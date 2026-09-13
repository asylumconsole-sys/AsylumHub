import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { GlassPanel } from "@/components/ui-custom/GlassPanel";
import { PageHexBadge } from "@/components/app/PageHexBadge";
import { IconCalendar } from "@/components/ui-custom/CustomIcon";
import { toast } from "sonner";
import { DAYZ_SERVERS, type DayZServerId } from "@/lib/dayz/servers";
import { listHubEvents, startHubEvent, stopHubEvent } from "@/lib/events.functions";
import { useAuth } from "@/contexts/AuthContext";

export const Route = createFileRoute("/_app/tools/events")({
    component: EventsContent,
    head: () => ({
          meta: [
            { title: "Nitrado Events — DayZ Pro" },
            { name: "description", content: "Start and stop Asylum Nitrado events mirrored to Discord." },
                ],
    }),
});

export function EventsContent({ hideHeader = false }: { hideHeader?: boolean } = {}) {
    const { user } = useAuth();
    const qc = useQueryClient();
    const playerId = user?.id || "demo-user";
    const displayName =
          (typeof user?.user_metadata?.name === "string" && user.user_metadata.name) ||
          user?.email ||
          playerId;

  const [serverId, setServerId] = useState<DayZServerId>("101x");
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [note, setNote] = useState("");

  const eventsQ = useQuery({
        queryKey: ["hub-events"],
        queryFn: () => listHubEvents(),
  });

  const catalog = eventsQ.data?.catalog ?? [];
    const active = eventsQ.data?.active ?? [];
    const hubServer = serverId.startsWith("102") ? "102" : "101";
    const selected = useMemo(
          () => catalog.find((e) => e.id === selectedId) ?? null,
          [catalog, selectedId],
        );
    const selectedActive = selected
      ? active.find((a) => a.eventId === selected.id && a.serverId === hubServer)
          : undefined;

  const invalidate = () => qc.invalidateQueries({ queryKey: ["hub-events"] });

  const startMut = useMutation({
        mutationFn: () => {
                if (!selected) throw new Error("Select an event");
                return startHubEvent({
                          data: {
                                      eventId: selected.id,
                                      serverId,
                                      playerId,
                                      displayName,
                                      note: note.trim() || undefined,
                          },
                });
        },
        onSuccess: () => {
                toast.success(`${selected?.name} started on ${serverId}`);
                setNote("");
                invalidate();
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Start failed"),
  });

  const stopMut = useMutation({
        mutationFn: () => {
                if (!selected) throw new Error("Select an event");
                return stopHubEvent({
                          data: {
                                      eventId: selected.id,
                                      serverId,
                                      playerId,
                                      displayName,
                                      note: note.trim() || undefined,
                          },
                });
        },
        onSuccess: () => {
                toast.success(`${selected?.name} stopped on ${serverId}`);
                setNote("");
                invalidate();
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Stop failed"),
  });

  return (
        <div className="space-y-6">
          {!hideHeader && (
                  <header className="flex items-start gap-4">
                            <PageHexBadge hue={150} icon={<IconCalendar size={26} />} aria-label="Events" />
                            <div>
                                        <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Nitrado · Discord</div>div>
                                        <h1 className="mt-1 font-display text-3xl md:text-4xl">Events</h1>h1>
                                        <p className="mt-2 max-w-2xl text-muted-foreground">
                                                      Start or stop server events. Emits `event.start` / `event.stop` to Discord #events.
                                        </p>p>
                            </div>div>
                  </header>header>
              )}
        
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-glass-border bg-black/20 p-3">
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Server</span>span>
                {DAYZ_SERVERS.map((s) => (
                    <button
                                  key={s.id}
                                  type="button"
                                  onClick={() => setServerId(s.id)}
                                  className={`rounded-full border px-3 py-1 text-xs uppercase ${
                                                  serverId === s.id
                                                    ? "border-primary/50 bg-primary/15 text-primary"
                                                    : "border-glass-border text-muted-foreground"
                                  }`}
                                >
                      {s.id}
                    </button>button>
                  ))}
              </div>div>
        
              <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
                      <div className="grid gap-2 sm:grid-cols-2">
                        {catalog.map((ev) => {
                      const isActive = active.some((a) => a.eventId === ev.id && a.serverId === hubServer);
                      return (
                                      <button
                                                        key={ev.id}
                                                        type="button"
                                                        onClick={() => setSelectedId(ev.id)}
                                                        className={`rounded-lg border p-3 text-left transition hover:border-primary/60 ${
                                                                            selectedId === ev.id ? "border-primary bg-primary/10" : "border-glass-border bg-black/25"
                                                        }`}
                                                      >
                                                      <div className="flex items-start justify-between gap-2">
                                                                        <span className="text-sm font-medium">{ev.name}</span>span>
                                                        {isActive && (
                                                                            <span className="text-[10px] uppercase tracking-wider text-emerald-300">Active</span>span>
                                                                        )}
                                                      </div>div>
                                                      <div className="mt-1 text-[10px] text-muted-foreground">{ev.category}</div>div>
                                                      <p className="mt-2 text-xs text-muted-foreground">{ev.description}</p>p>
                                      </button>button>
                                    );
        })}
                      </div>div>
              
                      <div className="lg:sticky lg:top-24 space-y-4">
                        {selected ? (
                      <GlassPanel className="border-primary/40 bg-black/95 p-5 shadow-xl">
                                    <div className="text-xs uppercase tracking-[0.18em] text-primary">Selected event</div>div>
                                    <h2 className="mt-1 font-display text-2xl">{selected.name}</h2>h2>
                                    <p className="mt-2 text-sm text-muted-foreground">{selected.description}</p>p>
                                    <div className="mt-3 text-xs text-muted-foreground">
                                      {selectedActive
                                                          ? `Active since ${new Date(selectedActive.startedAt).toLocaleString()}`
                                                          : "Not active on this server"}
                                    </div>div>
                                    <label className="mt-4 block text-[10px] uppercase tracking-wider text-muted-foreground">
                                                    Note (optional)
                                                    <input
                                                                        value={note}
                                                                        onChange={(e) => setNote(e.target.value)}
                                                                        className="mt-1 w-full rounded-lg border border-glass-border bg-black/40 px-3 py-2 text-sm outline-none"
                                                                        placeholder="POI, duration, rules…"
                                                                      />
                                    </label>label>
                                    <div className="mt-4 flex flex-col gap-2">
                                                    <button
                                                                        type="button"
                                                                        disabled={!!selectedActive || startMut.isPending}
                                                                        onClick={() => startMut.mutate()}
                                                                        className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-40"
                                                                      >
                                                      {startMut.isPending ? "Starting…" : `Start on ${serverId}`}
                                                    </button>button>
                                                    <button
                                                                        type="button"
                                                                        disabled={!selectedActive || stopMut.isPending}
                                                                        onClick={() => stopMut.mutate()}
                                                                        className="w-full rounded-lg border border-glass-border px-4 py-2.5 text-sm text-muted-foreground hover:bg-glass/40 disabled:opacity-40"
                                                                      >
                                                      {stopMut.isPending ? "Stopping…" : `Stop on ${serverId}`}
                                                    </button>button>
                                    </div>div>
                      </GlassPanel>GlassPanel>
                    ) : (
                      <div className="rounded-xl border border-dashed border-glass-border p-6 text-center text-sm text-muted-foreground">
                                    Select an event to start or stop.
                      </div>div>
                                )}
                      
                                <GlassPanel className="p-4">
                                            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Active now</div>div>
                                            <div className="mt-2 space-y-2">
                                              {active.length === 0 && (
                          <div className="text-sm text-muted-foreground">No active events.</div>div>
                                                          )}
                                              {active.map((a) => (
                          <div key={`${a.serverId}-${a.eventId}-${a.startedAt}`} className="text-sm">
                                            <div className="font-medium">{a.eventName} · {a.serverId}</div>div>
                                            <div className="text-[11px] text-muted-foreground">
                                                                by {a.startedByName}
                                            </div>div>
                          </div>div>
                        ))}
                                            </div>div>
                                </GlassPanel>GlassPanel>
                      </div>div>
              </div>div>
        </div>div>
      );
}
</div>
