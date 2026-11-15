import { env } from "cloudflare:workers";
import { normalizeApiKey } from "./api-key";

export function serverExaKey() {
  return normalizeApiKey(env.EXA_API_KEY) || normalizeApiKey(process.env.EXA_API_KEY);
}
