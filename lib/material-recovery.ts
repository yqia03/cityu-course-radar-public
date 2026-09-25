import { db } from "./db";
import { HttpError } from "./http";
import { bucket, version, audit } from "./materials";
import { PdfAdmission, checksumHex } from "./material-validation";
// Re-read a completed object after an interrupted D1 acknowledgement. Unknown
// uploads retain all capacity as abandoned; never delete/release a possible late writer.
export async function recoverUpload(id: string, actor: string, reason: string) {
  const v = await version(id),
    d = db();
  if (v.state !== "uploading" || v.expires_at >= Date.now() / 1000)
    throw new HttpError(409, "UPLOAD_STATE");
  const o = await bucket().get(v.object_key);
  let valid = false;
  if (
    o &&
    o.size === v.expected_size &&
    checksumHex(o.checksums.sha256) === v.expected_sha256
  ) {
    const admission = new PdfAdmission(),
      reader = o.body.getReader();
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        admission.inspect(chunk.value, v.expected_size);
      }
      admission.finish(v.expected_size);
      valid = true;
    } catch {
      await reader.cancel().catch(() => {});
    }
  } else if (o) await o.body.cancel();
  const statement = valid
    ? d
        .prepare(
          "UPDATE material_versions SET state='quarantined',size=expected_size,verified_sha256=expected_sha256,verified_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=? AND state='uploading' AND expires_at<unixepoch() RETURNING state",
        )
        .bind(id)
    : d
        .prepare(
          "UPDATE material_versions SET state='abandoned',error='OPERATOR_REVIEW_REQUIRED' WHERE id=? AND state='uploading' AND expires_at<unixepoch() RETURNING state",
        )
        .bind(id);
  let result;
  try {
    result = await d.batch([
      statement,
      audit(
        actor,
        valid ? "recover_upload" : "abandon_upload",
        v.material_id,
        `${id}: ${reason}`,
        true,
      ),
    ]);
  } catch (e) {
    if (
      !valid ||
      !(e instanceof Error) ||
      !e.message.includes(
        "UNIQUE constraint failed: material_versions.verified_sha256",
      )
    )
      throw e;
    // A competing upload can claim this digest after both reservations were
    // accepted. The failed batch rolled back; abandon only if this row still
    // owns the expired upload state and another row still claims its digest.
    // Retain bytes and the object, including any possible late writer.
    result = await d.batch([
      d
        .prepare(
          "UPDATE material_versions SET state='abandoned',error='DUPLICATE_FILE' WHERE id=? AND state='uploading' AND expires_at<unixepoch() AND EXISTS(SELECT 1 FROM material_versions duplicate WHERE duplicate.id<>material_versions.id AND duplicate.verified_sha256=material_versions.expected_sha256) RETURNING state",
        )
        .bind(id),
      audit(
        actor,
        "abandon_upload",
        v.material_id,
        `${id}: duplicate SHA-256; ${reason}`,
        true,
      ),
    ]);
  }
  const actual = await version(id);
  if (
    !result[0].results.length &&
    !["quarantined", "approved"].includes(actual.state)
  )
    throw new HttpError(409, "UPLOAD_STATE");
  return {
    ok: true,
    state: actual.state,
    capacityReleased: false,
  };
}
