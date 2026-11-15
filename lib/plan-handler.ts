import { runAgent } from "./agent";
import { inputSchema } from "./plan-core";
import { createExaClient, AgentError, errorMessage, type ExaTransport } from "./exa-client";
import { sameOrigin } from "./request-origin";
import type { AgentEvent } from "./plan-types";

/** Anonymous visitor endpoint. Credentials come exclusively from the operator. */
export function createPlanHandler(getServerKey: () => string, makeClient: (key: string) => ExaTransport = createExaClient) {
  return async function POST(request: Request) {
    if (!sameOrigin(request)) return Response.json({ error: "This request is not allowed." }, { status: 403 });
    if (Number(request.headers.get("content-length") || 0) > 64000) {
      return Response.json({ error: "The request is too large." }, { status: 413 });
    }
    let text: string;
    try { text = await request.text(); }
    catch { return Response.json({ error: errorMessage("VALIDATION") }, { status: 400 }); }
    if (text.length > 16000) return Response.json({ error: "The request is too large." }, { status: 413 });
    let raw: unknown;
    try { raw = JSON.parse(text); }
    catch { return Response.json({ error: errorMessage("VALIDATION") }, { status: 400 }); }
    const parsed = inputSchema.safeParse(raw);
    if (!parsed.success) return Response.json({ error: errorMessage("VALIDATION") }, { status: 400 });
    const key = getServerKey();
    if (!key || key.length > 512) {
      return Response.json({ error: errorMessage("NO_KEY"), code: "SERVICE_UNAVAILABLE" }, { status: 503 });
    }

    const encoder = new TextEncoder();
    const cancelled = new AbortController();
    const signal = AbortSignal.any([request.signal, cancelled.signal]);
    let closed = false;
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const emit = (event: AgentEvent) => {
          if (!closed && !signal.aborted) controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        };
        try {
          await runAgent(parsed.data, makeClient(key), emit, signal);
        } catch (error) {
          const code = error instanceof AgentError ? error.code : "EXA_ERROR";
          emit({ type: "error", code, message: errorMessage(code) });
        } finally {
          if (!closed) { closed = true; controller.close(); }
        }
      },
      cancel() { closed = true; cancelled.abort(); },
    });
    return new Response(stream, { headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-store, no-transform",
      "X-Accel-Buffering": "no",
    } });
  };
}
