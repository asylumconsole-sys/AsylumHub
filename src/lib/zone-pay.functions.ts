import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { readJsonFile, writeJsonFile } from "@/lib/dayz/store";

type VoucherStore = { codes: Record<string, { usedBy?: string; usedAt?: string }> };

export const redeemZoneVoucher = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { code: string; meters: number; x: number; z: number; map: string }) => data)
  .handler(async ({ data, context }) => {
    const code = data.code.trim().toUpperCase();
    if (!code) throw new Error("Enter a voucher code");
    const store = await readJsonFile<VoucherStore>("zone-vouchers.json", { codes: {} });
    const voucher = store.codes[code];
    if (!voucher) throw new Error("Voucher not valid");
    if (voucher.usedBy) throw new Error("Voucher already used");
    voucher.usedBy = context.userId ?? "demo-user";
    voucher.usedAt = new Date().toISOString();
    await writeJsonFile("zone-vouchers.json", store);
    return { ok: true, meters: data.meters, x: data.x, z: data.z, map: data.map };
  });
