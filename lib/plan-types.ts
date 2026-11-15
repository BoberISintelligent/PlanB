export type View = "new" | "saved" | "sources" | "about";

export interface Profile {
  location: string;
  budget: number | null;
  deadline: string;
  timeZone: string;
  deepSearch: boolean;
}

export interface PlanInput {
  message: string;
  profile: Profile;
  conversation?: ConversationTurn[];
}

export interface ConversationTurn {
  role: "user" | "assistant";
  content: string;
}

export interface PlanOutput {
  title: string;
  recommendation: string;
  cost: string;
  access_conditions: string;
  steps: string[];
  alternatives: string[];
  exclusions: string[];
  questions: string[];
  action_url: string;
  draft_message: string;
}

export interface Source {
  id: string;
  url: string;
  title: string;
  domain: string;
  excerpt: string;
  official: boolean;
  retrievedAt: string | null;
  contentRead: boolean;
  freshness: "live_requested" | "index";
}

export interface Grounding {
  field: string;
  sourceIds: string[];
  confidence: "high" | "medium" | "low" | "unknown";
}

export interface TraceEntry {
  endpoint: string;
  query?: string;
  requestId?: string;
  durationMs: number;
  resultCount: number;
  costDollars?: number;
}

export interface Plan {
  id: string;
  createdAt: string;
  input: PlanInput;
  output: PlanOutput;
  sources: Source[];
  grounding: Grounding[];
  warnings: string[];
  trace: TraceEntry[];
  metrics: { durationMs: number; calls: number; costDollars: number | null };
}

export type AgentStage = "understand" | "search" | "read" | "compare" | "prepare";
export type AgentEvent =
  | { type: "stage"; stage: AgentStage; detail?: string }
  | { type: "sources"; sources: Source[] }
  | { type: "result"; plan: Plan }
  | { type: "error"; code: string; message: string };

export interface ExaResult {
  id?: string;
  url: string;
  title?: string;
  text?: string;
  highlights?: string[];
  extras?: { links?: string[]; richLinks?: { url: string; anchor?: string }[] };
}

export interface ExaResponse {
  results?: ExaResult[];
  requestId?: string;
  costDollars?: { total?: number };
  output?: {
    content?: unknown;
    grounding?: { field: string; confidence?: string; citations?: { url: string; title?: string }[] }[];
  };
  statuses?: { id?: string; status?: string; error?: unknown }[];
}
