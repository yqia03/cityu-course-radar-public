import { isIP } from "node:net";

export const VISITOR_LIFETIME = 365 * 86400;
const encoder = new TextEncoder();

export function normalizedComment(text: string) {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s\p{Cf}\p{P}]/gu, "");
}

// Group IPv6 privacy addresses by /64 so changing the interface ID is not
// another voting identity. Never use user-controlled X-Forwarded-For.
export function networkPrefix(ip: string) {
  if (isIP(ip) === 4) return ip;
  if (isIP(ip) !== 6) return "unknown";
  const canonical = new URL(`http://[${ip}]/`).hostname.slice(1, -1);
  const [left, right] = canonical.split("::");
  const a = left ? left.split(":") : [];
  const b = right ? right.split(":") : [];
  const words =
    right !== undefined
      ? [...a, ...Array(8 - a.length - b.length).fill("0"), ...b]
      : a;
  if (
    words.slice(0, 5).every((v) => Number.parseInt(v, 16) === 0) &&
    Number.parseInt(words[5], 16) === 65535
  ) {
    return [words[6], words[7]]
      .flatMap((v) => {
        const n = Number.parseInt(v, 16);
        return [n >> 8, n & 255];
      })
      .join(".");
  }
  return (
    words
      .slice(0, 4)
      .map((v) => Number.parseInt(v, 16).toString(16))
      .join(":") + "::/64"
  );
}

export async function hmacKey(secret: string) {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}
export async function fingerprint(key: CryptoKey, value: string) {
  const bytes = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return Array.from(new Uint8Array(bytes), (v) =>
    v.toString(16).padStart(2, "0"),
  ).join("");
}
export async function signVisitor(key: CryptoKey, id: string, issued: number) {
  const payload = `v1.${id}.${issued}`;
  return `${payload}.${await fingerprint(key, payload)}`;
}
export async function verifyVisitor(
  key: CryptoKey,
  token: string,
  now: number,
) {
  const match =
    /^v1\.([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.([0-9]{10})\.([0-9a-f]{64})$/.exec(
      token,
    );
  if (!match) return null;
  const issued = Number(match[2]);
  if (issued > now || now - issued >= VISITOR_LIFETIME) return null;
  const signature = Uint8Array.from(match[3].match(/../g)!, (v) =>
    Number.parseInt(v, 16),
  );
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    signature,
    encoder.encode(token.slice(0, token.lastIndexOf("."))),
  );
  return valid ? { id: match[1], token, fresh: false } : null;
}
