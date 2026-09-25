import { db } from "@/lib/db";
import {
  json,
  failure,
  HttpError,
  limit,
  readJson,
  requireAdmin,
} from "@/lib/http";
import { z } from "zod";
export async function POST(request: Request) {
  try {
    const user = await requireAdmin(),
      data = z
        .object({
          reviewId: z.string().uuid(),
          action: z.enum(["hide", "restore", "dismiss"]),
          reason: z.string().trim().min(5).max(500),
        })
        .parse(await readJson(request));
    await limit(request, user.accountId, "review-moderation", 60);
    const d = db();
    if (
      !(await d
        .prepare("SELECT id FROM reviews WHERE id=?")
        .bind(data.reviewId)
        .first())
    )
      throw new HttpError(404, "NOT_FOUND");
    const statements = [
      d
        .prepare("UPDATE reports SET status='resolved' WHERE review_id=?")
        .bind(data.reviewId),
      d
        .prepare(
          "INSERT INTO moderation_log (id,review_id,actor,action,created_at,reason) VALUES (?,?,?,?,?,?)",
        )
        .bind(
          crypto.randomUUID(),
          data.reviewId,
          user.userId,
          data.action,
          new Date().toISOString(),
          data.reason,
        ),
    ];
    if (data.action !== "dismiss")
      statements.unshift(
        d
          .prepare("UPDATE reviews SET status=? WHERE id=?")
          .bind(data.action === "hide" ? "hidden" : "visible", data.reviewId),
      );
    await d.batch(statements);
    return json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
