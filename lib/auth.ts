import { env } from "cloudflare:workers";
import { headers } from "next/headers";
import { db } from "./db";
import { cookieValue, tokenHash } from "./auth-security";
import { ensureAccount } from "./points";

export const SESSION_LIFETIME = 7 * 86400;
export function authConfig() {
  return {
    origin: env.APP_ORIGIN || "http://localhost:5173",
    clientId: env.GOOGLE_CLIENT_ID || "",
    clientSecret: env.GOOGLE_CLIENT_SECRET || "",
  };
}
export function googleEnabled() {
  const c = authConfig();
  return !!(c.clientId && c.clientSecret && c.origin.startsWith("https://"));
}
export function authCookieName(kind: "session" | "oauth") {
  return `${authConfig().origin.startsWith("https:") ? "__Host-" : ""}radar_${kind}`;
}
export function authCookie(
  kind: "session" | "oauth",
  value: string,
  maxAge: number,
) {
  return `${authCookieName(kind)}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${authConfig().origin.startsWith("https:") ? "; Secure" : ""}`;
}
export async function getUser() {
  const h = await headers();
  const token = cookieValue(h.get("cookie"), authCookieName("session"));
  if (!token) return null;
  const user = await db()
    .prepare(
      "SELECT user_id AS userId,email,full_name AS fullName FROM auth_sessions WHERE token_hash=? AND expires_at>unixepoch()",
    )
    .bind(await tokenHash(token))
    .first<{ userId: string; email: string; fullName: string }>();
  if (!user) return null;
  const account = await ensureAccount(db(), user.userId);
  if (account.status !== "active") return null;
  return { ...user, accountId: account.id, balance: account.balance };
}
