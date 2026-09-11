import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getNitradoServerStatus } from "@/lib/nitrado.functions";
import { DAYZ_SERVERS, resolveServiceId, type DayZServerId } from "@/lib/dayz/servers";

export const getAsylumServerStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { serverId: DayZServerId }) => d)
  .handler(async ({ data }) => {
    const server = DAYZ_SERVERS.find((s) => s.id === data.serverId) ?? DAYZ_SERVERS[0];
    const serviceId = resolveServiceId(server);
    const status = await getNitradoServerStatus({ data: { serviceId } });
    return { ...status, asylumServerId: server.id, label: server.label, serviceId };
  });

export const listAsylumServiceIds = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () =>
    DAYZ_SERVERS.map((s) => ({
      id: s.id,
      label: s.label,
      serviceId: resolveServiceId(s),
    })),
  );
