import { db } from "./db";
import { HttpError } from "./http";
import { bucket, audit, type VersionRow } from "./materials";
// Small resumable batches fit both D1 Free queries and Worker subrequest budgets.
// A server-held cursor prevents a client from claiming an incomplete scan finished.
export async function reconcile(
  actor: string,
  reason: string,
  cursor?: string,
) {
  const d = db(),
    b = bucket();
  const locked = await d
    .prepare(
      `UPDATE material_settings SET uploads_enabled=0,reconcile_busy_until=unixepoch()+120,
 reconciled_at=NULL,reconcile_active=1 WHERE id=1 AND reconcile_busy_until<unixepoch()
 AND (coalesce(reconcile_cursor,'')=? OR ?='') RETURNING reconcile_cursor,reconcile_busy_until`,
    )
    .bind(cursor || "", cursor || "")
    .first<{ reconcile_cursor: string | null; reconcile_busy_until: number }>();
  if (!locked) throw new HttpError(409, "RECONCILE_BUSY");
  // Omitting cursor intentionally restarts a complete scan; partial scans can
  // only continue at the opaque cursor persisted by the previous successful page.
  const nextFrom = cursor ? locked.reconcile_cursor : null;
  await audit(actor, "reconcile", null, reason).run();
  let released = 0,
    orphanBytes = 0,
    orphans = 0;
  try {
    const known = await d
      .prepare(
        "SELECT * FROM material_versions WHERE (state='reserved' AND expires_at<unixepoch()) OR state IN ('failed','rejected') LIMIT 2",
      )
      .all<VersionRow>();
    for (const v of known.results) {
      const claimed = await d
        .prepare(
          "UPDATE material_versions SET state='deleted' WHERE id=? AND (state IN ('failed','rejected') OR (state='reserved' AND expires_at<unixepoch())) RETURNING id",
        )
        .bind(v.id)
        .first();
      if (!claimed) continue;
      await b.delete(v.object_key);
      await d
        .prepare(
          "UPDATE material_versions SET held_bytes=0 WHERE id=? AND state='deleted'",
        )
        .bind(v.id)
        .run();
      released++;
    }
    const incomplete = await d
      .prepare(
        "SELECT id,object_key FROM material_versions WHERE state='deleted' AND held_bytes>0 LIMIT 2",
      )
      .all<{ id: string; object_key: string }>();
    for (const v of incomplete.results) {
      await b.delete(v.object_key);
      await d
        .prepare(
          "UPDATE material_versions SET held_bytes=0 WHERE id=? AND state='deleted'",
        )
        .bind(v.id)
        .run();
      released++;
    }
    const listing = await b.list({
      limit: 3,
      ...(nextFrom ? { cursor: nextFrom } : {}),
    });
    for (const o of listing.objects) {
      const row = await d
        .prepare(
          "SELECT id,state,held_bytes FROM material_versions WHERE object_key=?",
        )
        .bind(o.key)
        .first<{ id: string; state: string; held_bytes: number }>();
      if (!row || row.held_bytes < o.size) {
        await d
          .prepare(
            "INSERT INTO material_orphans(object_key,size,first_seen) VALUES(?,?,strftime('%Y-%m-%dT%H:%M:%fZ','now')) ON CONFLICT(object_key) DO UPDATE SET size=excluded.size",
          )
          .bind(o.key, o.size)
          .run();
        orphanBytes += o.size;
        orphans++;
        if (
          (!row || ["deleted", "failed", "rejected"].includes(row.state)) &&
          /^quarantine\/[a-f0-9-]{36}\.pdf$/.test(o.key)
        ) {
          await b.delete(o.key);
          await d
            .prepare("DELETE FROM material_orphans WHERE object_key=?")
            .bind(o.key)
            .run();
        }
      }
    }
    const stale = await d
      .prepare("SELECT object_key FROM material_orphans LIMIT 2")
      .all<{ object_key: string }>();
    for (const row of stale.results)
      if (!(await b.head(row.object_key)))
        await d
          .prepare("DELETE FROM material_orphans WHERE object_key=?")
          .bind(row.object_key)
          .run();
    const uncertain = await d
      .prepare(
        "SELECT id,held_bytes AS heldBytes,expires_at AS expiresAt FROM material_versions WHERE state='uploading' AND expires_at<unixepoch() LIMIT 100",
      )
      .all();
    const completed = await d
      .prepare(
        `UPDATE material_settings SET reconcile_cursor=?,reconcile_active=?,reconcile_busy_until=0,reconciled_at=CASE WHEN ?=0 THEN strftime('%Y-%m-%dT%H:%M:%fZ','now') ELSE NULL END WHERE id=1 AND reconcile_busy_until=?`,
      )
      .bind(
        listing.truncated ? listing.cursor : null,
        listing.truncated ? 1 : 0,
        listing.truncated ? 1 : 0,
        locked.reconcile_busy_until,
      )
      .run();
    if (!completed.meta.changes) throw new HttpError(409, "RECONCILE_BUSY");
    return {
      released,
      orphans,
      orphanBytes,
      uncertainUploads: uncertain.results,
      uploadsEnabled: false,
      nextCursor: listing.truncated ? listing.cursor : null,
    };
  } catch (e) {
    await d
      .prepare(
        "UPDATE material_settings SET reconcile_busy_until=0 WHERE id=1 AND reconcile_busy_until=?",
      )
      .bind(locked.reconcile_busy_until)
      .run()
      .catch(() => {});
    throw e;
  }
}
