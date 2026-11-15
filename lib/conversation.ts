import type { ConversationTurn, Plan, PlanInput } from "./plan-types";

export const conversationConfig = { maxTurns: 6, maxCharacters: 1000 };
const clean = (text: string) => text.replace(/\[S\d+\]/g, "").replace(/\s+/g, " ").trim();
const short = (text: string, length: number) => clean(text).slice(0, length);

/** Continue only the selected plan. Unrelated saved searches stay out of context. */
export function continueConversation(plan: Plan): ConversationTurn[] {
  const output = plan.output;
  const summary = [
    `Plan: ${short(output.title, 120)}`,
    `Recommendation: ${short(output.recommendation, 340)}`,
    `Cost: ${short(output.cost, 130)}`,
    `Requirements: ${short(output.access_conditions, 150)}`,
    output.alternatives.length ? `Alternatives: ${output.alternatives.slice(0, 2).map(item => short(item, 85)).join("; ")}` : "",
  ].filter(Boolean).join("\n");
  const turns: ConversationTurn[] = [
    ...(plan.input.conversation || []),
    { role: "user", content: plan.input.message },
    { role: "assistant", content: summary },
  ];
  return turns.slice(-conversationConfig.maxTurns).map(turn => ({
    role: turn.role,
    content: clean(turn.content).slice(0, conversationConfig.maxCharacters),
  })).filter(turn => turn.content.length > 0);
}

/** Supply enough task context for short requests such as "only free options". */
export function researchRequest(input: PlanInput) {
  const task = input.message.slice(0, 1800);
  const history = input.conversation || [];
  if (!history.length) return task;
  const earlierRequests = history.filter(turn => turn.role === "user").map(turn => short(turn.content, 350));
  const previousAnswer = [...history].reverse().find(turn => turn.role === "assistant");
  return `${task}\nEarlier task context: ${earlierRequests.join(" / ")}\nPrevious answer for context: ${previousAnswer ? short(previousAnswer.content, 750) : "None"}\nResearch the current request using this context. New explicit instructions take precedence over older conversation details.`;
}
