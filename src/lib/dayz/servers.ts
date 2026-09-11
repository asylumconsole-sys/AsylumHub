/** Shared Asylum DayZ server catalog (Nitrado + FTP). */
export type DayZServerId = "101x" | "102x";

export type DayZServer = {
  id: DayZServerId;
  label: string;
  serviceEnv: string;
  fallbackServiceId: string;
};

export const DAYZ_SERVERS: DayZServer[] = [
  {
    id: "101x",
    label: "101x | ASYLUM",
    serviceEnv: "NITRADO_SERVICE_101X",
    fallbackServiceId: "17656048",
  },
  {
    id: "102x",
    label: "102x | ASYLUM",
    serviceEnv: "NITRADO_SERVICE_102X",
    fallbackServiceId: "19773616",
  },
];

export function resolveServiceId(server: DayZServer): string {
  if (typeof process !== "undefined" && process.env?.[server.serviceEnv]) {
    return String(process.env[server.serviceEnv]);
  }
  return server.fallbackServiceId;
}

export function requiredFtpEnv(serverId: DayZServerId): string[] {
  const prefix = serverId === "101x" ? "FTP_101X" : "FTP_102X";
  return [`${prefix}_HOST`, `${prefix}_USER`, `${prefix}_PASS`, `${prefix}_LOGS_PATH`];
}

export function requiredNitradoEnv(): string[] {
  return ["NITRADO_API_TOKEN", "NITRADO_SERVICE_101X", "NITRADO_SERVICE_102X"];
}
