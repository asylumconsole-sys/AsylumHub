import { createServerFn } from "@tanstack/react-start";
import { readJsonFile, writeJsonFile } from "@/lib/dayz/store";
import { db, ShopError } from "@/lib/shop/mongo.server";
import { optionalUser } from "@/lib/shop/auth.server";

type VoucherStore = { codes: Record<string, { usedBy?: string; usedAt?: string }> };

async function discordUser(accessToken: string) {
  const request = new Request("https://dayzpro.online/api/shop/wallet", { headers: { authorization: `Bearer ${accessToken}` } });
  const user = await optionalUser(request);
  if (!user?.id) throw new Error("Sign in with Discord first");
  return user;
}

export const payZoneWithCredits = createServerFn({ method: "POST" })
  .inputValidator((data: { accessToken: string; meters: number; price: number; x: number; z: number }) => data)
  .handler(async ({ data }) => {
    const user = await discordUser(data.accessToken);
    const price = Math.floor(Number(data.price));
    if (!Number.isFinite(price) || price <= 0) throw new Error("Invalid price");
    const players = (await db()).collection("players");
    const after = await players.findOneAndUpdate(
      { discordId: user.id, credits: { $gte: price } },
      { $inc: { credits: -price } },
      { returnDocument: "after" },
    );
    if (!after) {
      const current = await players.findOne({ discordId: user.id }, { projection: { credits: 1 } });
      const have = Number(current?.credits ?? 0);
      throw new Error(`Not enough credits: need ${price.toLocaleString("en-US")} CR, you have ${have.toLocaleString("en-US")} CR`);
    }
    return { credits: Number(after.credits), discordId: user.id };
  });

export const redeemZoneVoucher = createServerFn({ method: "POST" })
  .inputValidator((data: { accessToken: string; code: string; meters: number; x: number; z: number; map: string }) => data)
  .handler(async ({ data }) => {
    const user = await discordUser(data.accessToken);
    const code = data.code.trim().toUpperCase();
    if (!code) throw new Error("Enter a voucher code");
    const store = await readJsonFile<VoucherStore>("zone-vouchers.json", { codes: {} });
    const voucher = store.codes[code];
    if (!voucher) throw new Error("Voucher not valid");
    if (voucher.usedBy) throw new Error("Voucher already used");
    voucher.usedBy = user.id;
    voucher.usedAt = new Date().toISOString();
    await writeJsonFile("zone-vouchers.json", store);
    return { ok: true, meters: data.meters, x: data.x, z: data.z, map: data.map };
  });
