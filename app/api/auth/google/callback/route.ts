import { createRemoteJWKSet } from "jose";
import {
  authConfig,
  authCookie,
  authCookieName,
  googleEnabled,
  SESSION_LIFETIME,
} from "@/lib/auth";
import {
  cookieValue,
  googleIdentity,
  randomToken,
  tokenHash,
} from "@/lib/auth-security";
import { db } from "@/lib/db";
import { ENSURE_ACCOUNT_SQL } from "@/lib/points";

const keys = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs"),
  { timeoutDuration: 8000 },
);
export async function GET(request: Request) {
  const c = authConfig();
  const response = new Response(null, {
    status: 303,
    headers: {
      Location: `${c.origin}/login?error=google`,
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
      "Set-Cookie": authCookie("oauth", "", 0),
    },
  });
  try {
    if (!googleEnabled()) return response;
    const url = new URL(request.url);
    const state = cookieValue(
      request.headers.get("cookie"),
      authCookieName("oauth"),
    );
    if (
      !state ||
      url.searchParams.getAll("state").length !== 1 ||
      url.searchParams.get("state") !== state
    )
      return response;
    // Atomic consumption prevents parallel callback replay.
    const flow = await db()
      .prepare(
        "DELETE FROM auth_flows WHERE state_hash=? RETURNING verifier,nonce,expires_at",
      )
      .bind(await tokenHash(state))
      .first<{ verifier: string; nonce: string; expires_at: number }>();
    const code = url.searchParams.get("code");
    if (
      !flow ||
      flow.expires_at <= Date.now() / 1000 ||
      !code ||
      code.length > 4096 ||
      url.searchParams.getAll("code").length !== 1 ||
      url.searchParams.has("error")
    )
      return response;
    const exchange = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      signal: AbortSignal.timeout(10000),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        code_verifier: flow.verifier,
        client_id: c.clientId,
        client_secret: c.clientSecret,
        redirect_uri: `${c.origin}/api/auth/google/callback`,
      }),
    });
    if (!exchange.ok) return response;
    const tokens = (await exchange.json()) as { id_token?: unknown };
    if (typeof tokens.id_token !== "string") return response;
    const user = await googleIdentity(
      tokens.id_token,
      keys,
      c.clientId,
      flow.nonce,
    );
    const session = randomToken();
    const previous = cookieValue(
      request.headers.get("cookie"),
      authCookieName("session"),
    );
    await db().batch([
      db().prepare(ENSURE_ACCOUNT_SQL).bind(user.userId),
      db()
        .prepare(
          "DELETE FROM auth_sessions WHERE expires_at<=unixepoch() OR token_hash=?",
        )
        .bind(previous ? await tokenHash(previous) : ""),
      db()
        .prepare(
          "INSERT INTO auth_sessions(token_hash,user_id,email,full_name,expires_at) VALUES(?,?,?,?,unixepoch()+?)",
        )
        .bind(
          await tokenHash(session),
          user.userId,
          user.email,
          user.fullName,
          SESSION_LIFETIME,
        ),
    ]);
    response.headers.append(
      "Set-Cookie",
      authCookie("session", session, SESSION_LIFETIME),
    );
    response.headers.set("Location", `${c.origin}/`);
  } catch {
    // Never log authorization codes, tokens, profile data, or callback URLs.
    console.error("Google sign-in failed");
  }
  return response;
}
