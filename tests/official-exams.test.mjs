import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  OFFICIAL_EXAM_URL,
  OFFICIAL_EXAM_BROWSE_URL,
  officialExamSearchUrl,
} from "../lib/official-exams.ts";

test("official exam links preserve CityUHK's host, view and paper constraints", () => {
  assert.equal(
    OFFICIAL_EXAM_URL,
    "https://www.cityu.edu.hk/lib/digital/exampaper/index.htm",
  );
  assert.equal(
    OFFICIAL_EXAM_BROWSE_URL,
    "https://www.cityu.edu.hk/lib/digital/exampaper/ftlist.htm",
  );
  const url = new URL(officialExamSearchUrl("CS2116"));
  assert.equal(url.origin, "https://julac-cuh.primo.exlibrisgroup.com");
  assert.equal(url.pathname, "/discovery/search");
  assert.equal(url.hash, "");
  assert.deepEqual(url.searchParams.getAll("query"), [
    "any,exact,CityU Examination Papers,AND",
    "any,exact,CS2116,AND",
  ]);
  for (const [name, value] of Object.entries({
    tab: "Everything",
    search_scope: "MyInstitution",
    sortby: "title",
    vid: "852JULAC_CUH:CUH",
    lang: "en",
    mode: "advanced",
    offset: "0",
  })) {
    assert.deepEqual(url.searchParams.getAll(name), [value]);
  }
});

test("official exam searches normalize course codes consistently", () => {
  for (const code of ["CS5296", "CS1302", "GE1352", "CS2116"]) {
    assert.equal(
      officialExamSearchUrl(`  ${code.toLowerCase()}\n`),
      officialExamSearchUrl(code),
    );
    assert.deepEqual(
      new URL(officialExamSearchUrl(code)).searchParams.getAll("query"),
      ["any,exact,CityU Examination Papers,AND", `any,exact,${code},AND`],
    );
  }
});

test("invalid course codes fall back to the official year browser", () => {
  for (const code of [
    "",
    "   ",
    "C1302",
    "CS13",
    "ABCDEFG1302",
    "CS1302ABCD",
    "CS 1302",
    "CS1302,OR,any,contains,*",
    "CS1302&query=any,contains,*",
    "CS1302#ignored",
    "https://example.com/CS1302",
    "CS1302\nGE1352",
  ]) {
    assert.equal(officialExamSearchUrl(code), OFFICIAL_EXAM_BROWSE_URL, code);
  }
});

test("every catalogue course receives its own exact official exam search", () => {
  const courses = JSON.parse(
    readFileSync(new URL("../data/courses.json", import.meta.url), "utf8"),
  );
  assert.ok(courses.length > 0);
  for (const { code } of courses) {
    const url = new URL(officialExamSearchUrl(code));
    assert.equal(url.hostname, "julac-cuh.primo.exlibrisgroup.com", code);
    assert.deepEqual(
      url.searchParams.getAll("query"),
      ["any,exact,CityU Examination Papers,AND", `any,exact,${code},AND`],
      code,
    );
  }
});
