import { db, adminIds } from "@/lib/db";
import { json, failure, HttpError, limit } from "@/lib/http";
import {
  bucket,
  materialUser,
  version,
  sameOrigin,
  materialFailure,
  requireUploadAccess,
} from "@/lib/materials";
import { PdfAdmission, checksumHex } from "@/lib/material-validation";
export async function PUT(
  r: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  let claimed = false;
  let key = "";
  let id = "";
  try {
    sameOrigin(r);
    const u = await materialUser();
    requireUploadAccess(u.userId);
    id = (await params).id;
    const v = await version(id);
    if (v.uploader_id !== u.userId) throw new HttpError(403, "FORBIDDEN");
    await limit(r, u.userId, "upload-bytes", 10);
    if (r.headers.get("content-type")?.split(";")[0] !== "application/pdf")
      throw new HttpError(415, "INVALID_PDF");
    const length = r.headers.get("content-length");
    if (length === null) throw new HttpError(411, "LENGTH_REQUIRED");
    if (!/^\d+$/.test(length) || Number(length) !== v.expected_size)
      throw new HttpError(400, "FILE_SIZE");
    if (!r.body) throw new HttpError(400, "INVALID_PDF");
    const b = bucket();
    key = v.object_key;
    // Only this CAS winner can ever write this immutable server-generated key.
    const result = await db()
      .prepare(
        "UPDATE material_versions SET state='uploading',expires_at=unixepoch()+900 WHERE id=? AND state='reserved' AND expires_at>unixepoch() AND EXISTS(SELECT 1 FROM material_settings WHERE id=1 AND uploads_enabled=1) RETURNING id",
      )
      .bind(id)
      .first();
    if (!result) throw new HttpError(409, "UPLOAD_STATE");
    claimed = true;
    const admission = new PdfAdmission();
    const checked = r.body.pipeThrough(
      new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, controller) {
          admission.inspect(chunk, v.expected_size);
          controller.enqueue(chunk);
        },
        flush() {
          admission.finish(v.expected_size);
        },
      }),
    );
    // R2 requires a known-length stream; FixedLengthStream additionally rejects truncation.
    const fixed = new FixedLengthStream(v.expected_size);
    const abort = new AbortController();
    const deadline = setTimeout(
      () => abort.abort(new Error("UPLOAD_TIMEOUT")),
      180000,
    );
    const pump = checked.pipeTo(fixed.writable, { signal: abort.signal });
    void pump.catch(() => {});
    let stored: R2Object | null;
    try {
      stored = await b.put(key, fixed.readable, {
        sha256: v.expected_sha256,
        onlyIf: { etagDoesNotMatch: "*" },
        httpMetadata: {
          contentType: "application/pdf",
          contentDisposition: "attachment",
        },
        customMetadata: { version: id, scan: "not_scanned" },
      });
      await pump;
    } catch (e) {
      abort.abort(e);
      await pump.catch(() => {});
      throw e;
    } finally {
      clearTimeout(deadline);
    }
    if (
      !stored ||
      stored.size !== v.expected_size ||
      checksumHex(stored.checksums.sha256) !== v.expected_sha256
    )
      throw new HttpError(400, "CHECKSUM_MISMATCH");
    const finished = await db()
      .prepare(
        "UPDATE material_versions SET state='quarantined',size=?,verified_sha256=?,verified_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=? AND state='uploading' RETURNING id",
      )
      .bind(stored.size, v.expected_sha256, id)
      .first();
    if (!finished) throw new HttpError(409, "UPLOAD_STATE");
    return json({ ok: true, status: "quarantined", scanStatus: "not_scanned" });
  } catch (e) {
    if (claimed) {
      // On uncertainty retain all reservation bytes. Reconciliation confirms deletion
      // before releasing capacity; neither failure path awards points.
      try {
        const failed = await db()
          .prepare(
            "UPDATE material_versions SET state='failed',error='UPLOAD_FAILED' WHERE id=? AND state='uploading' RETURNING id",
          )
          .bind(id)
          .first();
        if (failed) {
          await bucket().delete(key);
          await db()
            .prepare(
              "UPDATE material_versions SET held_bytes=0 WHERE id=? AND state='failed'",
            )
            .bind(id)
            .run();
        }
      } catch {}
    }
    return failure(materialFailure(e));
  }
}

// A response can be lost after a successful write. Owners query status instead
// of writing bytes to the same immutable key a second time.
export async function GET(
  _r: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const u = await materialUser(),
      v = await version((await params).id);
    if (v.uploader_id !== u.userId && !adminIds().includes(u.userId))
      throw new HttpError(403, "FORBIDDEN");
    return json({
      status: v.state,
      verified: !!v.verified_sha256,
      materialId: v.material_id,
      uploadId: v.id,
      expiresAt: v.expires_at,
    });
  } catch (e) {
    return failure(e);
  }
}
