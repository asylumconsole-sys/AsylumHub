import { motion } from "framer-motion";
import { BrandHexLogo } from "@/components/app/BrandHexLogo";
import { BRAND } from "@/lib/brand";

export function AuthGate({
  busy,
  onDiscord,
}: {
  busy?: boolean;
  onDiscord: () => void;
}) {
  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-black px-4">
      <style>{`
        @keyframes warroom-scan { 0% { transform: translateY(-100%); } 100% { transform: translateY(100%); } }
        @keyframes warroom-flicker { 0%, 100% { opacity: 1; } 42% { opacity: 1; } 43% { opacity: 0.72; } 44% { opacity: 1; } 71% { opacity: 1; } 72% { opacity: 0.8; } 73% { opacity: 1; } }
        @keyframes warroom-shine { 0% { transform: translateX(-140%) skewX(-20deg); } 100% { transform: translateX(240%) skewX(-20deg); } }
      `}</style>
      <motion.div className="pointer-events-none absolute inset-0" animate={{ opacity: [0.25, 0.45, 0.25] }} transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }} style={{ background: "radial-gradient(circle at 50% 18%, rgba(212,168,75,0.22), transparent 58%)" }} />
      <div className="pointer-events-none absolute inset-0 opacity-20" style={{ backgroundImage: "linear-gradient(135deg, transparent 0%, transparent 48%, rgba(212,168,75,0.16) 49%, transparent 50%)", backgroundSize: "46px 46px" }} />
      <div className="pointer-events-none absolute inset-x-0 h-40 opacity-[0.08]" style={{ background: "linear-gradient(180deg, transparent, rgba(212,168,75,0.9), transparent)", animation: "warroom-scan 6s linear infinite" }} />
      <div className="relative z-10 w-full max-w-md text-center">
        <div className="relative mx-auto mb-6 flex h-28 w-28 items-center justify-center">
          <motion.span className="absolute inset-0 rounded-full border border-[#d4a84b]/30 border-t-[#d4a84b]" animate={{ rotate: 360 }} transition={{ duration: 8, repeat: Infinity, ease: "linear" }} />
          <BrandHexLogo size={96} />
        </div>
        <p className="text-[10px] uppercase tracking-[0.36em] text-[#d4a84b]/70">Access</p>
        <h1 className="mt-2 font-display text-5xl tracking-tight text-[#e8c56a]" style={{ animation: "warroom-flicker 5s infinite" }}>
          {BRAND.name}
        </h1>
        <p className="mt-3 text-sm uppercase tracking-[0.22em] text-zinc-500">Clearance required</p>
        <button type="button" disabled={busy} onClick={onDiscord} className="relative mt-8 inline-flex w-full items-center justify-center overflow-hidden rounded-full border border-[#d4a84b]/40 bg-[#d4a84b] px-6 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-black disabled:opacity-60">
          <span className="pointer-events-none absolute inset-0 opacity-40" style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.45), transparent)", animation: "warroom-shine 2.8s ease-in-out infinite" }} />
          <span className="relative">{busy ? "Connecting…" : "Continue with Discord"}</span>
        </button>
      </div>
    </div>
  );
}
