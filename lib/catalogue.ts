import packedCatalogue from "@/data/catalogue.generated";
import { db } from "./db";
import { externalReviewsFor, externalCoverage } from "./external-reviews";
import {
  emptyStats,
  type Course,
  type CourseResult,
  type CourseStats,
  RANKING_MINIMUM,
} from "./types";
// A compact build asset avoids an enormous generated JS AST. Decompress once,
// inside a request, then reuse the immutable snapshot for this Worker isolate.
let snapshot: Promise<Course[]> | undefined;
let courseIndex: Map<string, Course> | undefined;
function officialCourses(): Promise<Course[]> {
  return (snapshot ??= (async () => {
    const compressed = Uint8Array.from(atob(packedCatalogue), (c) =>
      c.charCodeAt(0),
    );
    const stream = new Blob([compressed])
      .stream()
      .pipeThrough(new DecompressionStream("gzip"));
    const courses: Course[] = JSON.parse(await new Response(stream).text());
    courseIndex = new Map(courses.map((c) => [c.code, c]));
    return courses;
  })());
}
const fields =
  "code,title_en AS titleEn,title_zh_hans AS titleZhHans,title_zh_hant AS titleZhHant,description_en AS descriptionEn,description_zh_hans AS descriptionZhHans,description_zh_hant AS descriptionZhHant,department,credits,level,source_url AS sourceUrl";
export async function getCourse(code: string): Promise<Course | null> {
  await officialCourses();
  const official = courseIndex!.get(code);
  if (official) return { ...official, source: "official" };
  const row = await db()
    .prepare(`SELECT ${fields} FROM community_courses WHERE code=?`)
    .bind(code)
    .first<Course>();
  return row ? { ...row, source: "community" } : null;
}
export async function allCourses(): Promise<Course[]> {
  const official = await officialCourses();
  const { results } = await db()
    .prepare(`SELECT ${fields} FROM community_courses ORDER BY code`)
    .all<Course>();
  return [
    ...official.map((c) => ({ ...c, source: "official" as const })),
    ...results
      .filter((c) => !courseIndex!.has(c.code))
      .map((c) => ({ ...c, source: "community" as const })),
  ];
}
export async function stats(): Promise<Map<string, CourseStats>> {
  const { results } = await db()
    .prepare(
      "SELECT course_code,COUNT(*) as count,AVG(usefulness) as usefulness,AVG(interest) as interest,AVG(difficulty) as difficulty,AVG((usefulness+interest+6.0-difficulty)/3.0) as score FROM reviews WHERE status='visible' GROUP BY course_code",
    )
    .all<CourseStats & { course_code: string }>();
  return new Map(results.map((r) => [r.course_code, r]));
}
export function filterCourses(
  courses: Course[],
  scores: Map<string, CourseStats>,
  params: URLSearchParams,
) {
  const query = (params.get("q") || "").trim().toLowerCase().slice(0, 150);
  const department = params.get("department"),
    level = params.get("level"),
    sort = params.get("sort") || "all";
  let filtered: CourseResult[] = courses
    .filter(
      (c) =>
        (!department || c.department === department) &&
        (!level || c.level === level) &&
        query
          .split(/\s+/)
          .every((q) =>
            `${c.code} ${c.titleEn} ${c.titleZhHans || ""} ${c.titleZhHant || ""}`
              .toLowerCase()
              .includes(q),
          ),
    )
    .map((c) => ({
      ...c,
      stats: scores.get(c.code) || emptyStats,
      externalReviews: externalReviewsFor(c.code),
    }));
  if (sort === "worst" || sort === "best")
    filtered = filtered
      .filter((c) => c.stats.count >= RANKING_MINIMUM)
      .sort(
        (a, b) =>
          (sort === "worst" ? 1 : -1) *
            ((a.stats.score || 0) - (b.stats.score || 0)) ||
          b.stats.count - a.stats.count ||
          a.code.localeCompare(b.code),
      );
  else if (sort === "popular")
    filtered.sort(
      (a, b) => b.stats.count - a.stats.count || a.code.localeCompare(b.code),
    );
  else filtered.sort((a, b) => a.code.localeCompare(b.code));
  const page = Math.max(
      1,
      Math.min(10000, Number.parseInt(params.get("page") || "1") || 1),
    ),
    size = 12;
  return {
    courses: filtered.slice((page - 1) * size, page * size),
    total: filtered.length,
    page,
    pages: Math.max(1, Math.ceil(filtered.length / size)),
    catalogueTotal: courses.length,
    reviewTotal: Array.from(scores.values()).reduce(
      (sum, s) => sum + s.count,
      0,
    ),
    departments: [...new Set(courses.map((c) => c.department))].sort(),
    minimumReviews: RANKING_MINIMUM,
    externalCoverage,
  };
}
