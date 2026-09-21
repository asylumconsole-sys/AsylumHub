import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  CATALOG,
  GEAR_SLOTS,
  SURVIVOR_SKINS,
  emptyDraft,
  survivorPortrait,
  type BuilderDraft,
  type Equipped,
  type GearSlot,
} from "@/lib/npc/builder-catalog";

const gold = "#d4a84b";

function slotItems(slot: GearSlot) {
  return CATALOG.filter((i) => i.slot === slot || (slot === "hands" && i.slot === "hands") || (slot === "shoulder" && i.slot === "shoulder"));
}

export function NpcBuilder() {
  const [step, setStep] = useState<1 | 2>(1);
  const [draft, setDraft] = useState<BuilderDraft>(emptyDraft());
  const [editSlot, setEditSlot] = useState<GearSlot | null>(null);
  const [sub, setSub] = useState<"attach" | "cargo" | null>(null);
  const skin = SURVIVOR_SKINS.find((s) => s.id === draft.skinId) ?? SURVIVOR_SKINS[0];

  const equippedCount = useMemo(() => Object.keys(draft.slots).length, [draft.slots]);

  function setSlot(slot: GearSlot, item: Equipped | undefined) {
    setDraft((d) => {
      const slots = { ...d.slots };
      if (!item) delete slots[slot];
      else slots[slot] = item;
      return { ...d, slots };
    });
  }

  function handcuff() {
    const next = !draft.handcuffed;
    setDraft((d) => {
      const slots = { ...d.slots };
      if (next) {
        delete slots.hands;
        slots.gloves = {
          classname: "PrisonerCap",
          name: "Restrained",
          attachments: [],
          cargo: ["Handcuffs", "HandcuffsLocked"],
        };
      }
      return { ...d, handcuffed: next, slots };
    });
    toast.success(next ? "NPC restrained — hands locked, cuffs on" : "Cuffs off — NPC can hold weapons again");
  }

  const editing = editSlot ? draft.slots[editSlot] : undefined;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#d4a84b]/30 bg-[#070707]">
      <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:linear-gradient(135deg,transparent_0%,transparent_48%,rgba(212,168,75,0.16)_49%,transparent_50%)] [background-size:46px_46px]" />
      <div className="relative space-y-5 p-4 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-[0.3em] text-[#d4a84b]">War room · NPC builder</div>
            <h2 className="font-display mt-1 text-3xl text-[#e8c56a]">Build operator</h2>
          </div>
          <div className="flex gap-2 text-[11px] uppercase tracking-[0.2em]">
            <button type="button" onClick={() => setStep(1)} className={`rounded-full border px-3 py-1 ${step === 1 ? "border-[#d4a84b] text-[#e8c56a]" : "border-white/10 text-zinc-500"}`}>
              1 · Skin
            </button>
            <button type="button" onClick={() => setStep(2)} className={`rounded-full border px-3 py-1 ${step === 2 ? "border-[#d4a84b] text-[#e8c56a]" : "border-white/10 text-zinc-500"}`}>
              2 · Loadout
            </button>
          </div>
        </div>

        {step === 1 && (
          <>
            <label className="block text-[11px] uppercase tracking-[0.22em] text-[#d4a84b]">
              Callsign
              <input
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value.slice(0, 24) }))}
                placeholder="NPC name"
                className="mt-2 w-full rounded-xl border border-[#d4a84b]/25 bg-black/60 px-3 py-2 text-sm text-[#f5e6c0] outline-none focus:border-[#d4a84b]"
              />
            </label>
            <p className="text-xs text-zinc-500">
              Skins from{" "}
              <a className="text-[#d4a84b] underline" href="https://dayz.fandom.com/wiki/Survivors" target="_blank" rel="noreferrer">
                DayZ Fandom · Survivors
              </a>
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
              {SURVIVOR_SKINS.map((s) => {
                const on = draft.skinId === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setDraft((d) => ({ ...d, skinId: s.id }))}
                    className={`overflow-hidden rounded-xl border text-left ${on ? "border-[#d4a84b] shadow-[0_0_18px_rgba(212,168,75,0.25)]" : "border-white/10"}`}
                  >
                    <img src={survivorPortrait(s)} alt={s.name} className="h-28 w-full object-cover bg-zinc-900" onError={(e) => { (e.currentTarget as HTMLImageElement).style.opacity = "0.25"; }} />
                    <div className="px-2 py-1.5">
                      <div className="font-display text-[#e8c56a]">{s.name}</div>
                      <div className="text-[10px] uppercase tracking-wider text-zinc-500">{s.sex === "M" ? "Male" : "Female"}</div>
                    </div>
                  </button>
                );
              })}
            </div>
            <button type="button" onClick={() => setStep(2)} className="rounded-xl border border-[#d4a84b] bg-[#d4a84b]/10 px-4 py-2 text-sm text-[#e8c56a]">
              Continue to gear →
            </button>
          </>
        )}

        {step === 2 && (
          <>
            <div className="flex items-center gap-4 rounded-xl border border-[#d4a84b]/20 bg-black/40 p-3">
              <img src={survivorPortrait(skin)} alt="" className="h-16 w-16 rounded-lg object-cover" />
              <div>
                <div className="font-display text-xl text-[#e8c56a]">{draft.name || "Unnamed"}</div>
                <div className="text-xs text-zinc-500">{skin.classname} · {equippedCount} slots</div>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {GEAR_SLOTS.map((slot) => {
                const item = draft.slots[slot.id];
                return (
                  <button
                    key={slot.id}
                    type="button"
                    onClick={() => { setEditSlot(slot.id); setSub(null); }}
                    className="rounded-xl border border-white/10 bg-black/50 p-3 text-left hover:border-[#d4a84b]/50"
                  >
                    <div className="text-[10px] uppercase tracking-[0.22em] text-[#d4a84b]">{slot.label}</div>
                    <div className="mt-1 text-sm text-[#f5e6c0]">{item?.name ?? "Empty"}</div>
                    {item && (
                      <div className="mt-1 text-[10px] text-zinc-500">
                        {item.attachments.length} attach · {item.cargo.length} cargo
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </>
        )}

        {editSlot && (
          <div className="rounded-xl border border-[#d4a84b]/30 bg-black/70 p-3">
            <div className="flex items-center justify-between">
              <div className="text-[11px] uppercase tracking-[0.22em] text-[#d4a84b]">Edit {editSlot}</div>
              <button type="button" className="text-xs text-zinc-500" onClick={() => setEditSlot(null)}>Close</button>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" onClick={() => setSlot(editSlot, undefined)} className="rounded-lg border border-white/10 px-2 py-1 text-xs text-zinc-400">Clear</button>
              {slotItems(editSlot).map((it) => (
                <button
                  key={it.classname}
                  type="button"
                  onClick={() => setSlot(editSlot, { classname: it.classname, name: it.name, attachments: [], cargo: [] })}
                  className={`rounded-lg border px-2 py-1 text-xs ${editing?.classname === it.classname ? "border-[#d4a84b] text-[#e8c56a]" : "border-white/10 text-zinc-300"}`}
                >
                  {it.name}
                </button>
              ))}
            </div>
            {editing && (editing.classname && (CATALOG.find((c) => c.classname === editing.classname)?.kind === "weapon" || CATALOG.find((c) => c.classname === editing.classname)?.kind === "clothing")) && (
              <div className="mt-3 flex gap-2">
                {CATALOG.find((c) => c.classname === editing.classname)?.kind === "weapon" && (
                  <button type="button" onClick={() => setSub("attach")} className="rounded-lg border border-[#d4a84b]/40 px-2 py-1 text-xs text-[#e8c56a]">Attachments</button>
                )}
                {CATALOG.find((c) => c.classname === editing.classname)?.kind === "clothing" && (
                  <button type="button" onClick={() => setSub("cargo")} className="rounded-lg border border-[#d4a84b]/40 px-2 py-1 text-xs text-[#e8c56a]">Inventory</button>
                )}
              </div>
            )}
            {sub === "attach" && editing && (
              <div className="mt-2 flex flex-wrap gap-2">
                {CATALOG.filter((c) => c.kind === "attach").map((it) => {
                  const on = editing.attachments.includes(it.classname);
                  return (
                    <button
                      key={it.classname}
                      type="button"
                      onClick={() => {
                        const attachments = on ? editing.attachments.filter((x) => x !== it.classname) : [...editing.attachments, it.classname];
                        setSlot(editSlot, { ...editing, attachments });
                      }}
                      className={`rounded-lg border px-2 py-1 text-xs ${on ? "border-[#d4a84b] text-[#e8c56a]" : "border-white/10 text-zinc-400"}`}
                    >
                      {it.name}
                    </button>
                  );
                })}
              </div>
            )}
            {sub === "cargo" && editing && (
              <div className="mt-2 flex flex-wrap gap-2">
                {CATALOG.filter((c) => c.kind === "cargo").map((it) => {
                  const on = editing.cargo.includes(it.classname);
                  return (
                    <button
                      key={it.classname}
                      type="button"
                      onClick={() => {
                        const cargo = on ? editing.cargo.filter((x) => x !== it.classname) : [...editing.cargo, it.classname];
                        setSlot(editSlot, { ...editing, cargo });
                      }}
                      className={`rounded-lg border px-2 py-1 text-xs ${on ? "border-[#d4a84b] text-[#e8c56a]" : "border-white/10 text-zinc-400"}`}
                    >
                      {it.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <motion.button
          type="button"
          onClick={handcuff}
          whileTap={{ scale: 0.98 }}
          className={`relative w-full overflow-hidden rounded-xl border py-4 font-display text-xl tracking-wide ${
            draft.handcuffed ? "border-red-500/70 bg-red-950/40 text-red-200" : "border-[#d4a84b] bg-[#d4a84b]/15 text-[#e8c56a]"
          }`}
        >
          {draft.handcuffed ? "Cuffed — tap to release" : "Handcuff my NPC"}
        </motion.button>
        <p className="text-center text-[11px] text-zinc-500">
          Same restrain flow as DayZ AI makers: strips hands, applies locked cuffs, NPC holds until released.
        </p>
      </div>
    </div>
  );
}
