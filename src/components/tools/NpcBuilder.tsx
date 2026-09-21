import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { getEconomyBalance } from "@/lib/economy.functions";
import { useQuery } from "@tanstack/react-query";
import {
  CATALOG,
  SURVIVOR_SKINS,
  emptyDraft,
  itemImage,
  survivorPortrait,
  type BuilderDraft,
  type Equipped,
  type GearSlot,
} from "@/lib/npc/builder-catalog";

const STEPS = ["Character", "Weapons", "Head", "Body", "Legs", "Gear", "Export"] as const;
type Step = (typeof STEPS)[number];

function itemsFor(slot: string) {
  return CATALOG.filter((i) => i.slot === slot || (slot === "shoulder" && (i.slot === "hands" || i.slot === "shoulder" || i.slot === "melee")));
}

function Picker({
  title,
  slot,
  onPick,
  onClose,
}: {
  title: string;
  slot: string;
  onPick: (item: Equipped | undefined) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const list = itemsFor(slot).filter((i) => i.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={onClose}>
      <div className="max-h-[80vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-[#d4a84b]/30 bg-[#0a0a0a] p-4" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="font-display text-2xl text-[#e8c56a]">{title}</div>
            <div className="text-xs text-zinc-500">{list.length} items</div>
          </div>
          <button type="button" className="text-zinc-500" onClick={onClose}>Close</button>
        </div>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className="mb-3 w-full rounded-lg border border-white/10 bg-black px-3 py-2 text-sm text-[#f5e6c0] outline-none" />
        <button type="button" onClick={() => { onPick(undefined); onClose(); }} className="mb-3 w-full rounded-lg border border-white/10 px-3 py-2 text-left text-sm text-zinc-400">None · clear this slot</button>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {list.map((it) => (
            <button key={it.classname} type="button" onClick={() => { onPick({ classname: it.classname, name: it.name, attachments: [], cargo: [] }); onClose(); }} className="rounded-xl border border-white/10 bg-black/50 p-2 text-left hover:border-[#d4a84b]/50">
              <img src={itemImage(it.classname)} alt="" className="mx-auto h-20 w-20 object-contain" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
              <div className="mt-1 text-center text-xs text-[#f5e6c0]">{it.name}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function SlotCard({
  label,
  item,
  onOpen,
  onClear,
}: {
  label: string;
  item?: Equipped;
  onOpen: () => void;
  onClear?: () => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-[#d4a84b]/20 bg-black/40 p-3">
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <div className="flex size-12 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-zinc-950">
          {item ? <img src={itemImage(item.classname)} alt="" className="h-10 w-10 object-contain" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} /> : <span className="text-[#d4a84b]">+</span>}
        </div>
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#d4a84b]">{label}</div>
          <div className="truncate text-sm text-[#f5e6c0]">{item?.name ?? "Tap to select"}</div>
        </div>
      </button>
      {item && onClear ? (
        <button type="button" onClick={onClear} className="ml-2 text-zinc-500">×</button>
      ) : null}
    </div>
  );
}

export function NpcBuilder() {
  const { user } = useAuth();
  const playerId = user?.id || "demo-user";
  const [step, setStep] = useState<Step>("Character");
  const [draft, setDraft] = useState<BuilderDraft>(emptyDraft());
  const [picker, setPicker] = useState<{ title: string; slot: GearSlot | "shoulder2" } | null>(null);
  const [shoulder2, setShoulder2] = useState<Equipped | undefined>();
  const [handMode, setHandMode] = useState<"free" | "cuffed" | "hold">("free");
  const skin = SURVIVOR_SKINS.find((s) => s.id === draft.skinId) ?? SURVIVOR_SKINS[0];
  const balanceQ = useQuery({
    queryKey: ["economy-balance", playerId],
    queryFn: () => getEconomyBalance({ data: { playerId } }),
  });
  const credits = balanceQ.data?.balance ?? 0;
  const itemCount = useMemo(() => Object.values(draft.slots).filter(Boolean).length + (shoulder2 ? 1 : 0), [draft.slots, shoulder2]);
  const idx = STEPS.indexOf(step);
  const createCost = 10_000;

  function setSlot(slot: GearSlot, item: Equipped | undefined) {
    setDraft((d) => {
      const slots = { ...d.slots };
      if (!item) delete slots[slot];
      else slots[slot] = item;
      return { ...d, slots, handcuffed: handMode === "cuffed" };
    });
  }

  function applyPick(item: Equipped | undefined) {
    if (!picker) return;
    if (picker.slot === "shoulder2") setShoulder2(item);
    else setSlot(picker.slot, item);
  }

  function next() {
    if (step === "Character" && !draft.name.trim()) return toast.error("Name your NPC");
    const n = STEPS[Math.min(STEPS.length - 1, idx + 1)];
    setStep(n);
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#d4a84b]/30 bg-[#070707]">
      <div className="pointer-events-none absolute inset-0 opacity-15 [background-image:linear-gradient(135deg,transparent_48%,rgba(212,168,75,0.16)_49%,transparent_50%)] [background-size:46px_46px]" />
      <div className="relative space-y-6 p-4 sm:p-6">
        <div className="flex flex-wrap gap-2">
          {STEPS.map((s, i) => (
            <button key={s} type="button" onClick={() => setStep(s)} className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.16em] ${step === s ? "border-[#d4a84b] text-[#e8c56a]" : i < idx ? "border-[#d4a84b]/40 text-[#d4a84b]/80" : "border-white/10 text-zinc-500"}`}>
              {s}
            </button>
          ))}
        </div>

        {step === "Character" && (
          <>
            <h2 className="font-display text-center text-4xl text-[#e8c56a]">Character</h2>
            <p className="text-center text-sm text-zinc-500">Name & choose your survivor</p>
            <label className="mx-auto block max-w-md text-center text-[11px] uppercase tracking-[0.2em] text-[#d4a84b]">
              Name your NPC
              <input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value.slice(0, 24) }))} placeholder="Enter a name…" className="mt-2 w-full rounded-xl border border-[#d4a84b]/40 bg-black px-4 py-3 text-center text-base text-[#f5e6c0] outline-none" />
            </label>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {SURVIVOR_SKINS.map((s) => (
                <button key={s.id} type="button" onClick={() => setDraft((d) => ({ ...d, skinId: s.id }))} className={`overflow-hidden rounded-xl border ${draft.skinId === s.id ? "border-[#d4a84b] shadow-[0_0_18px_rgba(212,168,75,0.3)]" : "border-white/10"}`}>
                  <img src={survivorPortrait(s)} alt={s.name} className="h-36 w-full object-cover object-top bg-zinc-950" />
                  <div className="py-1 text-center text-xs text-[#e8c56a]">{s.name}</div>
                </button>
              ))}
            </div>
          </>
        )}

        {step === "Weapons" && (
          <>
            <h2 className="font-display text-center text-4xl text-[#e8c56a]">Weapons</h2>
            <p className="text-center text-sm text-zinc-500">Primary & secondary</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <SlotCard label="Shoulder 1" item={draft.slots.shoulder ?? draft.slots.hands} onOpen={() => setPicker({ title: "Shoulder 1", slot: "shoulder" })} onClear={() => { setSlot("shoulder", undefined); setSlot("hands", undefined); }} />
              <SlotCard label="Shoulder 2" item={shoulder2} onOpen={() => setPicker({ title: "Shoulder 2", slot: "shoulder2" })} onClear={() => setShoulder2(undefined)} />
            </div>
            {(draft.slots.shoulder || draft.slots.hands) && (
              <div className="rounded-xl border border-[#d4a84b]/20 p-3">
                <div className="text-[10px] uppercase tracking-[0.2em] text-[#d4a84b]">Attachments</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {CATALOG.filter((c) => c.kind === "attach").map((it) => {
                    const cur = draft.slots.shoulder ?? draft.slots.hands;
                    const on = cur?.attachments.includes(it.classname);
                    return (
                      <button key={it.classname} type="button" onClick={() => {
                        if (!cur) return;
                        const attachments = on ? cur.attachments.filter((x) => x !== it.classname) : [...cur.attachments, it.classname];
                        setSlot(draft.slots.shoulder ? "shoulder" : "hands", { ...cur, attachments });
                      }} className={`rounded-lg border px-2 py-1 text-xs ${on ? "border-[#d4a84b] text-[#e8c56a]" : "border-white/10 text-zinc-400"}`}>{it.name}</button>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {step === "Head" && (
          <>
            <h2 className="font-display text-center text-4xl text-[#e8c56a]">Head</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <SlotCard label="Helmet" item={draft.slots.head} onOpen={() => setPicker({ title: "Helmet", slot: "head" })} onClear={() => setSlot("head", undefined)} />
              <SlotCard label="Mask" item={draft.slots.mask} onOpen={() => setPicker({ title: "Mask", slot: "mask" })} onClear={() => setSlot("mask", undefined)} />
              <SlotCard label="Eyewear" item={draft.slots.eyes} onOpen={() => setPicker({ title: "Eyewear", slot: "eyes" })} onClear={() => setSlot("eyes", undefined)} />
              <SlotCard label="NVG headstrap" item={undefined} onOpen={() => toast.message("NVG uses the eyewear slot on console")} />
            </div>
          </>
        )}

        {step === "Body" && (
          <>
            <h2 className="font-display text-center text-4xl text-[#e8c56a]">Body</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <SlotCard label="Vest" item={draft.slots.vest} onOpen={() => setPicker({ title: "Vest", slot: "vest" })} onClear={() => setSlot("vest", undefined)} />
              <SlotCard label="Jacket" item={draft.slots.jacket} onOpen={() => setPicker({ title: "Jacket", slot: "jacket" })} onClear={() => setSlot("jacket", undefined)} />
              <SlotCard label="Gloves" item={draft.slots.gloves} onOpen={() => setPicker({ title: "Gloves", slot: "gloves" })} onClear={() => setSlot("gloves", undefined)} />
              <SlotCard label="Shirt" item={draft.slots.shirt} onOpen={() => setPicker({ title: "Shirt", slot: "shirt" })} onClear={() => setSlot("shirt", undefined)} />
            </div>
          </>
        )}

        {step === "Legs" && (
          <>
            <h2 className="font-display text-center text-4xl text-[#e8c56a]">Legs</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <SlotCard label="Pants" item={draft.slots.pants} onOpen={() => setPicker({ title: "Pants", slot: "pants" })} onClear={() => setSlot("pants", undefined)} />
              <SlotCard label="Shoes" item={draft.slots.shoes} onOpen={() => setPicker({ title: "Shoes", slot: "shoes" })} onClear={() => setSlot("shoes", undefined)} />
            </div>
          </>
        )}

        {step === "Gear" && (
          <>
            <h2 className="font-display text-center text-4xl text-[#e8c56a]">Gear</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <SlotCard label="Backpack" item={draft.slots.backpack} onOpen={() => setPicker({ title: "Backpack", slot: "backpack" })} onClear={() => setSlot("backpack", undefined)} />
              <SlotCard label="Armband" item={draft.slots.armband} onOpen={() => setPicker({ title: "Armband", slot: "armband" })} onClear={() => setSlot("armband", undefined)} />
            </div>
            <div className="text-center text-[11px] uppercase tracking-[0.2em] text-[#d4a84b]">Hands</div>
            <div className="grid grid-cols-3 gap-2">
              {([
                ["free", "Free hands"],
                ["cuffed", "Handcuffed"],
                ["hold", "Holding item"],
              ] as const).map(([id, label]) => (
                <button key={id} type="button" onClick={() => {
                  setHandMode(id);
                  setDraft((d) => ({ ...d, handcuffed: id === "cuffed" }));
                  if (id === "cuffed") setSlot("hands", { classname: "HandcuffsLocked", name: "Handcuffed", attachments: [], cargo: [] });
                  if (id === "free") setSlot("hands", undefined);
                  if (id === "hold") setPicker({ title: "Holding", slot: "hands" });
                }} className={`rounded-xl border px-2 py-4 text-sm ${handMode === id ? "border-[#d4a84b] bg-[#d4a84b]/15 text-[#e8c56a]" : "border-white/10 text-zinc-400"}`}>{label}</button>
              ))}
            </div>
          </>
        )}

        {step === "Export" && (
          <>
            <h2 className="font-display text-center text-4xl text-[#e8c56a]">Export</h2>
            <div className="rounded-xl border border-red-500/40 bg-red-950/20 px-4 py-3 text-sm text-red-200">
              {createCost.toLocaleString()} credits charged to create this NPC. Balance {credits.toLocaleString()}.
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-xl border border-white/10 p-3 text-center"><div className="text-xs text-zinc-500">Items</div><div className="text-xl text-[#f5e6c0]">{itemCount}</div></div>
              <div className="rounded-xl border border-white/10 p-3 text-center"><div className="text-xs text-zinc-500">Name</div><div className="text-xl text-[#f5e6c0]">{draft.name || "—"}</div></div>
              <div className="rounded-xl border border-white/10 p-3 text-center"><div className="text-xs text-zinc-500">Skin</div><div className="text-xl text-[#f5e6c0]">{skin.name}</div></div>
              <div className="rounded-xl border border-white/10 p-3 text-center"><div className="text-xs text-zinc-500">Hands</div><div className="text-xl text-[#f5e6c0]">{handMode}</div></div>
            </div>
            <motion.button type="button" whileTap={{ scale: 0.98 }} onClick={() => {
              if (!draft.name.trim()) return toast.error("Name required");
              if (credits < createCost) return toast.error("Need 10,000 cr to create");
              toast.success(`${draft.name} saved as a custom operator draft`);
            }} className="w-full rounded-xl bg-[#d4a84b] py-3 font-semibold text-[#1a1205]">
              Create NPC
            </motion.button>
          </>
        )}

        <div className="flex justify-between">
          <button type="button" disabled={idx === 0} onClick={() => setStep(STEPS[idx - 1])} className="rounded-full border border-white/15 px-4 py-2 text-sm text-zinc-300 disabled:opacity-30">Back</button>
          {step !== "Export" && (
            <button type="button" onClick={next} className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-black">Next</button>
          )}
        </div>
      </div>
      {picker && <Picker title={picker.title} slot={picker.slot === "shoulder2" ? "shoulder" : picker.slot} onPick={applyPick} onClose={() => setPicker(null)} />}
    </div>
  );
}
