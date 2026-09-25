import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const load = (name) =>
  JSON.parse(
    readFileSync(new URL(`../data/${name}.json`, import.meta.url), "utf8"),
  );
const references = load("external-reviews");
const provenance = load("external-review-provenance");
const courses = new Map(load("courses").map((c) => [c.code, c]));
const canonical = (value) => {
  const url = new URL(value);
  url.hash = "";
  url.search = "";
  return url.href;
};
const validDate = (value) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
test("external references retain verifiable course identity, attribution and three summaries", () => {
  assert.ok(references.length >= 20);
  assert.equal(new Set(references.map((r) => r.id)).size, references.length);
  const seen = new Set();
  for (const r of references) {
    assert.ok(courses.has(r.courseCode), r.courseCode);
    const url = new URL(r.url);
    assert.equal(url.protocol, "https:");
    assert.ok(
      [
        "www.xiaohongshu.com",
        "www.dcard.tw",
        "shanechen0722.github.io",
        "trulybright.dev",
      ].includes(url.hostname),
    );
    const key = `${r.courseCode}:${canonical(r.url)}`;
    assert.ok(!seen.has(key), `Duplicate ${key}`);
    seen.add(key);
    assert.ok(r.author && r.platform && r.sourceTitle && r.sourceId);
    assert.ok(validDate(r.checkedAt), r.id);
    assert.ok(r.publishedAt === null || validDate(r.publishedAt), r.id);
    assert.ok(!r.publishedAt || r.publishedAt <= r.checkedAt);
    for (const locale of ["zh-Hans", "zh-Hant", "en"])
      assert.ok(r.summary[locale] && r.context[locale]);
  }
});
test("source identities join evidence and count contributions without counting each course as an author", () => {
  const sources = new Map(
    provenance.sources.map((source) => [source.id, source]),
  );
  for (const evidence of provenance.socialEvidence) {
    if (!sources.has(evidence.contributionId))
      sources.set(evidence.contributionId, {
        url: evidence.sourceUrl,
        author: evidence.authorDisplay,
        date: evidence.publishedDate,
      });
  }
  const identityUrls = new Map();
  for (const reference of references) {
    const source = sources.get(reference.sourceId);
    assert.ok(source, `Missing evidence for ${reference.id}`);
    assert.equal(canonical(source.url), canonical(reference.url));
    assert.equal(source.author, reference.author);
    assert.equal(source.date, reference.publishedAt);
    const url = canonical(reference.url);
    if (identityUrls.has(url))
      assert.equal(identityUrls.get(url), reference.sourceId);
    identityUrls.set(url, reference.sourceId);
  }
  assert.equal(provenance.includedRecords, references.length);
  assert.equal(
    provenance.includedCourses,
    new Set(references.map((reference) => reference.courseCode)).size,
  );
  assert.equal(provenance.includedContributions, identityUrls.size);
});
test("the September expansion has per-record locators and cannot publish blocked candidates", () => {
  const evidence = new Map(
    provenance.recordEvidence.map((item) => [item.recordId, item]),
  );
  const additions = references.filter((r) => r.checkedAt === "2026-09-25");
  const summaryUnits = new Map();
  for (const reference of additions) {
    const item = evidence.get(reference.id);
    assert.ok(item?.evidenceLocator && item?.courseMatch, reference.id);
    assert.equal(item.sourceId, reference.sourceId);
    assert.equal(item.courseCode, reference.courseCode);
    assert.equal(
      item.catalogueTitle,
      courses.get(reference.courseCode).titleEn,
    );
    assert.equal(item.verifiedAt, reference.checkedAt);
    assert.equal(item.ratingsConverted, false);
    const units = Object.values(reference.summary).reduce(
      (total, text) =>
        total +
        (text.match(/[\u3400-\u9fff]|[A-Za-z]+(?:[-’'][A-Za-z]+)*/gu)?.length ??
          0),
      0,
    );
    summaryUnits.set(
      reference.sourceId,
      (summaryUnits.get(reference.sourceId) ?? 0) + units,
    );
  }
  for (const [sourceId, units] of summaryUnits)
    assert.ok(units <= 200, `${sourceId} has ${units} derived summary units`);
  for (const candidate of provenance.pendingVerification)
    assert.ok(
      !references.some(
        (reference) => canonical(reference.url) === canonical(candidate.url),
      ),
      `Unverified candidate published: ${candidate.id}`,
    );
  assert.equal(additions.length, provenance.expansion20260925.newRecords);
});
test("original stars never acquire invented bounds or normalized aggregate scores", () => {
  for (const r of references) {
    assert.equal(r.overall, undefined);
    assert.equal(r.normalizedRating, undefined);
    for (const m of r.ratings) {
      assert.match(m.value, /^🌟+$/u);
      assert.equal(m.scale, null, "First batch sources do not state a maximum");
      assert.match(m.label, /体验$/);
    }
    if (r.platform === "Dcard") assert.deepEqual(r.ratings, []);
    if (r.reportedGrade) assert.equal(r.ratings.length, 0);
  }
  const se = references.find(
    (r) => r.id === "xhs-68345b41000000002100ef66-cs5351",
  );
  assert.deepEqual(
    se.ratings.map((m) => [m.label, m.value]),
    [
      ["上课体验", "🌟🌟🌟🌟"],
      ["项目体验", "🌟🌟🌟"],
      ["考试体验", "🌟🌟🌟🌟"],
    ],
  );
  assert.ok(
    !references.some((r) => r.courseCode === "CS5285"),
    "Unconfirmed historical title stays excluded",
  );
});
