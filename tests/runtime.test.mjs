import test from "node:test";
import assert from "node:assert/strict";
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { spawnSync } from "node:child_process";

const skipPermissions = process.platform === "win32" || process.getuid?.() === 0;
const generatedRoot = resolve(".sites-runtime/tests");
mkdirSync(generatedRoot, { recursive: true });
const runtimeVariables = ["SITES_RUNTIME_ROOT", "WRANGLER_LOG_PATH", "WRANGLER_REGISTRY_PATH", "MINIFLARE_REGISTRY_PATH"];

function cleanEnv() {
  const env = { ...process.env };
  for (const key of runtimeVariables) delete env[key];
  return env;
}
function fixture() {
  const root = mkdtempSync(join(generatedRoot, "runtime-permissions-"));
  const app = join(root, "app");
  mkdirSync(join(app, "scripts"), { recursive: true });
  for (const file of ["sites-env.mjs", "tool-environment.mjs", "serve-standalone.mjs"]) {
    copyFileSync(resolve("scripts", file), join(app, "scripts", file));
  }
  return { root, app, runtime: join(root, "writable-runtime") };
}

test("runtime initialization reproduces EACCES and succeeds with a writable external directory", { skip: skipPermissions }, () => {
  const { root, app, runtime } = fixture();
  try {
    chmodSync(app, 0o555);
    const args = ["--import", join(app, "scripts/sites-env.mjs"), "-e", "console.log('initialized')"];
    const before = spawnSync(process.execPath, args, { cwd: app, env: cleanEnv(), encoding: "utf8", timeout: 10000 });
    assert.notEqual(before.status, 0);
    assert.match(before.stderr, /EACCES/);
    const after = spawnSync(process.execPath, args, { cwd: app, env: { ...cleanEnv(), SITES_RUNTIME_ROOT: runtime }, encoding: "utf8", timeout: 10000 });
    assert.equal(after.status, 0, after.stderr);
    assert.match(after.stdout, /initialized/);
    assert.ok(existsSync(join(runtime, "wrangler/dev-registry")));
    assert.equal(existsSync(join(app, ".sites-runtime")), false);
  } finally {
    chmodSync(app, 0o755);
    rmSync(root, { recursive: true, force: true });
  }
});

test("standalone launcher starts unprivileged and keeps Wrangler state outside the application root", { skip: skipPermissions }, () => {
  const { root, app, runtime } = fixture();
  try {
    mkdirSync(join(app, "dist/server"), { recursive: true });
    mkdirSync(join(app, "node_modules/wrangler/bin"), { recursive: true });
    writeFileSync(join(app, "dist/server/index.js"), "export default {};\n");
    writeFileSync(join(app, "node_modules/wrangler/bin/wrangler.js"), `
      const fs = require("node:fs");
      const assert = require("node:assert/strict");
      const path = require("node:path");
      const args = process.argv.slice(2);
      const state = args[args.indexOf("--persist-to") + 1];
      assert.equal(state, path.join(process.env.SITES_RUNTIME_ROOT, "wrangler/state"));
      assert.equal(args[args.indexOf("--ip") + 1], "0.0.0.0");
      assert.equal(args[args.indexOf("--port") + 1], "10000");
      fs.mkdirSync(state, { recursive: true });
      console.log("launcher-ready");
    `);
    chmodSync(app, 0o555);
    const result = spawnSync(process.execPath, [join(app, "scripts/serve-standalone.mjs")], {
      cwd: app,
      env: { ...cleanEnv(), EXA_API_KEY: "startup-test-key", HOST: "0.0.0.0", PORT: "10000", SITES_RUNTIME_ROOT: runtime },
      encoding: "utf8", timeout: 10000,
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /launcher-ready/);
    assert.ok(existsSync(join(runtime, "wrangler/state")));
    assert.match(readFileSync(join(app, "dist/server/.dev.vars"), "utf8"), /startup-test-key/);
    assert.equal(existsSync(join(app, ".sites-runtime")), false);
    assert.equal(existsSync(join(app, ".wrangler")), false);
  } finally {
    chmodSync(app, 0o755);
    rmSync(root, { recursive: true, force: true });
  }
});
