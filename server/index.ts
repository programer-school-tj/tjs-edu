import { createServer } from "node:http";
import { pathToFileURL } from "node:url";

const port = Number(process.env.API_PORT || 3001);
const root = new URL("../endpoints/", import.meta.url);
const methods: Record<string, string> = {
  "GET": "GET",
  "POST": "POST",
  "PUT": "PUT",
  "PATCH": "PATCH",
  "DELETE": "DELETE",
};

function endpointPath(pathname: string, method: string) {
  const parts = pathname.replace(/^\\/_api\\//, "").split("/").filter(Boolean);
  if (parts.length !== 2 || !methods[method]) return null;
  const [group, action] = parts;
  if (!/^[a-z0-9_]+$/i.test(group) || !/^[a-z0-9_]+$/i.test(action)) return null;
  return new URL(`${group}/${action}_${methods[method]}.ts`, root);
}

const server = createServer(async (incoming, outgoing) => {
  if (incoming.url === "/health") {
    outgoing.writeHead(200, { "content-type": "application/json" });
    outgoing.end(JSON.stringify({ ok: true, service: "tjs-edu-api" }));
    return;
  }

  const url = new URL(incoming.url || "/", `http://${incoming.headers.host || "localhost"}`);
  const file = endpointPath(url.pathname, incoming.method || "GET");
  if (!file || !url.pathname.startsWith("/_api/")) {
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
    response.headers.forEach((value, key) => outgoing.setHeader(key, value));
    const responseBody = Buffer.from(await response.arrayBuffer());
    outgoing.end(responseBody);
  } catch (error) {
    console.error("TJS Edu API error:", error);
    if (!outgoing.headersSent) outgoing.writeHead(500, { "content-type": "application/json" });
    outgoing.end(JSON.stringify({ message: "Хатои дохилии сервер." }));
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`TJS Edu API listening on :${port}`);
});
