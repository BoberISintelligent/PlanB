import { build } from "esbuild";
import { mkdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";

await mkdir(".sites-runtime/tests", { recursive: true });
await build({ entryPoints: ["tests/core.test.ts", "tests/agent.test.ts", "tests/visitor.test.tsx", "tests/conversation.test.ts"], bundle: true, platform: "node", format: "esm", packages: "external", outdir: ".sites-runtime/tests", outExtension: { ".js": ".mjs" }, logLevel: "warning" });
const result = spawnSync(process.execPath, ["--test", ".sites-runtime/tests/core.test.mjs", ".sites-runtime/tests/agent.test.mjs", ".sites-runtime/tests/visitor.test.mjs", "tests/runtime.test.mjs", ".sites-runtime/tests/conversation.test.mjs"], { stdio: "inherit" });
process.exit(result.status ?? 1);
