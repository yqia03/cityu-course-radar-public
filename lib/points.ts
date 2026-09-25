/** SQL is kept free of runtime imports so the exact D1 statements can be tested
 * against SQLite, including separate connections competing for one balance. */
export const ENSURE_ACCOUNT_SQL = `
INSERT INTO accounts(id) VALUES (?) ON CONFLICT(id) DO NOTHING
`;

// Caller supplies a server-owned business event and trusted account identity.
// A retry never creates another entry. This statement alone handles the balance
// condition and journal write atomically; related state belongs in a trigger or
// the same D1 batch transaction, never a separate read/update sequence.
export const INSERT_POINT_EVENT_SQL = `
INSERT INTO point_ledger(id,event_key,account_id,amount,kind,reference_id,reason,actor)
SELECT ?1,?2,?3,?4,?5,?6,?7,?8
WHERE EXISTS(SELECT 1 FROM accounts WHERE id=?3
  AND (?9=0 OR (status='active' AND balance>=-?4)))
ON CONFLICT(event_key) DO NOTHING
RETURNING id
`;

export type PointKind =
  | "first_login"
  | "review_reward"
  | "review_revoke"
  | "upload_reward"
  | "upload_revoke"
  | "material_unlock"
  | "material_refund"
  | "admin_adjustment";

export type PointEvent = {
  eventKey: string;
  accountId: string;
  amount: number;
  kind: PointKind;
  referenceId: string;
  reason: string;
  actor: string;
  /** true for purchases; false for compensating revocations that may create debt. */
  requireFunds?: boolean;
};

export function pointEventStatement(d: D1Database, event: PointEvent) {
  if (
    !Number.isSafeInteger(event.amount) ||
    event.amount === 0 ||
    !event.reason.trim() ||
    (event.requireFunds && event.amount >= 0)
  )
    throw new Error("Invalid point event");
  return d
    .prepare(INSERT_POINT_EVENT_SQL)
    .bind(
      crypto.randomUUID(),
      event.eventKey,
      event.accountId,
      event.amount,
      event.kind,
      event.referenceId,
      event.reason,
      event.actor,
      event.requireFunds ? 1 : 0,
    );
}

export type Account = {
  id: string;
  balance: number;
  status: "active" | "banned";
};

export async function ensureAccount(d: D1Database, accountId: string) {
  // account_first_login creates the initial +3 ledger entry atomically.
  await d.prepare(ENSURE_ACCOUNT_SQL).bind(accountId).run();
  const account = await d
    .prepare("SELECT id,balance,status FROM accounts WHERE id=?")
    .bind(accountId)
    .first<Account>();
  if (!account) throw new Error("Account unavailable");
  return account;
}
