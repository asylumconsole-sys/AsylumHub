import { readJsonFile, writeJsonFile } from "@/lib/dayz/store";

const PRICE = 15000;
const SCRATCHES = 5;
const GOLD = 0xc4a35a;
const ASH = 0x1a1612;
const BLOOD = 0x8c2f2f;
const TABLE = [
  { kind: "credits", amount: 500000, label: "500,000 credits", weight: 3 },
  { kind: "credits", amount: 80000, label: "80,000 credits", weight: 5 },
  { kind: "credits", amount: 40000, label: "40,000 credits", weight: 12 },
  { kind: "credits", amount: 25000, label: "25,000 credits", weight: 30 },
  { kind: "credits", amount: 15000, label: "15,000 credits", weight: 80 },
  { kind: "credits", amount: 12000, label: "12,000 credits", weight: 180 },
  { kind: "credits", amount: 7500, label: "7,500 credits", weight: 700 },
  { kind: "credits", amount: 4000, label: "4,000 credits", weight: 1800 },
  { kind: "credits", amount: 1500, label: "1,500 credits", weight: 4000 },
  { kind: "credits", amount: 500, label: "500 credits", weight: 8000 },
  { kind: "reputation", amount: 0, label: "reputation", weight: 45000 },
  { kind: "voucher", amount: 0, label: "voucher", weight: 18000 },
  { kind: "nothing", amount: 0, label: "dust", weight: 922190 },
];
const SUM = TABLE.reduce((s, r) => s + r.weight, 0);
const ICONS = ["skull", "bone", "coin", "bomb", "radio", "can", "star", "ticket", "shield", "fire"];
const VOUCHERS = ["Trader voucher", "UAV charge", "Counter-UAV charge", "Base token", "Battlepass voucher", "Garage voucher"];
type Acc = { playerId: string; displayName: string; balance: number; xp: number; reputation?: number };
type Store = { accounts: Record<string, Acc>; transfers: Array<{ id: string; fromPlayerId: string; toPlayerId: string; amount: number; note?: string; createdAt: string }> };
type Ticket = { id: string; userId: string; mark: string[]; cells: string[]; revealed: boolean[]; left: number; kind: string; amount: number; label: string; live: boolean; rep: number; voucher: string | null; done: boolean; won: boolean; createdAt: number };
type Bag = { tickets: Record<string, Ticket> };

function roll() { let n = Math.floor(Math.random() * SUM); for (const row of TABLE) { n -= row.weight; if (n < 0) return row; } return TABLE[TABLE.length - 1]; }
function pick(n: number, ban: string[] = []) { const bag = ICONS.filter((i) => !ban.includes(i)); const out: string[] = []; while (out.length < n && bag.length) out.push(bag.splice(Math.floor(Math.random() * bag.length), 1)[0]); return out; }
function show(icon: string) { return { skull: "\u2620\ufe0f", bone: "\ud83e\uddb4", coin: "\ud83e\ude99", bomb: "\ud83e\udde8", radio: "\ud83d\udcfb", can: "\ud83e\udd6b", star: "\u2b50", ticket: "\ud83c\udf9f\ufe0f", shield: "\ud83d\udee1\ufe0f", fire: "\ud83d\udd25" }[icon] || icon; }
function foil(t: Ticket) { return [0, 1, 2].map((r) => [0, 1, 2].map((c) => t.revealed[r * 3 + c] ? show(t.cells[r * 3 + c]) : "\u25a3").join("  ")).join("\n"); }
function hit(t: Ticket) { const have = new Set(t.cells.filter((icon, i) => t.revealed[i] && t.mark.includes(icon))); return t.mark.every((icon) => have.has(icon)); }
function grid(t: Ticket) { return [0, 1, 2].map((r) => ({ type: 1, components: [0, 1, 2].map((c) => { const i = r * 3 + c; const open = t.revealed[i]; return { type: 2, style: open ? 2 : 1, label: open ? show(t.cells[i]) : "\u25a3", custom_id: `lot_sc:${t.id}:${i}`, disabled: open || t.done }; }) })); }
function view(t: Ticket, extra?: string) { return { flags: 64, embeds: [{ title: t.done ? (t.won ? "FOIL CLEARED" : "FOIL BURNED") : "SCRATCH TICKET", color: t.done ? (t.won ? GOLD : BLOOD) : ASH, description: [`Mark   ${t.mark.map(show).join("   ")}`, "", "```", foil(t), "```", `Stub \`${t.id}\`  \u00b7  ${t.done ? (t.won ? "MARK HIT" : "TICKET DEAD") : `${t.left} scratches left`}`, extra || ""].filter(Boolean).join("\n") }], components: grid(t) }; }

export async function buyLotteryTicket(userId: string, displayName: string) {
  const store = await readJsonFile<Store>("economy.json", { accounts: {}, transfers: [] });
  const bag = await readJsonFile<Bag>("lottery-tickets.json", { tickets: {} });
  if (Object.values(bag.tickets).some((t) => t.userId === userId && !t.done && Date.now() - t.createdAt < 120000)) return { flags: 64, content: "You already have a live ticket. Scratch it or let it burn." };
  store.accounts[userId] ??= { playerId: userId, displayName, balance: 0, xp: 0, reputation: 0 };
  const account = store.accounts[userId];
  account.displayName = displayName || account.displayName;
  if (account.balance < PRICE) return { flags: 64, content: `Need **${PRICE.toLocaleString("en-US")}** credits. You have **${account.balance.toLocaleString("en-US")}**.` };
  account.balance -= PRICE;
  store.transfers.unshift({ id: `tx_${Date.now().toString(36)}`, fromPlayerId: userId, toPlayerId: "lottery", amount: PRICE, note: "scratch ticket", createdAt: new Date().toISOString() });
  const prize = roll();
  const mark = pick(3);
  const cells: Array<string | null> = new Array(9).fill(null);
  const slots = [0, 1, 2, 3, 4, 5, 6, 7, 8];
  const take = () => slots.splice(Math.floor(Math.random() * slots.length), 1)[0];
  for (let i = 0; i < (prize.kind === "nothing" ? 2 : 3); i++) cells[take()] = mark[i];
  const decoys = pick(4, mark);
  while (slots.length) cells[take()] = decoys[Math.floor(Math.random() * decoys.length)] || "bone";
  const ticket: Ticket = { id: `t${Date.now().toString(36)}${Math.floor(Math.random() * 36).toString(36)}`, userId, mark, cells: cells as string[], revealed: new Array(9).fill(false), left: SCRATCHES, kind: prize.kind, amount: prize.amount, label: prize.label, live: prize.kind !== "nothing", rep: prize.kind === "reputation" ? 40 + Math.floor(Math.random() * 161) : 0, voucher: prize.kind === "voucher" ? VOUCHERS[Math.floor(Math.random() * VOUCHERS.length)] : null, done: false, won: false, createdAt: Date.now() };
  bag.tickets[ticket.id] = ticket;
  await writeJsonFile("economy.json", store);
  await writeJsonFile("lottery-tickets.json", bag);
  return view(ticket);
}

export async function scratchLottery(userId: string, customId: string) {
  const index = Number(customId.split(":")[2]);
  const bag = await readJsonFile<Bag>("lottery-tickets.json", { tickets: {} });
  const ticket = bag.tickets[customId.split(":")[1]];
  if (!ticket || ticket.userId !== userId) return { type: 4, data: { flags: 64, content: "That ticket is dead." } };
  if (ticket.done || Date.now() - ticket.createdAt > 120000) { ticket.done = true; await writeJsonFile("lottery-tickets.json", bag); return { type: 7, data: view(ticket, "Time's up.") }; }
  if (!ticket.revealed[index]) { ticket.revealed[index] = true; ticket.left -= 1; }
  let extra = "";
  if (hit(ticket) || ticket.left <= 0) {
    ticket.done = true;
    ticket.won = hit(ticket) && ticket.live;
    extra = "Nothing. The mark was not finished.";
    if (ticket.won) {
      const store = await readJsonFile<Store>("economy.json", { accounts: {}, transfers: [] });
      store.accounts[userId] ??= { playerId: userId, displayName: userId, balance: 0, xp: 0, reputation: 0 };
      if (ticket.kind === "credits") store.accounts[userId].balance += ticket.amount;
      if (ticket.kind === "reputation") store.accounts[userId].reputation = (store.accounts[userId].reputation || 0) + ticket.rep;
      if (ticket.kind === "voucher") store.accounts[userId].xp += 500;
      store.transfers.unshift({ id: `tx_${Date.now().toString(36)}`, fromPlayerId: "lottery", toPlayerId: userId, amount: ticket.kind === "credits" ? ticket.amount : 0, note: `scratch win ${ticket.label}${ticket.voucher ? " " + ticket.voucher : ""}`, createdAt: new Date().toISOString() });
      await writeJsonFile("economy.json", store);
      extra = ticket.kind === "credits" ? `Paid **${ticket.amount.toLocaleString("en-US")}** credits.` : ticket.kind === "reputation" ? `Paid **+${ticket.rep}** reputation. No credits.` : `Paid **${ticket.voucher}**.`;
    }
  }
  await writeJsonFile("lottery-tickets.json", bag);
  return { type: 7, data: view(ticket, extra || undefined) };
}
