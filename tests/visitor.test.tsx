import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import Home from "../app/page";
import { createPlanHandler } from "../lib/plan-handler";
import { AgentError, errorMessage, type ExaTransport } from "../lib/exa-client";
import { exampleOutput } from "./fixtures";

const page = { url: "https://workspace.example.org/computers", title: "Public workstations", text: "An account may be required. Book at https://workspace.example.org/book." };
function request(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost:3000/api/plan", { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
}
function events(text: string) {
  return text.split("\n").filter(line => line.startsWith("data: ")).map(line => JSON.parse(line.slice(6)));
}

test("a visitor can research a task without an account, key or mode", async () => {
  let usedKey = "", calls = 0;
  const client: ExaTransport = async (_path, body) => { calls++; return body.outputSchema ? { output: { content: exampleOutput } } : { results: [page] }; };
  const POST = createPlanHandler(() => "operator-key", key => { usedKey = key; return client; });
  const response = await POST(request({ message: "Find a public computer in Helsinki" }));
  assert.equal(response.status, 200);
  assert.match(response.headers.get("Content-Type") || "", /text\/event-stream/);
  const result = events(await response.text()).find(event => event.type === "result");
  assert.ok(result);
  assert.equal(calls, 5);
  assert.equal(usedKey, "operator-key");
  assert.equal("mode" in result.plan.input, false);
  assert.equal("language" in result.plan.input, false);
  assert.doesNotMatch(JSON.stringify(result), /operator-key/);
});

test("legacy mode and visitor key fields cannot replace the operator credential or trigger sample data", async () => {
  let usedKey = "", calls = 0;
  const POST = createPlanHandler(() => "operator-key", key => {
    usedKey = key;
    return async (_path, body) => { calls++; return body.outputSchema ? { output: { content: exampleOutput } } : { results: [page] }; };
  });
  const response = await POST(request({ message: "Find a public computer", mode: "demo", language: "ru" }, { "x-exa-api-key": "visitor-key" }));
  const result = events(await response.text()).find(event => event.type === "result");
  assert.ok(result);
  assert.equal(calls, 5);
  assert.equal(usedKey, "operator-key");
  assert.doesNotMatch(JSON.stringify(result), /visitor-key|operator-key/);
});

test("an unavailable service gives a useful English error without asking visitors for credentials", async () => {
  const response = await createPlanHandler(() => "")(request({ message: "Find a quiet room" }));
  assert.equal(response.status, 503);
  const text = await response.text();
  assert.match(text, /temporarily unavailable/);
  assert.doesNotMatch(text, /API key|settings|demo|register|log in/i);
});

test("provider errors stay visible and never expose a credential or raw provider message", async () => {
  const POST = createPlanHandler(() => "operator-key", () => async () => { throw new AgentError("INVALID_KEY", "provider-body-secret"); });
  const response = await POST(request({ message: "Find a quiet room" }));
  const text = await response.text();
  assert.ok(events(text).some(event => event.type === "error"));
  assert.equal(events(text).some(event => event.type === "result"), false);
  assert.doesNotMatch(text, /operator-key|provider-body-secret|settings|demo/);
});

test("the anonymous endpoint validates malformed input and cross-origin calls", async () => {
  const POST = createPlanHandler(() => "operator-key");
  assert.equal((await POST(request({ message: "hi" }))).status, 400);
  assert.equal((await POST(request({ message: "Find a room", profile: { budget: -5 } }))).status, 400);
  assert.equal((await POST(request({ message: "Find a room" }, { origin: "https://another.example.org" }))).status, 403);
  assert.equal((await POST(new Request("http://localhost:3000/api/plan", { method: "POST", body: "{" }))).status, 400);
});

test("the homepage is English and offers immediate search without connection or account controls", () => {
  const html = renderToStaticMarkup(<Home/>);
  assert.match(html, /Find an answer/);
  assert.match(html, /What can we help with today/);
  assert.match(html, /Search preferences/);
  assert.doesNotMatch(html, />Demo<|>Live<|Switch language|Bring your (?:Exa|API) key|API key|server key|Connect Exa|Sign in|Register|exa-connect-card|mode-switch|language-switch/i);
});

test("all authored interface, agent, error and documentation copy is free of Cyrillic", () => {
  const roots = ["app", "lib"];
  const files = ["README.md"];
  function collect(dir: string) { for (const item of readdirSync(dir, { withFileTypes: true })) { const path = join(dir, item.name); if (item.isDirectory()) collect(path); else if (/\.(tsx?|mts|md)$/.test(path)) files.push(path); } }
  roots.forEach(collect);
  for (const path of files) assert.doesNotMatch(readFileSync(path, "utf8"), /[\u0400-\u04ff]/u, path);
  for (const code of ["INVALID_KEY", "NO_KEY", "NO_CREDITS", "NETWORK", "TIMEOUT", "RATE_LIMIT", "UNKNOWN"]) {
    assert.doesNotMatch(errorMessage(code), /key|settings|demo|account|credits|register/i);
  }
});
