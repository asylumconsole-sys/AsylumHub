import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { GlassPanel } from "@/components/ui-custom/GlassPanel";
import { getKillfeed } from "@/lib/killfeed.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/intel")({ component: IntelPage });

const ZONES = ["Zelenogorsk", "Gorka", "Berezino", "Electro", "Cherno", "NWAF", "Tisy", "Kamensk", "Livonia Airfield", "Bielawa"];
const QUEST_DEFS = [
  { id: "first-blood", title: "First Blood", kind: "Main", detail: "1 kill on the 5-day feed", test: (k: number) => k >= 1, reward: 2500 },
  { id: "hattrick", title: "Three Bodies", kind: "Daily", detail: "3 kills on the feed", test: (k: number) => k >= 3, reward: 5000 },
  { id: "distance", title: "Long Shot", kind: "Hidden", detail: "A kill past 200m", test: (_k: number, maxD: number) => maxD >= 200, reward: 7500 },
  { id: "warpath", title: "Warpath", kind: "Weekly", detail: "10 kills", test: (k: number) => k >= 10, reward: 15000 },
  { id: "community", title: "Blood Week", kind: "Community", detail: "25 kills on the shared feed", test: (k: number) => k >= 25, reward: 25000 },
  { id: "chain", title: "Debt Collector", kind: "Chain", detail: "Claim First Blood first, then 3 bodies", test: (k: number) => k >= 3, reward: 8000 },
];

function IntelPage() {
  const feedQ = useQuery({ queryKey: ["killfeed-intel"], queryFn: () => getKillfeed({ data: { server: "all", limit: 400 } }) });
  const events = feedQ.data?.events ?? [];
  const [lastWords, setLastWords] = useState(() => localStorage.getItem("asylumhub:last-words") || "");
  const [claimed, setClaimed] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("asylumhub:territory") || "[]"); } catch { return []; }
  });
  const [doneQuests, setDoneQuests] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("asylumhub:quests") || "[]"); } catch { return []; }
  });
  const [lookup, setLookup] = useState("");

  const weapons = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of events) map.set(e.weapon || "Unknown", (map.get(e.weapon || "Unknown") || 0) + 1);
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [events]);
  const hours = useMemo(() => {
    const map = new Map<number, number>();
    for (const e of events) {
      const h = new Date(e.at).getHours();
      if (Number.isFinite(h)) map.set(h, (map.get(h) || 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1])[0];
  }, [events]);
  const maxDist = Math.max(0, ...events.map((e) => e.distance ?? 0));
  const streak = useMemo(() => {
    const byKiller = new Map<string, number>();
    for (const e of events) byKiller.set(e.killer, (byKiller.get(e.killer) || 0) + 1);
    return [...byKiller.entries()].sort((a, b) => b[1] - a[1])[0];
  }, [events]);
  const memorials = useMemo(() => {
    const deaths = new Map<string, number>();
    for (const e of events) deaths.set(e.victim, (deaths.get(e.victim) || 0) + 1);
    return [...deaths.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [events]);
  const intel = useMemo(() => {
    if (events.length < 3) return null;
    const window = events.slice(0, 12);
    return {
      when: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      deaths: window.length,
      players: new Set(window.flatMap((e) => [e.killer, e.victim])).size,
      topWeapon: weapons[0]?.[0] || "unknown",
    };
  }, [events, weapons]);
  const timeline = useMemo(() => {
    const q = lookup.trim().toLowerCase();
    if (!q) return events.slice(0, 12);
    return events.filter((e) => e.killer.toLowerCase().includes(q) || e.victim.toLowerCase().includes(q)).slice(0, 20);
  }, [events, lookup]);

  const claim = (zone: string) => {
    const held = claimed.includes(zone);
    const next = held ? claimed.filter((z) => z !== zone) : [...claimed, zone];
    setClaimed(next);
    localStorage.setItem("asylumhub:territory", JSON.stringify(next));
    pushNote(held ? `⚑ Released ${zone}` : `⚔️ YOUR FACTION IS UNDER ATTACK — claimed ${zone}`);
    toast.success(held ? `Released ${zone}` : `Claimed ${zone}`);
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="text-[10px] uppercase tracking-[0.22em] text-[#d4a84b]">World intelligence</div>
        <h1 className="font-display text-3xl text-[#e8c56a]">Intel Desk</h1>
      </div>
      {intel ? (
        <GlassPanel className="border-[#d4a84b]/30 p-5">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#d4a84b]">Intelligence report — {intel.when}</div>
          <p className="mt-2 text-sm text-zinc-300">Heavy combat on the last feed window. {intel.players} players involved. {intel.deaths} confirmed deaths. Dominant weapon {intel.topWeapon}.</p>
          <p className="mt-2 text-sm text-zinc-400">Regional alert — activity is clustered. Treat the last 3 hours as hot.</p>
        </GlassPanel>
      ) : null}

      <GlassPanel className="p-5">
        <h2 className="font-display text-xl">Death certificates</h2>
        <input value={lookup} onChange={(e) => setLookup(e.target.value)} placeholder="Filter by killer or victim" className="mt-3 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm" />
        <div className="mt-3 space-y-2">
          {timeline.map((e) => (
            <div key={e.id} className="rounded-lg border border-white/10 px-3 py-2 text-sm">
              <div className="font-medium">{e.victim} killed by {e.killer}</div>
              <div className="text-[11px] text-zinc-500">{e.weapon || "unknown weapon"} · {e.distance ?? "?"}m · {e.server} · {e.at}</div>
              {lastWords ? <div className="mt-1 text-[11px] italic text-zinc-400">Last words on file: {lastWords}</div> : null}
            </div>
          ))}
          {!events.length ? <div className="text-sm text-zinc-500">No deaths in the last 5 days of killfeed.</div> : null}
        </div>
        <label className="mt-4 block text-xs uppercase tracking-wider text-zinc-500">Last words</label>
        <textarea value={lastWords} onChange={(ev) => { setLastWords(ev.target.value); localStorage.setItem("asylumhub:last-words", ev.target.value); }} className="mt-1 h-20 w-full rounded-lg border border-white/10 bg-black/40 p-2 text-sm" placeholder="Optional message shown on certificates" />
      </GlassPanel>

      <div className="grid gap-4 md:grid-cols-2">
        <GlassPanel className="p-5">
          <h2 className="font-display text-xl">Analytics</h2>
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <Stat label="Kills logged" value={events.length} />
            <Stat label="Longest shot" value={`${Math.round(maxDist)}m`} />
            <Stat label="Top weapon" value={weapons[0]?.[0] || "—"} />
            <Stat label="Hottest killer" value={streak ? `${streak[0]} x${streak[1]}` : "—"} />
            <Stat label="Hottest hour" value={hours ? `${hours[0]}:00` : "—"} />
            <Stat label="Zones held" value={claimed.length} />
          </div>
        </GlassPanel>
        <GlassPanel className="p-5">
          <h2 className="font-display text-xl">Territory</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {ZONES.map((z) => (
              <button key={z} type="button" onClick={() => claim(z)} className={`rounded-full border px-3 py-1 text-xs ${claimed.includes(z) ? "border-[#d4a84b] bg-[#d4a84b]/20 text-[#e8c56a]" : "border-white/15 text-zinc-400"}`}>{z}</button>
            ))}
          </div>
        </GlassPanel>
      </div>

      <GlassPanel className="p-5">
        <h2 className="font-display text-xl">Memorial</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {memorials.map(([name, n]) => (
            <div key={name} className="rounded-lg border border-white/10 px-3 py-2 text-sm">
              <div className="font-medium">{name}</div>
              <div className="text-[11px] text-zinc-500">{n} recorded deaths on the feed</div>
            </div>
          ))}
          {!memorials.length ? <div className="text-sm text-zinc-500">No names yet.</div> : null}
        </div>
      </GlassPanel>

      <GlassPanel className="p-5">
        <h2 className="font-display text-xl">Quests</h2>
        <div className="mt-3 space-y-2">
          {QUEST_DEFS.map((q) => {
            const ready = q.id === "chain" ? doneQuests.includes("first-blood") && q.test(events.length, maxDist) : q.test(events.length, maxDist);
            const done = doneQuests.includes(q.id);
            return (
              <div key={q.id} className="flex items-center justify-between rounded-lg border border-white/10 px-3 py-2 text-sm">
                <div>
                  <div className="font-medium">{q.title} · {q.kind}</div>
                  <div className="text-[11px] text-zinc-500">{q.detail} · {q.reward.toLocaleString()} CR</div>
                </div>
                <button type="button" disabled={!ready || done} onClick={() => {
                  const next = [...doneQuests, q.id];
                  setDoneQuests(next);
                  localStorage.setItem("asylumhub:quests", JSON.stringify(next));
                  pushNote(`🟢 QUEST COMPLETED — ${q.title}`);
                  toast.success(`${q.title} complete`);
                }} className="rounded-full bg-[#d4a84b] px-3 py-1 text-xs font-semibold text-black disabled:opacity-40">{done ? "Done" : ready ? "Claim" : "Locked"}</button>
              </div>
            );
          })}
        </div>
      </GlassPanel>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-white/10 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}

function pushNote(text: string) {
  try {
    const raw = JSON.parse(localStorage.getItem("asylumhub:notifs") || "[]") as { id: string; text: string; at: string }[];
    raw.unshift({ id: `${Date.now()}`, text, at: new Date().toISOString() });
    localStorage.setItem("asylumhub:notifs", JSON.stringify(raw.slice(0, 40)));
    window.dispatchEvent(new Event("asylumhub:notifs"));
  } catch { /* ignore */ }
}
