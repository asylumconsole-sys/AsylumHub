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

export function FactionHubContent() {
  const [faction, setFaction] = useState<Profile | null>(null);
  const [name, setName] = useState("");
  const [flag, setFlag] = useState<FactionFlagId>(FACTION_FLAGS[0][0]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE);
      if (raw) setFaction(JSON.parse(raw) as Profile);
    } catch {
      /* ignore */
    }
  }, []);

  const save = (next: Profile) => {
    setFaction(next);
    localStorage.setItem(STORAGE, JSON.stringify(next));
  };

  const selected = flagOf(flag);

  return (
    <div className="mx-auto max-w-3xl space-y-6 text-center">
      <div>
        <div className="text-[10px] uppercase tracking-[0.28em] text-[#d4a84b]/80">War Room</div>
        <h2 className="font-display text-3xl text-[#e8c56a]">{faction?.name || "Found a faction"}</h2>
      </div>

      {!faction && !open ? (
        <button type="button" onClick={() => setOpen(true)} className="rounded-full bg-[#d4a84b] px-5 py-2.5 text-sm font-semibold uppercase tracking-[0.16em] text-black">
          Create faction
        </button>
      ) : null}

      {(!faction || open) && (
        <div className="mx-auto max-w-xl space-y-4">
          <div>
            <div className="mb-1 text-xs uppercase tracking-wider text-zinc-500">Faction name</div>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Faction name" className="mx-auto text-center" />
          </div>
          <div>
            <div className="mb-2 text-xs uppercase tracking-wider text-zinc-500">Choose your flag</div>
            <div className="mx-auto grid max-w-2xl grid-cols-4 justify-items-center gap-2 sm:grid-cols-6 md:grid-cols-8">
              {FACTION_FLAGS.map(([id, label, file]) => (
                <button
                  key={id}
                  type="button"
                  title={label}
                  onClick={() => setFlag(id)}
                  className={`flex w-full flex-col items-center rounded-xl border p-1.5 ${flag === id ? "border-[#d4a84b] bg-[#d4a84b]/10" : "border-white/10"}`}
                >
                  <FlagImg file={file} alt={label} className="size-10 object-contain" />
                  <div className="mt-1 w-full truncate text-center text-[9px] uppercase tracking-wide text-zinc-400">{label}</div>
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col items-center gap-3">
            <FlagImg file={selected[2]} alt={selected[1]} className="size-16 object-contain" />
            <button
              type="button"
              disabled={!name.trim()}
              onClick={() => {
                save({ name: name.trim(), flag, map: "102x", members: [] });
                setOpen(false);
                toast.success(`Faction ${name.trim()} founded`);
              }}
              className="rounded-full bg-[#d4a84b] px-5 py-2.5 text-sm font-semibold uppercase tracking-[0.16em] text-black disabled:opacity-50"
            >
              Found · 10,000 CR
            </button>
          </div>
        </div>
      )}

      {faction && !open ? (
        <div className="mx-auto max-w-md rounded-2xl border border-[#d4a84b]/20 p-4">
          <div className="flex flex-col items-center gap-2">
            <FlagImg file={flagOf(faction.flag)[2]} alt={flagOf(faction.flag)[1]} className="size-14 object-contain" />
            <div className="font-display text-2xl text-[#e8c56a]">{faction.name}</div>
            <div className="text-xs uppercase tracking-wider text-zinc-500">{flagOf(faction.flag)[1]}</div>
            <button type="button" onClick={() => setOpen(true)} className="text-xs uppercase tracking-[0.16em] text-[#d4a84b]">
              Change flag
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
