import { z } from "zod";
import type { ExaResult, Grounding, Plan, PlanInput, PlanOutput, Source } from "./plan-types";
import { conversationConfig, researchRequest } from "./conversation";
const profileSchema = z.object({
    location: z.string().trim().max(160).default(""),
    budget: z.number().finite().min(0).max(1000000000).nullable().default(null),
    deadline: z.string().default(""),
    timeZone: z.string().max(80).default("Europe/Tallinn").refine((zone) => {
        try {
            new Intl.DateTimeFormat("en", { timeZone: zone });
            return true;
        }
        catch {
            return false;
        }
    }, "Invalid time zone"),
    deepSearch: z.boolean().default(false),
}).superRefine((profile, context) => {
    if (!profile.deadline)
        return;
    try {
        localTimeToDate(profile.deadline, profile.timeZone);
    }
    catch {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ["deadline"], message: "Invalid local deadline" });
    }
});
export const inputSchema = z.object({
    message: z.string().trim().min(3).max(4000),
    profile: profileSchema.default({}),
    conversation: z.array(z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().trim().min(1).max(conversationConfig.maxCharacters),
    })).max(conversationConfig.maxTurns).default([]),
});
export const outputSchema = z.object({
    title: z.string().min(1).max(300),
    recommendation: z.string().min(1).max(5000),
    cost: z.string().max(1500),
    access_conditions: z.string().max(2500),
    steps: z.array(z.string().max(2000)).max(10),
    alternatives: z.array(z.string().max(2000)).max(6),
    exclusions: z.array(z.string().max(2000)).max(6),
    questions: z.array(z.string().max(1000)).max(6),
    action_url: z.string().max(2048),
    draft_message: z.string().max(5000),
});
// Ten root properties; primitive arrays keep the Exa schema within its nesting limit.
export const exaOutputSchema = {
    type: "object",
    additionalProperties: false,
    properties: {
        title: { type: "string", description: "A short, specific title in English." },
        recommendation: { type: "string", description: "The substantive answer to the user's question or recommended solution. Explain findings, compare relevant options and cite supplied sources as [S1]. Do not merely repeat the question." },
        cost: { type: "string", description: "Sourced prices when relevant; say unknown if unconfirmed and not applicable for a non-commercial question. Never invent a price or budget." },
        access_conditions: { type: "string", description: "Relevant practical details and requirements found in sources. Say not applicable if none. Never assume university membership, a location or credentials." },
        steps: { type: "array", minItems: 1, items: { type: "string" }, description: "A non-empty ordered list of concrete next steps, normally 3 to 6. For an informational question, at least one useful source-reading or verification step. Use source IDs [S1] when factual. Never return an empty array." },
        alternatives: { type: "array", items: { type: "string" }, description: "Relevant alternatives, competing options or additional perspectives with source IDs. Empty when not applicable." },
        exclusions: { type: "array", items: { type: "string" }, description: "Options that fail the user's explicitly stated constraints, with sourced reasons. Empty when none." },
        questions: { type: "array", items: { type: "string" }, description: "Only missing information needed to answer reliably. Do not require a university, budget, location or deadline for ordinary questions." },
        action_url: { type: "string", description: "An exact web URL present in the provided sources or retrieved links for the next action or useful reading, or an empty string. Never invent a URL." },
        draft_message: { type: "string", description: "A message draft in English if useful for this task. Otherwise an empty string. Never invent a recipient or claim it was sent." },
    },
    required: Object.keys(outputSchema.shape),
};
export function safeUrl(value: unknown): string | null {
    if (typeof value !== "string" || value.length > 2048)
        return null;
    try {
        const url = new URL(value);
        const host = url.hostname.toLowerCase();
        if (!["https:", "http:"].includes(url.protocol) || url.username || url.password || !host.includes(".") ||
            host === "localhost" || /\.(localhost|local|internal)$/.test(host) || /^\d+(\.\d+){3}$/.test(host) || host.includes(":"))
            return null;
        url.hash = "";
        return url.href;
    }
    catch {
        return null;
    }
}
export function shortExcerpt(text: string) {
    return text.replace(/\s+/g, " ").trim().split(" ").slice(0, 22).join(" ").slice(0, 200);
}
export function sourcesFromResults(results: ExaResult[], readUrls = new Set<string>()): Source[] {
    const unique = new Map<string, ExaResult>();
    for (const result of results) {
        const url = safeUrl(result.url);
        if (!url)
            continue;
        const previous = unique.get(url);
        unique.set(url, { ...previous, ...result, url, text: result.text || previous?.text, highlights: result.highlights?.length ? result.highlights : previous?.highlights });
    }
    return [...unique.values()].slice(0, 12).map((result, index) => ({
        id: `S${index + 1}`,
        url: result.url,
        title: result.title || new URL(result.url).hostname,
        domain: new URL(result.url).hostname.replace(/^www\./, ""),
        excerpt: shortExcerpt(result.highlights?.[0] || result.text || ""),
        official: false,
        retrievedAt: new Date().toISOString(),
        contentRead: !!result.text,
        freshness: readUrls.has(result.url) ? "live_requested" : "index",
    }));
}
export function actionAllowlist(results: ExaResult[]) {
    const urls = new Set<string>();
    for (const result of results) {
        const candidates = [result.url, ...(result.extras?.links || []), ...(result.extras?.richLinks?.map((link) => link.url) || []),
            ...(result.text?.match(/https?:\/\/[^\s<>"\])]+/g) || [])];
        for (const candidate of candidates) {
            const url = safeUrl(candidate.replace(/[.,;]+$/, ""));
            if (url)
                urls.add(url);
        }
    }
    return urls;
}
export function validateOutput(raw: unknown, sources: Source[], allowedActions: Set<string>) {
    const parsed = outputSchema.safeParse(typeof raw === "string" ? JSON.parse(raw) : raw);
    if (!parsed.success)
        throw new Error("INVALID_OUTPUT");
    const output = parsed.data;
    const ids = new Set(sources.map((source) => source.id));
    const clean = (text: string) => text.replace(/\[(S\d+)\]/g, (marker, id: string) => ids.has(id) ? marker : "");
    for (const key of Object.keys(output) as (keyof PlanOutput)[]) {
        if (key === "action_url")
            continue;
        const value = output[key];
        (output as Record<string, unknown>)[key] = Array.isArray(value) ? value.map(clean) : clean(value);
    }
    const action = safeUrl(output.action_url);
    output.action_url = action && allowedActions.has(action) ? action : "";
    return output;
}
export function mapGrounding(raw: {
    field: string;
    confidence?: string;
    citations?: {
        url: string;
    }[];
}[], sources: Source[]): Grounding[] {
    return raw.map((item) => ({
        field: item.field,
        sourceIds: [...new Set((item.citations || []).flatMap((citation) => {
                const found = sources.find((source) => safeUrl(source.url) === safeUrl(citation.url));
                return found ? [found.id] : [];
            }))],
        confidence: ["high", "medium", "low"].includes(item.confidence || "") ? item.confidence as "high" | "medium" | "low" : "unknown",
    }));
}
export function searchContext(input: PlanInput) {
    return [input.profile.location ? `Location: ${input.profile.location}.` : "",
        input.profile.budget !== null ? `Budget: EUR ${input.profile.budget}.` : "",
        input.profile.deadline ? `Deadline: ${input.profile.deadline} ${input.profile.timeZone}.` : ""].filter(Boolean).join(" ");
}
export function buildQueries(input: PlanInput) {
    const context = searchContext(input);
    const goal = researchRequest(input);
    return [
        { query: `${goal}${context ? ` Context: ${context}` : ""}` },
        { query: `${goal} ${context} Find relevant supporting sources, detailed explanations and practical options.`.trim() },
        { query: `${goal} ${context} Verify key facts, compare other perspectives and check recent changes where relevant.`.trim() },
    ];
}
/** Convert local wall-clock time in the supplied IANA zone, including DST validation. */
export function localTimeToDate(value: string, timeZone = "Europe/Helsinki"): Date {
    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
    if (!match)
        throw new Error("INVALID_DATE");
    const [year, month, day, hour, minute] = match.slice(1).map(Number);
    const wall = Date.UTC(year, month - 1, day, hour, minute);
    const formatter = new Intl.DateTimeFormat("sv-SE", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
    let instant = wall;
    for (let i = 0; i < 4; i++) {
        const p = Object.fromEntries(formatter.formatToParts(instant).map((part) => [part.type, part.value]));
        const represented = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute);
        instant += wall - represented;
    }
    const canonical = formatter.format(instant).replace(" ", "T");
    if (canonical !== value)
        throw new Error("INVALID_DATE");
    return new Date(instant);
}
export function withoutCitations(value: string) { return value.replace(/\[S\d+\]/g, "").trim(); }
export function planMarkdown(plan: Plan) {
    const o = plan.output;
    return `# ${o.title}\n\n${plan.input.message}\n\n${o.recommendation}\n\n**Cost:** ${o.cost}\n\n**Access:** ${o.access_conditions}\n\n## Steps\n\n${o.steps.map((step, i) => `${i + 1}. ${step}`).join("\n")}\n\n## Alternatives\n\n${o.alternatives.map((item) => `- ${item}`).join("\n")}\n\n## Restrictions and questions\n\n${[...o.exclusions, ...o.questions, ...plan.warnings].map((item) => `- ${item}`).join("\n")}\n\n## Sources\n\n${plan.sources.map((source) => `- [${source.id}] [${source.title}](${source.url}) — ${source.retrievedAt || "retrieval date unavailable"}`).join("\n")}\n\n${o.action_url ? `Next action: ${o.action_url}\n` : ""}`;
}
const icsEscape = (s: string) => s.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
const utcStamp = (date: Date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
/** Fold by UTF-8 octets as required by RFC 5545, preserving multibyte characters. */
function foldLine(line: string) {
    const encoder = new TextEncoder();
    let current = "";
    let bytes = 0;
    const lines: string[] = [];
    for (const char of line) {
        const size = encoder.encode(char).length;
        if (bytes + size > 73) {
            lines.push(current);
            current = " ";
            bytes = 1;
        }
        current += char;
        bytes += size;
    }
    lines.push(current);
    return lines.join("\r\n");
}
export function planCalendar(plan: Plan) {
    if (!plan.input.profile.deadline)
        throw new Error("NO_DEADLINE");
    const end = localTimeToDate(plan.input.profile.deadline, plan.input.profile.timeZone);
    const start = new Date(end.getTime() - 3600000);
    return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Plan B//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "BEGIN:VEVENT",
        `UID:${plan.id}@planb`, `DTSTAMP:${utcStamp(new Date())}`, `DTSTART:${utcStamp(start)}`, `DTEND:${utcStamp(end)}`,
        `SUMMARY:${icsEscape(withoutCitations(plan.output.title))}`, `DESCRIPTION:${icsEscape(`${withoutCitations(plan.output.recommendation)}\n\n${plan.output.steps.map(withoutCitations).join("\n")}\n${plan.output.action_url}\n\nThis is a personal reminder, not a reservation.`)}`,
        `LOCATION:${icsEscape(plan.input.profile.location)}`, "STATUS:TENTATIVE", "END:VEVENT", "END:VCALENDAR", ""].map(foldLine).join("\r\n");
}
