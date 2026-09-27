import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

export const Route = createFileRoute("/season")({
  component: SeasonPage,
  head: () => ({ meta: [{ title: "Dunes of Reckoning \u2014 Season 1" }] }),
});

const XP = 1000;
const COUNT = 100;
const END = Date.UTC(2026, 10, 30, 23, 59, 59);
const KEY = "dunes-reckoning-s1-tab";
const OFFERS = [
  { id: "premium" as const, name: "Premium Pass", cents: 999, detail: "Every tier, the exclusives, and the tier 100 crown.", skip: 0 },
  { id: "plus20" as const, name: "Pass + 20 tiers", cents: 1999, detail: "Premium, plus twenty tiers right now.", skip: 20 },
  { id: "plus50" as const, name: "Pass + 50 tiers", cents: 3999, detail: "Premium, plus a fifty-tier climb.", skip: 50 },
  { id: "skip" as const, name: "Single tier skip", cents: 150, detail: "Buy the next tier of XP.", skip: 1 },
];

const COSMETICS = ["Dunecutter Wrap", "Saltwind Shemagh", "Cinder Plate", "Mirage Goggles", "Ash Holster", "Bloodglass Knife", "Obsidian Rig", "Red Horizon Cape", "Scorched Boots", "Glassbite Bandolier"];
const ITEMS = ["Scrap rifle crate", "Brine canteen", "Field nail tin", "Signal flare bundle", "Medic roll"];
const BOOSTS = ["Ember XP, 2 hours", "Rep flare, 24 hours", "Double salvage, 1 hour", "Night sight tonic"];
const SEASONAL = ["Reckoning armband", "Dune saint patch", "Season sun tattoo", "Ash procession banner"];
const RIVALS = [
  { name: "Ash Mercenary", xp: 74000 },
  { name: "Red Dune", xp: 61000 },
  { name: "Salt Widow", xp: 48000 },
  { name: "Cinder Fox", xp: 33500 },
  { name: "Glass Mile", xp: 22000 },
  { name: "Brine Saint", xp: 9100 },
];

type Cat = "cosmetic" | "item" | "credits" | "boost" | "exclusive" | "seasonal";
type Reward = { id: string; tier: number; track: "free" | "premium"; name: string; cat: Cat; rarity: string; credits: number; blurb: string };
type Save = {
  xp: number; premium: boolean; claimed: string[]; wallet: number; callsign: string;
  killsToday: number; killsWeek: number; opsToday: number; opsWeek: number; checkInDay: string;
  dailyClaimed: string[]; weeklyClaimed: string[]; day: string; week: string; log: string[];
};

function money(cents: number) {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}
function tierOf(xp: number) { return Math.min(COUNT, Math.floor(Math.max(0, xp) / XP)); }
function today() { return new Date().toISOString().slice(0, 10); }
function thisWeek() {
  const d = new Date();
  const start = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return `${d.getUTCFullYear()}-W${Math.floor((d.getTime() - start.getTime()) / 86400000 / 7)}`;
}
function rarity(n: number) {
  if (n === 100 || n === 50) return "legendary";
  if (n % 25 === 0) return "epic";
  if (n % 5 === 0) return "rare";
  return "common";
}
function premiumOf(n: number): Reward {
  const credits = n === 100 ? 20000 : n === 50 ? 8000 : 150 + n * 20;
  if (n === 100) return { id: "p-100", tier: n, track: "premium", name: "Crown of the Reckoning", cat: "exclusive", rarity: "legendary", credits, blurb: "Legendary cloak and crown. Only this season." };
  if (n === 50) return { id: "p-50", tier: n, track: "premium", name: "Ashen Visor", cat: "exclusive", rarity: "legendary", credits, blurb: "Mid-season exclusive. The visor does not return." };
  if (n % 5 === 0) return { id: `p-${n}`, tier: n, track: "premium", name: COSMETICS[(n / 5) % COSMETICS.length]!, cat: n % 10 === 0 ? "seasonal" : "cosmetic", rarity: rarity(n), credits, blurb: "Major tier cosmetic plus a credit purse." };
  const slot = n % 4;
  if (slot === 1) return { id: `p-${n}`, tier: n, track: "premium", name: `${credits.toLocaleString("en-US")} credits`, cat: "credits", rarity: rarity(n), credits, blurb: "Paid into your season wallet when you claim." };
  if (slot === 2) return { id: `p-${n}`, tier: n, track: "premium", name: ITEMS[n % ITEMS.length]!, cat: "item", rarity: rarity(n), credits: Math.round(credits * 0.45), blurb: "Field kit staged for the next restart." };
  if (slot === 3) return { id: `p-${n}`, tier: n, track: "premium", name: BOOSTS[n % BOOSTS.length]!, cat: "boost", rarity: rarity(n), credits: Math.round(credits * 0.35), blurb: "Timed booster. Starts when you claim it." };
  return { id: `p-${n}`, tier: n, track: "premium", name: SEASONAL[n % SEASONAL.length]!, cat: "seasonal", rarity: rarity(n), credits: Math.round(credits * 0.4), blurb: "Seasonal mark. Gone when the dunes close." };
}
function freeOf(n: number): Reward | null {
  if (n !== 1 && n % 5 !== 0) return null;
  const credits = n === 1 ? 250 : n * 80;
  const cosmetic = n === 100 || n === 50 || n === 25 || n === 75;
  return { id: `f-${n}`, tier: n, track: "free", name: cosmetic ? `Dust ${COSMETICS[(n / 5) % COSMETICS.length]}` : `${credits.toLocaleString("en-US")} credits`, cat: cosmetic ? "cosmetic" : "credits", rarity: n === 100 ? "epic" : "common", credits, blurb: cosmetic ? "Free-track cosmetic." : "Free-track purse." };
}
const TIERS = Array.from({ length: COUNT }, (_, i) => ({ n: i + 1, free: freeOf(i + 1), premium: premiumOf(i + 1) }));

function blank(): Save {
  return { xp: 3500, premium: false, claimed: [], wallet: 22000, callsign: "Survivor", killsToday: 2, killsWeek: 6, opsToday: 0, opsWeek: 1, checkInDay: "", dailyClaimed: [], weeklyClaimed: [], day: today(), week: thisWeek(), log: ["Season file opened on the dunes."] };
}
function load(): Save {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return blank();
    return { ...blank(), ...JSON.parse(raw) };
  } catch { return blank(); }
}

function SeasonPage() {
  const [save, setSave] = useState<Save>(blank);
  const [ready, setReady] = useState(false);
  const [track, setTrack] = useState<"free" | "premium">("premium");
  const [picked, setPicked] = useState(4);
  const [now, setNow] = useState(Date.now());
  const [pay, setPay] = useState<null | { id: (typeof OFFERS)[number]["id"]; times: number }>(null);
  const [note, setNote] = useState("");

  useEffect(() => {
    setSave(load());
    setReady(true);
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  useEffect(() => { if (ready) localStorage.setItem(KEY, JSON.stringify(save)); }, [save, ready]);
  useEffect(() => {
    if (!pay) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setPay(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pay]);

  const write = (patch: Partial<Save>, message: string) => {
    setSave((current) => ({ ...current, ...patch, log: [message, ...current.log].slice(0, 8) }));
    setNote(message);
  };
  const xp = ready ? save.xp : 3500;
  const tier = tierOf(xp);
  const into = xp >= COUNT * XP ? XP : Math.max(0, xp) % XP;
  const leftMs = Math.max(0, END - now);
  const left = { d: Math.floor(leftMs / 86400000), h: Math.floor((leftMs % 86400000) / 3600000), m: Math.floor((leftMs % 3600000) / 60000), s: Math.floor((leftMs % 60000) / 1000) };
  const selected = TIERS[picked - 1] ?? TIERS[0]!;
  const reward = track === "free" ? selected.free : selected.premium;
  const gap = Math.max(0, selected.n - tier);
  const offer = pay ? OFFERS.find((item) => item.id === pay.id) : null;
  const due = offer ? offer.cents * (pay?.id === "skip" ? pay.times : 1) : 0;
  const board = useMemo(() => [{ name: save.callsign || "Survivor", xp, you: true }, ...RIVALS.map((r) => ({ ...r, you: false }))].sort((a, b) => b.xp - a.xp), [save.callsign, xp]);

  const buy = (id: (typeof OFFERS)[number]["id"], times = 1) => {
    const item = OFFERS.find((row) => row.id === id);
    if (!item) return;
    if (id === "premium" && save.premium) { setNote("Premium is already active."); return; }
    const n = id === "skip" ? Math.max(1, times) : 1;
    const paid = money(item.cents * n);
    write({
      premium: id === "skip" ? save.premium : true,
      xp: Math.min(COUNT * XP, save.xp + item.skip * n * XP),
    }, `Paid ${paid} \u00b7 ${item.name}`);
    setPay(null);
  };

  return (
    <main className="season-root">
      <style>{CSS}</style>
      {note && <p className="season-note" role="status">{note}</p>}
      <header className="season-hero">
        <img src="/bp-template.jpg" alt="Dunes of Reckoning season banner" />
        <div className="season-shade" />
        <div className="season-copy">
          <p className="kicker">Season 1</p>
          <h1>Dunes of Reckoning</h1>
        </div>
        <p className="clock">{left.d}d {left.h}h {left.m}m <span key={left.s}>{left.s}s</span></p>
      </header>

      <section className="season-panel meter">
        <div><p className="kicker">Current tier</p><p className="big">{tier}<span>/{COUNT}</span></p></div>
        <div>
          <div className="row"><span>{Math.round((Math.min(xp, COUNT * XP) / (COUNT * XP)) * 100)}% of the season</span><span>{tier >= COUNT ? "Season complete" : `${XP - into} XP to tier ${tier + 1}`}</span></div>
          <div className="track"><div style={{ width: `${tier >= COUNT ? 100 : (into / XP) * 100}%` }} /></div>
        </div>
        <div className="row">
          <button type="button" className={track === "free" ? "on" : ""} onClick={() => setTrack("free")}>Free</button>
          <button type="button" className={track === "premium" ? "on" : ""} onClick={() => setTrack("premium")}>Premium</button>
        </div>
      </section>

      <div className="rail">
        {TIERS.map((t) => {
          const shown = track === "free" ? t.free : t.premium;
          const past = tier >= t.n;
          return (
            <button key={t.n} type="button" className={picked === t.n ? "picked" : ""} onClick={() => setPicked(t.n)}>
              <span>Tier {t.n}</span>
              <strong>{shown ? shown.name : "Premium only"}</strong>
              <em>{shown ? shown.rarity : "locked"}</em>
              <small>{past && shown ? "Ready" : shown ? `${t.n * XP} XP` : "No free reward"}</small>
            </button>
          );
        })}
      </div>

      <section className="split">
        <article className="season-panel">
          <p className="kicker">Tier {selected.n}</p>
          <h2>{reward ? reward.name : "No free reward on this tier"}</h2>
          <p>{reward ? reward.blurb : "Free pass pays every fifth tier. Premium pays every tier."}</p>
          <div className="row">
            {reward && <button type="button" className="gold" disabled={!ready || save.claimed.includes(reward.id) || tier < selected.n || (reward.track === "premium" && !save.premium)} onClick={() => write({ claimed: [...save.claimed, reward.id], wallet: save.wallet + reward.credits }, reward.credits ? `Claimed +${reward.credits.toLocaleString("en-US")} cr` : "Reward claimed")}>{save.claimed.includes(reward.id) ? "Claimed" : "Claim tier"}</button>}
            <button type="button" disabled={!ready || gap === 0} onClick={() => setPay({ id: "skip", times: gap })}>Skip to here \u00b7 {money(gap * 150)}</button>
          </div>
        </article>
        <article className="season-hero short">
          <img src="/drylands.png" alt="Drylands beyond the season path" />
          <div className="season-shade" />
          <div className="season-copy"><p className="kicker">Climb</p><h2>{xp.toLocaleString("en-US")} XP on the file</h2></div>
        </article>
      </section>

      <section className="offers">
        <h2>Pass options</h2>
        <p>Prices are US dollars. Buying a pass does not spend season credits.</p>
        <div className="cards">
          <article><p className="kicker">Free pass</p><p className="big">$0</p><p>Every fifth tier. Plain cosmetics and small purses.</p></article>
          {OFFERS.filter((item) => item.id !== "skip").map((item) => (
            <article key={item.id} className="paid">
              <p className="kicker">{item.name}</p>
              <p className="big">{money(item.cents)}</p>
              <p>{item.detail}</p>
              <button type="button" onClick={() => { if (item.id === "premium" && save.premium) return; setPay({ id: item.id, times: 1 }); }}>{item.id === "premium" && save.premium ? "Owned" : `Pay ${money(item.cents)}`}</button>
            </article>
          ))}
        </div>
      </section>

      <section className="season-panel">
        <h2>Season board</h2>
        <ol>
          {board.map((row, i) => <li key={row.name}><span>{i + 1}. {row.name}{row.you ? " \u00b7 you" : ""}</span><span>Tier {tierOf(row.xp)}</span></li>)}
        </ol>
      </section>

      {offer && pay && (
        <div className="backdrop" onClick={() => setPay(null)}>
          <div role="dialog" aria-modal="true" aria-labelledby="pay-title" className="sheet" onClick={(event) => event.stopPropagation()}>
            <p className="kicker">US dollars</p>
            <h2 id="pay-title">{offer.name}</h2>
            <p>{pay.times > 1 ? `${pay.times} tier skips. ` : ""}{offer.detail}</p>
            <p className="due">{money(due)}</p>
            <div className="row">
              <button type="button" onClick={() => setPay(null)}>Cancel</button>
              <button type="button" className="gold" autoFocus onClick={() => buy(pay.id, pay.times)}>Pay {money(due)}</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

const CSS = `
.season-root{min-height:100vh;background:#100c09;color:#f4ead8;padding:16px 16px 64px;font-family:Manrope,Sora,sans-serif}
.season-root h1,.season-root h2,.big{font-family:"Instrument Serif",Georgia,serif;font-weight:400}
.season-root h1{font-size:clamp(2.4rem,6vw,4.6rem);line-height:.95;margin:0}
.season-root h2{font-size:1.8rem;margin:.2rem 0}
.kicker{letter-spacing:.18em;text-transform:uppercase;font-size:.72rem;color:#e0b15a;margin:0}
.season-hero{position:relative;overflow:hidden;border-radius:16px;border:1px solid #3d3128;min-height:280px}
.season-hero img{width:100%;height:320px;object-fit:cover;animation:drift 22s ease-in-out infinite alternate}
.season-hero.short img{height:100%;min-height:220px}
.season-shade{position:absolute;inset:0;background:linear-gradient(to top,#100c09,transparent 55%)}
.season-copy{position:absolute;left:20px;bottom:20px;right:20px}
.clock{position:absolute;right:16px;top:16px;border:1px solid #3d3128;background:rgba(16,12,9,.8);border-radius:999px;padding:8px 12px}
.season-panel{margin-top:14px;border:1px solid #3d3128;background:#241c16;border-radius:16px;padding:16px}
.meter{display:grid;gap:12px}
.big{font-size:2.4rem;color:#e0b15a;margin:0}
.big span{font-size:1rem;color:#b7a792}
.row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;justify-content:space-between;color:#b7a792;font-size:.9rem}
.track{height:12px;border-radius:999px;background:#1c1612;overflow:hidden;margin-top:8px}
.track>div{height:100%;background:#e0b15a;position:relative;overflow:hidden}
.track>div:after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,transparent,#fff8,transparent);animation:shine 2.4s linear infinite}
.season-root button{border-radius:999px;border:1px solid #3d3128;background:transparent;color:#f4ead8;padding:10px 14px;cursor:pointer}
.season-root button.on,.season-root button.gold{background:#e0b15a;color:#100c09;border-color:#e0b15a;font-weight:700}
.season-root button:disabled{opacity:.4;cursor:not-allowed}
.season-root button:active{transform:scale(.96)}
.rail{display:flex;gap:8px;overflow:auto;padding:14px 0}
.rail button{width:144px;flex:none;text-align:left;background:#241c16;display:grid;gap:6px;border-radius:16px;transition:transform .18s ease}
.rail button:hover{transform:translateY(-3px)}
.rail button.picked{border-color:#e0b15a;background:#1c1612}
.rail strong{font-size:.9rem;min-height:2.4em}
.rail em,.rail small{font-style:normal;color:#e0b15a;font-size:.72rem;letter-spacing:.12em;text-transform:uppercase}
.rail small{color:#b7a792}
.split{display:grid;gap:14px}
.offers{margin-top:18px}
.cards{display:grid;gap:12px;margin-top:12px}
.cards article{border:1px solid #3d3128;background:#1c1612;border-radius:16px;padding:16px}
.cards .paid{border-color:rgba(224,177,90,.45);background:#241c16}
.cards button{margin-top:12px;width:100%;background:#c4492c}
.season-panel ol{list-style:none;padding:0;margin:8px 0 0}
.season-panel li{display:flex;justify-content:space-between;padding:8px 0;border-top:1px solid #3d3128}
.backdrop{position:fixed;inset:0;background:rgba(16,12,9,.78);display:grid;place-items:center;padding:16px;z-index:40}
.sheet{width:min(440px,100%);background:#241c16;border:1px solid rgba(224,177,90,.5);border-radius:16px;padding:20px;animation:sheet .28s ease}
.due{font-family:"Instrument Serif",Georgia,serif;font-size:3.2rem;color:#e0b15a;margin:12px 0}
.season-note{position:fixed;top:16px;left:50%;transform:translateX(-50%);background:#241c16;border:1px solid #e0b15a;border-radius:999px;padding:8px 14px;z-index:30}
@keyframes drift{to{transform:scale(1.06)}}
@keyframes shine{from{transform:translateX(-120%)}to{transform:translateX(220%)}}
@keyframes sheet{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
@media(min-width:800px){.meter{grid-template-columns:180px 1fr auto}.split{grid-template-columns:1.1fr .9fr}.cards{grid-template-columns:repeat(3,1fr)}}
@media(prefers-reduced-motion:reduce){.season-hero img,.track>div:after,.sheet{animation:none}}
`;
