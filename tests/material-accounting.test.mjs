import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { database, concurrent } from "./sqlite-fixtures.mjs";
import { ENSURE_ACCOUNT_SQL, INSERT_POINT_EVENT_SQL } from "../lib/points.ts";
import { UNLOCK_MATERIAL_SQL } from "../lib/material-accounting.ts";

// These fixtures exercise actual migration triggers. Their object metadata is
// synthetic; R2 existence/type validation belongs to the HTTP integration tests.
const RESERVE = `INSERT INTO material_versions(id,material_id,uploader_id,object_key,expected_sha256,expected_size,held_bytes,state,expires_at)
VALUES(?1,?2,?3,'quarantine/'||?1||'.pdf',?1,?4,?4,'reserved',unixepoch()+3600) RETURNING id`;
const APPROVE =
  "UPDATE material_versions SET state='approved' WHERE id=? AND state='quarantined' RETURNING id";
const TAKE_DOWN =
  "UPDATE materials SET status='taken_down' WHERE id=? RETURNING id";
function account(db, id) {
  db.prepare(ENSURE_ACCOUNT_SQL).run(id);
}
function balance(db, id) {
  return db.prepare("SELECT balance FROM accounts WHERE id=?").get(id).balance;
}
function material(db, id, owner = "owner") {
  db.prepare(
    "INSERT INTO materials(id,course_code,owner_id,title,category,academic_year,semester,source_url,rights_basis,rights_declaration) VALUES(?,'TEST1000',?,'Self authored PDF','notes','2025/2026','A','','own','Generated solely for accounting tests')",
  ).run(id, owner);
}
function reserve(db, id, mid, owner = "owner", bytes = 100) {
  return db.prepare(RESERVE).get({ 1: id, 2: mid, 3: owner, 4: bytes });
}
function quarantine(db, id) {
  db.prepare(
    "UPDATE material_versions SET state='quarantined',size=expected_size,verified_sha256=expected_sha256 WHERE id=?",
  ).run(id);
}
function unlock(db, mid, vid, buyer = "buyer") {
  return db
    .prepare(UNLOCK_MATERIAL_SQL)
    .run({ 1: crypto.randomUUID(), 2: buyer, 3: mid, 4: vid });
}
function reconciled(db) {
  assert.deepEqual(
    db
      .prepare(
        "SELECT a.id FROM accounts a LEFT JOIN point_ledger l ON l.account_id=a.id GROUP BY a.id HAVING a.balance<>COALESCE(SUM(l.amount),0)",
      )
      .all(),
    [],
  );
}
function base(path = ":memory:") {
  const db = database(path);
  db.exec(
    "UPDATE material_settings SET uploads_enabled=1,capacity_bytes=8000000000",
  );
  account(db, "owner");
  account(db, "buyer");
  return db;
}
function ready(db, id = "material", vid = "version") {
  material(db, id);
  reserve(db, vid, id);
  quarantine(db, vid);
  return { id, vid };
}

test("approval journal failure rolls back publication, version state and reward together", () => {
  const db = base();
  ready(db);
  db.exec(
    "CREATE TRIGGER fail_reward BEFORE INSERT ON point_ledger WHEN NEW.kind='upload_reward' BEGIN SELECT RAISE(ABORT,'simulated journal failure'); END",
  );
  assert.throws(
    () => db.prepare(APPROVE).get("version"),
    /simulated journal failure/,
  );
  assert.equal(
    db.prepare("SELECT state FROM material_versions WHERE id='version'").get()
      .state,
    "quarantined",
  );
  const row = db
    .prepare("SELECT status,current_version FROM materials WHERE id='material'")
    .get();
  assert.equal(row.status, "pending");
  assert.equal(row.current_version, null);
  assert.equal(balance(db, "owner"), 3);
  assert.equal(
    db
      .prepare("SELECT COUNT(*) n FROM point_ledger WHERE kind='upload_reward'")
      .get().n,
    0,
  );
  db.exec("DROP TRIGGER fail_reward");
  db.prepare(APPROVE).get("version");
  assert.equal(balance(db, "owner"), 53);
  reconciled(db);
  db.close();
});

test("failed entitlement insertion rolls back debit and ledger; a retry unlocks for exactly one point", () => {
  const db = base();
  ready(db);
  db.prepare(APPROVE).get("version");
  db.exec(
    "CREATE TRIGGER fail_entitlement BEFORE INSERT ON material_unlocks BEGIN SELECT RAISE(ABORT,'simulated entitlement failure'); END",
  );
  assert.throws(
    () => unlock(db, "material", "version"),
    /simulated entitlement failure/,
  );
  assert.equal(balance(db, "buyer"), 3);
  assert.equal(
    db
      .prepare(
        "SELECT COUNT(*) n FROM point_ledger WHERE kind='material_unlock'",
      )
      .get().n,
    0,
  );
  assert.equal(
    db.prepare("SELECT COUNT(*) n FROM material_unlocks").get().n,
    0,
  );
  db.exec("DROP TRIGGER fail_entitlement");
  unlock(db, "material", "version");
  unlock(db, "material", "version");
  assert.equal(balance(db, "buyer"), 2);
  assert.equal(
    db.prepare("SELECT COUNT(*) n FROM material_unlocks").get().n,
    1,
  );
  reconciled(db);
  db.close();
});

test("refund failure rolls back takedown and uploader reversal; later takedown refunds each buyer once", () => {
  const db = base();
  ready(db);
  db.prepare(APPROVE).get("version");
  unlock(db, "material", "version");
  db.exec(
    "CREATE TRIGGER fail_refund BEFORE INSERT ON point_ledger WHEN NEW.kind='material_refund' BEGIN SELECT RAISE(ABORT,'simulated refund failure'); END",
  );
  assert.throws(
    () => db.prepare(TAKE_DOWN).get("material"),
    /simulated refund failure/,
  );
  assert.equal(
    db.prepare("SELECT status FROM materials WHERE id='material'").get().status,
    "approved",
  );
  assert.equal(balance(db, "owner"), 53);
  assert.equal(balance(db, "buyer"), 2);
  assert.equal(
    db
      .prepare("SELECT COUNT(*) n FROM point_ledger WHERE kind='upload_revoke'")
      .get().n,
    0,
  );
  db.exec("DROP TRIGGER fail_refund");
  db.prepare(TAKE_DOWN).get("material");
  db.exec("UPDATE materials SET status='approved' WHERE id='material'");
  db.prepare(TAKE_DOWN).get("material");
  assert.equal(balance(db, "owner"), 3);
  assert.equal(balance(db, "buyer"), 3);
  assert.equal(
    db
      .prepare(
        "SELECT COUNT(*) n FROM point_ledger WHERE kind='material_refund'",
      )
      .get().n,
    1,
  );
  reconciled(db);
  db.close();
});

test("publication changes, zero balances and bans cannot be bypassed by stale unlock attempts", () => {
  const db = base();
  ready(db);
  unlock(db, "material", "version");
  assert.equal(balance(db, "buyer"), 3);
  db.prepare(APPROVE).get("version");
  unlock(db, "material", "wrong-version");
  assert.equal(balance(db, "buyer"), 3);
  db.prepare(INSERT_POINT_EVENT_SQL).get({
    1: "zero",
    2: "zero",
    3: "buyer",
    4: -3,
    5: "admin_adjustment",
    6: "zero",
    7: "Set boundary fixture to zero",
    8: "test",
    9: 0,
  });
  unlock(db, "material", "version");
  assert.equal(balance(db, "buyer"), 0);
  db.prepare(INSERT_POINT_EVENT_SQL).get({
    1: "credit",
    2: "credit",
    3: "buyer",
    4: 3,
    5: "admin_adjustment",
    6: "credit",
    7: "Restore boundary fixture",
    8: "test",
    9: 0,
  });
  db.exec("UPDATE accounts SET status='banned' WHERE id='buyer'");
  unlock(db, "material", "version");
  assert.equal(balance(db, "buyer"), 3);
  db.exec("UPDATE accounts SET status='active' WHERE id='buyer'");
  db.prepare(TAKE_DOWN).get("material");
  unlock(db, "material", "version");
  assert.equal(balance(db, "buyer"), 3);
  assert.equal(
    db.prepare("SELECT COUNT(*) n FROM material_unlocks").get().n,
    0,
  );
  reconciled(db);
  db.close();
});

test("rejected and cleaned uploads still consume the same UTC daily quota", () => {
  const db = base();
  material(db, "material");
  for (let i = 0; i < 3; i++) {
    reserve(db, `version-${i}`, "material");
    db.prepare(
      "UPDATE material_versions SET state='rejected',held_bytes=0 WHERE id=?",
    ).run(`version-${i}`);
  }
  assert.throws(() => reserve(db, "fourth", "material"), /UPLOAD_DAILY_LIMIT/);
  db.exec("UPDATE material_versions SET state='deleted'");
  assert.throws(() => reserve(db, "fifth", "material"), /UPLOAD_DAILY_LIMIT/);
  assert.equal(
    db.prepare("SELECT COUNT(*) n FROM material_versions").get().n,
    3,
  );
  db.close();
});

test("eight independent writers cannot over-reserve capacity including quarantined, orphan and abandoned bytes", async () => {
  const dir = mkdtempSync(join(tmpdir(), "radar-material-capacity-")),
    path = join(dir, "db.sqlite"),
    db = base(path);
  try {
    material(db, "held");
    reserve(db, "held-version", "held");
    db.exec(
      "UPDATE material_versions SET state='abandoned' WHERE id='held-version'; INSERT INTO material_orphans VALUES('unknown-object',50,'test'); UPDATE material_settings SET capacity_bytes=350",
    );
    const params = Array.from({ length: 8 }, (_, i) => {
      const id = `owner-${i}`;
      account(db, id);
      material(db, `material-${i}`, id);
      return { 1: `version-${i}`, 2: `material-${i}`, 3: id, 4: 100 };
    });
    const results = await concurrent(path, RESERVE, params, {
      allowErrors: true,
    });
    assert.equal(results.filter((r) => r?.id).length, 2);
    assert.equal(
      results.filter((r) => r?.error?.includes("CAPACITY_LIMIT")).length,
      6,
    );
    assert.equal(
      db
        .prepare(
          "SELECT (SELECT SUM(held_bytes) FROM material_versions)+(SELECT SUM(size) FROM material_orphans) AS bytes",
        )
        .get().bytes,
      350,
    );
    db.exec(
      "UPDATE material_versions SET state='quarantined' WHERE state='reserved'",
    );
    assert.throws(() => reserve(db, "overflow", "held"), /CAPACITY_LIMIT/);
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("concurrent approval, unlock, updated approval and takedown preserve one reward, debit and refund", async () => {
  const dir = mkdtempSync(join(tmpdir(), "radar-material-ledger-")),
    path = join(dir, "db.sqlite"),
    db = base(path);
  try {
    ready(db);
    await concurrent(
      path,
      APPROVE,
      Array.from({ length: 8 }, () => ["version"]),
    );
    assert.equal(balance(db, "owner"), 53);
    await concurrent(
      path,
      UNLOCK_MATERIAL_SQL,
      Array.from({ length: 8 }, () => ({
        1: crypto.randomUUID(),
        2: "buyer",
        3: "material",
        4: "version",
      })),
    );
    assert.equal(balance(db, "buyer"), 2);
    assert.equal(
      db.prepare("SELECT COUNT(*) n FROM material_unlocks").get().n,
      1,
    );
    reserve(db, "version-2", "material");
    quarantine(db, "version-2");
    await concurrent(
      path,
      APPROVE,
      Array.from({ length: 8 }, () => ["version-2"]),
    );
    assert.equal(balance(db, "owner"), 53);
    unlock(db, "material", "version-2");
    assert.equal(balance(db, "buyer"), 2);
    await concurrent(
      path,
      TAKE_DOWN,
      Array.from({ length: 8 }, () => ["material"]),
    );
    assert.equal(balance(db, "owner"), 3);
    assert.equal(balance(db, "buyer"), 3);
    assert.equal(
      db
        .prepare(
          "SELECT COUNT(*) n FROM point_ledger WHERE kind='upload_reward'",
        )
        .get().n,
      1,
    );
    assert.equal(
      db
        .prepare(
          "SELECT COUNT(*) n FROM point_ledger WHERE kind='upload_revoke'",
        )
        .get().n,
      1,
    );
    assert.equal(
      db
        .prepare(
          "SELECT COUNT(*) n FROM point_ledger WHERE kind='material_refund'",
        )
        .get().n,
      1,
    );
    reconciled(db);
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
