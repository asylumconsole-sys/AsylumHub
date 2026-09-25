import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useMutation } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { FACTION_FLAGS, flagImage, flagImageFallback, type FactionFlagId } from "@/lib/faction-flags";
import { applyFactionRoleStyle } from "@/lib/faction-style.functions";
import { SurvivorIdCard } from "@/components/dayz/SurvivorIdCard";

const STORAGE = "asylumhub:faction-profile";
const RECRUIT_KEY = "asylumhub:faction-recruits";

type Profile = {
  name: string;
  flag: string;
  map: "101x" | "102x";
  members: string[];
  balance?: number;
  reputation?: number;
  missionsDone?: string[];
  banner?: string;
  description?: string;
  roleMode?: "solid" | "gradient" | "holographic";
  rolePrimary?: string;
};

type RecruitPost = { id: string; faction: string; text: string; at: string };

function FlagImg({ file, alt, className }: { file: string; alt: string; className?: string }) {
  const [src, setSrc] = useState(flagImage(file));
  return <img src={src} alt={alt} className={className} onError={() => { if (src.includes("wiki.gg")) setSrc(flagImageFallback(file)); }} />;
}
function flagOf(id: string) {
  return FACTION_FLAGS.find(([fid]) => fid === id) ?? FACTION_FLAGS[0];
}
function pushNote(text: string) {
  try {
    const raw = JSON.parse(localStorage.getItem("asylumhub:notifs") || "[]") as { id: string; text: string; at: string }[];
    raw.unshift({ id: `${Date.now()}`, text, at: new Date().toISOString() });
    localStorage.setItem("asylumhub:notifs", JSON.stringify(raw.slice(0, 40)));
    window.dispatchEvent(new Event("asylumhub:notifs"));
  } catch { /* ignore */ }
}

const MISSIONS = [
  { id: "first-blood", title: "First Blood", detail: "Claim First Blood on Intel", reward: 5 },
  { id: "roster-2", title: "Brothers in Arms", detail: "Two names on the roster", reward: 8 },
  { id: "hold-gorka", title: "Hold Gorka", detail: "Claim Gorka on Intel", reward: 12 },
  { id: "warpath", title: "Warpath", detail: "Claim Warpath weekly", reward: 20 },
];

export function FactionHubContent({ hideHeader = false }: { hideHeader?: boolean } = {}) {
  const [faction, setFaction] = useState<Profile | null>(null);
  const [name, setName] = useState("");
  const [flag, setFlag] = useState<FactionFlagId>(FACTION_FLAGS[0][0]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [tab, setTab] = useState<"live" | "roster" | "rep" | "missions" | "recruit">("live");
  const [memberDraft, setMemberDraft] = useState("");
  const [renameDraft, setRenameDraft] = useState("");
  const [bannerDraft, setBannerDraft] = useState("");
  const [descDraft, setDescDraft] = useState("");
  const [roleMode, setRoleMode] = useState<"solid" | "gradient" | "holographic">("solid");
  const [primary, setPrimary] = useState("#d4a84b");
  const [secondary, setSecondary] = useState("#7c3aed");
  const [tertiary, setTertiary] = useState("#22d3ee");
  const [recruitText, setRecruitText] = useState("Need shooters. Livonia. No solo heroes.");
  const [board, setBoard] = useState<RecruitPost[]>(() => {
    try { return JSON.parse(localStorage.getItem(RECRUIT_KEY) || "[]"); } catch { return []; }
  });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE);
      if (raw) {
        const next = JSON.parse(raw) as Profile;
        setFaction(next);
        setRenameDraft(next.name);
        setBannerDraft(next.banner || "");
        setDescDraft(next.description || "");
        setRoleMode(next.roleMode || "solid");
        setPrimary(next.rolePrimary || "#d4a84b");
        setFlag((next.flag as FactionFlagId) || FACTION_FLAGS[0][0]);
      }
    } catch { /* ignore */ }
  }, []);

  const save = (next: Profile) => {
    setFaction(next);
    localStorage.setItem(STORAGE, JSON.stringify(next));
  };
  const spend = (cost: number, label: string) => {
    if (!faction) return false;
    const balance = faction.balance ?? 0;
    if (balance < cost) {
      toast.error(`Need ${cost.toLocaleString()} CR in the faction wallet for ${label}`);
      return false;
    }
    save({ ...faction, balance: balance - cost });
    return true;
  };

  const roleMut = useMutation({
    mutationFn: () => applyFactionRoleStyle({ data: { factionName: faction?.name || "", mode: roleMode, primary, secondary, tertiary } }),
    onSuccess: (res) => {
      if (!faction) return;
      save({ ...faction, roleMode, rolePrimary: primary });
      pushNote(`🏆 NEW PERSONAL RECORD — Discord role ${res.name} restyled`);
      toast.success(`Pro AI updated ${res.name}`);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Role update failed"),
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {!hideHeader ? (
        <div className="text-center">
          <div className="text-[10px] uppercase tracking-[0.28em] text-[#d4a84b]/80">War Room</div>
          <h2 className="font-display text-3xl text-[#e8c56a]">{faction?.name || "Found a faction"}</h2>
        </div>
      ) : null}

      {faction?.banner ? (
        <div className="relative h-40 overflow-hidden rounded-3xl border border-[#d4a84b]/30">
          <img src={faction.banner} alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
          <div className="absolute bottom-3 left-4 font-display text-2xl text-[#e8c56a]">{faction.name}</div>
        </div>
      ) : null}

      {!faction && !open ? (
        <div className="text-center">
          <button type="button" onClick={() => setOpen(true)} className="rounded-full bg-[#d4a84b] px-5 py-2.5 text-sm font-semibold uppercase tracking-[0.16em] text-black">Create faction</button>
        </div>
      ) : null}

      {(!faction || open) && (
        <div className="mx-auto max-w-xl space-y-4 text-center">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Faction name" className="mx-auto text-center" />
          <div className="mx-auto grid max-w-2xl grid-cols-4 justify-items-center gap-2 sm:grid-cols-6 md:grid-cols-8">
            {FACTION_FLAGS.map(([id, label, file]) => (
              <button key={id} type="button" title={label} onClick={() => setFlag(id)} className={`flex w-full flex-col items-center rounded-xl border p-1.5 ${flag === id ? "border-[#d4a84b] bg-[#d4a84b]/10" : "border-white/10"}`}>
                <FlagImg file={file} alt={label} className="size-10 object-contain" />
              </button>
            ))}
          </div>
          <button type="button" disabled={!name.trim()} onClick={() => { save({ name: name.trim(), flag, map: "102x", members: [], balance: 5000, reputation: 0, missionsDone: [] }); setOpen(false); toast.success(`Faction ${name.trim()} founded`); }} className="rounded-full bg-[#d4a84b] px-5 py-2.5 text-sm font-semibold uppercase tracking-[0.16em] text-black disabled:opacity-50">Found</button>
        </div>
      )}

      {faction && !open ? (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div className="flex flex-wrap justify-center gap-2">
            {(["live", "roster", "rep", "missions", "recruit"] as const).map((id) => (
              <button key={id} type="button" onClick={() => setTab(id)} className={`rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.16em] ${tab === id ? "border-[#d4a84b] text-[#e8c56a]" : "border-white/10 text-zinc-500"}`}>{id}</button>
            ))}
          </div>
          <div className="text-center text-xs uppercase tracking-wider text-zinc-500">{flagOf(faction.flag)[1]} · owner · rep {faction.reputation ?? 0} · {(faction.balance ?? 0).toLocaleString()} CR</div>
          <div className="text-center">
            <button type="button" onClick={() => setEditing((v) => !v)} className="rounded-full border border-[#d4a84b]/40 px-5 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#e8c56a]">{editing ? "Close edit" : "Edit faction"}</button>
          </div>
        </motion.div>
      ) : null}

      {faction && tab === "live" ? (
        <div className="grid gap-4 md:grid-cols-2">
          <SurvivorIdCard factionName={faction.name} reputation={faction.reputation} />
          <div className="space-y-3 rounded-3xl border border-white/10 p-5">
            <div className="text-[10px] uppercase tracking-[0.18em] text-[#d4a84b]">Public brief</div>
            <p className="text-sm text-zinc-300">{faction.description || "No public description yet. Add one in Edit."}</p>
            <div className="text-[10px] uppercase tracking-[0.18em] text-[#d4a84b]">Weekly / monthly</div>
            <Link to="/intel" className="block rounded-xl border border-[#d4a84b]/20 px-3 py-2 text-sm text-[#e8c56a]">Open Intel challenges</Link>
            <div className="text-xs text-zinc-500">Longest shot, Warpath, Blood Week and memorials live on the desk. Bell fires when you claim them.</div>
          </div>
        </div>
      ) : null}

      {faction && tab === "roster" ? (
        <div className="space-y-2 rounded-2xl border border-white/10 p-4">
          {faction.members.map((member) => (
            <div key={member} className="flex items-center justify-between rounded-lg border border-white/10 px-3 py-2 text-sm">
              <span>{member}</span>
              <span className="text-[10px] uppercase tracking-wider text-zinc-500">active</span>
            </div>
          ))}
          {!faction.members.length ? <div className="text-sm text-zinc-500">Private activity empty. Add members in Edit.</div> : null}
        </div>
      ) : null}

      {faction && tab === "rep" ? (
        <div className="rounded-2xl border border-white/10 p-5">
          <div className="font-display text-5xl text-[#e8c56a]">{faction.reputation ?? 0}</div>
          <p className="mt-2 text-sm text-zinc-400">Reputation moves when missions complete. Trusted starts at 40.</p>
        </div>
      ) : null}

      {faction && tab === "missions" ? (
        <div className="space-y-2 rounded-2xl border border-white/10 p-4">
          {MISSIONS.map((m) => {
            const done = (faction.missionsDone ?? []).includes(m.id);
            return (
              <div key={m.id} className="flex items-center justify-between rounded-lg border border-white/10 px-3 py-2 text-sm">
                <div>
                  <div className="font-medium">{m.title}</div>
                  <div className="text-[11px] text-zinc-500">{m.detail}</div>
                </div>
                <button type="button" disabled={done} onClick={() => { save({ ...faction, reputation: (faction.reputation ?? 0) + m.reward, missionsDone: [...(faction.missionsDone ?? []), m.id] }); pushNote(`🟢 QUEST COMPLETED — ${m.title}`); toast.success(m.title); }} className="rounded-full bg-[#d4a84b] px-3 py-1 text-xs font-semibold text-black disabled:opacity-40">{done ? "Done" : "Complete"}</button>
              </div>
            );
          })}
        </div>
      ) : null}

      {faction && tab === "recruit" ? (
        <div className="space-y-3 rounded-2xl border border-white/10 p-4">
          <textarea value={recruitText} onChange={(e) => setRecruitText(e.target.value)} className="h-20 w-full rounded-lg border border-white/10 bg-black/40 p-2 text-sm" />
          <button type="button" onClick={() => { const post = { id: `${Date.now()}`, faction: faction.name, text: recruitText.trim(), at: new Date().toISOString() }; const next = [post, ...board].slice(0, 20); setBoard(next); localStorage.setItem(RECRUIT_KEY, JSON.stringify(next)); toast.success("Posted"); }} className="rounded-full bg-[#d4a84b] px-4 py-2 text-xs font-semibold uppercase tracking-wider text-black">Post opening</button>
          {board.map((p) => (
            <div key={p.id} className="rounded-lg border border-white/10 px-3 py-2 text-sm">
              <div className="font-medium text-[#e8c56a]">{p.faction}</div>
              <div>{p.text}</div>
            </div>
          ))}
        </div>
      ) : null}

      {faction && editing ? (
        <div className="space-y-5 rounded-3xl border border-[#d4a84b]/20 p-5">
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-[#d4a84b]">Public description</div>
            <textarea value={descDraft} onChange={(e) => setDescDraft(e.target.value)} className="mt-2 h-20 w-full rounded-lg border border-white/10 bg-black/40 p-2 text-sm" />
            <button type="button" onClick={() => { save({ ...faction, description: descDraft }); toast.success("Description saved"); }} className="mt-2 rounded-lg bg-[#d4a84b] px-3 py-1.5 text-sm font-semibold text-black">Save copy</button>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-[#d4a84b]">Faction banner URL</div>
            <Input className="mt-2" value={bannerDraft} onChange={(e) => setBannerDraft(e.target.value)} placeholder="https://..." />
            <button type="button" onClick={() => { save({ ...faction, banner: bannerDraft.trim() }); toast.success("Banner set"); }} className="mt-2 rounded-lg bg-[#d4a84b] px-3 py-1.5 text-sm font-semibold text-black">Apply banner</button>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-[#d4a84b]">Customize Discord role · 5,000 CR</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {(["solid", "gradient", "holographic"] as const).map((m) => (
                <button key={m} type="button" onClick={() => setRoleMode(m)} className={`rounded-full border px-3 py-1 text-xs uppercase ${roleMode === m ? "border-[#d4a84b] text-[#e8c56a]" : "border-white/10 text-zinc-500"}`}>{m}</button>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <label className="text-xs text-zinc-400">Primary <input type="color" value={primary} onChange={(e) => setPrimary(e.target.value)} className="ml-2 h-8 w-12 bg-transparent" /></label>
              {roleMode !== "solid" ? <label className="text-xs text-zinc-400">Secondary <input type="color" value={secondary} onChange={(e) => setSecondary(e.target.value)} className="ml-2 h-8 w-12 bg-transparent" /></label> : null}
              {roleMode === "holographic" ? <label className="text-xs text-zinc-400">Holo <input type="color" value={tertiary} onChange={(e) => setTertiary(e.target.value)} className="ml-2 h-8 w-12 bg-transparent" /></label> : null}
            </div>
            <div className="mt-3 h-10 rounded-full" style={{ background: roleMode === "solid" ? primary : `linear-gradient(90deg, ${primary}, ${secondary}${roleMode === "holographic" ? `, ${tertiary}` : ""})` }} />
            <button type="button" disabled={roleMut.isPending} onClick={() => { if (!spend(5000, "Discord role")) return; roleMut.mutate(); }} className="mt-3 rounded-full bg-[#d4a84b] px-4 py-2 text-xs font-semibold uppercase tracking-wider text-black disabled:opacity-50">{roleMut.isPending ? "Talking to Pro AI…" : "Apply to Discord · 5k"}</button>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-[#d4a84b]">Change name · 1,000 CR</div>
            <div className="mt-2 flex gap-2">
              <Input value={renameDraft} onChange={(e) => setRenameDraft(e.target.value)} />
              <button type="button" onClick={() => { if (!renameDraft.trim() || !spend(1000, "rename")) return; save({ ...faction, name: renameDraft.trim(), balance: Math.max(0, (faction.balance ?? 0) - 1000) }); toast.success("Name changed"); }} className="rounded-lg bg-[#d4a84b] px-3 text-sm font-semibold text-black">Save</button>
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-[#d4a84b]">Members</div>
            <div className="mt-2 flex gap-2">
              <Input value={memberDraft} onChange={(e) => setMemberDraft(e.target.value)} placeholder="Gamertag" />
              <button type="button" onClick={() => { const tag = memberDraft.trim(); if (!tag) return; save({ ...faction, members: [...faction.members, tag] }); setMemberDraft(""); }} className="rounded-lg border border-[#d4a84b]/40 px-3 text-sm text-[#e8c56a]">Add</button>
            </div>
          </div>
          <button type="button" onClick={() => { if (!window.confirm(`Disband ${faction.name}?`)) return; localStorage.removeItem(STORAGE); setFaction(null); setEditing(false); }} className="w-full rounded-lg border border-red-500/40 px-3 py-2 text-sm text-red-300">Disband</button>
        </div>
      ) : null}
    </div>
  );
}
