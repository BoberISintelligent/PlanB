import test from "node:test";
import assert from "node:assert/strict";
import { runAgent } from "../lib/agent";
import { AgentError, createExaClient, type ExaTransport } from "../lib/exa-client";
import { exampleOutput } from "./fixtures";
import type { AgentEvent, PlanInput } from "../lib/plan-types";

const input: PlanInput = { message: "My laptop broke, I need a Windows computer by tomorrow", profile: { location: "Helsinki", budget: 10, deadline: "2026-11-14T10:00", timeZone: "Europe/Tallinn", deepSearch: false } };
const page = { url: "https://workspace.example.org/computers", title: "Public workstations", text: "Public Windows workstations. An account is required. Book at https://workspace.example.org/book.", highlights: ["An account is required."] };
const answer = { ...exampleOutput, recommendation: "Check public workstations [S1]", cost: "Not confirmed [S1]", access_conditions: "An account is required [S1]", action_url: "https://workspace.example.org/book" };

test("agent performs discovery, fresh reading, grounded synthesis and actual telemetry", async () => {
  const calls: { path: string; body: Record<string, unknown> }[] = []; const events: AgentEvent[] = [];
  const mock: ExaTransport = async (path, body) => { calls.push({ path, body }); return body.outputSchema ? { results: [page], output: { content: answer, grounding: [{ field: "recommendation", confidence: "high", citations: [{ url: page.url }] }] }, requestId: "synthesis-test", costDollars: { total: .007 } } : { results: [page], requestId: "retrieval-test", costDollars: { total: .001 } }; };
  const plan = await runAgent(input, mock, (event) => events.push(event));
  assert.equal(calls.length, 5); assert.equal(calls.filter((call) => call.path === "search").length, 4);
  assert.equal(calls.find((call) => call.path === "contents")?.body.maxAgeHours, 0);
  assert.equal(plan.output.action_url, "https://workspace.example.org/book"); assert.equal(plan.grounding[0].sourceIds[0], "S1");
  assert.equal(plan.metrics.calls, 5); assert.ok(Math.abs((plan.metrics.costDollars || 0) - .011) < 1e-8);
  assert.equal(events.at(-1)?.type, "result");
  const synthesis = calls.find(call => call.body.outputSchema);
  assert.match(String(synthesis?.body.systemPrompt), /Always write every output value in English/);
  for (const call of calls.filter((entry) => entry.path === "search")) {
    assert.equal(call.body.moderation, false);
    assert.equal("includeDomains" in call.body, false);
    assert.equal("excludeDomains" in call.body, false);
  }
});
test("a failed discovery branch gives a limited-coverage warning and still produces a plan", async () => {
  let discoveries = 0;
  const mock: ExaTransport = async (path, body) => {
    if (path === "search" && !body.outputSchema && discoveries++ === 1) throw new AgentError("TIMEOUT", "Timed out");
    return body.outputSchema ? { output: { content: answer } } : { results: [page] };
  };
  const plan = await runAgent(input, mock, () => {});
  assert.ok(plan.warnings.some((warning) => /Some searches failed/.test(warning))); assert.equal(plan.metrics.costDollars, null);
});
test("a failed contents call preserves indexed excerpts and labels the limitation", async () => {
  const mock: ExaTransport = async (path, body) => {
    if (path === "contents") throw new AgentError("TIMEOUT", "Timed out");
    return body.outputSchema ? { output: { content: answer } } : { results: [{ url: page.url, title: page.title, highlights: page.highlights }] };
  };
  const plan = await runAgent(input, mock, () => {});
  assert.ok(plan.warnings.some((warning) => /Full pages couldn't/.test(warning))); assert.equal(plan.sources[0].contentRead, false);
});
test("invalid credentials fail visibly and do not turn into sample data", async () => {
  const events: AgentEvent[] = [];
  await assert.rejects(() => runAgent(input, async () => { throw new AgentError("INVALID_KEY", "Rejected", 401); }, (event) => events.push(event)), (err: unknown) => err instanceof AgentError && err.code === "INVALID_KEY");
  assert.equal(events.some((event) => event.type === "result"), false);
});
test("empty evidence stops the agent before synthesis", async () => {
  await assert.rejects(() => runAgent(input, async () => ({ results: [] }), () => {}), (error: unknown) => error instanceof AgentError && error.code === "NO_SOURCES");
});
test("malformed structured output is rejected", async () => {
  await assert.rejects(() => runAgent(input, async (_path, body) => body.outputSchema ? { output: { content: { title: "Incomplete" } } } : { results: [page] }, () => {}), (error: unknown) => error instanceof AgentError && error.code === "INVALID_OUTPUT");
});
test("cancelled work emits no result", async () => {
  const controller = new AbortController(); controller.abort(); const events: AgentEvent[] = [];
  await assert.rejects(() => runAgent(input, async () => ({ results: [page] }), (event) => events.push(event), controller.signal));
  assert.equal(events.some((event) => event.type === "result"), false);
});
test("provider error details never leak private data", async () => {
  const mockFetch = (async () => new Response(JSON.stringify({ message: "secret-key-in-provider-body" }), { status: 401 })) as typeof fetch;
  const client = createExaClient("secret-key", mockFetch);
  await assert.rejects(() => client("search", { query: "test" }), (error: unknown) => error instanceof AgentError && error.code === "INVALID_KEY" && !error.message.includes("secret-key"));
});
test("transport sends the key only to Exa in a header", async () => {
  const mockFetch = (async (url: string | URL | Request, init?: RequestInit) => {
    assert.equal(url, "https://api.exa.ai/search"); assert.equal((init?.headers as Record<string, string>)["x-api-key"], "unit-test-key"); assert.equal(String(init?.body).includes("unit-test-key"), false);
    return new Response(JSON.stringify({ results: [page], requestId: "test-only" }), { status: 200 });
  }) as typeof fetch;
  assert.equal((await createExaClient(' “unit-test-key” ', mockFetch)("search", { query: "test" })).requestId, "test-only");
});

test("empty action steps trigger exactly one deeper research pass", async () => {
  const modes: unknown[] = [];
  const mock: ExaTransport = async (_path, body) => {
    if (!body.outputSchema) return { results: [page] };
    modes.push(body.type);
    return { output: { content: modes.length === 1 ? { ...answer, steps: [] } : answer } };
  };
  const plan = await runAgent(input, mock, () => {});
  assert.deepEqual(modes, ["auto", "deep"]);
  assert.ok(plan.output.steps.length > 0);
  assert.equal(plan.metrics.calls, 6);
});

test("persistently empty action steps produce an error, not an incomplete plan", async () => {
  let attempts = 0;
  await assert.rejects(() => runAgent(input, async (_path, body) => {
    if (!body.outputSchema) return { results: [page] };
    attempts++;
    return { output: { content: { ...answer, steps: [] } } };
  }, () => {}), (error: unknown) => error instanceof AgentError && error.code === "INVALID_OUTPUT");
  assert.equal(attempts, 2);
});
