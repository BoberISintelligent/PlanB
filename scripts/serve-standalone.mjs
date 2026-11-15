import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { spawn } from "node:child_process";
import { resolve } from "node:path";

if (existsSync(".env")) loadEnvFile(".env");
if (!existsSync("dist/server/index.js")) {
  console.error("Build output is missing. Run npm run build first.");
  process.exit(1);
}
const key = process.env.EXA_API_KEY?.trim();
if (!key) {
  console.error("Search is not configured. The operator must set EXA_API_KEY in .env or the deployment environment.");
  process.exit(1);
}
const port = Number(process.env.PORT || 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid PORT");

// Workerd reads local secrets next to the generated Wrangler configuration.
// This file is never part of the browser bundle or a public static directory.
mkdirSync("dist/server", { recursive: true });
writeFileSync("dist/server/.dev.vars", `EXA_API_KEY=${JSON.stringify(key)}\n`, { mode: 0o600 });
process.env.WRANGLER_SEND_METRICS ||= "false";
const child = spawn(process.execPath, [
  "--import", resolve("scripts/sites-env.mjs"),
  resolve("node_modules/wrangler/bin/wrangler.js"),
  "dev", "--config", "dist/server/wrangler.json", "--local",
  "--persist-to", resolve(process.env.SITES_RUNTIME_ROOT || ".sites-runtime", "wrangler/state"),
  "--ip", process.env.HOST || "0.0.0.0", "--port", String(port), "--inspector-port", "0",
], { stdio: "inherit", env: process.env });
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("error", () => { console.error("Could not start the application."); process.exit(1); });
child.on("exit", (code, signal) => process.exit(signal ? 0 : code ?? 1));
