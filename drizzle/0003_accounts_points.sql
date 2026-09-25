-- Accounts use the verified Google issuer + sub, never an email or visitor cookie.
-- Existing reviews deliberately keep account_id NULL: no transfer or backfill.
CREATE TABLE accounts (
  id TEXT PRIMARY KEY NOT NULL,
  balance INTEGER NOT NULL DEFAULT 0 CHECK(typeof(balance)='integer'),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','banned')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE point_ledger (
  id TEXT PRIMARY KEY NOT NULL,
  event_key TEXT NOT NULL UNIQUE,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  amount INTEGER NOT NULL CHECK(typeof(amount)='integer' AND amount<>0),
  kind TEXT NOT NULL,
  reference_id TEXT NOT NULL,
  reason TEXT NOT NULL CHECK(length(trim(reason))>0),
  actor TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_point_ledger_account_time ON point_ledger(account_id,created_at DESC);
CREATE INDEX idx_point_ledger_kind_time ON point_ledger(account_id,kind,created_at);

-- Every balance change follows an immutable journal insertion in the same SQL
-- transaction. Reversals are compensating entries, including debt below zero.
CREATE TRIGGER point_ledger_apply AFTER INSERT ON point_ledger BEGIN
  UPDATE accounts SET balance=balance+NEW.amount,
    updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=NEW.account_id;
END;
CREATE TRIGGER point_ledger_no_update BEFORE UPDATE ON point_ledger BEGIN
  SELECT RAISE(ABORT,'point_ledger is immutable');
END;
CREATE TRIGGER point_ledger_no_delete BEFORE DELETE ON point_ledger BEGIN
  SELECT RAISE(ABORT,'point_ledger is immutable');
END;
CREATE TRIGGER account_first_login AFTER INSERT ON accounts BEGIN
  INSERT INTO point_ledger(id,event_key,account_id,amount,kind,reference_id,reason,actor)
  VALUES('first_login:'||NEW.id,'first_login:'||NEW.id,NEW.id,3,
    'first_login',NEW.id,'First account sign-in','system');
END;

ALTER TABLE reviews ADD COLUMN account_id TEXT REFERENCES accounts(id);
CREATE UNIQUE INDEX idx_reviews_course_account ON reviews(course_code,account_id)
  WHERE account_id IS NOT NULL;
CREATE TRIGGER reviews_identity_immutable
BEFORE UPDATE OF account_id,visitor_id,course_code,id ON reviews
WHEN NEW.account_id IS NOT OLD.account_id OR NEW.visitor_id IS NOT OLD.visitor_id
  OR NEW.course_code IS NOT OLD.course_code OR NEW.id IS NOT OLD.id
BEGIN
  SELECT RAISE(ABORT,'review identity is immutable');
END;

-- Only a newly inserted authenticated review can earn points. An edit, old
-- anonymous review, restored review, or fourth daily review can never catch up.
-- Reward days use UTC (the same clock as D1); revocations do not reset the quota.
CREATE TRIGGER review_reward AFTER INSERT ON reviews
WHEN NEW.account_id IS NOT NULL AND NEW.status='visible'
BEGIN
  INSERT INTO point_ledger(id,event_key,account_id,amount,kind,reference_id,reason,actor)
  SELECT 'review_reward:'||NEW.account_id||':'||NEW.course_code,
    'review_reward:'||NEW.account_id||':'||NEW.course_code,
    NEW.account_id,10,'review_reward',NEW.id,'New authenticated course review',NEW.account_id
  WHERE EXISTS(SELECT 1 FROM accounts WHERE id=NEW.account_id AND status='active')
    AND (SELECT COUNT(*) FROM point_ledger WHERE account_id=NEW.account_id
      AND kind='review_reward' AND created_at>=strftime('%Y-%m-%dT00:00:00.000Z','now'))<3
  ON CONFLICT(event_key) DO NOTHING;
END;
CREATE TRIGGER review_reward_revoke AFTER UPDATE OF status ON reviews
WHEN NEW.status='hidden'
BEGIN
  INSERT INTO point_ledger(id,event_key,account_id,amount,kind,reference_id,reason,actor)
  SELECT 'review_revoke:'||NEW.id,'review_revoke:'||NEW.id,
    account_id,-amount,'review_revoke',NEW.id,'Review withdrawn or hidden','system:review-status'
  FROM point_ledger WHERE kind='review_reward' AND reference_id=NEW.id
  ON CONFLICT(event_key) DO NOTHING;
END;

ALTER TABLE moderation_log ADD COLUMN reason TEXT NOT NULL DEFAULT '';
