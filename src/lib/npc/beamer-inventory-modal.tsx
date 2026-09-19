import { THE_BEAMER_LOADOUT } from "@/lib/npc/the-beamer-loadout";

export function BeamerInventoryModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-xl overflow-auto rounded-2xl border border-[#d4a84b]/40 bg-[#0a0a0a] p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.22em] text-[#d4a84b]">View inventory</div>
            <h3 className="font-display mt-1 text-2xl text-[#e8c56a]">The Beamer loadout</h3>
          </div>
          <button type="button" onClick={onClose} className="text-xs uppercase tracking-wide text-zinc-500">
            Close
          </button>
        </div>
        <p className="mt-3 text-sm text-zinc-400">{THE_BEAMER_LOADOUT.blurb}</p>
        <div className="mt-4 space-y-3">
          {THE_BEAMER_LOADOUT.sections.map((section) => (
            <div key={section.title} className="rounded-xl border border-[#d4a84b]/20 bg-black/40 p-3">
              <div className="text-[10px] uppercase tracking-[0.18em] text-[#d4a84b]">{section.title}</div>
              <ul className="mt-2 space-y-1 text-sm text-zinc-300">
                {section.items.map((item) => (
                  <li key={item} className="leading-relaxed">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
