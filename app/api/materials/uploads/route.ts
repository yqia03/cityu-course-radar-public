import { db } from "@/lib/db";
import { getCourse } from "@/lib/catalogue";
import { json, failure, readJson, limit, HttpError } from "@/lib/http";
import { uploadSchema } from "@/lib/material-validation";
import {
  bucket,
  materialUser,
  material,
  materialFailure,
  requireUploadAccess,
} from "@/lib/materials";
export async function POST(r: Request) {
  try {
    const u = await materialUser(),
      data = uploadSchema.parse(await readJson(r));
    requireUploadAccess(u.userId);
    bucket();
    await limit(r, u.userId, "upload-reserve", 10);
    if (!(await getCourse(data.courseCode)))
      throw new HttpError(404, "NOT_FOUND");
    if (data.materialId) {
      const m = await material(data.materialId);
      if (m.owner_id !== u.userId) throw new HttpError(403, "FORBIDDEN");
      if (m.status !== "approved" || m.course_code !== data.courseCode)
        throw new HttpError(409, "MATERIAL_UNAVAILABLE");
      if (
        m.title !== data.title ||
        m.category !== data.category ||
        m.academic_year !== data.academicYear ||
        m.semester !== data.semester ||
        m.week !== data.week ||
        m.source_url !== data.sourceUrl ||
        m.rights_basis !== data.rightsBasis ||
        m.rights_declaration !== data.rightsDeclaration
      )
        throw new HttpError(400, "UPDATE_METADATA_MISMATCH");
    }
    const duplicate = await db()
      .prepare("SELECT id FROM material_versions WHERE verified_sha256=?")
      .bind(data.sha256)
      .first();
    if (duplicate) throw new HttpError(409, "DUPLICATE_FILE");
    const id = data.materialId || crypto.randomUUID(),
      vid = crypto.randomUUID(),
      expires = Math.floor(Date.now() / 1000) + 3600,
      d = db();
    const statements = [];
    if (!data.materialId)
      statements.push(
        d
          .prepare(
            "INSERT INTO materials(id,course_code,owner_id,title,category,academic_year,semester,week,source_url,rights_basis,rights_declaration) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
          )
          .bind(
            id,
            data.courseCode,
            u.userId,
            data.title,
            data.category,
            data.academicYear,
            data.semester,
            data.week,
            data.sourceUrl,
            data.rightsBasis,
            data.rightsDeclaration,
          ),
      );
    statements.push(
      d
        .prepare(
          "INSERT INTO material_versions(id,material_id,uploader_id,object_key,expected_sha256,expected_size,held_bytes,state,expires_at) VALUES(?,?,?,?,?,?,?,'reserved',?)",
        )
        .bind(
          vid,
          id,
          u.userId,
          `quarantine/${vid}.pdf`,
          data.sha256,
          data.size,
          data.size,
          expires,
        ),
    );
    await d.batch(statements);
    return json(
      {
        materialId: id,
        uploadId: vid,
        uploadUrl: `/api/materials/uploads/${vid}`,
        expiresAt: expires,
      },
      201,
    );
  } catch (e) {
    return failure(materialFailure(e));
  }
}
