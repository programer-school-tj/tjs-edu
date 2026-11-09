import { spawn } from "node:child_process";

const npmBin = process.platform === "win32" ? "npm.cmd" : "npm";
const node = process.execPath;
const children = [];

function start(label, args) {
  const child = spawn(node, args, {
    cwd: process.cwd(),
    stdio: "inherit",
    env: { ...process.env },
    shell: false,
  });
  children.push({ label, child });
  child.once("error", (error) => {
    console.error(`[${label}] оғоз нашуд:`, error.message);
    shutdown(1);
  });
  child.once("exit", (code, signal) => {
    if (shuttingDown) return;
    if (code !== 0) {
      console.error(`[${label}] қатъ шуд (code=${code ?? "null"}, signal=${signal ?? "none"}).`);
      shutdown(code || 1);
    }
  });
  return child;
}

let shuttingDown = false;
function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const item of children) {
    if (item.child.exitCode === null && !item.child.killed) item.child.kill("SIGTERM");
  }
  setTimeout(() => {
    for (const item of children) {
      if (item.child.exitCode === null) item.child.kill("SIGKILL");
    }
    process.exit(code);
  }, 1200).unref();
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

console.log("TJS Edu: API ва веб якҷоя оғоз мешаванд.");
start("API", ["--import", "tsx", "server/index.ts"]);
start("WEB", ["node_modules/vite/bin/vite.js", "--host", "0.0.0.0"]);
console.log("Веб: http://localhost:5173  |  API: http://localhost:3001/health");
