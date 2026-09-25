import { db } from "@/lib/db";
import { json, failure, readJson, visitor, limit } from "@/lib/http";
import { material } from "@/lib/materials";
import { z } from "zod";
export async function POST(
  r: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const v = await visitor(r),
      data = z
        .object({ reason: z.string().trim().min(10).max(2000) })
        .strict()
        .parse(await readJson(r));
    await limit(r, v.id, "material-report", 10);
    const id = (await params).id;
    await material(id);
    await db()
      .prepare(
        "INSERT INTO material_reports(id,material_id,reporter_id,reason,status,created_at) VALUES(?,?,?,?,'pending',?) ON CONFLICT(material_id,reporter_id) DO UPDATE SET reason=excluded.reason,status='pending',created_at=excluded.created_at",
      )
      .bind(
        crypto.randomUUID(),
        id,
        v.id,
        data.reason,
        new Date().toISOString(),
      )
      .run();
    return json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
