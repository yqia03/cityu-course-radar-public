import type { MessageKey } from "./messages";
export async function api<T>(
  path: string,
  body?: unknown,
  method = "POST",
): Promise<T> {
  const response = await fetch(
    path,
    body === undefined
      ? undefined
      : {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
  );
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error("UNAVAILABLE");
  }
  if (!response.ok)
    throw new Error((data as { error?: string }).error || "UNAVAILABLE");
  return data as T;
}
export function errorKey(e: unknown): MessageKey {
  const s = e instanceof Error ? e.message : "UNAVAILABLE";
  return [
    "COOKIE_REQUIRED",
    "INVALID_INPUT",
    "UNAVAILABLE",
    "LOGIN_REQUIRED",
    "COURSE_EXISTS",
    "NOT_FOUND",
    "RATE_LIMIT",
    "COURSE_NETWORK_LIMIT",
    "DAILY_REVIEW_LIMIT",
    "DUPLICATE_REVIEW",
    "ORIGIN",
    "FORBIDDEN",
    "MODERATED",
  ].includes(s)
    ? (s as MessageKey)
    : "UNAVAILABLE";
}
