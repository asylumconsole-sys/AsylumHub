import { createServer } from "node:http";
import { existsSync, readdirSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const port = Number(process.env.PORT || 8080);
const host = "0.0.0.0";

function listDir(dir) {
  if (!existsSync(dir)) return `${dir} missing`;
  try {
    return readdirSync(dir, { recursive: true }).slice(0, 80).join("\n");
  } catch (error) {
    return String(error);
  }
}

console.log("cwd", process.cwd());
console.log(".output\n" + listDir(".output"));
console.log("dist\n" + listDir("dist"));

const candidates = [
  ".output/server/index.mjs",
  ".output/server/index.js",
  "dist/server/index.mjs",
  "dist/server/index.js",
];

const entry = candidates.find((file) => existsSync(file));
if (!entry) {
  console.error("No server entry found. Build did not emit a Node server.");
  createServer((_req, res) => {
    res.statusCode = 500;
    res.setHeader("content-type", "text/plain; charset=utf-8");
    res.end("AsylumHub: server bundle missing. Check Railway build logs.");
  }).listen(port, host, () => {
    console.log(`placeholder listening on ${host}:${port}`);
  });
} else {
  const mod = await import(pathToFileURL(resolve(entry)).href);
  const app = mod.default ?? mod;
  console.log("loaded", entry, "keys", Object.keys(mod));

  createServer(async (req, res) => {
    try {
      if (typeof app.fetch !== "function") {
        throw new Error("Server module has no fetch() handler");
      }
      const url = `http://${req.headers.host || "localhost"}${req.url || "/"}`;
      const headers = new Headers();
      for (const [key, value] of Object.entries(req.headers)) {
        if (value) headers.set(key, Array.isArray(value) ? value.join(", ") : String(value));
      }
      let body;
      if (req.method && !['GET', 'HEAD'].includes(req.method)) {
        body = await new Promise((resolveBody, reject) => {
          const chunks = [];
          req.on("data", (chunk) => chunks.push(chunk));
          req.on("end", () => resolveBody(Buffer.concat(chunks)));
          req.on("error", reject);
        });
      }
      const request = new Request(url, { method: req.method, headers, body });
      const response = await app.fetch(request, process.env, {});
      res.statusCode = response.status;
      response.headers.forEach((value, key) => res.setHeader(key, value));
      res.end(Buffer.from(await response.arrayBuffer()));
    } catch (error) {
      console.error(error);
      res.statusCode = 500;
      res.setHeader("content-type", "text/plain; charset=utf-8");
      res.end(error instanceof Error ? error.stack || error.message : String(error));
    }
  }).listen(port, host, () => {
    console.log(`listening on ${host}:${port} via ${entry}`);
  });
}
