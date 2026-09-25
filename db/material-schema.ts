import { sql } from "drizzle-orm";
import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
  primaryKey,
  check,
} from "drizzle-orm/sqlite-core";
import { accounts } from "./schema";

const created = (name: string) =>
  text(name)
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`);

// SQL migrations remain authoritative for triggers and initial settings rows.
export const materialSettings = sqliteTable(
  "material_settings",
  {
    id: integer("id").primaryKey(),
    uploadsEnabled: integer("uploads_enabled").notNull().default(0),
    capacityBytes: integer("capacity_bytes").notNull().default(0),
    reconciledAt: text("reconciled_at"),
    reconcileCursor: text("reconcile_cursor"),
    reconcileActive: integer("reconcile_active").notNull().default(0),
    reconcileBusyUntil: integer("reconcile_busy_until").notNull().default(0),
  },
  (t) => [
    check("material_settings_singleton", sql`${t.id}=1`),
    check("material_upload_enabled", sql`${t.uploadsEnabled} IN (0,1)`),
    check(
      "material_capacity_bounds",
      sql`${t.capacityBytes} BETWEEN 0 AND 8000000000`,
    ),
  ],
);

export const materials = sqliteTable(
  "materials",
  {
    id: text("id").primaryKey(),
    courseCode: text("course_code").notNull(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => accounts.id),
    title: text("title").notNull(),
    category: text("category").notNull(),
    academicYear: text("academic_year").notNull(),
    semester: text("semester").notNull(),
    week: integer("week"),
    sourceUrl: text("source_url").notNull(),
    rightsBasis: text("rights_basis").notNull(),
    rightsDeclaration: text("rights_declaration").notNull(),
    status: text("status").notNull().default("pending"),
    // The SQL state transition, not an FK cycle, controls the approved pointer.
    currentVersion: text("current_version"),
    createdAt: created("created_at"),
    updatedAt: created("updated_at"),
  },
  (t) => [
    index("material_course").on(t.courseCode, t.status),
    check(
      "material_category",
      sql`${t.category} IN ('lecture','tutorial','past_exam','notes')`,
    ),
    check("material_semester", sql`${t.semester} IN ('A','B','Summer')`),
    check(
      "material_rights",
      sql`${t.rightsBasis} IN ('own','permission','open_license')`,
    ),
    check(
      "material_status",
      sql`${t.status} IN ('pending','approved','rejected','taken_down')`,
    ),
  ],
);

export const materialVersions = sqliteTable(
  "material_versions",
  {
    id: text("id").primaryKey(),
    materialId: text("material_id")
      .notNull()
      .references(() => materials.id),
    uploaderId: text("uploader_id")
      .notNull()
      .references(() => accounts.id),
    objectKey: text("object_key").notNull().unique(),
    expectedSha256: text("expected_sha256").notNull(),
    verifiedSha256: text("verified_sha256").unique(),
    expectedSize: integer("expected_size").notNull(),
    size: integer("size"),
    heldBytes: integer("held_bytes").notNull(),
    state: text("state").notNull(),
    createdAt: created("created_at"),
    expiresAt: integer("expires_at").notNull(),
    verifiedAt: text("verified_at"),
    error: text("error"),
    approvedAt: text("approved_at"),
  },
  (t) => [
    index("material_version_owner_day").on(t.uploaderId, t.createdAt),
    index("material_version_material").on(t.materialId, t.state),
    check(
      "material_expected_size",
      sql`${t.expectedSize} BETWEEN 1 AND 50000000`,
    ),
    check("material_held_bytes", sql`${t.heldBytes} BETWEEN 0 AND 50000000`),
    check(
      "material_version_state",
      sql`${t.state} IN ('reserved','uploading','quarantined','approved','rejected','failed','deleted','abandoned')`,
    ),
  ],
);

export const materialOrphans = sqliteTable("material_orphans", {
  objectKey: text("object_key").primaryKey(),
  size: integer("size").notNull(),
  firstSeen: text("first_seen").notNull(),
});

export const materialUnlocks = sqliteTable(
  "material_unlocks",
  {
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id),
    materialId: text("material_id")
      .notNull()
      .references(() => materials.id),
    createdAt: created("created_at"),
  },
  (t) => [primaryKey({ columns: [t.accountId, t.materialId] })],
);

export const materialReports = sqliteTable(
  "material_reports",
  {
    id: text("id").primaryKey(),
    materialId: text("material_id")
      .notNull()
      .references(() => materials.id),
    reporterId: text("reporter_id").notNull(),
    reason: text("reason").notNull(),
    status: text("status").notNull().default("pending"),
    createdAt: text("created_at").notNull(),
  },
  (t) => [
    uniqueIndex("material_reports_material_reporter").on(
      t.materialId,
      t.reporterId,
    ),
  ],
);

export const materialAudit = sqliteTable("material_audit", {
  id: text("id").primaryKey(),
  actor: text("actor").notNull(),
  action: text("action").notNull(),
  materialId: text("material_id"),
  reason: text("reason").notNull(),
  createdAt: text("created_at").notNull(),
});
