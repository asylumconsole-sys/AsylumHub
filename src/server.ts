import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => ((m as { default?: ServerEntry }).default ?? (m as unknown as ServerEntry)),
    );
  }
  return serverEntryPromise;
}

function brandedErrorResponse(): Response {
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isCatastrophicSsrErrorBody(body: string, responseStatus: number): boolean {
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return false;
  }

  if (!payload || Array.isArray(payload) || typeof payload !== "object") {
    return false;
  }

  const fields = payload as Record<string, unknown>;
  const expectedKeys = new Set(["message", "status", "unhandled"]);
  if (!Object.keys(fields).every((key) => expectedKeys.has(key))) {
    return false;
  }

  return (
    fields.unhandled === true &&
    fields.message === "HTTPError" &&
    (fields.status === undefined || fields.status === responseStatus)
  );
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isCatastrophicSsrErrorBody(body, response.status)) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return brandedErrorResponse();
}

// dayzpro.online is also the PRO AI Discord Activity: allow framing by Discord (and its discordsays.com proxy) only.
const FRAME_ANCESTORS =
  "frame-ancestors 'self' https://discord.com https://*.discord.com https://discordapp.com https://*.discordapp.com https://*.discordsays.com";

function withFrameHeaders(response: Response): Response {
  try {
    response.headers.delete("x-frame-options");
    const csp = response.headers.get("content-security-policy");
    if (!csp) response.headers.set("content-security-policy", FRAME_ANCESTORS);
    else if (!/frame-ancestors/i.test(csp)) response.headers.set("content-security-policy", `${csp}; ${FRAME_ANCESTORS}`);
    return response;
  } catch {
    // immutable headers (e.g. a fetched Response): copy
    const h = new Headers(response.headers);
    h.delete("x-frame-options");
    if (!h.get("content-security-policy")) h.set("content-security-policy", FRAME_ANCESTORS);
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers: h });
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return withFrameHeaders(await normalizeCatastrophicSsrResponse(response));
    } catch (error) {
      console.error(error);
      return withFrameHeaders(brandedErrorResponse());
    }
  },
};
