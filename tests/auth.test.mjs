import test from "node:test";
import assert from "node:assert/strict";
import { SignJWT, generateKeyPair } from "jose";
import {
  cookieValue,
  randomToken,
  tokenHash,
  googleIdentity,
} from "../lib/auth-security.ts";

test("session cookies reject duplicates and malformed tokens; only hashes go to storage", async () => {
  const value = randomToken();
  assert.equal(value.length, 43);
  assert.equal(cookieValue(`radar_session=${value}`, "radar_session"), value);
  assert.equal(
    cookieValue(
      `radar_session=${value}; radar_session=${value}`,
      "radar_session",
    ),
    null,
  );
  assert.equal(cookieValue("radar_session=forged", "radar_session"), null);
  assert.notEqual(await tokenHash(value), value);
  assert.equal(await tokenHash(value), await tokenHash(value));
});
test("Google identity requires trusted signature, audience, issuer, nonce, expiry and verified email", async () => {
  const { privateKey, publicKey } = await generateKeyPair("RS256");
  const payload = {
    iss: "https://accounts.google.com",
    aud: "client",
    sub: "12345",
    email: "test@example.com",
    email_verified: true,
    nonce: "nonce",
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 300,
  };
  const issue = (overrides = {}) =>
    new SignJWT({ ...payload, ...overrides })
      .setProtectedHeader({ alg: "RS256" })
      .sign(privateKey);
  assert.equal(
    (
      await googleIdentity(
        await issue(),
        async () => publicKey,
        "client",
        "nonce",
      )
    ).userId,
    "google:12345",
  );
  for (const invalid of [
    { aud: "evil" },
    { iss: "https://evil.com" },
    { nonce: "wrong" },
    { exp: 1 },
    { email_verified: false },
    { azp: "evil" },
    { sub: "" },
  ]) {
    await assert.rejects(() =>
      issue(invalid).then((token) =>
        googleIdentity(token, async () => publicKey, "client", "nonce"),
      ),
    );
  }
  const other = await generateKeyPair("RS256");
  await assert.rejects(() =>
    issue().then((token) =>
      googleIdentity(token, async () => other.publicKey, "client", "nonce"),
    ),
  );
});

test("canonical redirects keep double-slash paths on the trusted host", async () => {
  const { canonicalUrl } = await import("../lib/canonical.ts");
  for (const source of [
    "http://cityuhk.uwaylab.com//evil.example/path",
    "https://alternate.example/ordinary?next=https://evil.example",
    "http://cityuhk.uwaylab.com/%2f%2fevil.example",
  ]) {
    const target = canonicalUrl(new URL(source), "https://cityuhk.uwaylab.com");
    assert.equal(target.origin, "https://cityuhk.uwaylab.com");
    assert.equal(target.pathname, new URL(source).pathname);
  }
});
