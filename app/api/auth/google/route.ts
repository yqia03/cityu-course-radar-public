import { authConfig, authCookie, googleEnabled } from "@/lib/auth";
import { randomToken, tokenHash } from "@/lib/auth-security";
import { db } from "@/lib/db";
import { failure, HttpError, limit, visitor } from "@/lib/http";

export async function POST(request: Request) {
  try {
    const c = authConfig();
    if (request.headers.get("origin") !== c.origin)
      throw new HttpError(403, "ORIGIN");
    if (!googleEnabled()) throw new HttpError(503, "LOGIN_NOT_CONFIGURED");
    const v = await visitor(request);
    await limit(request, v.id, "login", 10);
    const state = randomToken(),
      verifier = randomToken(),
      nonce = randomToken();
    await db().batch([
      db().prepare("DELETE FROM auth_flows WHERE expires_at<=unixepoch()"),
      db()
        .prepare(
          "INSERT INTO auth_flows(state_hash,verifier,nonce,expires_at) VALUES(?,?,?,unixepoch()+600)",
        )
        .bind(await tokenHash(state), verifier, nonce),
    ]);
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.search = new URLSearchParams({
      client_id: c.clientId,
      redirect_uri: `${c.origin}/api/auth/google/callback`,
      response_type: "code",
      scope: "openid email profile",
      state,
      nonce,
      code_challenge: await tokenHash(verifier),
      code_challenge_method: "S256",
      prompt: "select_account",
    }).toString();
    return new Response(null, {
      status: 303,
      headers: {
        Location: url.href,
        "Set-Cookie": authCookie("oauth", state, 600),
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return failure(e);
  }
}
