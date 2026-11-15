import type { ExaResponse } from "./plan-types";
import { normalizeApiKey } from "./api-key";

export class AgentError extends Error {
  constructor(public code: string, message: string, public status = 502) { super(message); }
}

export type ExaTransport = (path: "search" | "contents", body: Record<string, unknown>, signal?: AbortSignal) => Promise<ExaResponse>;

export function createExaClient(apiKey: string, fetcher: typeof fetch = fetch): ExaTransport {
  const key = normalizeApiKey(apiKey);
  return async (path, body, parentSignal) => {
    if (!key || key.length > 512 || /\s/.test(key)) throw new AgentError("INVALID_KEY", "Invalid key format", 400);
    const timeout = AbortSignal.timeout(path === "search" && body.outputSchema ? 55000 : 20000);
    const signal = parentSignal ? AbortSignal.any([parentSignal, timeout]) : timeout;
    for (let attempt = 0; attempt < 2; attempt++) {
      let response: Response;
      try {
        response = await fetcher(`https://api.exa.ai/${path}`, {
          method: "POST", headers: { "Content-Type": "application/json", "x-api-key": key },
          body: JSON.stringify(body), signal,
        });
      } catch (error) {
        if (parentSignal?.aborted) throw new AgentError("CANCELLED", "Request cancelled", 499);
        if (signal.aborted) throw new AgentError("TIMEOUT", "Exa did not respond in time", 504);
        throw new AgentError("NETWORK", "Could not reach Exa");
      }
      if ((response.status === 429 || response.status === 503) && attempt === 0) {
        const wait = Math.min(2000, Math.max(300, Number(response.headers.get("retry-after") || 1) * 1000));
        await response.body?.cancel();
        await new Promise<void>((resolve, reject) => {
          const stop = () => { clearTimeout(timer); reject(new AgentError("CANCELLED", "Request cancelled", 499)); };
          const timer = setTimeout(() => { signal.removeEventListener("abort", stop); resolve(); }, wait);
          if (signal.aborted) stop(); else signal.addEventListener("abort", stop, { once: true });
        });
        continue;
      }
      if (!response.ok) {
        // Never reflect provider bodies: they can contain private request data.
        await response.body?.cancel();
        const codes: Record<number, string> = { 400: "EXA_REQUEST", 401: "INVALID_KEY", 402: "NO_CREDITS", 403: "INVALID_KEY", 429: "RATE_LIMIT" };
        throw new AgentError(codes[response.status] || "EXA_ERROR", `Exa returned HTTP ${response.status}`, response.status);
      }
      let parsed: unknown;
      try { parsed = await response.json(); } catch { throw new AgentError("EXA_RESPONSE", "Exa returned invalid JSON"); }
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new AgentError("EXA_RESPONSE", "Invalid Exa response");
      return parsed as ExaResponse;
    }
    throw new AgentError("RATE_LIMIT", "Exa request limit reached", 429);
  };
}

export function errorMessage(code: string) {
  const messages: Record<string, string> = {
    INVALID_KEY: "Search is temporarily unavailable. Please try again later.",
    NO_KEY: "Search is temporarily unavailable. Please try again later.",
    NO_CREDITS: "Search is temporarily unavailable. Please try again later.",
    RATE_LIMIT: "Search is busy right now. Wait a moment and try again.",
    TIMEOUT: "The search took too long. Try again with a more specific request.",
    NO_SOURCES: "No useful sources were found. Try adding a few details to your request.",
    INVALID_OUTPUT: "We couldn't put a reliable plan together. Try refining your request.",
    NETWORK: "We couldn't reach the search service. Please try again in a moment.",
    VALIDATION: "Write between 3 and 4,000 characters. Location, budget and deadline are optional; check their format if provided.",
    CANCELLED: "Search stopped.",
  };
  return messages[code] || "The search couldn't finish. Please try again.";
}
