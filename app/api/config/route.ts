import { serverExaKey } from "@/lib/server-env";

export function GET() {
  const ready = !!serverExaKey();
  return Response.json({ status: ready ? "ready" : "unavailable", version: "1.3.1" }, { status: ready ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
