import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { database, concurrent } from "./sqlite-fixtures.mjs";
import { ENSURE_ACCOUNT_SQL, INSERT_POINT_EVENT_SQL } from "../lib/points.ts";
import {
  REVIEW_OWNER_SQL,
  SAVE_ACCOUNT_REVIEW_SQL,
  SAVE_REVIEW_SQL,
} from "../lib/review-sql.ts";

function account(db, id = "google:one") {
  db.prepare(ENSURE_ACCOUNT_SQL).run(id);
  return id;
}
function balance(db, id = "google:one") {
  return db.prepare("SELECT balance FROM accounts WHERE id=?").get(id).balance;
}
function reviewParams(id, course, visitor, accountId) {
  const values = {
    1: id,
    2: course,
    3: visitor,
    4: 3,
    5: 4,
    6: 2,
    7: `Actual course experience ${id}`,
    8: "Test",
    9: "2025/26 Sem A",
    10: new Date().toISOString(),
    11: new Date().toISOString(),
    12: `content:${id}`,
    13: `network:${id}`,
    14: Math.floor(Date.now() / 1000),
  };
  if (accountId) values[15] = accountId;
  return values;
}
function review(db, id, course, visitor, accountId) {
  return db
    .prepare(accountId ? SAVE_ACCOUNT_REVIEW_SQL : SAVE_REVIEW_SQL)
    .get(reviewParams(id, course, visitor, accountId));
}
function ratingsOnlyParams(id, course, visitor, accountId) {
  return { ...reviewParams(id, course, visitor, accountId), 7: "", 12: null };
}
function eventParams(
  key,
  amount,
  requireFunds = true,
  accountId = "google:one",
) {
  return {
    1: `id:${key}`,
    2: key,
    3: accountId,
    4: amount,
    5: "admin_adjustment",
    6: key,
    7: "Test accounting event",
    8: "test",
    9: requireFunds ? 1 : 0,
  };
}
function reconcile(db) {
  assert.deepEqual(
    db
      .prepare(
        "SELECT a.id FROM accounts a LEFT JOIN point_ledger p ON p.account_id=a.id GROUP BY a.id HAVING a.balance<>COALESCE(SUM(p.amount),0)",
      )
      .all(),
    [],
  );
}

test("durable accounts award first login once and keep an immutable reconcilable journal", () => {
  const db = database();
  account(db);
  account(db);
  account(db);
  assert.equal(balance(db), 3);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM point_ledger").get().n, 1);
  assert.throws(
    () => db.exec("UPDATE point_ledger SET amount=300"),
    /immutable/,
  );
  assert.throws(() => db.exec("DELETE FROM point_ledger"), /immutable/);
  reconcile(db);
  db.close();
});

test("old anonymous reviews remain anonymous and cannot be transferred or rewarded by login or edit", () => {
  const db = database();
  review(db, "old", "CS1001", "cookie");
  const id = account(db);
  assert.equal(review(db, "edit", "CS1001", "cookie", id).id, "old");
  assert.equal(
    db.prepare("SELECT account_id FROM reviews WHERE id='old'").get()
      .account_id,
    null,
  );
  assert.equal(balance(db), 3);
  assert.throws(
    () => db.prepare("UPDATE reviews SET account_id=? WHERE id='old'").run(id),
    /identity is immutable/,
  );
  reconcile(db);
  db.close();
});

test("account ownership survives cookie changes and never leaks to a different account on the same browser", () => {
  const db = database();
  const one = account(db),
    two = account(db, "google:two");
  review(db, "one", "CS1002", "shared-cookie", one);
  assert.equal(
    review(db, "new-cookie", "CS1002", "other-cookie", one).id,
    "one",
  );
  assert.equal(balance(db, one), 13);
  const own = db.prepare(`SELECT id FROM reviews WHERE ${REVIEW_OWNER_SQL}`);
  assert.equal(own.get(two, "shared-cookie"), undefined);
  assert.equal(own.get("", "shared-cookie"), undefined);
  review(db, "two", "CS1002", "shared-cookie", two);
  assert.equal(own.get(two, "shared-cookie").id, "two");
  assert.equal(db.prepare("SELECT COUNT(*) n FROM reviews").get().n, 2);
  reconcile(db);
  db.close();
});

test("rating-only reviews earn once per account/course and cannot claim old anonymous votes", () => {
  const db = database(),
    one = account(db),
    two = account(db, "google:two"),
    save = db.prepare(SAVE_ACCOUNT_REVIEW_SQL);
  save.get(ratingsOnlyParams("blank-one", "CS1003", "cookie-one", one));
  save.get(ratingsOnlyParams("blank-two", "CS1003", "cookie-two", two));
  assert.equal(balance(db, one), 13);
  assert.equal(balance(db, two), 13);
  assert.equal(
    save.get(ratingsOnlyParams("replay", "CS1003", "new-cookie", one)).id,
    "blank-one",
  );
  review(db, "add-experience", "CS1003", "new-cookie", one);
  save.get(ratingsOnlyParams("remove-experience", "CS1003", "new-cookie", one));
  assert.equal(balance(db, one), 13);
  db.prepare(SAVE_REVIEW_SQL).get(
    ratingsOnlyParams("old-blank", "CS1004", "anonymous-cookie"),
  );
  assert.equal(
    save.get(
      ratingsOnlyParams("logged-in-edit", "CS1004", "anonymous-cookie", one),
    ).id,
    "old-blank",
  );
  assert.equal(balance(db, one), 13);
  db.exec("UPDATE reviews SET status='hidden' WHERE id='blank-one'");
  assert.equal(balance(db, one), 3);
  assert.equal(
    save.get(
      ratingsOnlyParams("withdrawn-replay", "CS1003", "another-cookie", one),
    ),
    undefined,
  );
  assert.equal(
    db
      .prepare(
        "SELECT COUNT(*) n FROM point_ledger WHERE account_id=? AND kind='review_reward'",
      )
      .get(one).n,
    1,
  );
  reconcile(db);
  db.close();
});

test("daily rewards cap at three and hidden, restored, withdrawn or replayed reviews do not earn again", () => {
  const db = database(),
    id = account(db);
  for (let n = 1; n <= 4; n++) review(db, `r${n}`, `GE100${n}`, "cookie", id);
  assert.equal(balance(db), 33);
  db.exec("UPDATE reviews SET status='hidden' WHERE id='r1'");
  assert.equal(balance(db), 23);
  db.exec(
    "UPDATE reviews SET status='visible' WHERE id='r1'; UPDATE reviews SET status='hidden' WHERE id='r1'",
  );
  assert.equal(balance(db), 23);
  assert.equal(review(db, "repost", "GE1001", "new-cookie", id), undefined);
  review(db, "edit-fourth", "GE1004", "new-cookie", id);
  assert.equal(balance(db), 23);
  assert.equal(
    db
      .prepare("SELECT COUNT(*) n FROM point_ledger WHERE kind='review_reward'")
      .get().n,
    3,
  );
  assert.equal(
    db
      .prepare("SELECT COUNT(*) n FROM point_ledger WHERE kind='review_revoke'")
      .get().n,
    1,
  );
  reconcile(db);
  db.close();
});

test("conditional debits reject insufficient funds while a reward reversal may create debt", () => {
  const db = database(),
    id = account(db);
  review(db, "r", "GE1001", "cookie", id);
  const entry = db.prepare(INSERT_POINT_EVENT_SQL);
  for (let n = 0; n < 13; n++) entry.get(eventParams(`spend-${n}`, -1));
  assert.equal(balance(db), 0);
  assert.equal(entry.get(eventParams("insufficient", -1)), undefined);
  db.exec("UPDATE reviews SET status='hidden' WHERE id='r'");
  assert.equal(balance(db), -10);
  assert.equal(entry.get(eventParams("debt", -1)), undefined);
  entry.get(eventParams("credit", 5, false));
  assert.equal(balance(db), -5);
  entry.get(eventParams("credit", 5, false));
  assert.equal(balance(db), -5);
  db.exec("UPDATE accounts SET status='banned'");
  entry.get(eventParams("credit-2", 100, false));
  assert.equal(entry.get(eventParams("banned", -1)), undefined);
  reconcile(db);
  db.close();
});

test("failure in ledger insertion rolls back the review and transaction rollback leaves no partial balance", () => {
  const db = database(),
    id = account(db);
  db.exec(
    "CREATE TRIGGER simulate_journal_failure BEFORE INSERT ON point_ledger WHEN NEW.kind='review_reward' BEGIN SELECT RAISE(ABORT,'simulated ledger outage'); END",
  );
  assert.throws(
    () => review(db, "broken", "CS9000", "cookie", id),
    /simulated ledger outage/,
  );
  assert.equal(db.prepare("SELECT COUNT(*) n FROM reviews").get().n, 0);
  assert.equal(balance(db), 3);
  db.exec("BEGIN");
  db.prepare(INSERT_POINT_EVENT_SQL).get(eventParams("partial", -1));
  db.exec("ROLLBACK");
  assert.equal(balance(db), 3);
  assert.equal(
    db.prepare("SELECT id FROM point_ledger WHERE event_key='partial'").get(),
    undefined,
  );
  reconcile(db);
  db.close();
});

test("concurrent accounts, course rewards and purchases remain once-only and cannot overspend", async () => {
  const dir = mkdtempSync(join(tmpdir(), "radar-points-")),
    path = join(dir, "db.sqlite");
  const db = database(path);
  try {
    await concurrent(
      path,
      ENSURE_ACCOUNT_SQL,
      Array.from({ length: 8 }, () => ["google:one"]),
    );
    assert.equal(balance(db), 3);
    account(db, "google:shared");
    await concurrent(
      path,
      SAVE_ACCOUNT_REVIEW_SQL,
      Array.from({ length: 8 }, (_, n) =>
        ratingsOnlyParams(
          `same-course-${n}`,
          "CS2010",
          `changed-cookie-${n}`,
          "google:shared",
        ),
      ),
    );
    assert.equal(balance(db, "google:shared"), 13);
    await concurrent(
      path,
      "UPDATE reviews SET status='hidden' WHERE account_id=? RETURNING id",
      Array.from({ length: 8 }, () => ["google:shared"]),
    );
    assert.equal(balance(db, "google:shared"), 3);
    assert.equal(
      db
        .prepare(
          "SELECT COUNT(*) n FROM point_ledger WHERE kind='review_revoke' AND account_id='google:shared'",
        )
        .get().n,
      1,
    );
    assert.equal(
      db
        .prepare(
          "SELECT COUNT(*) n FROM reviews WHERE account_id='google:shared'",
        )
        .get().n,
      1,
    );
    await concurrent(
      path,
      SAVE_ACCOUNT_REVIEW_SQL,
      Array.from({ length: 8 }, (_, n) =>
        reviewParams(`parallel-${n}`, `CS200${n}`, `cookie-${n}`, "google:one"),
      ),
    );
    assert.equal(balance(db), 33);
    assert.equal(
      db
        .prepare(
          "SELECT COUNT(*) n FROM point_ledger WHERE kind='review_reward' AND account_id='google:one'",
        )
        .get().n,
      3,
    );
    await concurrent(
      path,
      INSERT_POINT_EVENT_SQL,
      Array.from({ length: 8 }, () => eventParams("same-request", -3)),
    );
    assert.equal(balance(db), 30);
    await concurrent(
      path,
      INSERT_POINT_EVENT_SQL,
      Array.from({ length: 8 }, (_, n) => eventParams(`different-${n}`, -10)),
    );
    assert.equal(balance(db), 0);
    reconcile(db);
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
