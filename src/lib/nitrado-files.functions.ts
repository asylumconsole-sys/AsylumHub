import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const NITRADO_API_BASE = "https://api.nitrado.net";

function nitradoHeaders() {
  const token = process.env.NITRADO_API_TOKEN;
  if (!token) throw new Error("NITRADO_API_TOKEN not configured");
  return { Authorization: `Bearer ${token}` };
}

async function nitradoJson(path: string, init?: RequestInit) {
  const res = await fetch(`${NITRADO_API_BASE}${path}`, {
    ...init,
    headers: { ...nitradoHeaders(), ...init?.headers },
  });
  if (!res.ok) {
    throw new Error(`Nitrado API error (${res.status}): ${await res.text().catch(() => res.statusText)}`);
  }
  return res.json();
}

function missionFile(relativePath: string, baseOverride?: string) {
  const base = baseOverride || process.env.NITRADO_MISSION_PATH;
  if (!base) throw new Error("NITRADO_MISSION_PATH not configured (pass missionPath from resolveMissionPath)");
  return `${base.replace(/\/$/, "")}/${relativePath.replace(/^\//, "")}`;
}

/**
 * Downloads a text file from the Nitrado file manager.
 * Uses the two-step file_server flow: request a signed download URL, then fetch it.
 */
export async function downloadNitradoFile(serviceId: string, relativePath: string, baseOverride?: string): Promise<string> {
  const path = missionFile(relativePath, baseOverride);
  const json = (await nitradoJson(
    `/services/${serviceId}/gameservers/file_server/download?file=${encodeURIComponent(path)}`,
  )) as { data?: { url?: string; token?: { url?: string } } };
  const url = json.data?.url ?? json.data?.token?.url;
  if (!url) throw new Error(`Nitrado did not return a download URL for ${path}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed downloading ${path} (${res.status})`);
  return res.text();
}

/**
 * Uploads text content to a file on the Nitrado server.
 * `baseOverride` must match the mission path used for download (per-server).
 *
 * Nitrado requires:
 * 1) Token request with `path` = directory (trailing slash) + `file` = basename
 * 2) Raw body POST to the token URL with headers `token` + `content-type: application/binary`
 *    (FormData/multipart returns 400 from the fileserver.)
 */
export async function uploadNitradoFile(
  serviceId: string,
  relativePath: string,
  content: string,
  baseOverride?: string,
): Promise<void> {
  const path = missionFile(relativePath, baseOverride);
  const slash = path.lastIndexOf("/");
  const dirPath = `${path.slice(0, slash + 1)}`;
  const fileName = path.slice(slash + 1);
  if (!fileName) throw new Error(`Invalid Nitrado upload path: ${path}`);

  const json = (await nitradoJson(`/services/${serviceId}/gameservers/file_server/upload`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ path: dirPath, file: fileName }).toString(),
  })) as { data?: { token?: { url?: string; token?: string } } };
  const url = json.data?.token?.url;
  const uploadToken = json.data?.token?.token;
  if (!url || !uploadToken) throw new Error(`Nitrado did not return an upload URL for ${path}`);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      token: uploadToken,
      "content-type": "application/binary",
    },
    body: content,
  });
  if (!res.ok) throw new Error(`Failed uploading ${path} (${res.status}): ${await res.text().catch(() => res.statusText)}`);
}

/** Restarts the gameserver so console/Xbox builds reload CE config from disk. */
export const restartNitradoServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { serviceId: string }) => d)
  .handler(async ({ data }) => {
    await nitradoJson(`/services/${data.serviceId}/gameservers/restart`, { method: "POST" });
    return { ok: true };
  });

/** Returns the file's last-modified unix timestamp (seconds), or null if it doesn't exist. */
export async function statNitradoFileModifiedAt(
  serviceId: string,
  relativePath: string,
  baseOverride?: string,
): Promise<number | null> {
  const path = missionFile(relativePath, baseOverride);
  try {
    const json = (await nitradoJson(
      `/services/${serviceId}/gameservers/file_server/stat?files[]=${encodeURIComponent(path)}`,
    )) as { data?: { entries?: Array<{ path: string; modified_at?: number }> } };
    const entry = json.data?.entries?.find((e) => e.path === path);
    return entry?.modified_at ?? null;
  } catch {
    return null;
  }
}
