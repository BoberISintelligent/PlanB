import type { Plan, PlanInput, PlanOutput } from "../lib/plan-types";

export const exampleOutput: PlanOutput = {
  title: "Find a public workstation",
  recommendation: "Check a public workstation and confirm the requirements [S1].",
  cost: "Confirm the current price with the provider [S1].",
  access_conditions: "An account may be required [S1].",
  steps: ["Read the access requirements [S1].", "Confirm availability with the provider [S1]."],
  alternatives: [], exclusions: [], questions: [],
  action_url: "https://workspace.example.org/book", draft_message: "",
};

/** Synthetic fixture used only by automated tests; never served to visitors. */
export function testPlan(input: PlanInput): Plan {
  return {
    id: "test-plan", createdAt: "2026-11-14T12:00:00.000Z", input,
    output: { ...exampleOutput },
    sources: [{ id: "S1", url: "https://workspace.example.org/computers", title: "Public workstations", domain: "workspace.example.org", excerpt: "An account may be required.", official: false, retrievedAt: "2026-11-14T12:00:00.000Z", contentRead: true, freshness: "live_requested" }],
    grounding: [], warnings: [], trace: [], metrics: { durationMs: 1, calls: 0, costDollars: null },
  };
}
