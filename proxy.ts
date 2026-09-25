import { NextResponse, type NextRequest } from "next/server";
import { canonicalUrl } from "./lib/canonical";
import { env } from "cloudflare:workers";
export function proxy(request: NextRequest) {
  const url = new URL(request.url);
  const origin = env.APP_ORIGIN;
  // Only the canonical production host accepts mutations. Alternate Worker
  // addresses cannot bypass controls placed on the custom domain.
  if (origin?.startsWith("https://") && url.origin !== origin) {
    if (request.method !== "GET" && request.method !== "HEAD")
      return new Response("Invalid host", { status: 403 });
    return NextResponse.redirect(canonicalUrl(url, origin), 308);
  }
  const response = NextResponse.next();
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()",
  );
  response.headers.set(
    "Content-Security-Policy",
    "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self' https://accounts.google.com",
  );
  if (url.protocol === "https:")
    response.headers.set("Strict-Transport-Security", "max-age=31536000");
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname === "/login" ||
    url.pathname === "/admin"
  )
    response.headers.set("Cache-Control", "private, no-store");
  return response;
}
export const config = { matcher: ["/((?!assets/).*)"] };
