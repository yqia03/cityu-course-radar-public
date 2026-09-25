import { env } from "cloudflare:workers";
export function db(): D1Database {
  if (!env.DB) throw new Error("D1 unavailable");
  return env.DB;
}
export function adminIds(): string[] {
  return String(
    (env as unknown as Record<string, unknown>).ADMIN_USER_IDS || "",
  )
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
