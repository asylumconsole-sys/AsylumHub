import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { FACTION_FLAGS, flagImage, flagImageFallback, type FactionFlagId } from "@/lib/faction-flags";

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
  { id: "first-blood", title: "First Blood", detail: "Open Intel and claim First Blood", reward: 5 },
  { id: "roster-2", title: "Brothers in Arms", detail: "Add 2 members to the roster", reward: 8 },
  { id: "hold-gorka", title: "Hold Gorka", detail: "Claim Gorka on the Intel territory board", reward: 12 },
  { id: "warpath", title: "Warpath", detail: "Claim the Warpath weekly on Intel", reward: 20 },
];

export function FactionHubContent({ hideHeader = false }: { hideHeader?: boolean } = {}) {
  const [faction, setFaction] = useState<Profile | null>(null);
  const [name, setName] = useState("");
  const [flag, setFlag] = useState<FactionFlagId>(FACTION_FLAGS[0][0]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [tab, setTab] = useState<"roster" | "rep" | "missions" | "recruit">("roster");
  const [memberDraft, setMemberDraft] = useState("");
  const [renameDraft, setRenameDraft] = useState("");
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

  return (
    <div className="mx-auto max-w-3xl space-y-6 text-center">
      {!hideHeader ? (
        <div>
          <div className="text-[10px] uppercase tracking-[0.28em] text-[#d4a84b]/80">War Room</div>
          <h2 className="font-display text-3xl text-[#e8c56a]">{faction?.name || "Found a faction"}</h2>
        </div>
      ) : null}

      {!faction && !open ? (
        <button type="button" onClick={() => setOpen(true)} className="rounded-full bg-[#d4a84b] px-5 py-2.5 text-sm font-semibold uppercase tracking-[0.16em] text-black">Create faction</button>
      ) : null}

      {(!faction || open) && (
        <div className="mx-auto max-w-xl space-y-4">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Faction name" className="mx-auto text-center" />
          <div className="mx-auto grid max-w-2xl grid-cols-4 justify-items-center gap-2 sm:grid-cols-6 md:grid-cols-8">
            {FACTION_FLAGS.map(([id, label, file]) => (
              <button key={id} type="button" title={label} onClick={() => setFlag(id)} className={`flex w-full flex-col items-center rounded-xl border p-1.5 ${flag === id ? "border-[#d4a84b] bg-[#d4a84b]/10" : "border-white/10"}`}>
                <FlagImg file={file} alt={label} className="size-10 object-contain" />
                <div className="mt-1 w-full truncate text-center text-[9px] uppercase tracking-wide text-zinc-400">{label}</div>
              </button>
            ))}
          </div>
          <button type="button" disabled={!name.trim()} onClick={() => { save({ name: name.trim(), flag, map: "102x", members: [], balance: 0, reputation: 0, missionsDone: [] }); setOpen(false); toast.success(`Faction ${name.trim()} founded`); }} className="rounded-full bg-[#d4a84b] px-5 py-2.5 text-sm font-semibold uppercase tracking-[0.16em] text-black disabled:opacity-50">Found · 10,000 CR</button>
        </div>
      )}

      {faction && !open ? (
        <div className="mx-auto max-w-md space-y-3 rounded-2xl border border-[#d4a84b]/20 p-4">
          <FlagImg file={flagOf(faction.flag)[2]} alt={flagOf(faction.flag)[1]} className="mx-auto size-14 object-contain" />
          <div className="font-display text-2xl text-[#e8c56a]">{faction.name}</div>
          <div className="text-xs uppercase tracking-wider text-zinc-500">{flagOf(faction.flag)[1]} · owner · rep {faction.reputation ?? 0}</div>
          <div className="font-mono text-sm text-[#e8c56a]">{(faction.balance ?? 0).toLocaleString()} CR faction wallet</div>
          <div className="flex flex-wrap justify-center gap-2">
            {(["roster", "rep", "missions", "recruit"] as const).map((id) => (
              <button key={id} type="button" onClick={() => setTab(id)} className={`rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.16em] ${tab === id ? "border-[#d4a84b] text-[#e8c56a]" : "border-white/10 text-zinc-500"}`}>{id}</button>
            ))}
          </div>
          <button type="button" onClick={() => { setEditing((v) => !v); setRenameDraft(faction.name); setFlag((faction.flag as FactionFlagId) || FACTION_FLAGS[0][0]); }} className="rounded-full border border-[#d4a84b]/40 px-5 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#e8c56a]">{editing ? "Close edit" : "Edit faction"}</button>
        </div>
      ) : null}

      {faction && tab === "roster" ? (
        <div className="mx-auto max-w-xl space-y-2 rounded-2xl border border-white/10 p-4 text-left">
          <div className="text-[10px] uppercase tracking-[0.18em] text-[#d4a84b]">Members list</div>
          <div className="text-sm text-zinc-400">Owner plus {faction.members.length} fighters.</div>
          {faction.members.map((member) => (
            <div key={member} className="flex items-center justify-between rounded-lg border border-white/10 px-3 py-2 text-sm">
              <span>{member}</span>
              <button type="button" onClick={() => save({ ...faction, members: faction.members.filter((m) => m !== member) })} className="text-xs text-red-300">Remove</button>
            </div>
          ))}
          {!faction.members.length ? <div className="text-sm text-zinc-500">Roster empty. Add names in Edit.</div> : null}
        </div>
      ) : null}

      {faction && tab === "rep" ? (
        <div className="mx-auto max-w-xl space-y-2 rounded-2xl border border-white/10 p-4 text-left text-sm text-zinc-300">
          <div className="text-[10px] uppercase tracking-[0.18em] text-[#d4a84b]">Faction reputation</div>
          <div className="font-display text-4xl text-[#e8c56a]">{faction.reputation ?? 0}</div>
          <p>Rep rises when missions are marked done. It is how other crews read you on the board.</p>
        </div>
      ) : null}

      {faction && tab === "missions" ? (
        <div className="mx-auto max-w-xl space-y-2 rounded-2xl border border-white/10 p-4 text-left">
          <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-[#d4a84b]">
            <span>Faction missions</span>
            <Link to="/intel" className="text-[#e8c56a]">Intel desk</Link>
          </div>
          {MISSIONS.map((m) => {
            const done = (faction.missionsDone ?? []).includes(m.id);
            return (
              <div key={m.id} className="flex items-center justify-between rounded-lg border border-white/10 px-3 py-2 text-sm">
                <div>
                  <div className="font-medium">{m.title}</div>
                  <div className="text-[11px] text-zinc-500">{m.detail} · +{m.reward} rep</div>
                </div>
                <button
                  type="button"
                  disabled={done}
                  onClick={() => {
                    save({ ...faction, reputation: (faction.reputation ?? 0) + m.reward, missionsDone: [...(faction.missionsDone ?? []), m.id] });
                    pushNote(`🟢 QUEST COMPLETED — ${m.title}`);
                    toast.success(`${m.title} logged`);
                  }}
                  className="rounded-full bg-[#d4a84b] px-3 py-1 text-xs font-semibold text-black disabled:opacity-40"
                >{done ? "Done" : "Complete"}</button>
              </div>
            );
          })}
        </div>
      ) : null}

      {faction && tab === "recruit" ? (
        <div className="mx-auto max-w-xl space-y-3 rounded-2xl border border-white/10 p-4 text-left">
          <div className="text-[10px] uppercase tracking-[0.18em] text-[#d4a84b]">Recruitment board</div>
          <textarea value={recruitText} onChange={(e) => setRecruitText(e.target.value)} className="h-20 w-full rounded-lg border border-white/10 bg-black/40 p-2 text-sm" />
          <button
            type="button"
            onClick={() => {
              const post: RecruitPost = { id: `${Date.now()}`, faction: faction.name, text: recruitText.trim(), at: new Date().toISOString() };
              const next = [post, ...board].slice(0, 20);
              setBoard(next);
              localStorage.setItem(RECRUIT_KEY, JSON.stringify(next));
              toast.success("Posted to recruitment board");
            }}
            className="rounded-full bg-[#d4a84b] px-4 py-2 text-xs font-semibold uppercase tracking-wider text-black"
          >Post opening</button>
          {board.map((p) => (
            <div key={p.id} className="rounded-lg border border-white/10 px-3 py-2 text-sm">
              <div className="font-medium text-[#e8c56a]">{p.faction}</div>
              <div className="text-zinc-300">{p.text}</div>
            </div>
          ))}
        </div>
      ) : null}

      {faction && editing ? (
        <div className="mx-auto max-w-xl space-y-4 rounded-2xl border border-[#d4a84b]/20 p-5 text-left">
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-[#d4a84b]">Change name · 1,000 CR</div>
            <div className="mt-2 flex gap-2">
              <Input value={renameDraft} onChange={(e) => setRenameDraft(e.target.value)} />
              <button type="button" onClick={() => { if (!renameDraft.trim() || !spend(1000, "rename")) return; save({ ...faction, name: renameDraft.trim(), balance: Math.max(0, (faction.balance ?? 0) - 1000) }); toast.success("Name changed"); }} className="rounded-lg bg-[#d4a84b] px-3 text-sm font-semibold text-black">Save</button>
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-[#d4a84b]">Change flag · 2,000 CR</div>
            <div className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-6">
              {FACTION_FLAGS.map(([id, label, file]) => (
                <button key={id} type="button" onClick={() => setFlag(id)} className={`rounded-xl border p-1.5 ${flag === id ? "border-[#d4a84b]" : "border-white/10"}`}>
                  <FlagImg file={file} alt={label} className="mx-auto size-8 object-contain" />
                </button>
              ))}
            </div>
            <button type="button" onClick={() => { if (!spend(2000, "flag")) return; save({ ...faction, flag, balance: Math.max(0, (faction.balance ?? 0) - 2000) }); toast.success("Flag changed"); }} className="mt-2 rounded-lg bg-[#d4a84b] px-3 py-2 text-sm font-semibold text-black">Apply flag</button>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-[#d4a84b]">Add / remove members</div>
            <div className="mt-2 flex gap-2">
              <Input value={memberDraft} onChange={(e) => setMemberDraft(e.target.value)} placeholder="Gamertag / Discord name" />
              <button type="button" onClick={() => { const tag = memberDraft.trim(); if (!tag) return; if (faction.members.includes(tag)) return toast.error("Already in roster"); save({ ...faction, members: [...faction.members, tag] }); setMemberDraft(""); toast.success(`Added ${tag}`); }} className="rounded-lg border border-[#d4a84b]/40 px-3 text-sm text-[#e8c56a]">Add</button>
            </div>
          </div>
          <button type="button" onClick={() => { if (!window.confirm(`Disband ${faction.name}? This cannot be undone.`)) return; localStorage.removeItem(STORAGE); setFaction(null); setEditing(false); toast.success("Faction disbanded"); }} className="w-full rounded-lg border border-red-500/40 px-3 py-2 text-sm text-red-300">Disband faction</button>
        </div>
      ) : null}
    </div>
  );
}
