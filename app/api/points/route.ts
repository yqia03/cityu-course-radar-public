import { getUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { failure, HttpError, json } from "@/lib/http";

export async function GET(request: Request) {
  try {
    const user = await getUser();
    if (!user) throw new HttpError(401, "LOGIN_REQUIRED");
    const page = Math.max(
      1,
      Math.min(
        10000,
        Number.parseInt(new URL(request.url).searchParams.get("page") || "1") ||
          1,
      ),
    );
    const d = db();
    // A D1 batch gives the balance, count and journal one consistent transaction.
    const result = await d.batch<Record<string, unknown>>([
      d.prepare("SELECT balance FROM accounts WHERE id=?").bind(user.accountId),
      d
        .prepare(
          "SELECT COUNT(*) AS total FROM point_ledger WHERE account_id=?",
        )
        .bind(user.accountId),
      d
        .prepare(
          "SELECT id,event_key AS eventKey,amount,kind,reference_id AS referenceId,reason,created_at AS createdAt FROM point_ledger WHERE account_id=? ORDER BY created_at DESC,id DESC LIMIT 20 OFFSET ?",
        )
        .bind(user.accountId, (page - 1) * 20),
      d
        .prepare(
          "SELECT COUNT(*)*50 AS pendingRewards FROM materials m WHERE m.owner_id=? AND m.status='pending' AND EXISTS(SELECT 1 FROM material_versions v WHERE v.material_id=m.id AND v.state='quarantined') AND NOT EXISTS(SELECT 1 FROM point_ledger p WHERE p.event_key='upload_reward:'||m.id)",
        )
        .bind(user.accountId),
    ]);
    return json({
      balance: result[0].results[0]?.balance ?? 0,
      pendingRewards: result[3].results[0]?.pendingRewards ?? 0,
      ledger: result[2].results,
      page,
      total: result[1].results[0]?.total ?? 0,
    });
  } catch (e) {
    return failure(e);
  }
}
