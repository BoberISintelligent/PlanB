import test from "node:test";
import assert from "node:assert/strict";
import { actionAllowlist, buildQueries, inputSchema, localTimeToDate, planCalendar, planMarkdown, safeUrl, sourcesFromResults, validateOutput } from "../lib/plan-core";
import { testPlan } from "./fixtures";
import type { PlanInput } from "../lib/plan-types";

const input: PlanInput = { message: "My laptop broke and I need Word tomorrow", profile: { location: "Helsinki", budget: 10, deadline: "2026-11-14T10:00", timeZone: "Europe/Tallinn", deepSearch: false } };

test("URL validation rejects executable, credentialled and private endpoints", () => {
  for (const url of ["javascript:alert(1)", "data:text/html,hi", "https://user:secret@aalto.fi", "https://127.0.0.1", "https://app.localhost", "https://[::1]/"]) assert.equal(safeUrl(url), null, url);
  assert.equal(safeUrl("https://booking.aalto.fi/#section"), "https://booking.aalto.fi/");
});
test("sources accept unrelated public domains and HTTP pages without a domain whitelist", () => {
  const sources = sourcesFromResults([{ url: "https://example.org/a", title: "Independent source" }, { url: "http://blog.example.net/b", title: "Another perspective" }]);
  assert.equal(sources.length, 2);
  assert.equal(sources[1].url, "http://blog.example.net/b");
});
test("Helsinki winter and summer deadlines become correct UTC instants", () => {
  assert.equal(localTimeToDate("2026-11-14T10:00").toISOString(), "2026-11-14T08:00:00.000Z");
  assert.equal(localTimeToDate("2026-07-14T10:00").toISOString(), "2026-07-14T07:00:00.000Z");
  assert.throws(() => localTimeToDate("2026-02-30T10:00"));
  assert.throws(() => localTimeToDate("2026-03-29T03:30"));
});
test("task validation rejects impossible dates, negative budgets and short queries", () => {
  assert.equal(inputSchema.safeParse(input).success, true);
  assert.equal(inputSchema.safeParse({ ...input, message: "hi" }).success, false);
  assert.equal(inputSchema.safeParse({ ...input, profile: { ...input.profile, budget: -1 } }).success, false);
  assert.equal(inputSchema.safeParse({ ...input, profile: { ...input.profile, deadline: "2026-02-30T10:00" } }).success, false);
});
test("retrieval deduplicates sources, keeps read content and removes unsafe URLs", () => {
  const sources = sourcesFromResults([{ url: "https://www.aalto.fi/a", title: "First", highlights: ["A valid access tag is required."] }, { url: "javascript:alert(1)" }, { url: "https://www.aalto.fi/a", text: "Full text" }], new Set(["https://www.aalto.fi/a"]));
  assert.equal(sources.length, 1); assert.equal(sources[0].id, "S1"); assert.equal(sources[0].contentRead, true); assert.equal(sources[0].freshness, "live_requested");
});
test("actions must come from retrieved documents; invented citation IDs are removed", () => {
  const page = { url: "https://www.aalto.fi/a", text: "Book at https://booking.aalto.fi/." };
  const sources = sourcesFromResults([page]); const allowed = actionAllowlist([page]);
  const raw = { ...testPlan(input).output, recommendation: "An option [S1] fake [S88]", action_url: "https://invented.example/" };
  const output = validateOutput(raw, sources, allowed);
  assert.equal(output.action_url, ""); assert.equal(output.recommendation.includes("S88"), false);
  assert.equal(validateOutput({ ...raw, action_url: "https://booking.aalto.fi/" }, sources, allowed).action_url, "https://booking.aalto.fi/");
});
test("queries are unrestricted and do not add institutional or geographic assumptions", () => {
  const plain = inputSchema.parse({ message: "Compare camera lenses for landscape photography" });
  assert.deepEqual(plain.profile, { location: "", budget: null, deadline: "", timeZone: "Europe/Tallinn", deepSearch: false });
  const queries = buildQueries(plain);
  for (const query of queries) {
    assert.deepEqual(Object.keys(query), ["query"]);
    assert.doesNotMatch(query.query, /Aalto|university|Helsinki|campus|Deadline|Budget/i);
  }
  assert.equal(queries[0].query, plain.message);
});
test("old history profiles are migrated and obsolete institutional fields are dropped", () => {
  const migrated = inputSchema.parse({ ...input, profile: { institution: "aalto", location: "Helsinki", budget: 10, deadline: "", hasAccess: true, degreeStudent: true, deepSearch: false } });
  assert.equal("institution" in migrated.profile, false);
  assert.equal("hasAccess" in migrated.profile, false);
  assert.equal(migrated.profile.timeZone, "Europe/Tallinn");
});
test("calendar is a UTF-8-safe UTC reminder, never a booking", () => {
  const plan = testPlan(input);
  plan.output.title = "Café planning ☕ ".repeat(20);
  const ics = planCalendar(plan);
  assert.match(ics, /DTSTART:20261114T070000Z/); assert.match(ics, /DTEND:20261114T080000Z/); assert.match(ics, /STATUS:TENTATIVE/); assert.match(ics.replace(/\r\n[ \t]/g, ""), /not a reservation/);
  for (const line of ics.split("\r\n")) assert.ok(Buffer.byteLength(line, "utf8") <= 75);
  assert.match(planMarkdown(plan), /## Steps/);
  assert.doesNotMatch(planMarkdown(plan), /DEMO|Demo/);
});

test("deadlines support other IANA time zones and calendar export requires an explicit date", () => {
  assert.equal(localTimeToDate("2026-11-14T10:00", "America/New_York").toISOString(), "2026-11-14T15:00:00.000Z");
  assert.throws(() => planCalendar(testPlan({ ...input, profile: { ...input.profile, deadline: "" } })));
});
