import { getCourse, stats } from "@/lib/catalogue";
import { emptyStats } from "@/lib/types";
import { externalReviewsFor } from "@/lib/external-reviews";
import { json, failure, HttpError } from "@/lib/http";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  try {
    const { code } = await params,
      c = await getCourse(code.toUpperCase());
    if (!c) throw new HttpError(404, "NOT_FOUND");
    const s = await stats();
    return json({
      ...c,
      stats: s.get(c.code) || emptyStats,
      externalReviews: externalReviewsFor(c.code),
    });
  } catch (e) {
    return failure(e);
  }
}
