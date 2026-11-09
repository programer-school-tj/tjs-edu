import { createServer } from "node:http";
import { pathToFileURL, fileURLToPath } from "node:url";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

const port = Number(process.env.API_PORT || 3001);
const root = new URL("../endpoints/", import.meta.url);
const distRoot = fileURLToPath(new URL("../dist/", import.meta.url));
const methods: Record<string, string> = {
  "GET": "GET",
  "POST": "POST",
  "PUT": "PUT",
  "PATCH": "PATCH",
  "DELETE": "DELETE",
};

const mimeTypes: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

function endpointPath(pathname: string, method: string) {
  const parts = pathname.replace(/^\/_api\//, "").split("/").filter(Boolean);
  if (parts.length !== 2 || !methods[method]) return null;
  const [group, action] = parts;
  if (!/^[a-z0-9_]+$/i.test(group) || !/^[a-z0-9_]+$/i.test(action)) return null;
  return new URL(`${group}/${action}_${methods[method]}.ts`, root);
}

async function serveWeb(pathname: string, method: string, outgoing: import("node:http").ServerResponse) {
  if (method !== "GET" && method !== "HEAD") return false;
  let requestedPath = "/";
  try { requestedPath = decodeURIComponent(pathname); } catch { return false; }
  const relative = requestedPath.replace(/^\/+/, "");
  let target = path.resolve(distRoot, relative || "index.html");
  if (target !== distRoot && !target.startsWith(distRoot + path.sep)) return false;
  try {
    const info = await stat(target);
    if (info.isDirectory()) target = path.join(target, "index.html");
    const data = await readFile(target);
    outgoing.writeHead(200, {
      "content-type": mimeTypes[path.extname(target).toLowerCase()] || "application/octet-stream",
      "content-length": data.length,
      "cache-control": target.endsWith("index.html") ? "no-cache" : "public, max-age=31536000, immutable",
    });
    outgoing.end(method === "HEAD" ? undefined : data);
    return true;
  } catch {
    if (path.extname(requestedPath)) return false;
    try {
      const data = await readFile(path.join(distRoot, "index.html"));
      outgoing.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-cache" });
      outgoing.end(method === "HEAD" ? undefined : data);
      return true;
    } catch { return false; }
  }
}

const server = createServer(async (incoming, outgoing) => {
  const url = new URL(incoming.url || "/", `http://${incoming.headers.host || "localhost"}`);
  if (url.pathname === "/health") {
    outgoing.writeHead(200, { "content-type": "application/json" });
    outgoing.end(JSON.stringify({ ok: true, service: "tjs-edu-api" }));
    return;
  }

  if (!url.pathname.startsWith("/_api/")) {
    if (await serveWeb(url.pathname, incoming.method || "GET", outgoing)) return;
    outgoing.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    outgoing.end("Not found");
    return;
  }

  const file = endpointPath(url.pathname, incoming.method || "GET");
  if (!file) {
    outgoing.writeHead(404, { "content-type": "application/json" });
    outgoing.end(JSON.stringify({ message: "API route not found" }));
    return;
  }

  try {
    const chunks: Buffer[] = [];
    for await (const chunk of incoming) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    const body = chunks.length ? Buffer.concat(chunks) : undefined;
    const headers = new Headers();
    for (const [name, value] of Object.entries(incoming.headers)) {
      if (Array.isArray(value)) headers.set(name, value.join(", "));
      else if (value !== undefined) headers.set(name, value);
    }
    const request = new Request(url, {
      method: incoming.method,
      headers,
      ...(body && incoming.method !== "GET" && incoming.method !== "HEAD"
        ? { body, duplex: "half" } as RequestInit
        : {}),
    });

    const module = await import(pathToFileURL(file.pathname).href);
    if (typeof module.handle !== "function") throw new Error("Endpoint must export handle(request)");
    const response: Response = await module.handle(request);
    outgoing.statusCode = response.status;
    const responseHeaders = response.headers as Headers & { getSetCookie?: () => string[] };
    responseHeaders.forEach((value, key) => {
      if (key.toLowerCase() !== "set-cookie") outgoing.setHeader(key, value);
    });
    const cookies = responseHeaders.getSetCookie?.();
    if (cookies?.length) outgoing.setHeader("Set-Cookie", cookies);
    const responseBody = Buffer.from(await response.arrayBuffer());
    outgoing.end(responseBody);
  } catch (error) {
    console.error("TJS Edu API error:", error);
    if (!outgoing.headersSent) outgoing.writeHead(500, { "content-type": "application/json" });
    outgoing.end(JSON.stringify({ message: "Хатои дохилии сервер." }));
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`TJS Edu app/API listening on :${port}`);
});
