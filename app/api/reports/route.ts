import { db } from "@/lib/db";
import { reportSchema } from "@/lib/validation";
import {
  json,
  failure,
  readJson,
  visitor,
  withVisitor,
  limit,
  HttpError,
} from "@/lib/http";
export async function POST(request: Request) {
  try {
    const v = await visitor(request);
    const r = reportSchema.parse(await readJson(request));
    await limit(request, v.id, "report", 10);
    if (
      !(await db()
        .prepare("SELECT id FROM reviews WHERE id=? AND status='visible'")
        .bind(r.reviewId)
        .first())
    )
      throw new HttpError(404, "NOT_FOUND");
    await db()
      .prepare(
        "INSERT INTO reports (id,review_id,visitor_id,reason,created_at) VALUES (?,?,?,?,?) ON CONFLICT(review_id,visitor_id) DO UPDATE SET reason=excluded.reason,created_at=excluded.created_at,status='pending' WHERE reports.status='resolved'",
      )
      .bind(
        crypto.randomUUID(),
        r.reviewId,
        v.id,
        r.reason,
        new Date().toISOString(),
      )
      .run();
    return withVisitor(json({ ok: true }), request, v.token);
  } catch (e) {
    return failure(e);
  }
}
