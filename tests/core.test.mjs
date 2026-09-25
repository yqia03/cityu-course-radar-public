import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { reviewSchema, courseSchema, codeSchema } from "../lib/validation.ts";
import { overall } from "../lib/types.ts";
import { message, messageKeys } from "../lib/messages.ts";
const validReview = {
  usefulness: 4,
  interest: 5,
  difficulty: 3,
  comment: "A useful course with practical exercises.",
};
test("ratings require integers and reject client identity injection", () => {
  assert.ok(reviewSchema.safeParse(validReview).success);
  for (const value of [0, 6, 1.5, "5", null])
    assert.equal(
      reviewSchema.safeParse({ ...validReview, difficulty: value }).success,
      false,
    );
  for (const comment of [null, 42, {}, []])
    assert.equal(
      reviewSchema.safeParse({ ...validReview, comment }).success,
      false,
    );
  assert.equal(
    reviewSchema.safeParse({ ...validReview, visitorId: "forged" }).success,
    false,
  );
});
test("course experience is optional and has no product character limit", () => {
  const ratings = { ...validReview };
  delete ratings.comment;
  assert.equal(reviewSchema.parse(ratings).comment, "");
  for (const comment of ["", "   ", "好", "short", "👍", "x".repeat(3000)])
    assert.equal(
      reviewSchema.parse({ ...ratings, comment }).comment,
      comment.trim(),
    );
});
test("composite reverses difficulty and preserves fractional values", () => {
  assert.equal(overall({ usefulness: 5, interest: 5, difficulty: 1 }), 5);
  assert.equal(overall({ usefulness: 1, interest: 1, difficulty: 5 }), 1);
  assert.equal(overall(validReview), 4);
});
test("course identity and official source constraints", () => {
  assert.equal(codeSchema.parse(" cs1302 "), "CS1302");
  const c = {
    code: "ZZ9999",
    titleEn: "Test course",
    titleZhHans: "测试课程",
    titleZhHant: "測試課程",
    descriptionEn: "A test description.",
    descriptionZhHans: "这是测试课程的完整简介。",
    descriptionZhHant: "這是測試課程的完整簡介。",
    department: "Department of Testing",
    credits: "1.5",
    level: "ug",
    sourceUrl: "https://www.cityu.edu.hk/catalogue/",
  };
  assert.ok(courseSchema.safeParse(c).success);
  for (const sourceUrl of [
    "https://cityu.edu.hk.attacker.test",
    "https://attacker.test/cityu.edu.hk",
    "javascript:alert(1)",
    "http://www.cityu.edu.hk",
  ])
    assert.equal(courseSchema.safeParse({ ...c, sourceUrl }).success, false);
});
test("every interface message has all three translations", () => {
  for (const key of messageKeys)
    for (const locale of ["en", "zh-Hans", "zh-Hant"])
      assert.ok(message(key, locale)?.trim(), `${locale}: ${key}`);
});
test("migrations enforce uniqueness, status, rating bounds and report references", () => {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys=ON");
  db.exec(
    readFileSync(
      new URL("../drizzle/0000_amusing_drax.sql", import.meta.url),
      "utf8",
    ),
  );
  const insert = db.prepare(
    "INSERT INTO reviews VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
  );
  const row = [
    "r1",
    "CS1302",
    "visitor",
    4,
    5,
    3,
    "A real comment",
    "student",
    "",
    "visible",
    "2026-09-11",
    "2026-09-11",
  ];
  insert.run(...row);
  assert.throws(() => insert.run("r2", ...row.slice(1)));
  const bad = [...row];
  bad[0] = "r3";
  bad[2] = "visitor2";
  bad[3] = 6;
  assert.throws(() => insert.run(...bad));
  db.prepare("UPDATE reviews SET status='hidden' WHERE id='r1'").run();
  assert.equal(
    db.prepare("SELECT count(*) AS n FROM reviews WHERE status='visible'").get()
      .n,
    0,
  );
  assert.throws(() =>
    db
      .prepare(
        "INSERT INTO reports VALUES ('p','missing','v','reason','now','pending')",
      )
      .run(),
  );
  db.close();
});
test("official snapshot has unique canonical course codes and provenance", () => {
  const courses = JSON.parse(
    readFileSync(new URL("../data/courses.json", import.meta.url)),
  );
  assert.ok(courses.length >= 4000);
  assert.equal(new Set(courses.map((c) => c.code)).size, courses.length);
  for (const c of courses) {
    assert.ok(codeSchema.safeParse(c.code).success, c.code);
    assert.ok(c.titleEn && c.department, c.code);
    assert.ok(new URL(c.sourceUrl).hostname.endsWith("cityu.edu.hk"));
    assert.ok(c.titleZhHans && c.titleZhHant, c.code);
  }
});
