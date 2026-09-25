import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";

const PROFILE = "asylumhub:faction-profile";
const HQ = "asylumhub:faction-hq";

type Profile = { name: string; members: string[]; balance?: number; banner?: string; description?: string };
type Piece = { id: string; kind: string; x: number; z: number };
type Pad = { id: string; label: string; x: number; z: number };
type Msg = { id: string; from: string; text: string; at: string };
type HqState = {
  fileName: string;
  map: "livonia" | "chernarus";
  originX: number;
  originZ: number;
  zoom: number;
  pieces: Piece[];
  pads: Pad[];
  chat: Msg[];
};

const KINDS = [
  ["well", "Water well"],
  ["pump", "Water pump"],
  ["garden", "Garden house"],
  ["shed", "Shed"],
  ["watch", "Watchtower"],
  ["fence", "Fence kit"],
  ["tent", "Large tent"],
  ["med", "Medical tent"],
  ["garage", "Car tent"],
  ["flag", "Flag pole"],
] as const;

const SAT = {
  livonia: "https://static.xam.nu/dayz/maps/livonia/1.27/satellite/0/0/0.webp",
  chernarus: "https://static.xam.nu/dayz/maps/chernarusplus/1.27/satellite/0/0/0.webp",
} as const;
const WORLD = { livonia: 12800, chernarus: 15360 } as const;

function slugOwner(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9.]+/g, ".").replace(/^\.|\.$/g, "") || "owner";
}

function loadHq(owner: string): HqState {
  try {
    const raw = localStorage.getItem(HQ);
    if (raw) return JSON.parse(raw) as HqState;
  } catch { /* ignore */ }
  return {
    fileName: `${slugOwner(owner)}.base`,
    map: "livonia",
    originX: 6400,
    originZ: 6400,
    zoom: 1.4,
    pieces: [],
    pads: [{ id: "pad-1", label: "Yard pad", x: 6400, z: 6400 }],
    chat: [],
  };
}

export function FactionHQ() {
  const { user } = useAuth();
  const owner =
    (typeof user?.user_metadata?.name === "string" && user.user_metadata.name) ||
    user?.email?.split("@")[0] ||
    "owner";
  const [profile, setProfile] = useState<Profile | null>(null);
  const [hq, setHq] = useState<HqState>(() => loadHq(owner));
  const [msg, setMsg] = useState("");
  const [kind, setKind] = useState<(typeof KINDS)[number][0]>("shed");
  const [deposit, setDeposit] = useState("1000");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PROFILE);
      if (raw) setProfile(JSON.parse(raw) as Profile);
    } catch { /* ignore */ }
  }, []);

  const persist = (next: HqState) => {
    setHq(next);
    localStorage.setItem(HQ, JSON.stringify(next));
  };

  const saveWallet = (balance: number) => {
    if (!profile) return;
    const next = { ...profile, balance };
    setProfile(next);
    localStorage.setItem(PROFILE, JSON.stringify(next));
  };

  const size = WORLD[hq.map];
  const left = Math.min(96, Math.max(4, (hq.originX / size) * 100));
  const top = Math.min(96, Math.max(4, (hq.originZ / size) * 100));

  const prompt = useMemo(() => {
    const list = hq.pieces.map((p) => `${p.kind}@${Math.round(p.x)},${Math.round(p.z)}`).join("; ") || "empty lot";
    return [
      `You are the DAYZ PRO Grok base editor.`,
      `Open the DayZ Editor file named ${hq.fileName} for faction ${profile?.name || "unknown"}.`,
      `Owner PSN/Discord: ${owner}.`,
      `Map ${hq.map}. Origin X ${hq.originX} Z ${hq.originZ}.`,
      `Current layout: ${list}.`,
      `Teleporters: ${hq.pads.map((p) => `${p.label} ${p.x},${p.z}`).join("; ") || "none"}.`,
      `Apply Hub edits exactly. Do not invent a second base. Write the .dze/.json back and confirm piece counts.`,
    ].join(" ");
  }, [hq, owner, profile?.name]);

  return (
    <div className="space-y-5 text-left">
      <div>
        <div className="text-[10px] uppercase tracking-[0.22em] text-[#d4a84b]">Faction HQ</div>
        <h3 className="font-display text-3xl text-[#e8c56a]">{profile?.name || "No faction"}</h3>
        <div className="font-mono text-xs text-zinc-500">Editor file · {hq.fileName}</div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-[#d4a84b]/25 p-4">
          <div className="text-[10px] uppercase tracking-wider text-zinc-500">Faction wallet</div>
          <div className="font-display text-2xl text-[#e8c56a]">{(profile?.balance ?? 0).toLocaleString()} CR</div>
          <div className="mt-2 flex gap-2">
            <Input value={deposit} onChange={(e) => setDeposit(e.target.value)} />
            <button type="button" onClick={() => { const n = Math.floor(Number(deposit)); if (!n) return; saveWallet((profile?.balance ?? 0) + n); toast.success("Wallet updated on Hub. Staff still clears live credits."); }} className="rounded-lg bg-[#d4a84b] px-3 text-xs font-semibold text-black">Log</button>
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 p-4 md:col-span-2">
          <div className="text-[10px] uppercase tracking-wider text-zinc-500">Base teleporters</div>
          <div className="mt-2 space-y-1">
            {hq.pads.map((p) => (
              <div key={p.id} className="flex items-center justify-between text-sm">
                <span>{p.label}</span>
                <span className="font-mono text-xs text-zinc-500">{p.x}, {p.z}</span>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => persist({ ...hq, pads: [...hq.pads, { id: `pad-${Date.now()}`, label: `Pad ${hq.pads.length + 1}`, x: hq.originX + 12, z: hq.originZ + 12 }] })} className="mt-2 text-xs uppercase tracking-wider text-[#e8c56a]">Add pad</button>
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-[#d4a84b]/30 bg-black">
        <div className="flex items-center justify-between px-4 py-2 text-xs text-zinc-400">
          <span>Base map · zoom {hq.zoom.toFixed(1)}x</span>
          <span className="flex gap-2">
            <button type="button" onClick={() => persist({ ...hq, zoom: Math.max(1, hq.zoom - 0.2) })}>Out</button>
            <button type="button" onClick={() => persist({ ...hq, zoom: Math.min(4, hq.zoom + 0.2) })}>In</button>
          </span>
        </div>
        <div className="relative h-[380px] overflow-hidden">
          <img src={SAT[hq.map]} alt="" className="absolute inset-0 h-full w-full object-cover" style={{ transform: `scale(${hq.zoom})`, transformOrigin: `${left}% ${top}%` }} />
          <button type="button" onClick={(e) => {
            const box = e.currentTarget.getBoundingClientRect();
            const px = (e.clientX - box.left) / box.width;
            const pz = (e.clientY - box.top) / box.height;
            const x = hq.originX + (px - 0.5) * (900 / hq.zoom);
            const z = hq.originZ + (pz - 0.5) * (900 / hq.zoom);
            persist({ ...hq, pieces: [...hq.pieces, { id: `${Date.now()}`, kind, x, z }] });
          }} className="absolute inset-0">
            <span className="sr-only">Place piece</span>
          </button>
          {hq.pieces.map((p) => {
            const pl = 50 + ((p.x - hq.originX) / (900 / hq.zoom)) * 100;
            const pt = 50 + ((p.z - hq.originZ) / (900 / hq.zoom)) * 100;
            return (
              <div key={p.id} className="absolute -translate-x-1/2 -translate-y-1/2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] uppercase text-[#e8c56a]" style={{ left: `${pl}%`, top: `${pt}%` }}>{p.kind}</div>
            );
          })}
          <div className="absolute left-1/2 top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#d4a84b] shadow-[0_0_16px_#d4a84b]" />
        </div>
        <div className="flex flex-wrap gap-2 border-t border-white/10 p-3">
          {KINDS.map(([id, label]) => (
            <button key={id} type="button" onClick={() => setKind(id)} className={`rounded-full border px-3 py-1 text-[10px] uppercase ${kind === id ? "border-[#d4a84b] text-[#e8c56a]" : "border-white/10 text-zinc-500"}`}>{label}</button>
          ))}
          <button type="button" onClick={() => persist({ ...hq, pieces: [] })} className="ml-auto text-[10px] uppercase text-red-300">Clear layout</button>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 p-4">
        <div className="text-[10px] uppercase tracking-wider text-[#d4a84b]">Faction chat</div>
        <div className="mt-2 max-h-40 space-y-1 overflow-auto text-sm">
          {hq.chat.map((c) => (
            <div key={c.id}><span className="text-[#e8c56a]">{c.from}</span> · {c.text}</div>
          ))}
          {!hq.chat.length ? <div className="text-zinc-500">No traffic yet.</div> : null}
        </div>
        <div className="mt-2 flex gap-2">
          <Input value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Message the crew" />
          <button type="button" onClick={() => { if (!msg.trim()) return; persist({ ...hq, chat: [...hq.chat, { id: `${Date.now()}`, from: owner, text: msg.trim(), at: new Date().toISOString() }] }); setMsg(""); }} className="rounded-lg bg-[#d4a84b] px-3 text-sm font-semibold text-black">Send</button>
        </div>
      </div>

      <div className="rounded-2xl border border-[#d4a84b]/20 p-4">
        <div className="text-[10px] uppercase tracking-wider text-[#d4a84b]">Grok bot prompt</div>
        <p className="mt-2 text-xs leading-relaxed text-zinc-400">{prompt}</p>
        <button type="button" onClick={() => { void navigator.clipboard.writeText(prompt); toast.success("Prompt copied for Grok bot"); }} className="mt-3 rounded-full border border-[#d4a84b]/40 px-4 py-1.5 text-xs uppercase tracking-wider text-[#e8c56a]">Copy prompt</button>
      </div>
    </div>
  );
}
