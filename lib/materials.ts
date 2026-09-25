import { env } from "cloudflare:workers";
import { db, adminIds } from "./db";
import { getUser } from "./auth";
import { HttpError } from "./http";
import { checksumHex } from "./material-validation";
export const OFFICIAL_EXAM_URL =
  "https://www.cityu.edu.hk/lib/digital/exampaper/index.htm";
export function bucket() {
  if (!env.MATERIALS) throw new HttpError(503, "STORAGE_UNAVAILABLE");
  return env.MATERIALS;
}
export async function materialUser() {
  const u = await getUser();
  if (!u) throw new HttpError(401, "LOGIN_REQUIRED");
  return u;
}
export function canUploadMaterials(userId: string | null) {
  const mode = env.MATERIALS_UPLOAD_MODE;
  if (mode === undefined) return true;
  return (
    mode === "admin-only" && userId !== null && adminIds().includes(userId)
  );
}
export function requireUploadAccess(userId: string) {
  if (!canUploadMaterials(userId)) throw new HttpError(503, "UPLOADS_DISABLED");
}
export function sameOrigin(r: Request) {
  if (r.headers.get("origin") !== new URL(r.url).origin)
    throw new HttpError(403, "ORIGIN");
}
export function materialFailure(e: unknown) {
  const message = e instanceof Error ? e.message : "";
  for (const code of [
    "UPLOADS_DISABLED",
    "CAPACITY_LIMIT",
    "UPLOAD_DAILY_LIMIT",
    "UPLOAD_PENDING_LIMIT",
    "FILE_SIZE",
    "ACTIVE_PDF",
    "INVALID_PDF",
  ])
    if (message.includes(code))
      return new HttpError(
        code === "UPLOADS_DISABLED" ? 503 : code.includes("LIMIT") ? 429 : 400,
        code,
      );
  if (message.includes("material_versions.verified_sha256"))
    return new HttpError(409, "DUPLICATE_FILE");
  return e;
}
export type MaterialRow = {
  id: string;
  course_code: string;
  owner_id: string;
  title: string;
  category: string;
  academic_year: string;
  semester: string;
  week: number | null;
  source_url: string;
  rights_basis: string;
  rights_declaration: string;
  status: string;
  current_version: string | null;
  created_at: string;
};
export type VersionRow = {
  id: string;
  material_id: string;
  uploader_id: string;
  object_key: string;
  expected_sha256: string;
  verified_sha256: string | null;
  expected_size: number;
  size: number | null;
  state: string;
  expires_at: number;
  held_bytes: number;
  created_at: string;
};
export async function material(id: string) {
  const m = await db()
    .prepare("SELECT * FROM materials WHERE id=?")
    .bind(id)
    .first<MaterialRow>();
  if (!m) throw new HttpError(404, "NOT_FOUND");
  return m;
}
export async function version(id: string) {
  const v = await db()
    .prepare("SELECT * FROM material_versions WHERE id=?")
    .bind(id)
    .first<VersionRow>();
  if (!v) throw new HttpError(404, "NOT_FOUND");
  return v;
}
export async function verifiedObject(v: VersionRow) {
  if (!v.verified_sha256 || !["approved", "quarantined"].includes(v.state))
    throw new HttpError(409, "MATERIAL_UNAVAILABLE");
  const o = await bucket().head(v.object_key);
  if (
    !o ||
    o.size !== v.size ||
    checksumHex(o.checksums.sha256) !== v.verified_sha256
  )
    throw new HttpError(503, "OBJECT_UNAVAILABLE");
  return o;
}
export function audit(
  actor: string,
  action: string,
  materialId: string | null,
  reason: string,
  whenChanged = false,
) {
  return db()
    .prepare(
      `INSERT INTO material_audit(id,actor,action,material_id,reason,created_at) SELECT ?,?,?,?,?,? ${whenChanged ? "WHERE changes()>0" : ""}`,
    )
    .bind(
      crypto.randomUUID(),
      actor,
      action,
      materialId,
      reason,
      new Date().toISOString(),
    );
}
export async function usage() {
  const s = await db()
    .prepare(
      "SELECT uploads_enabled AS uploadsEnabled,capacity_bytes AS capacityBytes,reconciled_at AS reconciledAt FROM material_settings WHERE id=1",
    )
    .first<{
      uploadsEnabled: number;
      capacityBytes: number;
      reconciledAt: string | null;
    }>();
  const held = await db()
    .prepare(
      "SELECT COALESCE((SELECT SUM(held_bytes) FROM material_versions),0)+COALESCE((SELECT SUM(size) FROM material_orphans),0) AS heldBytes",
    )
    .first<{ heldBytes: number }>();
  return {
    ...s,
    ...held,
    uploadsEnabled: !!s?.uploadsEnabled && !!env.MATERIALS,
    bucketAvailable: !!env.MATERIALS,
  };
}
export async function listMaterials(
  courseCode: string | undefined,
  userId: string | null,
  admin = false,
  page = 1,
  filters: {
    category?: string;
    academicYear?: string;
    semester?: string;
    week?: number;
  } = {},
) {
  const d = db();
  const filterClauses: string[] = [],
    filterValues: (string | number)[] = [];
  for (const [key, column] of [
    ["category", "category"],
    ["academicYear", "academic_year"],
    ["semester", "semester"],
    ["week", "week"],
  ] as const)
    if (filters[key] !== undefined) {
      filterClauses.push(`m.${column}=?`);
      filterValues.push(filters[key]!);
    }
  const rows = await d
    .prepare(
      `SELECT m.*,u.account_id AS unlocked_account FROM materials m LEFT JOIN material_unlocks u ON u.material_id=m.id AND u.account_id=? ${courseCode ? "WHERE m.course_code=? AND (m.status='approved' OR m.owner_id=?)" : ""} ${filterClauses.length ? " AND " + filterClauses.join(" AND ") : ""} ORDER BY m.created_at DESC,m.id LIMIT 50 OFFSET ?`,
    )
    .bind(
      userId || "",
      ...(courseCode ? [courseCode, userId || ""] : []),
      ...filterValues,
      (page - 1) * 50,
    )
    .all<MaterialRow & { unlocked_account: string | null }>();
  if (!rows.results.length) return [];
  const vs = await d
    .prepare(
      `SELECT * FROM material_versions WHERE material_id IN (${rows.results.map(() => "?").join(",")}) ORDER BY created_at DESC`,
    )
    .bind(...rows.results.map((m) => m.id))
    .all<VersionRow>();
  return rows.results.map((m) => {
    const versions = vs.results.filter((v) => v.material_id === m.id),
      current = versions.find((v) => v.id === m.current_version),
      own = m.owner_id === userId;
    return {
      id: m.id,
      courseCode: m.course_code,
      title: m.title,
      category: m.category,
      academicYear: m.academic_year,
      semester: m.semester,
      week: m.week,
      sourceUrl: m.source_url,
      rightsBasis: m.rights_basis,
      status: m.status,
      createdAt: m.created_at,
      mine: own,
      unlocked: own || !!m.unlocked_account,
      currentVersion: current
        ? {
            id: current.id,
            size: current.size,
            sha256: current.verified_sha256,
          }
        : null,
      ...(own || admin
        ? {
            rightsDeclaration: m.rights_declaration,
            versions: versions.map((v) => ({
              id: v.id,
              state: v.state,
              status: v.state,
              size: v.size ?? v.expected_size,
              sha256: v.verified_sha256,
              createdAt: v.created_at,
              expiresAt: v.expires_at,
            })),
            ...(admin
              ? { ownerId: m.owner_id, uploaderAccountId: m.owner_id }
              : {}),
          }
        : {}),
    };
  });
}
