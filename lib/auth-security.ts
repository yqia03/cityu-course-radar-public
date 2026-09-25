import { jwtVerify, type JWTVerifyGetKey } from "jose";

export function randomToken() {
  return btoa(
    String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))),
  )
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}
export async function tokenHash(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}
export function cookieValue(header: string | null, name: string) {
  const values = (header || "")
    .split(";")
    .map((v) => v.trim())
    .filter((v) => v.startsWith(name + "="));
  const value = values.length === 1 ? values[0].slice(name.length + 1) : "";
  return /^[A-Za-z0-9_-]{43}$/.test(value) ? value : null;
}
export async function googleIdentity(
  token: string,
  key: JWTVerifyGetKey,
  clientId: string,
  nonce: string,
) {
  const { payload } = await jwtVerify(token, key, {
    algorithms: ["RS256"],
    audience: clientId,
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    requiredClaims: ["sub", "exp", "iat", "nonce", "email", "email_verified"],
    maxTokenAge: "10m",
  });
  if (
    payload.nonce !== nonce ||
    payload.email_verified !== true ||
    typeof payload.sub !== "string" ||
    !/^[A-Za-z0-9_-]{1,255}$/.test(payload.sub) ||
    typeof payload.email !== "string" ||
    payload.email.length > 320 ||
    (payload.azp !== undefined && payload.azp !== clientId)
  )
    throw new Error("Invalid identity");
  return {
    userId: `google:${payload.sub}`,
    email: payload.email,
    fullName:
      typeof payload.name === "string"
        ? payload.name.slice(0, 100)
        : "CityU community member",
  };
}
