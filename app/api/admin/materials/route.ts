import { db } from "@/lib/db";
import {
  json,
  failure,
  readJson,
  requireAdmin,
  limit,
  HttpError,
} from "@/lib/http";
import {
  listMaterials,
  usage,
  material,
  version,
  verifiedObject,
  audit,
} from "@/lib/materials";
import { z } from "zod";
export async function GET(r: Request) {
  try {
    const u = await requireAdmin(),
      d = db();
    const page = Math.max(
      1,
      Math.min(
        10000,
        Number.parseInt(new URL(r.url).searchParams.get("page") || "1") || 1,
      ),
    );
    const materials = await listMaterials(undefined, u.userId, true, page);
    return json({
      materials,
      page,
      hasMore: materials.length === 50,
      reports: (
        await d
          .prepare(
            "SELECT id,material_id AS materialId,reason,status,created_at AS createdAt FROM material_reports WHERE status='pending' ORDER BY created_at DESC LIMIT 200",
          )
          .all()
      ).results,
      audit: (
        await d
          .prepare(
            "SELECT * FROM material_audit ORDER BY created_at DESC LIMIT 200",
          )
          .all()
      ).results,
      usage: await usage(),
    });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(r: Request) {
  try {
    const u = await requireAdmin(),
      data = z
        .object({
          materialId: z.string().uuid(),
          versionId: z.string().uuid().optional(),
          action: z.enum(["approve", "reject", "take_down", "restore"]),
          reason: z.string().trim().min(10).max(1000),
        })
        .strict()
        .parse(await readJson(r));
    await limit(r, u.userId, "material-admin", 60);
    const m = await material(data.materialId),
      d = db();
    let statement: D1PreparedStatement;
    if (data.action === "approve" || data.action === "reject") {
      if (!data.versionId) throw new HttpError(400, "INVALID_INPUT");
      const v = await version(data.versionId);
      if (
        v.material_id !== m.id ||
        !["quarantined", "approved"].includes(v.state)
      )
        throw new HttpError(409, "UPLOAD_STATE");
      if (data.action === "approve") {
        if (m.status === "taken_down")
          throw new HttpError(409, "MATERIAL_UNAVAILABLE");
        await verifiedObject(v);
        statement = d
          .prepare(
            "UPDATE material_versions SET state='approved',approved_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=? AND state='quarantined' AND EXISTS(SELECT 1 FROM materials WHERE id=? AND status<>'taken_down')",
          )
          .bind(v.id, m.id);
      } else {
        if (v.state !== "quarantined") throw new HttpError(409, "UPLOAD_STATE");
        statement = d
          .prepare(
            "UPDATE material_versions SET state='rejected' WHERE id=? AND state='quarantined'",
          )
          .bind(v.id);
      }
    } else if (data.action === "take_down")
      statement = d
        .prepare(
          "UPDATE materials SET status='taken_down',updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?",
        )
        .bind(m.id);
    else {
      if (!m.current_version) throw new HttpError(409, "MATERIAL_UNAVAILABLE");
      await verifiedObject(await version(m.current_version));
      statement = d
        .prepare(
          "UPDATE materials SET status='approved',updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=? AND status='taken_down'",
        )
        .bind(m.id);
    }
    await d.batch([
      statement,
      audit(u.userId, data.action, m.id, data.reason),
      d
        .prepare(
          "UPDATE materials SET status='rejected' WHERE id=? AND status='pending' AND NOT EXISTS(SELECT 1 FROM material_versions WHERE material_id=? AND state IN ('reserved','uploading','quarantined','approved'))",
        )
        .bind(m.id, m.id),
    ]);
    return json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
