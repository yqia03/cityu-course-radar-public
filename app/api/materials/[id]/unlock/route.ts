import { UNLOCK_MATERIAL_SQL } from "@/lib/material-accounting";
import { db } from "@/lib/db";
import { json, failure, HttpError, readJson, limit } from "@/lib/http";
import {
  materialUser,
  material,
  version,
  verifiedObject,
} from "@/lib/materials";
import { z } from "zod";
export async function POST(
  r: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const u = await materialUser();
    z.object({})
      .strict()
      .parse(await readJson(r));
    await limit(r, u.userId, "material-unlock", 30);
    const id = (await params).id,
      m = await material(id);
    if (m.status !== "approved" || !m.current_version)
      throw new HttpError(404, "MATERIAL_UNAVAILABLE");
    const v = await version(m.current_version);
    await verifiedObject(v);
    if (m.owner_id !== u.userId) {
      // Debit and entitlement are one statement; the ledger trigger creates the
      // entitlement and updates balance. A uniqueness failure rolls back everything.
      await db()
        .prepare(UNLOCK_MATERIAL_SQL)
        .bind(crypto.randomUUID(), u.userId, id, v.id)
        .run();
      if (
        !(await db()
          .prepare(
            "SELECT 1 FROM material_unlocks WHERE account_id=? AND material_id=?",
          )
          .bind(u.userId, id)
          .first())
      )
        throw new HttpError(409, "INSUFFICIENT_POINTS");
    }
    return json({ ok: true, downloadUrl: `/api/materials/${id}/download` });
  } catch (e) {
    return failure(e);
  }
}
