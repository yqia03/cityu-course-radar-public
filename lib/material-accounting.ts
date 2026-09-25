/** Shared unchanged by the HTTP route and SQLite adversarial tests.
 * The ledger trigger writes the entitlement and account balance atomically. */
export const UNLOCK_MATERIAL_SQL = `INSERT INTO point_ledger(id,event_key,account_id,amount,kind,reference_id,reason,actor,created_at)
  SELECT ?1,'material_unlock:'||?2||':'||?3,?2,-1,'material_unlock',?3,'First material unlock',?2,strftime('%Y-%m-%dT%H:%M:%fZ','now')
  WHERE EXISTS(SELECT 1 FROM accounts WHERE id=?2 AND status='active' AND balance>=1)
  AND EXISTS(SELECT 1 FROM materials WHERE id=?3 AND status='approved' AND current_version=?4)
  AND NOT EXISTS(SELECT 1 FROM material_unlocks WHERE account_id=?2 AND material_id=?3)
  ON CONFLICT(event_key) DO NOTHING`;
