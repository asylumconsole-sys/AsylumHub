# DAYZ PRO: Item Shop + Vehicle Shop handoff (AsylumHub / dayzpro.online)

Last updated: Sun 27 Sep 2026, ~10:50 Berlin (CEST) by Grok Bot. For Grok: read section 0 and section 12 first.
No secrets in this file. Env vars are listed by NAME only.

## 0. The one rule that keeps losing the shop

* The site (Railway service DAYZ PRO) is linked to GitHub `asylumconsole-sys/AsylumHub` main and auto-deploys on every push to main.
* The shop is live from a CLI deploy (`railway up`) of the box branch `restore/shop-2026-09-27` (deploy `a6f332e6`, 27 Sep 10:40 Berlin).
* ANY push to main, and any variable change on the DAYZ PRO service without `--skip-deploys`, redeploys main and wipes the shop. That happened on 26 Sep 16:00 and again on 27 Sep 10:08-10:19 (nine pushes to main).
* Permanent fix: merge this branch (`grok/shop-cart-checkout-activity`) into main. After that, main contains the shop and auto-deploys keep it.

## 1. What is live (27 Sep 2026)

| Piece | State |
|---|---|
| Item shop | 1,427 sellable items, all with local PNG images (0 placeholders, 33 approximate recolours). No whole vehicles, no EasterEgg. Vehicle parts kept in category "Vehicle Parts". |
| Vehicle shop | 6 models / 14 colour variants, 6 preset road spots, 1 vehicle per order, max 5 per restart, a spot is not reused for 2 restarts. |
| Cart | per Discord user (Mongo `shop_carts`), `?cart=id:qty,...` prefill, 1 vehicle max in cart. |
| Checkout | server prices only, atomic conditional debit of the Discord wallet (Mongo `players.credits`), one checkout at a time per account (`shop_checkout_locks`), Idempotency-Key replay, vehicles check out separately from items. |
| Delivery | items: buyer's own last ADM position (only via bot-verified PSN link, max 360 min old) or 4 public safe spots; vehicles: preset vehicle spots only. Label: "Arrives at next server restart (every 2h)". |
| Auto-refund | bridge reports `failed`, hub refunds (idempotent) and releases the vehicle slot. Not refunded once `verified_live`. |
| Discord Activity | CSP frame-ancestors for discord.com, discordapp.com, *.discordsays.com; SDK sign-in via `/api/discord/activity-token`. |
| Security | ticket-gate locked (401); cart/orders/checkout need Discord bearer; bridge endpoints need `HUB_BRIDGE_SECRET`; hub-api wallet routes need `HUB_BOT_SECRET`; `GET /api/live?say=` now needs `x-hub-secret` (before, anyone could make the bot post in Discord server chat). |

## 2. Architecture

```
Browser / Discord Activity -> dayzpro.online (Railway "DAYZ PRO", TanStack Start, Node, Dockerfile)
   /api/shop/*, /api/cart, /api/checkout, /api/orders, /api/server/status, /api/item-image/:cls
   Mongo collections: players, transactions, shop_carts, shop_orders, shop_checkout_locks, shop_vehicle_slots
   Volume DAYZ_DATA_DIR: item-images/*.png, shop-data.json, bot-account-links.json
Box scheduler (Grok Bot's computer, /workspace/project-heartbeat, python): every 30 s GET /api/bridge/orders (Bearer HUB_BRIDGE_SECRET)
   paid orders -> uploads mission files to 101 at T-10..T-3 min before DayZ++'s even-hour restart (never restarts the server)
   after the restart verifies -> POST /api/bridge/orders (state report)
Nitrado 101 Livonia (service 17656048), mission dayzOffline.enoch, server clock US Eastern = Berlin minus 6h
hub-api (Railway "hub-api", Express+mongoose): wallet/economy API used by the PRO-AI bot (secret-gated)
PRO-AI (Railway "PRO-AI", discord.js bot): sends HUB_BOT_SECRET to hub-api
```

## 3. Site code map

* UI: `src/components/shop/ShopStore.tsx` (`<ShopStore/>` items, `<ShopStore mode="vehicles"/>`), used by `src/routes/_app/tools/ItemShop.tsx` (Item Shop tab), `vehicle-shop-content.tsx` (Vehicles tab), `item-shop.tsx` (`?cart=` prefill). Older UIs `item-shop-content.tsx` / `next-restart.ts` stay in the repo but are not routed.
* Server libs `src/lib/shop/`: `catalog.server.ts` (NOT_ITEMS = vehicle hulls + EasterEgg), `vehicles.server.ts` (models, prices, spots, limits, atomic reservations), `orders.server.ts` (cart, checkout, refunds, bridge), `delivery.server.ts`, `auth.server.ts`, `images.server.ts` (PNG only), `status.server.ts`, `mongo.server.ts`.
* Discord Activity: `src/lib/discord-activity.ts`, `src/routes/api/discord/activity-token.ts`, CSP in `src/server.ts`.

### Endpoints
| Method/path | Auth | Purpose |
|---|---|---|
| GET `/api/shop/catalog`, `/api/shop/items` | public | item catalog |
| GET `/api/shop/vehicles` | public | models, spots, capacity, next restart |
| GET `/api/shop/delivery-options` | Discord | own last position + safe spots |
| GET/POST/PATCH/PUT/DELETE `/api/cart` | Discord | cart |
| POST `/api/checkout` | Discord + Idempotency-Key | `{scope:"items"|"vehicle", delivery:{mode:"safe_spot"|"last_position"|"vehicle_spot", spotId}}` |
| GET `/api/orders`, `/api/orders/:id` | Discord | order status |
| GET `/api/server/status` | public | players, next restart, bridge online |
| GET `/api/item-image/:classname` | public | PNG from volume |
| `/api/bridge/*` | Bearer HUB_BRIDGE_SECRET | box scheduler |
| POST `/api/discord/ticket-gate` | locked | 401 |
| `/api/live` | x-hub-secret | post into Discord server chat |

### Order states
`pending_payment` -> `paid` -> `queued` -> `uploaded` -> `verified_live` -> `delivered`. `failed` = refunded automatically (only before `verified_live`). `rejected` = never charged.

## 4. Spawn method on 101

* Items: Object Spawner. Each item is one object in `custom/heartbeat_queue.json` referenced from `cfggameplay.json` objectSpawnersArr; removed again after 1 restart.
* Vehicles: one new CE event per car (`VehicleShop_<id>` in `db/events.xml`, nominal/min/max 1, restock 0) + one position in `cfgeventspawns.xml`. The CE spawns the car with every attachment listed in the live `cfgspawnabletypes.xml` (wheels + spare, doors, hood, trunk, battery, plug, radiator, headlights). Only classnames with a full cfgspawnabletypes entry are sold. After the car is live its event is locked so it never respawns.
* Uploads only in the window T-10..T-3 min before the even-hour restart. Never calls the Nitrado restart endpoint, never touches init.c, backs up live files first. ADM logs only.

### Spots, limits, prices
* Item safe spots: Roadside 078/058 (7812.6, 5889.5), Roadside 055/087 (5521.1, 8714.3), Roadside 025/055 (2562.8, 5521.3), Open ground 066/111 (6655.6, 11102.9).
* Vehicle spots: (10872.59, 940.38), (6101.03, 4090.22), (11050.73, 4385.64), (10657.11, 11214.11), (3177.36, 12065.05), (2026.58, 7376.6).
* Limits: items 10 per order, 60 per restart; vehicles 1 per order, 5 per restart.
* Vehicle prices (CR): Ada 4x4 25,000; Gunter 2 22,000; Olga 24 28,000; Sarka 120 20,000; M3S Truck (covered) 45,000; M1025 Humvee 80,000.

## 5. Railway (project DayzPro `54f918be-cfc1-44fc-9383-85dd48d2fb90`)
* DAYZ PRO (site) `ceb6575f-b253-43b4-a4ff-b4f9b939429a`, live deploy `a6f332e6` (CLI). hub-api `8ccb9a4e-d2ec-492b-be04-10bf91d83699`. PRO-AI `a82c4ce4-bb15-4975-9cab-7a617ba63173`. hub-api and PRO-AI source are not on GitHub (CLI deploys from Grok Bot's computer).
* Site env names: MONGO_URL, DAYZ_DATA_DIR, HUB_BRIDGE_SECRET, HUB_BOT_SECRET, DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, VITE_DISCORD_CLIENT_ID, DISCORD_REDIRECT_URI, DISCORD_TOKEN, DISCORD_GUILD_ID, FTP_101X_*, NITRADO_API_TOKEN, NITRADO_SERVICE_101X. Optional: SHOP_MAX_ITEMS_PER_ORDER, SHOP_MAX_ITEMS_PER_RESTART, SHOP_MAX_VEHICLES_PER_RESTART, SHOP_SAFE_SPOTS. SHOP_TEST_AUTH_SECRET must stay unset.

## 6. Order history
* `ord_muicbcia_2dabe39c` (1 bandage, 350 CR): uploaded 26 Sep 15:50, verified live at the 16:00 restart, delivered. First real item order worked end to end.
* No real vehicle order has run yet (dry runs only). Watch the first one.

## 10. Known gaps
1. Merge this branch into main (see section 0).
2. hub-api still has unauthenticated routes: POST /api/players, POST /api/players/sync, /api/shops/* buy, /api/daily, /api/npc.
3. `/pro-ai.jpg` is missing (sidebar logo broken).
4. Discord Developer Portal: Activity URL mapping to dayzpro.online still pending (owner action).
5. Vehicle images are ~250 px wiki renders.

## 12. For Grok: how to continue
1. Before you push anything to main, merge this branch (or rebase your work on it). If you get conflicts, keep `ShopStore` in `ItemShop.tsx` and `vehicle-shop-content.tsx`, and regenerate `src/routeTree.gen.ts` / `package-lock.json`.
2. Don't reroute the Shop tab back to `item-shop-content.tsx` or the old `purchaseShopItem` vehicle UI: they have no spawn pipeline.
3. Next work: gate the hub-api open routes, add `/pro-ai.jpg`, sharper vehicle images.
