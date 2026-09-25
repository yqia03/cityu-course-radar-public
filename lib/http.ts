import { db, adminIds } from "./db";
import { getUser } from "@/lib/auth";
import { ZodError } from "zod";
import {
  fingerprint,
  hmacKey,
  networkPrefix,
  signVisitor,
  verifyVisitor,
  VISITOR_LIFETIME,
} from "./security";
export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    public retryAfter = 3600,
  ) {
    super(code);
  }
}
export function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
export function failure(e: unknown) {
  if (e instanceof HttpError) {
    const response = json({ error: e.code }, e.status);
    if (e.status === 429)
      response.headers.set("Retry-After", String(e.retryAfter));
    return response;
  }
  if (e instanceof ZodError)
    return json(
      { error: "INVALID_INPUT", fields: e.issues.map((i) => i.path.join(".")) },
      400,
    );
  console.error(
    "Request failed",
    e instanceof Error ? e.message : "Unknown error",
  );
  return json({ error: "UNAVAILABLE" }, 503);
}
export async function readJson(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin)
    throw new HttpError(403, "ORIGIN");
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    throw new HttpError(415, "INVALID_INPUT");
  if (Number(request.headers.get("content-length") || 0) > 20000)
    throw new HttpError(413, "INVALID_INPUT");
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, "INVALID_INPUT");
  let text = "",
    size = 0;
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 20000) {
      await reader.cancel();
      throw new HttpError(413, "INVALID_INPUT");
    }
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, "INVALID_INPUT");
  }
}
let signingKey: Promise<CryptoKey> | undefined;
export function securityKey(): Promise<CryptoKey> {
  return (signingKey ??= (async () => {
    const d = db();
    const secret = Array.from(crypto.getRandomValues(new Uint8Array(32)), (v) =>
      v.toString(16).padStart(2, "0"),
    ).join("");
    await d
      .prepare(
        "INSERT INTO settings (key,value) VALUES ('security-key-v1',?) ON CONFLICT(key) DO NOTHING",
      )
      .bind(secret)
      .run();
    const row = await d
      .prepare("SELECT value FROM settings WHERE key='security-key-v1'")
      .first<{ value: string }>();
    if (!row) throw new Error("Security key unavailable");
    return hmacKey(row.value);
  })().catch((e) => {
    signingKey = undefined;
    throw e;
  }));
}
export async function networkHash(request: Request) {
  return fingerprint(
    await securityKey(),
    `network:${networkPrefix(request.headers.get("cf-connecting-ip") || "")}`,
  );
}
function visitorCookieName(request: Request) {
  return new URL(request.url).protocol === "https:"
    ? "__Host-radar_visitor"
    : "radar_visitor";
}
export async function visitor(request: Request, issue = false) {
  const name = visitorCookieName(request);
  const cookies = (request.headers.get("cookie") || "")
    .split(";")
    .map((v) => v.trim())
    .filter((v) => v.startsWith(`${name}=`));
  const key = await securityKey(),
    now = Math.floor(Date.now() / 1000);
  if (cookies.length === 1) {
    const valid = await verifyVisitor(
      key,
      cookies[0].slice(name.length + 1),
      now,
    );
    if (valid) return valid;
  }
  if (!issue) throw new HttpError(409, "COOKIE_REQUIRED");
  // Every issuance path shares this counter. Rejected writes never mint tokens.
  await consumeLimits(
    [
      {
        key: `session:${await networkHash(request)}:${Math.floor(now / 3600)}`,
        max: 30,
      },
    ],
    (Math.floor(now / 3600) + 1) * 3600,
  );
  const id = crypto.randomUUID();
  return { id, token: await signVisitor(key, id, now), fresh: true };
}
// Exhausted issuance must not prevent anonymous users from reading courses.
export async function readVisitor(request: Request) {
  try {
    return await visitor(request, true);
  } catch (e) {
    if (e instanceof HttpError && e.status === 429) return null;
    throw e;
  }
}
export function withVisitor(
  response: Response,
  request: Request,
  token: string,
) {
  response.headers.append(
    "Set-Cookie",
    `${visitorCookieName(request)}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${VISITOR_LIFETIME}${new URL(request.url).protocol === "https:" ? "; Secure" : ""}`,
  );
  return response;
}
async function consumeLimits(
  limits: { key: string; max: number }[],
  expires: number,
) {
  const d = db();
  const results = await d.batch(
    limits.map(({ key, max }) =>
      d
        .prepare(
          "INSERT INTO rate_limits (key,count,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=MIN(count+1,?) RETURNING count",
        )
        .bind(key, expires, max + 1),
    ),
  );
  await d
    .prepare("DELETE FROM rate_limits WHERE expires_at < ?")
    .bind(Math.floor(Date.now() / 1000) - 86400)
    .run();
  if (
    results.some(
      (r, i) =>
        Number((r.results[0] as { count: number })?.count) > limits[i].max,
    )
  )
    throw new HttpError(429, "RATE_LIMIT");
}
export async function limit(
  request: Request,
  visitorId: string,
  action: string,
  max = 15,
) {
  const now = Math.floor(Date.now() / 1000),
    bucket = Math.floor(now / 3600);
  await consumeLimits(
    [
      { key: `${action}:visitor:${visitorId}:${bucket}`, max },
      {
        key: `${action}:ip:${await networkHash(request)}:${bucket}`,
        max: max * 4,
      },
    ],
    (bucket + 1) * 3600,
  );
}

export async function requireAdmin() {
  const user = await getUser();
  if (!user) throw new HttpError(401, "LOGIN_REQUIRED");
  if (!adminIds().includes(user.userId)) throw new HttpError(403, "FORBIDDEN");
  return user;
}
