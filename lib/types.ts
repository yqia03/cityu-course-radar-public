export type Locale = "zh-Hans" | "zh-Hant" | "en";
export type Course = {
  code: string;
  titleEn: string;
  titleZhHans?: string | null;
  titleZhHant?: string | null;
  descriptionEn?: string | null;
  descriptionZhHans?: string | null;
  descriptionZhHant?: string | null;
  archived?: boolean;
  creditsText?: string;
  department: string;
  credits: string | number | null;
  level: string;
  academicYear?: string;
  sourceUrl: string;
  translationMethod?: string;
  source?: "official" | "community";
};
export type CourseStats = {
  count: number;
  score: number | null;
  usefulness: number | null;
  interest: number | null;
  difficulty: number | null;
};
export type ExternalReview = {
  id: string;
  courseCode: string;
  platform: string;
  url: string;
  sourceTitle: string;
  author: string;
  publishedAt: string | null;
  term: string | null;
  checkedAt: string;
  ratings: { label: string; value: string; scale: string | null }[];
  reportedGrade: string | null;
  summary: Record<Locale, string>;
  context: Record<Locale, string>;
};
export type CourseResult = Course & {
  stats: CourseStats;
  externalReviews?: ExternalReview[];
};
export type Review = {
  id: string;
  usefulness: number;
  interest: number;
  difficulty: number;
  comment: string;
  nickname: string;
  semester: string;
  createdAt: string;
  updatedAt: string;
  mine?: boolean;
};
export const emptyStats: CourseStats = {
  count: 0,
  score: null,
  usefulness: null,
  interest: null,
  difficulty: null,
};
export const RANKING_MINIMUM = 3;
export function overall(r: {
  usefulness: number;
  interest: number;
  difficulty: number;
}) {
  return (r.usefulness + r.interest + 6 - r.difficulty) / 3;
}
export function title(c: Course, l: Locale) {
  return (
    (l === "zh-Hans"
      ? c.titleZhHans
      : l === "zh-Hant"
        ? c.titleZhHant
        : c.titleEn) || c.titleEn
  );
}
export function chineseTitle(c: Course, l: Locale) {
  return (l === "zh-Hant" ? c.titleZhHant : c.titleZhHans) || null;
}
export function description(c: Course, l: Locale) {
  return (
    (l === "zh-Hans"
      ? c.descriptionZhHans
      : l === "zh-Hant"
        ? c.descriptionZhHant
        : c.descriptionEn) ||
    c.descriptionEn ||
    ""
  );
}

export function externalMetricLabel(label: string, locale: Locale) {
  const names: Record<string, [string, string]> = {
    上课体验: ["上課體驗", "Class experience"],
    课程体验: ["課程體驗", "Course experience"],
    项目体验: ["項目體驗", "Project experience"],
    作业体验: ["作業體驗", "Assignment experience"],
    考试体验: ["考試體驗", "Exam experience"],
  };
  return locale === "zh-Hans"
    ? label
    : names[label]?.[locale === "en" ? 1 : 0] || label;
}
