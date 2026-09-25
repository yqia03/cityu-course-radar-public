import { authConfig, authCookie, authCookieName } from "@/lib/auth";
import { cookieValue, tokenHash } from "@/lib/auth-security";
import { db } from "@/lib/db";
import { failure, HttpError } from "@/lib/http";
export async function POST(request: Request) {
  try {
    const origin = authConfig().origin;
    if (request.headers.get("origin") !== origin)
      throw new HttpError(403, "ORIGIN");
    const token = cookieValue(
      request.headers.get("cookie"),
      authCookieName("session"),
    );
    if (token)
      await db()
        .prepare("DELETE FROM auth_sessions WHERE token_hash=?")
        .bind(await tokenHash(token))
        .run();
    return new Response(null, {
      status: 303,
      headers: {
        Location: origin,
        "Set-Cookie": authCookie("session", "", 0),
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return failure(e);
  }
}
