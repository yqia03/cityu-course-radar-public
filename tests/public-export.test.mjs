import test from "node:test";
import assert from "node:assert/strict";
import { isPublicPath, sanitizePublicFile } from "../scripts/export-public.mjs";

test("public export includes source but excludes private state, plans and production evidence", () => {
  for (const path of [
    "app/page.tsx",
    "data/external-reviews.json",
    "LICENSE",
    ".env.example",
    "docs/materials-operations.md",
  ])
    assert.equal(isPublicPath(path), true, path);
  for (const path of [
    ".env",
    ".openai/hosting.json",
    ".sites-runtime/backups/private.sql",
    "docs/evidence/account.json",
    "docs/plans/course-materials-library.md",
    "docs/站长操作清单.txt",
    "data/../.env",
  ])
    assert.equal(isPublicPath(path), false, path);
});
test("public export strips account config and source-link tokens while preserving attribution", () => {
  const config = JSON.parse(
    sanitizePublicFile(
      "wrangler.json",
      JSON.stringify({
        account_id: "private-account",
        vars: {
          APP_ORIGIN: "https://live.example",
          CONTACT_EMAIL: "owner@example.com",
          MATERIALS_UPLOAD_MODE: "admin-only",
        },
        d1_databases: [{ binding: "DB", database_id: "private-database" }],
      }),
    ),
  );
  assert.equal(config.account_id, undefined);
  assert.equal(
    config.d1_databases[0].database_id,
    "00000000-0000-4000-8000-000000000000",
  );
  assert.equal(config.vars.APP_ORIGIN, "https://your-domain.example");
  assert.equal(config.vars.CONTACT_EMAIL, "");
  assert.equal(config.vars.MATERIALS_UPLOAD_MODE, "admin-only");
  const source = {
    author: "Public author",
    sourceUrl:
      "https://www.xiaohongshu.com/explore/note?xsec_token=private-token&xsec_source=pc&course=CS1234",
    checkedAt: "2026-09-25",
  };
  const clean = JSON.parse(
    sanitizePublicFile("data/external-reviews.json", JSON.stringify(source)),
  );
  assert.equal(
    clean.sourceUrl,
    "https://www.xiaohongshu.com/explore/note?course=CS1234",
  );
  assert.equal(clean.author, source.author);
  assert.equal(clean.checkedAt, source.checkedAt);
});
