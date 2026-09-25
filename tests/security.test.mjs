import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { SAVE_REVIEW_SQL } from "../lib/review-sql.ts";
import { readFileSync, readdirSync } from "node:fs";
import {
  hmacKey,
  signVisitor,
  verifyVisitor,
  normalizedComment,
  networkPrefix,
  VISITOR_LIFETIME,
} from "../lib/security.ts";

test("only unmodified server tokens are accepted, within their lifetime", async () => {
  const key = await hmacKey(crypto.randomUUID());
  const now = Math.floor(Date.now() / 1000),
    id = crypto.randomUUID();
  const token = await signVisitor(key, id, now);
  assert.equal((await verifyVisitor(key, token, now)).id, id);
  for (const bad of [
    id,
    token.replace(id, crypto.randomUUID()),
    token.slice(0, -1),
    token.replace("v1.", "v2."),
  ])
    assert.equal(await verifyVisitor(key, bad, now), null);
  assert.equal(await verifyVisitor(key, token, now - 1), null);
  assert.equal(await verifyVisitor(key, token, now + VISITOR_LIFETIME), null);
  assert.equal(
    await verifyVisitor(await hmacKey("different key"), token, now),
    null,
  );
});
test("duplicate fingerprint handles formatting and invisible character changes", () => {
  assert.equal(
    normalizedComment("Ａ useful, course!"),
    normalizedComment("a useful\u200b COURSE"),
  );
  assert.notEqual(
    normalizedComment("重实践，作业很多。"),
    normalizedComment("重理论，作业不多。"),
  );
});
test("network identity groups equivalent IPv6 and mapped IPv4 addresses", () => {
  assert.equal(
    networkPrefix("2001:db8:1:2::123"),
    networkPrefix("2001:0db8:0001:0002:abcd::1"),
  );
  assert.notEqual(
    networkPrefix("2001:db8:1:2::1"),
    networkPrefix("2001:db8:1:3::1"),
  );
  assert.equal(networkPrefix("::ffff:192.0.2.1"), "192.0.2.1");
  assert.equal(networkPrefix("::ffff:c000:201"), "192.0.2.1");
  for (const value of ["", "garbage", "1.2.3.4, 5.6.7.8"])
    assert.equal(networkPrefix(value), "unknown");
});
test("database guards count hidden votes, exclude old votes and cannot reset on edits", () => {
  const db = new DatabaseSync(":memory:");
  const dir = new URL("../drizzle/", import.meta.url);
  for (const name of readdirSync(dir)
    .filter((x) => x.endsWith(".sql"))
    .sort())
    db.exec(readFileSync(new URL(name, dir), "utf8"));
  const statement = db.prepare(SAVE_REVIEW_SQL);
  const insert = {
    run(id, code, visitor, content, network, time) {
      return statement.get({
        1: id,
        2: code,
        3: visitor,
        4: 3,
        5: 3,
        6: 3,
        7: "Test review text",
        8: "",
        9: "",
        10: "now",
        11: "now",
        12: content,
        13: network,
        14: time,
      });
    },
  };
  const now = Math.floor(Date.now() / 1000);
  insert.run("one", "TEST1000", "v1", "text1", "network", now);
  insert.run("two", "TEST1000", "v2", "text2", "network", now);
  db.exec("UPDATE reviews SET status='hidden' WHERE id='one'");
  assert.equal(
    insert.run("three", "TEST1000", "v3", "text3", "network", now),
    undefined,
  );
  assert.throws(
    () => insert.run("copy", "TEST1000", "v4", "text1", "other-network", now),
    /UNIQUE/,
  );
  db.exec("UPDATE reviews SET interest=5 WHERE id='two'");
  assert.equal(
    insert.run("three", "TEST1000", "v3", "text3", "network", now),
    undefined,
  );
  db.prepare("UPDATE reviews SET submitted_at=? WHERE id='one'").run(
    now - 86401,
  );
  insert.run("three", "TEST1000", "v3", "text3", "network", now);
  for (let n = 0; n < 6; n++)
    insert.run(
      `daily${n}`,
      `DAY100${n}`,
      "dailyvisitor",
      `daily${n}`,
      "another-network",
      now,
    );
  assert.equal(
    insert.run(
      "daily7",
      "DAY1007",
      "dailyvisitor",
      "daily7",
      "another-network",
      now,
    ),
    undefined,
  );
  for (let n = 0; n < 20; n++)
    insert.run(`net${n}`, `NET${n}`, `n${n}`, `net${n}`, "bulk-network", now);
  assert.equal(
    insert.run("net21", "NET21", "n21", "net21", "bulk-network", now),
    undefined,
  );
  db.close();
});
