# Grok handoff — AsylumHub / DayZ Pro (from Cursor agent)

**Date:** 2026-09-19 (Europe/Rome)  
**Owner / user:** Asylum DAYZ (asylumconsole-sys)  
**Why this exists:** Cursor agent was burning credits on a stuck large-file GitHub push. User asked to hand off to Grok AI mid-task. Continue from here.

---

## 1. What you are continuing

Repo: **https://github.com/asylumconsole-sys/AsylumHub**  
Branch: **`main`**  
Live site: **https://dayzpro.online** (Railway deploy from `main`)

User asked for three hub changes:

1. **Font:** sitewide display font **Acme** (replace MedievalSharp) — **DONE on main**
2. **Beamer “View inventory”** button + loadout copy — **UI file NOT on main** (see blocker)
3. **NPC economy:** permanent unlock → **consumable spawn packs** (buy charges, burn 1 per successful spawn) — **backend DONE on main**; **shop UI NOT on main**

### Pack tiers (product spec)

| Pack | Price (credits) | Spawns |
|------|-----------------|--------|
| Recon | 1000 | 8 |
| Operator | 2500 | 25 |
| Strike | 5000 | 60 |
| Battalion | 10000 | 150 |

Legacy permanent `owned` NPCs migrate to **25 charges** on read.

---

## 2. CRITICAL BLOCKER (do this first)

**`src/routes/_app/tools/npc-shop.tsx` on `main` is destroyed.**

Contents are literally:

```text
PLACEHOLDER_LOADING
```

That happened because large-file updates via GitHub Contents / `push_files` / `create_or_update_file` kept getting stubbed. Several “restore” commits have the same stub.

**Backend for packs is live; the shop page is broken.** Fix the shop file, then Railway will redeploy.

### How to fix (recommended)

1. Clone `asylumconsole-sys/AsylumHub`, checkout `main`.
2. Restore `src/routes/_app/tools/npc-shop.tsx` with a full shop that:
   - Imports or inlines **SPAWN_PACKS** (Recon/Operator/Strike/Battalion).
   - Calls `purchaseNpc` with `{ npcId, npcName, price, spawns }` from the selected pack.
   - Reads `charges` from `getNpcInventory` (not permanent `owned`).
   - Gates deploy on `charges[npcId] > 0`.
   - Shows **View inventory** for The Beamer with the loadout blurb.
3. Prefer **`git push` with a PAT / SSH**, not the GitHub “update file” API for this ~25–30KB file.
4. Confirm on GitHub that the file starts with `import` and contains `SPAWN_PACKS` and `View inventory`, not `PLACEHOLDER`.
5. Confirm Railway redeploy for dayzpro.online.

### Already on main (do not revert)

| Path | Status |
|------|--------|
| `src/styles.css` | Acme font |
| `src/lib/economy.functions.ts` | `charges`, `spawns` on purchase, `consumeNpcSpawn`, legacy owned→25 |
| `src/lib/dayz-spawn.functions.ts` | Calls `consumeNpcSpawn` after successful spawn |
| `src/lib/npc/spawn-packs.ts` | Pack definitions |
| `src/lib/npc/the-beamer-cfg.ts` | Beamer cfg XML extracted |

---

## 3. Repo & access

- **GitHub:** https://github.com/asylumconsole-sys/AsylumHub  
- Connect Grok to this repo (GitHub app / clone with write access).
- **Do not** commit secrets.

### Local good copies (Cursor box — if available)

- `/workspace/hub-push/npc-shop.tsx` (~30KB) — full packs + View inventory (good)
- `/workspace/hub-push/npc-shop-compact.tsx` (~25KB)
- `/tmp/npc-shop-RESTORE.tsx`

If you only have GitHub: rebuild from product spec + remote economy types.

---

## 4. How it works (short)

- **Economy:** `npc-inventory.json` → `charges[playerId][npcId]`. Purchase adds `spawns`. `consumeNpcSpawn` decrements after spawn.
- **Spawn:** after live or queued success → `consumeNpcSpawn`.
- **Shop (intended):** pack picker, buy with `spawns`+`price`, show charges left, View inventory modal, deploy gated on charges.
- **Deploy:** push `main` → Railway → dayzpro.online.

---

## 5. Discord (optional context)

DAYZ PRO guild. Recent: Junior 2x donation announcement live in `#announcements` with `@everyone` + embed. Not required for shop restore.

---

## 6. Do not waste time on

- Re-implementing charges / `consumeNpcSpawn` / Acme (already on main).
- GitHub Contents API for the full shop without verifying remote (stubbed repeatedly).
- Cursor `GITHUB_TOKEN` secret-request (never injected into box env).

---

## 7. Success checklist

- [ ] Shop file on main is real TSX (starts with imports)
- [ ] `SPAWN_PACKS` + `View inventory` present
- [ ] Purchase sends `spawns` + `price`
- [ ] UI uses `charges`
- [ ] dayzpro.online shop loads
- [ ] Smoke: buy Operator (+25), spawn once (24 left)

## 8. First message to user

> Shop backend (packs + consume) and Acme are already on main. Only blocker: `npc-shop.tsx` is the stub `PLACEHOLDER_LOADING`. I’ll restore packs + View inventory via git push and confirm Railway.

— End of handoff from Cursor / PRO AI —
