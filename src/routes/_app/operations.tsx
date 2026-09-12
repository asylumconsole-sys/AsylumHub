import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { GlassPanel } from "@/components/ui-custom/GlassPanel";
import { DayZPageHeader } from "@/components/dayz/DayZPageHeader";
import { IconCampaign, IconClock, IconBolt } from "@/components/ui-custom/CustomIcon";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/operations")({
  component: OperationsPage,
});

const WINDOW_MS = 5 * 60 * 60 * 1000;
const STORAGE_KEY = "asylumhub:operations-v1";

type Difficulty = "Easy" | "Normal" | "Hard" | "Elite" | "Legendary";
type ContractStatus = "available" | "active";

type OpsContract = {
  id: string;
  title: string;
  description: string;
  difficulty: Difficulty;
  tier: number;
  reward: number;
  type: string;
  expiresAt: number;
  status: ContractStatus;
};

type OpsStore = {
  windowStartedAt: number;
  contracts: OpsContract[];
};

const CONTRACT_POOL: Array<{
  title: string;
  description: string;
  type: string;
  difficulty: Difficulty;
  tier: number;
  rewardMin: number;
  rewardMax: number;
}> = [
  { title: "Coastal Scouting Sweep", description: "Mark three coastal camps and report survivor density without engaging hostiles.", type: "scouting", difficulty: "Easy", tier: 1, rewardMin: 800, rewardMax: 1400 },
  { title: "Supply Run \u2014 NWAF Perimeter", description: "Extract a sealed crate from the airfield fence line. Avoid prolonged firefights.", type: "supply", difficulty: "Normal", tier: 2, rewardMin: 1600, rewardMax: 2600 },
  { title: "Salvage Wreck Convoy", description: "Strip electronics and ammo from the burned convoy near Zeleno before scavengers strip it clean.", type: "salvage", difficulty: "Normal", tier: 2, rewardMin: 1800, rewardMax: 2800 },
  { title: "Recon Overwatch \u2014 Tisy", description: "Hold overwatch for 10 minutes and log faction traffic through the northern approach.", type: "recon", difficulty: "Hard", tier: 3, rewardMin: 2800, rewardMax: 4200 },
  { title: "Faction Hit \u2014 Rogue Outpost", description: "Neutralize the named target holding the outpost radio. Proof of kill required.", type: "faction-hit", difficulty: "Elite", tier: 4, rewardMin: 4500, rewardMax: 7000 },
  { title: "Medical Cache Drop", description: "Plant a medical cache at the marked clinic and confirm the beacon for friendlies.", type: "supply", difficulty: "Easy", tier: 1, rewardMin: 900, rewardMax: 1500 },
  { title: "Silent Recon \u2014 Elektro Docks", description: "Photograph dock activity and extract without being spotted on local chat or killfeed.", type: "recon", difficulty: "Hard", tier: 3, rewardMin: 3000, rewardMax: 4500 },
  { title: "Heli Crash Salvage", description: "Secure high-tier loot from the crash site and stash it at the designated dead-drop.", type: "salvage", difficulty: "Elite", tier: 4, rewardMin: 5000, rewardMax: 7800 },
  { title: "Night Patrol \u2014 Industrial Zone", description: "Clear infected choke points and report any player-built fortifications.", type: "scouting", difficulty: "Normal", tier: 2, rewardMin: 1500, rewardMax: 2400 },
  { title: "Legendary Black Site Breach", description: "Infiltrate the sealed bunker, retrieve the drive, and exfil under hostile pressure.", type: "faction-hit", difficulty: "Legendary", tier: 5, rewardMin: 9000, rewardMax: 14000 },
  { title: "Food & Fuel Relay", description: "Move a supply sled between two safehouses without losing the cargo.", type: "supply", difficulty: "Easy", tier: 1, rewardMin: 700, rewardMax: 1300 },
  { title: "Border Recon Sweep", description: "Trace fence gaps and mark smuggler paths along the eastern border.", type: "recon", difficulty: "Hard", tier: 3, rewardMin: 3200, rewardMax: 4800 },
];

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function windowStartFor(now: number) {
  return Math.floor(now / WINDOW_MS) * WINDOW_MS;
}

function pickContracts(windowStartedAt: number): OpsContract[] {
  const windowId = Math.floor(windowStartedAt / WINDOW_MS);
  const seeded = mulberry32((windowId * 2654435761) >>> 0);
  const pool = [...CONTRACT_POOL];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(seeded() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const expiresAt = windowStartedAt + WINDOW_MS;
  return pool.slice(0, 5).map((tpl, idx) => {
    const span = tpl.rewardMax - tpl.rewardMin;
    const reward = tpl.rewardMin + Math.floor(seeded() * (span + 1));
    return {
      id: `ops-${windowStartedAt}-${idx}`,
      title: tpl.title,
      description: tpl.description,
      difficulty: tpl.difficulty,
      tier: tpl.tier,
      reward,
      type: tpl.type,
      expiresAt,
      status: "available" as const,
    };
  });
}

function loadStore(): OpsStore {
  const now = Date.now();
  const fallbackStart = windowStartFor(now);
  if (typeof window === "undefined") {
    return { windowStartedAt: fallbackStart, contracts: pickContracts(fallbackStart) };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as OpsStore;
      if (
        parsed &&
        typeof parsed.windowStartedAt === "number" &&
        Array.isArray(parsed.contracts) &&
        parsed.contracts.length === 5 &&
        now < parsed.windowStartedAt + WINDOW_MS
      ) {
        return parsed;
      }
    }
  } catch {
    /* ignore */
  }
  const windowStartedAt = fallbackStart;
  const next: OpsStore = { windowStartedAt, contracts: pickContracts(windowStartedAt) };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}

function saveStore(store: OpsStore) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* ignore */
  }
}

function formatCountdown(ms: number) {
  const clamped = Math.max(0, ms);
  const totalSec = Math.floor(clamped / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${h}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
}

const DIFFICULTY_STYLE: Record<Difficulty, string> = {
  Easy: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  Normal: "border-sky-500/40 bg-sky-500/10 text-sky-300",
  Hard: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  Elite: "border-violet-500/40 bg-violet-500/10 text-violet-300",
  Legendary: "border-rose-500/40 bg-rose-500/10 text-rose-300",
};

function OperationsPage() {
  const [store, setStore] = useState<OpsStore>(() => loadStore());
  const [now, setNow] = useState(() => Date.now());

  const rotateIfNeeded = useCallback(() => {
    const t = Date.now();
    setNow(t);
    setStore((prev) => {
      if (t < prev.windowStartedAt + WINDOW_MS) return prev;
      const windowStartedAt = windowStartFor(t);
      const next: OpsStore = { windowStartedAt, contracts: pickContracts(windowStartedAt) };
      saveStore(next);
      return next;
    });
  }, []);

  useEffect(() => {
    rotateIfNeeded();
    const id = window.setInterval(rotateIfNeeded, 1000);
    return () => window.clearInterval(id);
  }, [rotateIfNeeded]);

  const remaining = useMemo(
    () => store.windowStartedAt + WINDOW_MS - now,
    [store.windowStartedAt, now],
  );

  const acceptContract = (id: string) => {
    setStore((prev) => {
      const next: OpsStore = {
        ...prev,
        contracts: prev.contracts.map((c) =>
          c.id === id ? { ...c, status: c.status === "active" ? "available" : "active" } : c,
        ),
      };
      saveStore(next);
      const toggled = next.contracts.find((c) => c.id === id);
      if (toggled?.status === "active") toast.success(`Accepted: ${toggled.title}`);
      else if (toggled) toast.message(`Released: ${toggled.title}`);
      return next;
    });
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 space-y-8">
      <DayZPageHeader
        title="Operations"
        subtitle="Five rotating field contracts \u2014 new set every 5 hours"
        icon={<IconCampaign size={16} />}
        hue={320}
        actions={
          <div className="flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1.5 text-xs text-amber-50/80">
            <IconClock size={14} className="text-primary" />
            <span>Next rotation</span>
            <span className="font-mono text-primary">{formatCountdown(remaining)}</span>
          </div>
        }
      />
      <div className="grid gap-4">
        <AnimatePresence initial={false}>
          {store.contracts.map((contract, index) => (
            <motion.div
              key={contract.id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.35, delay: index * 0.05, ease: [0.16, 1, 0.3, 1] }}
            >
              <GlassPanel className="overflow-hidden p-0">
                <div className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider ${DIFFICULTY_STYLE[contract.difficulty]}`}>
                          T{contract.tier} \u00b7 {contract.difficulty}
                        </span>
                        <span className="rounded-full border border-glass-border px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                          {contract.type}
                        </span>
                        {contract.status === "active" && (
                          <span className="rounded-full border border-amber-300/40 bg-amber-400/15 px-2 py-0.5 text-[10px] uppercase tracking-wider text-amber-100">
                            Active
                          </span>
                        )}
                      </div>
                      <h2 className="font-display text-lg font-semibold text-foreground">{contract.title}</h2>
                      <p className="mt-1 text-sm text-muted-foreground">{contract.description}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Reward</div>
                      <div className="font-mono text-xl text-amber-100">{contract.reward.toLocaleString()}</div>
                      <div className="text-[11px] text-muted-foreground">credits</div>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-glass-border/70 pt-4">
                    <span className="text-[11px] text-muted-foreground">
                      Expires with window \u00b7 {new Date(contract.expiresAt).toLocaleTimeString()}
                    </span>
                    <Button
                      size="sm"
                      variant={contract.status === "active" ? "outline" : "default"}
                      onClick={() => acceptContract(contract.id)}
                    >
                      {contract.status === "active" ? "Release" : "Accept"}
                    </Button>
                  </div>
                </div>
              </GlassPanel>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
