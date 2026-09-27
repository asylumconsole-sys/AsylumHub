import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { BRAND } from "@/lib/brand";
import { claimBattlepassReward, getBattlepass, grantBattlepassXp, unlockBattlepass } from "@/lib/battlepass.functions";

export const Route = createFileRoute("/_app/battlepass")({
  component: BattlepassPage,
  head: () => ({ meta: [{ title: `Battlepass \u2014 ${BRAND.name}` }] }),
});

const TIERS = [
  { level: 1, xp: 200, free: "500 cr", premium: "1,500 cr", freeCr: 500, premiumCr: 1500 },
  { level: 2, xp: 450, free: "Field notes", premium: "2,000 cr", freeCr: 0, premiumCr: 2000 },
  { level: 3, xp: 700, free: "750 cr", premium: "Gold tag", freeCr: 750, premiumCr: 0 },
  { level: 4, xp: 1000, free: "1,000 cr", premium: "3,500 cr", freeCr: 1000, premiumCr: 3500 },
  { level: 5, xp: 1400, free: "Scout title", premium: "5,000 cr", freeCr: 0, premiumCr: 5000 },
  { level: 6, xp: 1800, free: "1,250 cr", premium: "Night optic", freeCr: 1250, premiumCr: 0 },
  { level: 7, xp: 2300, free: "1,500 cr", premium: "7,500 cr", freeCr: 1500, premiumCr: 7500 },
  { level: 8, xp: 2900, free: "Pathfinder", premium: "10,000 cr", freeCr: 0, premiumCr: 10000 },
  { level: 9, xp: 3600, free: "2,000 cr", premium: "Season banner", freeCr: 2000, premiumCr: 0 },
  { level: 10, xp: 4500, free: "3,000 cr", premium: "20,000 cr", freeCr: 3000, premiumCr: 20000 },
];

const LESSONS = [
  { title: "Season track", body: "Season 1 has 10 tiers. Free rewards are open to everyone. Premium rewards need the 25,000 cr unlock." },
  { title: "How XP works", body: "Finish the tutorial, check in once a day, and clear the listed tasks. XP is saved to your Discord account, not this browser." },
  { title: "Claiming", body: "A tier unlocks when your XP bar reaches it. Claim pays credits into the same wallet the shop uses. Each reward can be claimed once." },
  { title: "Analytics", body: "The right side is your real season record: level, claimed rewards, credits earned, and XP from the last 7 days." },
];

type PassState = { xp: number; premium: boolean; claimed: string[]; days: Record<string, number> };

function BattlepassPage() {
  const { session } = useAuth();
  const [pass, setPass] = useState<PassState>({ xp: 0, premium: false, claimed: [], days: {} });
  const [lesson, setLesson] = useState(0);
  const [showTour, setShowTour] = useState(false);
  const [busy, setBusy] = useState(false);
  const token = session?.access_token ?? "";

  useEffect(() => {
    if (!token) return;
    getBattlepass({ data: { accessToken: token } }).then((row) => {
      setPass({ xp: row.xp ?? 0, premium: Boolean(row.premium), claimed: row.claimed ?? [], days: row.days ?? {} });
      if ((row.xp ?? 0) === 0) setShowTour(true);
    }).catch(() => setShowTour(true));
  }, [token]);

  const level = TIERS.filter((tier) => pass.xp >= tier.xp).length;
  const next = TIERS[level] ?? TIERS[TIERS.length - 1];
  const prevXp = TIERS[level - 1]?.xp ?? 0;
  const span = Math.max(1, next.xp - prevXp);
  const into = Math.min(100, Math.round(((pass.xp - prevXp) / span) * 100));
  const earned = TIERS.reduce((sum, tier) => sum + (pass.claimed.includes(`f${tier.level}`) ? tier.freeCr : 0) + (pass.claimed.includes(`p${tier.level}`) ? tier.premiumCr : 0), 0);
  const week = useMemo(() => Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    const key = date.toISOString().slice(0, 10);
    return { key: key.slice(5), xp: pass.days[key] ?? 0 };
  }), [pass.days]);
  const peak = Math.max(1, ...week.map((day) => day.xp));

  const earn = async (amount: number, reason: string) => {
    if (!token) return toast.error("Sign in with Discord first");
    setBusy(true);
    try {
      const row = await grantBattlepassXp({ data: { accessToken: token, amount, reason } });
      setPass(row);
      toast.success(`+${amount} XP`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save XP");
    } finally {
      setBusy(false);
    }
  };

  const claim = async (id: string, credits: number, premium: boolean) => {
    if (!token) return toast.error("Sign in with Discord first");
    setBusy(true);
    try {
      const row = await claimBattlepassReward({ data: { accessToken: token, id, credits, premium } });
      setPass(row);
      toast.success(credits ? `Claimed ${credits.toLocaleString("en-US")} cr` : "Reward claimed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not claim");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.28em] text-[#e8c56a]">Season 1</div>
          <h1 className="font-display mt-2 text-4xl">Battlepass</h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">Free track is open. Premium is 25,000 cr. No spark field, just the track, the tutorial, and your saved progress.</p>
        </div>
        <button type="button" onClick={() => setShowTour(true)} className="rounded-full border border-[#d4a84b]/40 px-4 py-2 text-xs uppercase tracking-[0.16em] text-[#e8c56a]">Tutorial</button>
      </header>

      <section className="rounded-2xl border border-[#d4a84b]/30 bg-black/60 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.16em] text-zinc-400">Level {level} / 10</div>
            <div className="mt-1 font-mono text-[#e8c56a]">{pass.xp.toLocaleString("en-US")} XP</div>
          </div>
          <div className="text-sm text-muted-foreground">{level >= 10 ? "Season complete" : `${next.xp - pass.xp} XP to level ${next.level}`}</div>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-[#d4a84b]" style={{ width: `${level >= 10 ? 100 : into}%` }} /></div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" disabled={busy} onClick={() => earn(100, "daily")} className="rounded-full bg-[#d4a84b] px-4 py-2 text-sm font-semibold text-black">Daily check-in +100 XP</button>
          <button type="button" disabled={busy || pass.premium} onClick={async () => {
            if (!token) return toast.error("Sign in with Discord first");
            setBusy(true);
            try { const row = await unlockBattlepass({ data: { accessToken: token } }); setPass(row); toast.success("Premium unlocked"); }
            catch (error) { toast.error(error instanceof Error ? error.message : "Could not unlock"); }
            finally { setBusy(false); }
          }} className="rounded-full border border-[#d4a84b]/40 px-4 py-2 text-sm text-[#e8c56a]">{pass.premium ? "Premium active" : "Unlock premium 25,000 cr"}</button>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <section className="space-y-2">
          {TIERS.map((tier) => {
            const open = pass.xp >= tier.xp;
            return (
              <article key={tier.level} className="grid gap-2 rounded-2xl border border-white/10 bg-black/50 p-4 md:grid-cols-[72px_1fr_1fr]">
                <div className="font-display text-2xl text-[#e8c56a]">{tier.level}</div>
                <Reward label="Free" name={tier.free} open={open} claimed={pass.claimed.includes(`f${tier.level}`)} onClaim={() => claim(`f${tier.level}`, tier.freeCr, false)} />
                <Reward label="Premium" name={tier.premium} open={open && pass.premium} locked={!pass.premium} claimed={pass.claimed.includes(`p${tier.level}`)} onClaim={() => claim(`p${tier.level}`, tier.premiumCr, true)} />
              </article>
            );
          })}
        </section>
        <aside className="space-y-3">
          <div className="rounded-2xl border border-white/10 bg-black/50 p-4">
            <div className="text-xs uppercase tracking-[0.16em] text-zinc-400">Analytics</div>
            <Stat label="Level" value={`${level}/10`} />
            <Stat label="Claimed" value={String(pass.claimed.length)} />
            <Stat label="Credits earned" value={earned.toLocaleString("en-US")} />
            <Stat label="Premium" value={pass.premium ? "Yes" : "No"} />
            <div className="mt-4 flex h-24 items-end gap-1">
              {week.map((day) => <div key={day.key} className="flex flex-1 flex-col items-center gap-1"><div className="w-full rounded-sm bg-[#d4a84b]" style={{ height: `${Math.max(4, (day.xp / peak) * 72)}px` }} /><span className="text-[10px] text-zinc-500">{day.key.slice(3)}</span></div>)}
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/50 p-4 text-sm text-muted-foreground">
            Tasks: daily check-in, finish the tutorial, claim a free tier. XP and claims stay on your Discord account.
          </div>
        </aside>
      </div>

      {showTour && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-black/70 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-[#d4a84b]/40 bg-black p-5">
            <div className="text-xs uppercase tracking-[0.16em] text-[#e8c56a]">Tutorial {lesson + 1} / {LESSONS.length}</div>
            <h2 className="font-display mt-2 text-3xl">{LESSONS[lesson].title}</h2>
            <p className="mt-3 text-sm leading-6 text-zinc-300">{LESSONS[lesson].body}</p>
            <div className="mt-5 flex justify-between gap-2">
              <button type="button" onClick={() => setLesson((value) => Math.max(0, value - 1))} className="rounded-full border border-white/10 px-4 py-2 text-sm">Back</button>
              {lesson < LESSONS.length - 1 ? (
                <button type="button" onClick={() => setLesson((value) => value + 1)} className="rounded-full bg-[#d4a84b] px-4 py-2 text-sm font-semibold text-black">Next</button>
              ) : (
                <button type="button" onClick={() => { setShowTour(false); earn(250, "tutorial"); }} className="rounded-full bg-[#d4a84b] px-4 py-2 text-sm font-semibold text-black">Finish +250 XP</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Reward({ label, name, open, claimed, locked, onClaim }: { label: string; name: string; open: boolean; claimed: boolean; locked?: boolean; onClaim: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 px-3 py-2">
      <div>
        <div className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">{label}</div>
        <div className="text-sm">{name}</div>
      </div>
      <button type="button" disabled={!open || claimed} onClick={onClaim} className="rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-[0.12em] disabled:opacity-40">{claimed ? "Claimed" : locked ? "Locked" : open ? "Claim" : "Locked"}</button>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="mt-3 flex items-center justify-between text-sm"><span className="text-zinc-400">{label}</span><span className="font-mono text-[#e8c56a]">{value}</span></div>;
}
