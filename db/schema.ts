import {
  sqliteTable,
  text,
  integer,
  uniqueIndex,
  index,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { check } from "drizzle-orm/sqlite-core";
export const courses = sqliteTable("community_courses", {
  code: text("code").primaryKey(),
  titleEn: text("title_en").notNull(),
  titleZhHans: text("title_zh_hans").notNull(),
  titleZhHant: text("title_zh_hant").notNull(),
  descriptionEn: text("description_en").notNull(),
  descriptionZhHans: text("description_zh_hans").notNull(),
  descriptionZhHant: text("description_zh_hant").notNull(),
  department: text("department").notNull(),
  credits: text("credits").notNull(),
  level: text("level").notNull(),
  sourceUrl: text("source_url").notNull(),
  createdBy: text("created_by").notNull(),
  createdAt: text("created_at").notNull(),
});
export const reviews = sqliteTable(
  "reviews",
  {
    id: text("id").primaryKey(),
    courseCode: text("course_code").notNull(),
    visitorId: text("visitor_id").notNull(),
    accountId: text("account_id").references(() => accounts.id),
    usefulness: integer("usefulness").notNull(),
    interest: integer("interest").notNull(),
    difficulty: integer("difficulty").notNull(),
    comment: text("comment").notNull(),
    nickname: text("nickname").notNull(),
    semester: text("semester").notNull(),
    status: text("status").notNull().default("visible"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    contentHash: text("content_hash"),
    networkHash: text("network_hash"),
    submittedAt: integer("submitted_at").notNull().default(0),
  },
  (t) => [
    uniqueIndex("idx_reviews_course_visitor").on(t.courseCode, t.visitorId),
    uniqueIndex("idx_reviews_course_account")
      .on(t.courseCode, t.accountId)
      .where(sql`${t.accountId} IS NOT NULL`),
    index("idx_reviews_status_course").on(t.status, t.courseCode),
    uniqueIndex("idx_reviews_course_content").on(t.courseCode, t.contentHash),
    index("idx_reviews_network_time").on(t.networkHash, t.submittedAt),
    index("idx_reviews_visitor_time").on(t.visitorId, t.submittedAt),
    check(
      "ratings_range",
      sql`${t.usefulness} BETWEEN 1 AND 5 AND ${t.interest} BETWEEN 1 AND 5 AND ${t.difficulty} BETWEEN 1 AND 5`,
    ),
    check("review_status", sql`${t.status} IN ('visible','hidden')`),
  ],
);
export const rateLimits = sqliteTable(
  "rate_limits",
  {
    key: text("key").primaryKey(),
    count: integer("count").notNull(),
    expiresAt: integer("expires_at").notNull(),
  },
  (t) => [index("idx_rate_expiry").on(t.expiresAt)],
);
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});
export const reports = sqliteTable(
  "reports",
  {
    id: text("id").primaryKey(),
    reviewId: text("review_id")
      .notNull()
      .references(() => reviews.id),
    visitorId: text("visitor_id").notNull(),
    reason: text("reason").notNull(),
    createdAt: text("created_at").notNull(),
    status: text("status").notNull().default("pending"),
  },
  (t) => [
    uniqueIndex("idx_reports_review_visitor").on(t.reviewId, t.visitorId),
    index("idx_reports_status").on(t.status),
  ],
);
export const moderationLog = sqliteTable("moderation_log", {
  id: text("id").primaryKey(),
  reviewId: text("review_id").notNull(),
  actor: text("actor").notNull(),
  action: text("action").notNull(),
  reason: text("reason").notNull().default(""),
  createdAt: text("created_at").notNull(),
});

export const authFlows = sqliteTable(
  "auth_flows",
  {
    stateHash: text("state_hash").primaryKey().notNull(),
    verifier: text("verifier").notNull(),
    nonce: text("nonce").notNull(),
    expiresAt: integer("expires_at").notNull(),
  },
  (t) => [index("idx_auth_flows_expiry").on(t.expiresAt)],
);
export const authSessions = sqliteTable(
  "auth_sessions",
  {
    tokenHash: text("token_hash").primaryKey().notNull(),
    userId: text("user_id").notNull(),
    email: text("email").notNull(),
    fullName: text("full_name").notNull(),
    expiresAt: integer("expires_at").notNull(),
  },
  (t) => [index("idx_auth_sessions_expiry").on(t.expiresAt)],
);

// Balance is materialized from the immutable point_ledger by SQL triggers in
// 0003_accounts_points.sql; application code must never assign it directly.
export const accounts = sqliteTable(
  "accounts",
  {
    id: text("id").primaryKey().notNull(),
    balance: integer("balance").notNull().default(0),
    status: text("status").notNull().default("active"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
  },
  (t) => [check("account_status", sql`${t.status} IN ('active','banned')`)],
);

export const pointLedger = sqliteTable(
  "point_ledger",
  {
    id: text("id").primaryKey().notNull(),
    eventKey: text("event_key").notNull().unique(),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id),
    amount: integer("amount").notNull(),
    kind: text("kind").notNull(),
    referenceId: text("reference_id").notNull(),
    reason: text("reason").notNull(),
    actor: text("actor").notNull(),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
  },
  (t) => [
    index("idx_point_ledger_account_time").on(t.accountId, t.createdAt),
    index("idx_point_ledger_kind_time").on(t.accountId, t.kind, t.createdAt),
    check(
      "point_amount",
      sql`typeof(${t.amount})='integer' AND ${t.amount}<>0`,
    ),
  ],
);
