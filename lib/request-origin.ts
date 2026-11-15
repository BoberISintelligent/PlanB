export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || new URL(request.url).host;
  try {
    return !origin || new URL(origin).host === host || new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}
