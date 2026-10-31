import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
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

test("public export preserves the bilingual introduction and reviewed screenshot without allowing other binaries", (t) => {
  const root = mkdtempSync(join(tmpdir(), "cityu-public-export-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const source = join(root, "source");
  mkdirSync(source);
  const write = (path, contents) => {
    const target = join(source, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, contents);
  };
  const screenshot = readFileSync(
    new URL("../docs/images/course-browser.png", import.meta.url),
  );
  write(
    "README.md",
    "# 城课雷达\n\n[English](README.en.md)\n\n![课程浏览页](docs/images/course-browser.png)\n",
  );
  write("README.en.md", "# CityU Course Radar\n\n[简体中文](README.md)\n");
  write("docs/development.md", "# 开发指南\n\nLocal setup and checks.\n");
  write("docs/images/course-browser.png", screenshot);
  write("docs/images/unreviewed.png", screenshot);
  write("docs/evidence/account.json", '{"private":true}\n');
  const git = (...args) =>
    execFileSync("git", args, { cwd: source, stdio: "pipe" });
  git("init", "-q");
  const commit = () => {
    git("add", ".");
    git(
      "-c",
      "user.name=Export Test",
      "-c",
      "user.email=export-test@example.invalid",
      "-c",
      "commit.gpgsign=false",
      "commit",
      "-qm",
      "Export fixture",
    );
  };
  commit();
  const exporter = fileURLToPath(
    new URL("../scripts/export-public.mjs", import.meta.url),
  );
  const output = join(root, "exported");
  execFileSync(process.execPath, [exporter, output], {
    cwd: source,
    stdio: "pipe",
  });
  assert.match(
    readFileSync(join(output, "README.md"), "utf8"),
    /README\.en\.md/,
  );
  assert.match(
    readFileSync(join(output, "README.en.md"), "utf8"),
    /CityU Course Radar/,
  );
  assert.match(
    readFileSync(join(output, "docs/development.md"), "utf8"),
    /Local setup and checks/,
  );
  assert.deepEqual(
    readFileSync(join(output, "docs/images/course-browser.png")),
    screenshot,
  );
  assert.equal(existsSync(join(output, "docs/images/unreviewed.png")), false);
  assert.equal(existsSync(join(output, "docs/evidence/account.json")), false);

  write("public/unreviewed.png", screenshot);
  commit();
  assert.throws(
    () =>
      execFileSync(process.execPath, [exporter, join(root, "rejected")], {
        cwd: source,
        stdio: "pipe",
      }),
    /Binary file needs explicit review before public export: public\/unreviewed\.png/,
  );
});
