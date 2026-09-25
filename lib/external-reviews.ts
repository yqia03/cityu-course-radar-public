import records from "@/data/external-reviews.json";
import type { ExternalReview } from "./types";

// Editorial snapshots, never inserted into student reviews or rating aggregates.
const reviews = records as ExternalReview[];
const index = new Map<string, ExternalReview[]>();
for (const review of reviews) {
  const list = index.get(review.courseCode) ?? [];
  list.push(review);
  index.set(review.courseCode, list);
}
export function externalReviewsFor(code: string): ExternalReview[] {
  return index.get(code) ?? [];
}
export const externalCoverage = {
  courses: index.size,
  references: reviews.length,
  sources: new Set(reviews.map((r) => r.url)).size,
  platforms: [...new Set(reviews.map((r) => r.platform))],
};
