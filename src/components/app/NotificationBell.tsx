import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";

type Note = { id: string; text: string; at: string };

function readNotes(): Note[] {
  try {
    return JSON.parse(localStorage.getItem("asylumhub:notifs") || "[]");
  } catch {
    return [];
  }
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState<Note[]>(readNotes);
  useEffect(() => {
    const sync = () => setNotes(readNotes());
    window.addEventListener("asylumhub:notifs", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("asylumhub:notifs", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} className="relative grid size-9 place-items-center rounded-full border border-[#d4a84b]/40 bg-black/70 text-sm" aria-label="Notifications">
        🔔
        {notes.length ? <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-red-500" /> : null}
      </button>
      {open ? (
        <div className="absolute right-0 top-11 z-50 w-80 rounded-2xl border border-[#d4a84b]/30 bg-black/95 p-3 shadow-2xl">
          <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-[0.16em] text-[#d4a84b]">
            <span>Alerts</span>
            <Link to="/intel" className="text-[#e8c56a]" onClick={() => setOpen(false)}>Intel desk</Link>
          </div>
          {notes.length === 0 ? <div className="text-sm text-zinc-500">No alerts yet.</div> : notes.slice(0, 8).map((n) => (
            <div key={n.id} className="border-b border-white/5 py-2 text-xs last:border-0">{n.text}</div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
