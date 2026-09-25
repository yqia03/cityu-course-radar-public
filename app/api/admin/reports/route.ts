import { db } from "@/lib/db";
import { json, failure, requireAdmin } from "@/lib/http";
export async function GET() {
  try {
    await requireAdmin();
    const { results } = await db()
      .prepare(
        "SELECT r.id,r.review_id AS reviewId,r.reason,r.created_at AS createdAt,v.comment,v.course_code AS courseCode,v.status FROM reports r JOIN reviews v ON v.id=r.review_id WHERE r.status='pending' ORDER BY r.created_at LIMIT 100",
      )
      .all();
    return json({ reports: results });
  } catch (e) {
    return failure(e);
  }
}
