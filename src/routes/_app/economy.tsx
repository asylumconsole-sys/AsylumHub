import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { GlassPanel } from "@/components/ui-custom/GlassPanel";
import { DayZPageHeader } from "@/components/dayz/DayZPageHeader";
import { IconBolt, IconChart } from "@/components/ui-custom/CustomIcon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getEconomyBalance,
  listEconomyLeaderboard,
  listRecentTransfers,
  payPlayer,
} from "@/lib/economy.functions";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/economy")({
  component: EconomyPage,
});

function EconomyPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const playerId = user?.id || "demo-user";
  const displayName =
    (typeof user?.user_metadata?.name === "string" && user.user_metadata.name) ||
    user?.email ||
    playerId;

  const [toPlayerId, setToPlayerId] = useState("");
  const [amount, setAmount] = useState("1000");
  const [note, setNote] = useState("");

  const balanceQ = useQuery({
    queryKey: ["economy-balance", playerId],
    queryFn: () => getEconomyBalance({ data: { playerId } }),
  });
  const boardQ = useQuery({
    queryKey: ["economy-board"],
    queryFn: () => listEconomyLeaderboard(),
  });
  const txQ = useQuery({
    queryKey: ["economy-tx"],
    queryFn: () => listRecentTransfers(),
  });

  const invalidateEconomy = () => {
    qc.invalidateQueries({ queryKey: ["economy-balance", playerId] });
    qc.invalidateQueries({ queryKey: ["economy-board"] });
    qc.invalidateQueries({ queryKey: ["economy-tx"] });
  };

  const pay = useMutation({
    mutationFn: () =>
      payPlayer({
        data: {
          toPlayerId: toPlayerId.trim(),
          amount: Number(amount),
          note: note.trim() || undefined,
        },
      }),
    onSuccess: (res) => {
      toast.success(`Paid ${res.transfer.amount.toLocaleString()} to ${res.transfer.toPlayerId}`);
      setNote("");
      invalidateEconomy();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Payment failed"),
  });

  const balance = balanceQ.data?.balance ?? 0;
  const xp = balanceQ.data?.xp ?? 0;

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <DayZPageHeader
        title="Economy"
        subtitle="Credits, transfers, and leaderboard"
        icon={<IconBolt size={16} />}
        hue={48}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <GlassPanel className="p-5">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Your balance</div>
          <div className="mt-2 font-display text-3xl text-primary">
            {balanceQ.isLoading ? "…" : balance.toLocaleString()}
          </div>
          <div className="mt-1 text-sm text-muted-foreground">XP {xp.toLocaleString()} · {displayName}</div>
        </GlassPanel>
        <GlassPanel className="p-5">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Send credits</div>
          <div className="mt-3 space-y-3">
            <div>
              <Label htmlFor="to">Player id</Label>
              <Input id="to" value={toPlayerId} onChange={(e) => setToPlayerId(e.target.value)} placeholder="discord/user id" />
            </div>
            <div>
              <Label htmlFor="amt">Amount</Label>
              <Input id="amt" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="note">Note</Label>
              <Input id="note" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <Button disabled={pay.isPending || !toPlayerId.trim()} onClick={() => pay.mutate()}>
              {pay.isPending ? "Sending…" : "Pay player"}
            </Button>
          </div>
        </GlassPanel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <GlassPanel className="p-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium">
            <IconChart size={16} /> Leaderboard
          </div>
          <div className="space-y-2">
            {(boardQ.data ?? []).slice(0, 12).map((row, i) => (
              <div key={row.playerId} className="flex items-center justify-between text-sm">
                <span className="truncate text-muted-foreground">
                  {i + 1}. {row.displayName || row.playerId}
                </span>
                <span className="font-mono text-primary">{row.balance.toLocaleString()}</span>
              </div>
            ))}
            {!boardQ.isLoading && (boardQ.data?.length ?? 0) === 0 && (
              <div className="text-sm text-muted-foreground">No accounts yet.</div>
            )}
          </div>
        </GlassPanel>
        <GlassPanel className="p-5">
          <div className="mb-3 text-sm font-medium">Recent transfers</div>
          <div className="space-y-2">
            {(txQ.data ?? []).slice(0, 12).map((tx) => (
              <div key={tx.id} className="text-sm">
                <div className="flex justify-between gap-2">
                  <span className="truncate text-muted-foreground">
                    {tx.fromPlayerId} → {tx.toPlayerId}
                  </span>
                  <span className="font-mono text-primary">{tx.amount.toLocaleString()}</span>
                </div>
                {tx.note ? <div className="text-[11px] text-muted-foreground">{tx.note}</div> : null}
              </div>
            ))}
            {!txQ.isLoading && (txQ.data?.length ?? 0) === 0 && (
              <div className="text-sm text-muted-foreground">No transfers yet.</div>
            )}
          </div>
        </GlassPanel>
      </div>
    </div>
  );
}
