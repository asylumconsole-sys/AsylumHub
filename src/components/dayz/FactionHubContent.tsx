import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { FACTION_FLAGS, flagImage, flagImageFallback, type FactionFlagId } from "@/lib/faction-flags";

const STORAGE = "asylumhub:faction-profile";

type Profile = {
  name: string;
  flag: string;
  map: "101x" | "102x";
  members: string[];
  balance?: number;
};

function FlagImg({ file, alt, className }: { file: string; alt: string; className?: string }) {
  const [src, setSrc] = useState(flagImage(file));
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => {
        if (src.includes("wiki.gg")) setSrc(flagImageFallback(file));
      }}
    />
  );
}

function flagOf(id: string) {
  return FACTION_FLAGS.find(([fid]) => fid === id) ?? FACTION_FLAGS[0];
}

export function FactionHubContent({ hideHeader = false }: { hideHeader?: boolean } = {}) {
  const [faction, setFaction] = useState<Profile | null>(null);
  const [name, setName] = useState("");
  const [flag, setFlag] = useState<FactionFlagId>(FACTION_FLAGS[0][0]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [memberDraft, setMemberDraft] = useState("");
  const [renameDraft, setRenameDraft] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE);
      if (raw) {
        const next = JSON.parse(raw) as Profile;
        setFaction(next);
        setRenameDraft(next.name);
        setFlag((next.flag as FactionFlagId) || FACTION_FLAGS[0][0]);
      }
    } catch {
      /* ignore */
    }
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
        <button type="button" onClick={() => setOpen(true)} className="rounded-full bg-[#d4a84b] px-5 py-2.5 text-sm font-semibold uppercase tracking-[0.16em] text-black">
          Create faction
        </button>
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
          <button
            type="button"
            disabled={!name.trim()}
            onClick={() => {
              save({ name: name.trim(), flag, map: "102x", members: [], balance: 0 });
              setOpen(false);
              toast.success(`Faction ${name.trim()} founded`);
            }}
            className="rounded-full bg-[#d4a84b] px-5 py-2.5 text-sm font-semibold uppercase tracking-[0.16em] text-black disabled:opacity-50"
          >
            Found · 10,000 CR
          </button>
        </div>
      )}

      {faction && !open ? (
        <div className="mx-auto max-w-md space-y-3 rounded-2xl border border-[#d4a84b]/20 p-4">
          <FlagImg file={flagOf(faction.flag)[2]} alt={flagOf(faction.flag)[1]} className="mx-auto size-14 object-contain" />
          <div className="font-display text-2xl text-[#e8c56a]">{faction.name}</div>
          <div className="text-xs uppercase tracking-wider text-zinc-500">{flagOf(faction.flag)[1]} · owner</div>
          <div className="font-mono text-sm text-[#e8c56a]">{(faction.balance ?? 0).toLocaleString()} CR faction wallet</div>
          <button type="button" onClick={() => { setEditing((v) => !v); setRenameDraft(faction.name); setFlag((faction.flag as FactionFlagId) || FACTION_FLAGS[0][0]); }} className="rounded-full border border-[#d4a84b]/40 px-5 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#e8c56a]">
            {editing ? "Close edit" : "Edit faction"}
          </button>
        </div>
      ) : null}

      {faction && editing ? (
        <div className="mx-auto max-w-xl space-y-4 rounded-2xl border border-[#d4a84b]/20 p-5 text-left">
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-[#d4a84b]">Change name · 1,000 CR</div>
            <div className="mt-2 flex gap-2">
              <Input value={renameDraft} onChange={(e) => setRenameDraft(e.target.value)} />
              <button
                type="button"
                onClick={() => {
                  if (!renameDraft.trim()) return;
                  if (!spend(1000, "rename")) return;
                  save({ ...faction, name: renameDraft.trim(), balance: Math.max(0, (faction.balance ?? 0) - 1000) });
                  toast.success("Name changed");
                }}
                className="rounded-lg bg-[#d4a84b] px-3 text-sm font-semibold text-black"
              >
                Save
              </button>
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
            <button
              type="button"
              onClick={() => {
                if (!spend(2000, "flag")) return;
                save({ ...faction, flag, balance: Math.max(0, (faction.balance ?? 0) - 2000) });
                toast.success("Flag changed");
              }}
              className="mt-2 rounded-lg bg-[#d4a84b] px-3 py-2 text-sm font-semibold text-black"
            >
              Apply flag
            </button>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-[#d4a84b]">Members</div>
            <div className="mt-2 flex gap-2">
              <Input value={memberDraft} onChange={(e) => setMemberDraft(e.target.value)} placeholder="Gamertag / Discord name" />
              <button
                type="button"
                onClick={() => {
                  const tag = memberDraft.trim();
                  if (!tag) return;
                  if (faction.members.includes(tag)) return toast.error("Already in roster");
                  save({ ...faction, members: [...faction.members, tag] });
                  setMemberDraft("");
                  toast.success(`Added ${tag}`);
                }}
                className="rounded-lg border border-[#d4a84b]/40 px-3 text-sm text-[#e8c56a]"
              >
                Add
              </button>
            </div>
            <div className="mt-2 space-y-1">
              {faction.members.length === 0 ? <div className="text-sm text-zinc-500">No members yet.</div> : null}
              {faction.members.map((member) => (
                <div key={member} className="flex items-center justify-between rounded-lg border border-white/10 px-3 py-2 text-sm">
                  <span>{member}</span>
                  <button type="button" onClick={() => { save({ ...faction, members: faction.members.filter((m) => m !== member) }); toast.success(`Removed ${member}`); }} className="text-xs uppercase tracking-wider text-red-300">Remove</button>
                </div>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              if (!window.confirm(`Disband ${faction.name}? This cannot be undone.`)) return;
              localStorage.removeItem(STORAGE);
              setFaction(null);
              setEditing(false);
              toast.success("Faction disbanded");
            }}
            className="w-full rounded-lg border border-red-500/40 px-3 py-2 text-sm text-red-300"
          >
            Disband faction
          </button>
        </div>
      ) : null}
    </div>
  );
}
