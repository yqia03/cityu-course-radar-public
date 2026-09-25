import { db } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { getCourse } from "@/lib/catalogue";
import { reviewSchema } from "@/lib/validation";
import {
  json,
  failure,
  readJson,
  visitor,
  readVisitor,
  withVisitor,
  limit,
  securityKey,
  networkHash,
  HttpError,
} from "@/lib/http";
import { fingerprint, normalizedComment } from "@/lib/security";
import { z } from "zod";
import {
  REVIEW_OWNER_SQL,
  SAVE_ACCOUNT_REVIEW_SQL,
  SAVE_REVIEW_SQL,
} from "@/lib/review-sql";
import type { Review } from "@/lib/types";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  try {
    const { code } = await params;
    if (!(await getCourse(code.toUpperCase())))
      throw new HttpError(404, "NOT_FOUND");
    const user = await getUser();
    const v = await readVisitor(request),
      page = Math.max(
        1,
        Math.min(
          10000,
          Number.parseInt(
            new URL(request.url).searchParams.get("page") || "1",
          ) || 1,
        ),
      );
    const { results } = await db()
      .prepare(
        `SELECT id,usefulness,interest,difficulty,comment,nickname,semester,created_at AS createdAt,updated_at AS updatedAt,${REVIEW_OWNER_SQL} AS mine FROM reviews WHERE course_code=? AND status='visible' ORDER BY updated_at DESC LIMIT 20 OFFSET ?`,
      )
      .bind(
        user?.accountId || "",
        v?.id || "",
        code.toUpperCase(),
        (page - 1) * 20,
      )
      .all<Review>();
    const own = await db()
      .prepare(
        `SELECT id,usefulness,interest,difficulty,comment,nickname,semester,created_at AS createdAt,updated_at AS updatedAt FROM reviews WHERE course_code=? AND ${REVIEW_OWNER_SQL} AND status='visible' ORDER BY account_id IS NOT NULL DESC LIMIT 1`,
      )
      .bind(code.toUpperCase(), user?.accountId || "", v?.id || "")
      .first<Review>();
    const total = await db()
      .prepare(
        "SELECT COUNT(*) AS count FROM reviews WHERE course_code=? AND status='visible'",
      )
      .bind(code.toUpperCase())
      .first<{ count: number }>();
    const response = json({
      reviews: results,
      own,
      total: total?.count || 0,
      page,
      canReview: !!v,
    });
    return v ? withVisitor(response, request, v.token) : response;
  } catch (e) {
    return failure(e);
  }
}
export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  try {
    const v = await visitor(request);
    const user = await getUser();
    const review = reviewSchema.parse(await readJson(request)),
      { code } = await params,
      c = await getCourse(code.toUpperCase());
    if (!c) throw new HttpError(404, "NOT_FOUND");
    await limit(request, user?.accountId || v.id, "review");
    const now = new Date().toISOString();
    const normalized = normalizedComment(review.comment);
    // No text is not duplicated text. A NULL fingerprint lets independent
    // rating-only reviews coexist; identity and network admission still apply.
    const contentHash = normalized
      ? await fingerprint(await securityKey(), `comment:${normalized}`)
      : null;
    const network = await networkHash(request);
    // Retain only 24 hours of network identifiers. Hidden/withdrawn votes still
    // count during that window, so moderation cannot be used to reset quotas.
    await db()
      .prepare(
        "UPDATE reviews SET network_hash=NULL WHERE network_hash IS NOT NULL AND submitted_at <= unixepoch()-86400",
      )
      .run();
    const values: (string | number | null)[] = [
      crypto.randomUUID(),
      c.code,
      v.id,
      review.usefulness,
      review.interest,
      review.difficulty,
      review.comment,
      review.nickname,
      review.semester,
      now,
      now,
      contentHash,
      network,
      Math.floor(Date.now() / 1000),
    ];
    if (user) values.push(user.accountId);
    const saved = await db()
      .prepare(user ? SAVE_ACCOUNT_REVIEW_SQL : SAVE_REVIEW_SQL)
      .bind(...values)
      .first<{ id: string }>();
    if (!saved) {
      const existing = await db()
        .prepare(
          `SELECT id FROM reviews WHERE course_code=? AND ${REVIEW_OWNER_SQL}`,
        )
        .bind(c.code, user?.accountId || "", v.id)
        .first();
      if (existing) throw new HttpError(403, "MODERATED");
      const count = await db()
        .prepare(
          "SELECT COUNT(*) AS n FROM reviews WHERE course_code=? AND network_hash=? AND submitted_at > unixepoch()-86400",
        )
        .bind(c.code, network)
        .first<{ n: number }>();
      throw new HttpError(
        429,
        (count?.n || 0) >= 2 ? "COURSE_NETWORK_LIMIT" : "DAILY_REVIEW_LIMIT",
        86400,
      );
    }
    return withVisitor(json({ id: saved.id }, 201), request, v.token);
  } catch (e) {
    const detail = e instanceof Error ? e.message : "";
    if (detail.includes("reviews.course_code, reviews.content_hash"))
      return failure(new HttpError(409, "DUPLICATE_REVIEW"));
    return failure(e);
  }
}

// Withdrawal retains the admission record so deleting and reposting cannot
// reset anti-spam limits. Only the signed owner can withdraw; it cannot restore
// a moderated review. Retained records are never included in public scores.
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  try {
    const v = await visitor(request);
    const user = await getUser();
    z.object({})
      .strict()
      .parse(await readJson(request));
    await limit(request, user?.accountId || v.id, "withdraw", 10);
    const { code } = await params;
    const d = db(),
      now = new Date().toISOString();
    const result = await d.batch<{ id: string }>([
      d
        .prepare(
          `UPDATE reviews SET status='hidden',updated_at=? WHERE id=(SELECT id FROM reviews WHERE course_code=? AND ${REVIEW_OWNER_SQL} ORDER BY account_id IS NOT NULL DESC LIMIT 1) RETURNING id`,
        )
        .bind(now, code.toUpperCase(), user?.accountId || "", v.id),
      d
        .prepare(
          `INSERT INTO moderation_log(id,review_id,actor,action,created_at,reason)
        SELECT ?,id,?,'withdraw',?,'Review withdrawn by its owner' FROM reviews
        WHERE course_code=? AND ${REVIEW_OWNER_SQL} ORDER BY account_id IS NOT NULL DESC LIMIT 1`,
        )
        .bind(
          crypto.randomUUID(),
          user?.accountId || `visitor:${v.id}`,
          now,
          code.toUpperCase(),
          user?.accountId || "",
          v.id,
        ),
    ]);
    if (!result[0].results[0]) throw new HttpError(404, "NOT_FOUND");
    return json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
