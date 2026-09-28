// Runs only against a local preview. All fixtures use a generated ZZTEST code.
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { randomToken, tokenHash } from "../lib/auth-security.ts";
const origin = process.env.TEST_ORIGIN || "http://localhost:5173";
assert.ok(
  ["localhost", "127.0.0.1"].includes(new URL(origin).hostname),
  "Refusing to mutate a non-local site",
);
const stamp = String(Date.now()).slice(-4),
  code = `ZZTEST${stamp}`;
const cleanup = `DELETE FROM reports WHERE review_id IN (SELECT id FROM reviews WHERE course_code='${code}');\nDELETE FROM moderation_log WHERE review_id IN (SELECT id FROM reviews WHERE course_code='${code}');\nDELETE FROM reviews WHERE course_code='${code}';\nDELETE FROM community_courses WHERE code='${code}';\n`;
await writeFile(
  new URL("../.sites-runtime/test-cleanup.sql", import.meta.url),
  cleanup,
);
let clientIndex = 0;
const subnet = Math.floor(Math.random() * 200) + 20;
async function client(
  ip = `192.0.${subnet}.${++clientIndex}`,
  initialCookie = "",
) {
  let cookie = initialCookie;
  return async function request(path, body, headers = {}, method) {
    const r = await fetch(origin + path, {
      method: method || (body === undefined ? "GET" : "POST"),
      redirect: "manual",
      headers: {
        Origin: origin,
        // Local-only edge simulation; this is not a claim that production
        // accepts this header from browsers.
        "CF-Connecting-IP": ip,
        ...(cookie ? { Cookie: cookie } : {}),
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...headers,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    for (const value of r.headers.getSetCookie()) {
      const pair = value.split(";")[0],
        name = pair.split("=")[0];
      cookie = cookie
        .split("; ")
        .filter((p) => p && !p.startsWith(name + "="))
        .concat(pair)
        .join("; ");
    }
    let data = null;
    try {
      data = await r.json();
    } catch {}
    return { status: r.status, data, headers: r.headers };
  };
}
let passed = 0;
function check(condition, label) {
  assert.ok(condition, label);
  console.log("PASS", label);
  passed++;
}
// Direct local D1 fixture: there is no login bypass endpoint in the app.
const sessionToken = randomToken();
const sessionHash = await tokenHash(sessionToken);
const fixtureSql = new URL(
  "../.sites-runtime/auth-fixture.sql",
  import.meta.url,
);
await writeFile(
  fixtureSql,
  `INSERT INTO auth_sessions(token_hash,user_id,email,full_name,expires_at) VALUES('${sessionHash}','local_seedy','test@example.com','Local test',unixepoch()+600);`,
);
execFileSync(
  process.execPath,
  [
    "--import",
    "./scripts/sites-env.mjs",
    "./node_modules/wrangler/bin/wrangler.js",
    "d1",
    "execute",
    "DB",
    "--local",
    "--config",
    "wrangler.json",
    "--persist-to",
    process.env.RADAR_TEST_STATE || ".wrangler/state",
    "--file",
    fixtureSql.pathname,
  ],
  { stdio: "pipe" },
);
const anon = await client(),
  owner = await client(undefined, `radar_session=${sessionToken}`);
await anon("/api/session");
for (const courseCode of ["CS2116", "GE2340"]) {
  const catalogue = await anon(`/api/courses/${courseCode}/materials`);
  check(
    catalogue.status === 200,
    `anonymous materials catalogue ${courseCode}`,
  );
  const link = new URL(catalogue.data.officialExamUrl);
  check(
    link.origin === "https://julac-cuh.primo.exlibrisgroup.com" &&
      link.searchParams.getAll("query").join("|") ===
        `any,exact,CityU Examination Papers,AND|any,exact,${courseCode},AND`,
    `official paper search scoped to ${courseCode}`,
  );
}
const fixture = {
  code,
  titleEn: "Integration Test Course",
  titleZhHans: "集成测试课程",
  titleZhHant: "整合測試課程",
  descriptionEn: "Local disposable integration test fixture.",
  descriptionZhHans: "这是仅在本地使用的集成测试课程。",
  descriptionZhHant: "這是僅在本機使用的整合測試課程。",
  department: "Test Department",
  credits: "3",
  level: "ug",
  sourceUrl: "https://www.cityu.edu.hk/catalogue/",
};
check(
  (await anon("/api/courses", fixture)).status === 401,
  "anonymous course creation rejected",
);
const forged = await anon("/api/session", undefined, {
  "oai-authenticated-user-id": "local_seedy",
  "oai-authenticated-user-email": "test@example.com",
});
check(!forged.data.user, "legacy identity headers cannot authenticate");
check(
  (
    await anon("/api/courses", fixture, {
      "oai-authenticated-user-id": "local_seedy",
      "oai-authenticated-user-email": "test@example.com",
    })
  ).status === 401,
  "forged headers cannot add courses",
);
check(
  (
    await anon("/api/session", undefined, {
      Cookie: `radar_session=${randomToken()}`,
    })
  ).data.user === null,
  "unknown login cookie rejected",
);
check(
  (await anon("/api/auth/logout", {}, { Origin: "https://evil.example" }))
    .status === 403,
  "logout rejects cross-origin requests",
);
const session = await owner("/api/session");
check(!!session.data.user, "database session establishes identity");
const creates = await Promise.all([
  owner("/api/courses", fixture),
  owner("/api/courses", fixture),
]);
check(
  creates
    .map((r) => r.status)
    .sort()
    .join(",") === "201,409",
  "concurrent duplicate course creation is atomic",
);
const review = {
  usefulness: 5,
  interest: 4,
  difficulty: 2,
  comment: "RADAR_TEST: useful practical exercises, local test only.",
  nickname: "RADAR_TEST",
};
check(
  (
    await anon(`/api/courses/${code}/reviews`, review, {
      Cookie: `radar_visitor=${crypto.randomUUID()}`,
    })
  ).status === 409,
  "forged unsigned visitor cannot submit",
);
const ratingsOnly = { ...review };
delete ratingsOnly.comment;
const first = await anon(`/api/courses/${code}/reviews`, ratingsOnly);
check(
  first.status === 201,
  "visitor can submit ratings without experience text or signing in",
);
check(
  (await anon(`/api/courses/${code}/reviews`)).data.own.comment === "",
  "omitted experience text persists as an empty string",
);
const updated = await anon(`/api/courses/${code}/reviews`, {
  ...review,
  comment: "好",
  usefulness: 3,
});
check(
  updated.status === 201 && updated.data.id === first.data.id,
  "same browser can add a one-character experience to the existing review",
);
const concurrent = await Promise.all(
  Array.from({ length: 5 }, () => anon(`/api/courses/${code}/reviews`, review)),
);
check(
  concurrent.every((r) => r.status === 201 && r.data.id === first.data.id),
  "concurrent review submissions retain one identity",
);
let detail = await anon(`/api/courses/${code}`);
check(
  detail.data.stats.count === 1,
  "one visible review after concurrent updates",
);
for (const difficulty of [0, 6, 1.5, "5", null])
  check(
    (await anon(`/api/courses/${code}/reviews`, { ...review, difficulty }))
      .status === 400,
    `reject invalid difficulty ${difficulty}`,
  );
check(
  (
    await anon(`/api/courses/${code}/reviews`, review, {
      Origin: "https://attacker.test",
    })
  ).status === 403,
  "reject cross-origin submission",
);
check(
  (await anon(`/api/courses/${code}/reviews`, review, { Origin: "" }))
    .status === 403,
  "reject missing origin",
);
check(
  (await anon("/api/courses/ZZ0000/reviews", review)).status === 404,
  "reject non-existent course review",
);
const second = await client();
await second("/api/session");
check(
  (await second(`/api/courses/${code}/reviews`, { ...review, comment: "" }))
    .status === 201,
  "another student can submit an explicitly empty experience",
);
let rank = await anon(`/api/catalogue?sort=worst&q=${code}`);
check(rank.data.total === 0, "two reviews do not qualify for rankings");
const third = await client();
await third("/api/session");
check(
  (await third(`/api/courses/${code}/reviews`, ratingsOnly)).status === 201,
  "distinct rating-only reviews do not collide on an empty text fingerprint",
);
const longExperience = "Test course experience. ".repeat(120);
check(
  (
    await third(`/api/courses/${code}/reviews`, {
      ...review,
      comment: longExperience,
    })
  ).status === 201 &&
    (await third(`/api/courses/${code}/reviews`)).data.own.comment ===
      longExperience.trim(),
  "experience longer than the former 2000-character limit persists unchanged",
);
rank = await anon(`/api/catalogue?sort=worst&q=${code}`);
check(rank.data.total === 1, "third review qualifies for rankings");
let listed = await anon(`/api/courses/${code}/reviews`);
check(
  listed.data.total === 3 && !JSON.stringify(listed.data).includes("visitorId"),
  "public reviews exclude private identity",
);
check(
  (await anon("/api/admin/reports")).status === 401,
  "anonymous cannot moderate",
);
check(
  (
    await anon("/api/admin/reports", undefined, {
      "oai-authenticated-user-id": "local_seedy",
      "oai-authenticated-user-email": "seedy@sites.test",
    })
  ).status === 401,
  "untrusted browser identity headers cannot grant moderation",
);
check(
  (
    await anon("/api/reports", {
      reviewId: first.data.id,
      reason: "RADAR_TEST local moderation test.",
    })
  ).status === 200,
  "anonymous reporting works",
);
await anon("/api/reports", {
  reviewId: first.data.id,
  reason: "RADAR_TEST duplicate report.",
});
if (session.data.user.isAdmin) {
  const queue = await owner("/api/admin/reports");
  check(
    queue.data.reports.filter((r) => r.reviewId === first.data.id).length === 1,
    "duplicate reports collapse",
  );
  await owner("/api/admin/reviews", {
    reviewId: first.data.id,
    action: "dismiss",
    reason: "RADAR_TEST report dismissal with documented test reason.",
  });
  await anon("/api/reports", {
    reviewId: first.data.id,
    reason: "RADAR_TEST new evidence after previous resolution.",
  });
  const reopened = await owner("/api/admin/reports");
  check(
    reopened.data.reports.some((r) => r.reviewId === first.data.id),
    "resolved reports can be reopened with new evidence",
  );
  check(
    (
      await owner("/api/admin/reviews", {
        reviewId: first.data.id,
        action: "hide",
        reason: "RADAR_TEST moderation hides a test-only review.",
      })
    ).status === 200,
    "moderator can hide a review",
  );
  check(
    (await anon(`/api/courses/${code}/reviews`, review)).status === 403,
    "editing cannot restore hidden review",
  );
  detail = await anon(`/api/courses/${code}`);
  check(detail.data.stats.count === 2, "hidden reviews excluded from stats");
  rank = await anon(`/api/catalogue?sort=worst&q=${code}`);
  check(rank.data.total === 0, "hidden review removes ranking eligibility");
} else {
  check(
    (await owner("/api/admin/reports")).status === 403,
    "ordinary signed-in user cannot moderate",
  );
}
let limited = false;
for (let i = 0; i < 16; i++) {
  const r = await second(`/api/courses/${code}/reviews`, {
    ...review,
    comment: review.comment + " Second student.",
  });
  if (r.status === 429) {
    limited = true;
    check(
      r.headers.get("retry-after") === "3600",
      "rate limiting includes retry guidance",
    );
    break;
  }
}
check(limited, "per-visitor write limit enforced");
// Attack cases are bounded and restricted to this local disposable course.
for (const extra of [
  { visitorId: crypto.randomUUID() },
  { status: "visible" },
  { website: "https://spam.test" },
])
  check(
    (await anon(`/api/courses/${code}/reviews`, { ...review, ...extra }))
      .status === 400,
    "reject identity/status injection and honeypot",
  );
check(
  (
    await anon(`/api/courses/${code}/reviews`, {
      ...review,
      comment: "x".repeat(21000),
    })
  ).status === 413,
  "reject oversized body before database writes",
);
check(
  (
    await anon(`/api/courses/${code}/reviews`, review, {
      "Content-Type": "text/plain",
    })
  ).status === 415,
  "reject non-JSON write",
);
check(
  (await anon(`/api/courses/${code}/reviews?page=${"9".repeat(400)}`))
    .status === 200,
  "extreme pagination is bounded",
);
const fresh = await client();
check(
  (
    await fresh("/api/reports", {
      reviewId: first.data.id,
      reason: "Unestablished visitor test.",
    })
  ).status === 409,
  "reports require server-issued visitor identity",
);
const tamperClient = await client();
const issued = await tamperClient("/api/session");
const issuedPair = issued.headers.getSetCookie()[0].split(";")[0];
check(
  (
    await tamperClient(`/api/courses/${code}/reviews`, review, {
      Cookie: issuedPair.replace(/v1\.[^.]+/, `v1.${crypto.randomUUID()}`),
    })
  ).status === 409,
  "tampered signed identity cannot submit",
);
const copy = await client();
await copy("/api/session");
check(
  (
    await copy(`/api/courses/${code}/reviews`, {
      ...review,
      comment: review.comment.toUpperCase().replaceAll(" ", "  ") + "\u200b",
    })
  ).status === 409,
  "duplicate normalized text is rejected even when original is hidden",
);
const attackers = await Promise.all(
  Array.from({ length: 8 }, () => client(`198.51.${subnet}.90`)),
);
await Promise.all(attackers.map((c) => c("/api/session")));
const bulk = await Promise.all(
  attackers.map((c, i) =>
    c(`/api/courses/${code}/reviews`, {
      ...review,
      comment: `RADAR_BULK_${i}: unique text with a rotating visitor cookie.`,
    }),
  ),
);
check(
  bulk.filter((r) => r.status === 201).length === 2 &&
    bulk.filter(
      (r) => r.status === 429 && r.data.error === "COURSE_NETWORK_LIMIT",
    ).length === 6,
  "concurrent cookie rotation admits exactly two votes per course/network",
);
check(
  bulk
    .filter((r) => r.status === 429)
    .every((r) => r.headers.get("retry-after") === "86400"),
  "daily limit supplies correct retry interval",
);
const winner = bulk.findIndex((r) => r.status === 201);
check(
  (
    await attackers[winner](`/api/courses/${code}/reviews`, {
      ...review,
      comment: "RADAR_BULK_EDIT: editing the admitted review remains possible.",
    })
  ).status === 201,
  "legitimate edits still work after network vote cap",
);
const injector = await client();
await injector("/api/session");
const injected =
  "RADAR_LITERAL: '); DROP TABLE reviews; -- <img src=x onerror=alert(1)>";
const literal = await injector(`/api/courses/${code}/reviews`, {
  ...review,
  comment: injected,
  nickname: "<script>alert(1)</script>",
});
check(literal.status === 201, "SQL/HTML payload is stored as ordinary text");
let literalRead = await injector(`/api/courses/${code}/reviews`);
check(
  literalRead.data.own.comment === injected,
  "literal payload reads back unchanged and review table survives",
);
check(
  (await anon(`/api/courses/${code}/reviews`, {}, {}, "DELETE")).status === 200,
  "owner withdrawal is idempotent for an already hidden review",
);
check(
  (await copy(`/api/courses/${code}/reviews`, {}, {}, "DELETE")).status === 404,
  "another visitor cannot withdraw an unowned review",
);
check(
  (
    await injector(
      `/api/courses/${code}/reviews`,
      {},
      { Origin: "https://attacker.test" },
      "DELETE",
    )
  ).status === 403,
  "cross-site withdrawal rejected",
);
check(
  (await injector(`/api/courses/${code}/reviews`, {}, {}, "DELETE")).status ===
    200,
  "signed visitor can withdraw their own review",
);
check(
  !(await injector(`/api/courses/${code}/reviews`)).data.reviews.some(
    (r) => r.id === literal.data.id,
  ),
  "withdrawn test review is absent from public results",
);
check(
  (
    await injector(`/api/courses/${code}/reviews`, {
      ...review,
      comment: injected,
    })
  ).status === 403,
  "withdrawal cannot reset identity or revive a hidden vote",
);
const mint = await client(`203.0.${subnet}.90`);
const mintStatuses = [];
for (let i = 0; i < 31; i++)
  mintStatuses.push(
    await mint(
      i % 2 ? `/api/courses/${code}/reviews` : "/api/session",
      undefined,
      { Cookie: "" },
    ),
  );
check(
  mintStatuses
    .slice(0, 30)
    .every((r) => r.status === 200 && r.data.canReview) &&
    mintStatuses[30].status === 200 &&
    !mintStatuses[30].data.canReview &&
    !mintStatuses[30].headers.get("set-cookie"),
  "all issuance routes share a network cap without blocking public reads",
);

// Store only local test credentials, never production cookies, for restart proof.
const persistentClient = await client();
const receipt = await persistentClient("/api/session");
const signedCookie = receipt.headers.getSetCookie()[0].split(";")[0];
const durable = await persistentClient(`/api/courses/${code}/reviews`, {
  ...review,
  comment: "RADAR_PERSISTENCE: retained across a local server restart.",
});
check(durable.status === 201, "persistence fixture saved");
await writeFile(
  new URL("../.sites-runtime/persistence-fixture.json", import.meta.url),
  JSON.stringify({ origin, code, id: durable.data.id, cookie: signedCookie }),
);

check(
  (await owner("/api/auth/logout", {})).status === 303,
  "logout revokes session",
);
check(
  !(
    await owner("/api/session", undefined, {
      Cookie: `radar_session=${sessionToken}`,
    })
  ).data.user,
  "revoked cookie cannot authenticate",
);

console.log(
  `${passed} API integration checks passed. Remove fixtures with .sites-runtime/test-cleanup.sql.`,
);
