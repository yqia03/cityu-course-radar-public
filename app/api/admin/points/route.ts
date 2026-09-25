import { db } from "@/lib/db";
import {
  failure,
  HttpError,
  json,
  limit,
  readJson,
  requireAdmin,
} from "@/lib/http";
import { pointEventStatement } from "@/lib/points";
import { z } from "zod";

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    const data = z
      .object({
        accountId: z.string().min(1).max(255),
        amount: z
          .number()
          .int()
          .min(-10000)
          .max(10000)
          .refine((v) => v !== 0),
        reason: z.string().trim().min(5).max(500),
        eventId: z.string().uuid(),
      })
      .strict()
      .parse(await readJson(request));
    await limit(request, admin.accountId, "points-adjustment", 30);
    const d = db();
    const account = await d
      .prepare("SELECT id FROM accounts WHERE id=?")
      .bind(data.accountId)
      .first();
    if (!account) throw new HttpError(404, "NOT_FOUND");
    const eventKey = `admin_adjustment:${data.eventId}`;
    const result = await d.batch<Record<string, unknown>>([
      pointEventStatement(d, {
        eventKey,
        accountId: data.accountId,
        amount: data.amount,
        kind: "admin_adjustment",
        referenceId: data.eventId,
        reason: data.reason,
        actor: admin.accountId,
      }),
      d
        .prepare(
          "SELECT id,account_id AS accountId,amount,reason,actor FROM point_ledger WHERE event_key=?",
        )
        .bind(eventKey),
      d.prepare("SELECT balance FROM accounts WHERE id=?").bind(data.accountId),
    ]);
    const saved = result[1].results[0];
    // Idempotency keys must never silently stand in for a different adjustment.
    if (
      !saved ||
      saved.accountId !== data.accountId ||
      saved.amount !== data.amount ||
      saved.reason !== data.reason ||
      saved.actor !== admin.accountId
    )
      throw new HttpError(409, "CONFLICT");
    return json({
      id: saved.id,
      balance: result[2].results[0]?.balance,
      duplicate: result[0].results.length === 0,
    });
  } catch (e) {
    return failure(e);
  }
}
