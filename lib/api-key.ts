export function normalizeApiKey(value: string | null | undefined) {
  let key = (value || "").replace(/[\u200B-\u200D\uFEFF]/g, "").trim();
  const pairs: Record<string, string> = { '"': '"', "'": "'", "“": "”", "‘": "’" };
  for (let i = 0; i < 3; i++) {
    if (pairs[key[0]] && key.at(-1) === pairs[key[0]]) key = key.slice(1, -1).trim();
    else if (/^Bearer\s+/i.test(key)) key = key.replace(/^Bearer\s+/i, "").trim();
    else break;
  }
  return key;
}
