import { db } from "@/lib/db";
import {
  json,
  failure,
  readJson,
  requireAdmin,
  limit,
  HttpError,
} from "@/lib/http";
import { bucket, audit, usage } from "@/lib/materials";
import { recoverUpload } from "@/lib/material-recovery";
import { reconcile } from "@/lib/material-reconcile";
import { MAX_CAPACITY_BYTES } from "@/lib/material-validation";
import { z } from "zod";
const reason = z.string().trim().min(10).max(1000);
const schema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("recover_upload"),
      uploadId: z.string().uuid(),
      reason,
    })
    .strict(),
  z
    .object({
      action: z.literal("settings"),
      uploadsEnabled: z.boolean(),
      capacityBytes: z.number().int().min(0).max(MAX_CAPACITY_BYTES),
      reason,
    })
    .strict(),
  z
    .object({
      action: z.literal("reconcile"),
      cursor: z.string().max(2000).optional(),
      reason,
    })
    .strict(),
  z
    .object({
      action: z.literal("dismiss_report"),
      reportId: z.string().uuid(),
      reason,
    })
    .strict(),
]);
export async function POST(r: Request) {
  try {
    const u = await requireAdmin(),
      data = schema.parse(await readJson(r));
    await limit(
      r,
      u.userId,
      "material-operations",
      data.action === "reconcile" ? 120 : 20,
    );
    const d = db();
    if (data.action === "recover_upload")
      return json(await recoverUpload(data.uploadId, u.userId, data.reason));
    if (data.action === "reconcile")
      return json(await reconcile(u.userId, data.reason, data.cursor));
    if (data.action === "settings") {
      if (data.uploadsEnabled) bucket();
      const result = await d.batch([
        d
          .prepare(
            `UPDATE material_settings SET uploads_enabled=?1,capacity_bytes=?2 WHERE id=1 AND (?1=0 OR (
          ?2>0 AND reconcile_active=0 AND reconcile_busy_until=0 AND reconciled_at>=strftime('%Y-%m-%dT%H:%M:%fZ','now','-1 hour')
          AND ?2>=COALESCE((SELECT SUM(held_bytes) FROM material_versions),0)+COALESCE((SELECT SUM(size) FROM material_orphans),0)
          AND NOT EXISTS(SELECT 1 FROM material_versions WHERE state='uploading' AND expires_at<unixepoch())
        )) RETURNING id`,
          )
          .bind(data.uploadsEnabled ? 1 : 0, data.capacityBytes),
        audit(
          u.userId,
          "settings",
          null,
          `${data.reason}; enabled=${data.uploadsEnabled}; capacity=${data.capacityBytes}`,
          true,
        ),
      ]);
      if (!result[0].results.length)
        throw new HttpError(409, "RECONCILE_REQUIRED");
    } else
      await d.batch([
        d
          .prepare("UPDATE material_reports SET status='resolved' WHERE id=?")
          .bind(data.reportId),
        audit(
          u.userId,
          "dismiss_report",
          null,
          `${data.reportId}: ${data.reason}`,
        ),
      ]);
    return json({ ok: true, usage: await usage() });
  } catch (e) {
    return failure(e);
  }
}
