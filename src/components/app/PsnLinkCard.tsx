import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getMyLinkedPlayernames, linkMyPsn } from "@/lib/account-links.functions";

export function PsnLinkCard() {
  const { user } = useAuth();
  const discordId = user?.id ?? "";
  const [psn, setPsn] = useState("");
  const [draft, setDraft] = useState("");
  const [serverId, setServerId] = useState<"101" | "102">("101");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!discordId) return;
    let cancelled = false;
    getMyLinkedPlayernames({ data: { discordId } })
      .then((res) => {
        if (cancelled) return;
        const name = res.psn ?? "";
        setPsn(name);
        setDraft(name);
        const sid = res.links?.[0]?.serverId;
        if (sid === "101" || sid === "102") setServerId(sid);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [discordId]);

  const save = async () => {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await linkMyPsn({ data: { discordId, username: draft, serverId } });
      const tag = res.psn ?? draft.trim();
      setPsn(tag);
      setMsg(
        `Linked ${tag}. You now get auto NPC spawns on this tag, the correct credit wallet, killfeed stats, shop drops, and faction intel. Your Discord nickname will change to ${tag}. You can change that later in Settings for 1,000 CR.`,
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save PSN");
    } finally {
      setBusy(false);
    }
  };

  const unlink = async () => {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      await linkMyPsn({ data: { discordId, username: psn || draft, serverId, unlink: true } });
      setPsn("");
      setDraft("");
      setMsg("Unlinked.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not unlink");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section data-tour="psn-link" className="rounded-2xl border border-glass-border bg-glass/40 p-4 sm:p-6">
      <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">PlayStation / Xbox</div>
      <h2 className="mt-1 font-display text-xl sm:text-2xl">Linked gamertag</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Link once for NPC spawns, credits, killfeed, and shop drops on the right character. Linking sets your Discord nickname to this tag. Change the nickname later in Settings for 1,000 CR.
      </p>

      {psn ? (
        <div className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
          Active: <span className="font-mono">{psn}</span> · server {serverId}
        </div>
      ) : (
        <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          No tag linked yet.
        </div>
      )}

      <label className="mt-4 block text-xs uppercase tracking-wider text-muted-foreground">Online ID</label>
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Your PSN or Xbox gamertag"
        autoComplete="username"
        autoCapitalize="off"
        className="mt-1 w-full rounded-xl border border-glass-border bg-black/30 px-3 py-3 text-base outline-none focus:border-primary/50"
      />

      <div className="mt-3 grid grid-cols-2 gap-2">
        {(["101", "102"] as const).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setServerId(id)}
            className={`rounded-xl border px-3 py-2.5 text-sm ${
              serverId === id
                ? "border-primary bg-primary/20 text-foreground"
                : "border-glass-border text-muted-foreground"
            }`}
          >
            Server {id}
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          disabled={busy || !draft.trim()}
          onClick={save}
          className="flex-1 rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {busy ? "Saving…" : psn ? "Update link" : "Link gamertag"}
        </button>
        {psn ? (
          <button type="button" disabled={busy} onClick={unlink} className="rounded-xl border border-glass-border px-4 py-3 text-sm text-muted-foreground">
            Unlink
          </button>
        ) : null}
      </div>
      {msg ? <p className="mt-3 text-sm text-emerald-300">{msg}</p> : null}
      {err ? <p className="mt-3 text-sm text-red-300">{err}</p> : null}
    </section>
  );
}
