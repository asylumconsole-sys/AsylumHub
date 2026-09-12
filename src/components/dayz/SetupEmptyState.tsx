import { GlassPanel } from "@/components/ui-custom/GlassPanel";

export function SetupEmptyState({
  title,
  description,
  requiredEnv,
  optionalHint,
}: {
  title: string;
  description: string;
  requiredEnv: string[];
  optionalHint?: string;
}) {
  return (
    <GlassPanel className="p-6">
      <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Setup required</div>
      <h2 className="mt-2 text-lg font-semibold">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
      {requiredEnv.length > 0 && (
        <div className="mt-4">
          <div className="text-xs font-medium text-foreground">Required env vars</div>
          <ul className="mt-2 space-y-1 font-mono text-xs text-amber-200/90">
            {requiredEnv.map((key) => (
              <li key={key} className="rounded-md border border-amber-500/20 bg-amber-500/5 px-2 py-1">
                {key}
              </li>
            ))}
          </ul>
        </div>
      )}
      {optionalHint && <p className="mt-4 text-xs text-muted-foreground">{optionalHint}</p>}
    </GlassPanel>
  );
}
