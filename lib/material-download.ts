import { db } from "./db";
import { HttpError, limit, requireAdmin } from "./http";
import {
  bucket,
  material,
  materialUser,
  version,
  verifiedObject,
} from "./materials";
export function parseRange(value: string | null, size: number) {
  if (!value) return undefined;
  const match = /^bytes=(\d*)-(\d*)$/.exec(value);
  if (!match || (!match[1] && !match[2]))
    throw new HttpError(416, "INVALID_RANGE");
  let start: number, end: number;
  if (!match[1]) {
    const suffix = Number(match[2]);
    if (!Number.isSafeInteger(suffix) || suffix < 1)
      throw new HttpError(416, "INVALID_RANGE");
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
  }
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    start < 0 ||
    start >= size ||
    end < start
  )
    throw new HttpError(416, "INVALID_RANGE");
  return { offset: start, length: end - start + 1 };
}
export async function download(r: Request, id: string, admin = false) {
  const u = admin ? await requireAdmin() : await materialUser();
  await limit(r, u.userId, "material-download", 60);
  const m = await material(id);
  const vid = admin
    ? new URL(r.url).searchParams.get("versionId")
    : m.current_version;
  if (!vid || (!admin && m.status !== "approved"))
    throw new HttpError(404, "MATERIAL_UNAVAILABLE");
  if (
    !admin &&
    m.owner_id !== u.userId &&
    !(await db()
      .prepare(
        "SELECT 1 FROM material_unlocks WHERE account_id=? AND material_id=?",
      )
      .bind(u.userId, id)
      .first())
  )
    throw new HttpError(403, "UNLOCK_REQUIRED");
  const v = await version(vid);
  if (v.material_id !== id || (!admin && v.state !== "approved"))
    throw new HttpError(404, "NOT_FOUND");
  const meta = await verifiedObject(v),
    range = parseRange(r.headers.get("range"), meta.size);
  const h = new Headers({
    "Content-Type": "application/pdf",
    "Content-Disposition": `attachment; filename="${m.course_code}-${v.id}.pdf"`,
    "Cache-Control": "private, no-store, max-age=0",
    Vary: "Cookie",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "sandbox; default-src 'none'",
    "Accept-Ranges": "bytes",
    "Content-Length": String(range?.length ?? meta.size),
  });
  if (range)
    h.set(
      "Content-Range",
      `bytes ${range.offset}-${range.offset + range.length - 1}/${meta.size}`,
    );
  if (r.method === "HEAD")
    return new Response(null, { status: range ? 206 : 200, headers: h });
  const object = await bucket().get(v.object_key, {
    onlyIf: { etagMatches: meta.etag },
    ...(range ? { range } : {}),
  });
  if (!object || !("body" in object))
    throw new HttpError(503, "OBJECT_UNAVAILABLE");
  return new Response(object.body, { status: range ? 206 : 200, headers: h });
}
