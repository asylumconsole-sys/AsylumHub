/**
 * Live gradient mesh background — desktop only.
 * Hidden on phones so the UI stays fast and readable.
 */
export function GradientMesh({ className = "" }: { className?: string }) {
  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden="true">
      <div className="absolute inset-0 bg-[color:var(--color-ink)]" />
      <div className="mesh-bg hidden md:block" />
      <div className="grain hidden md:block" />
    </div>
  );
}
