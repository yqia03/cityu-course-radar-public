// The admission checks and write form ONE SQLite statement. D1 serializes
// writers, so concurrent requests cannot both pass a separate preflight check.
// Numbered parameters reuse server-owned values without interpolating SQL.
export const SAVE_REVIEW_SQL = `
INSERT INTO reviews
  (id,course_code,visitor_id,usefulness,interest,difficulty,comment,nickname,
   semester,status,created_at,updated_at,content_hash,network_hash,submitted_at)
SELECT ?1,?2,?3,?4,?5,?6,?7,?8,?9,'visible',?10,?11,?12,?13,?14
WHERE EXISTS (SELECT 1 FROM reviews WHERE course_code=?2 AND visitor_id=?3)
OR (
  (SELECT COUNT(*) FROM reviews WHERE network_hash=?13 AND course_code=?2
   AND submitted_at > unixepoch()-86400) < 2
  AND (SELECT COUNT(*) FROM reviews WHERE network_hash=?13
   AND submitted_at > unixepoch()-86400) < 20
  AND (SELECT COUNT(*) FROM reviews WHERE visitor_id=?3
   AND submitted_at > unixepoch()-86400) < 6
)
ON CONFLICT(course_code,visitor_id) DO UPDATE SET
  usefulness=excluded.usefulness,interest=excluded.interest,
  difficulty=excluded.difficulty,comment=excluded.comment,
  nickname=excluded.nickname,semester=excluded.semester,
  updated_at=excluded.updated_at,content_hash=excluded.content_hash
WHERE reviews.status='visible'
RETURNING id
`;

// Logged-in identity never comes from the browser. A legacy anonymous review
// may still be edited with its original signed cookie, but remains anonymous and
// cannot earn points. Existing account ownership wins on a shared browser.
export const SAVE_ACCOUNT_REVIEW_SQL = `
WITH identity AS (
  SELECT COALESCE(
    (SELECT visitor_id FROM reviews WHERE course_code=?2 AND account_id=?15),
    (SELECT visitor_id FROM reviews WHERE course_code=?2 AND visitor_id=?3 AND account_id IS NULL),
    'account:'||?15
  ) AS visitor_id
)
INSERT INTO reviews
  (id,course_code,visitor_id,usefulness,interest,difficulty,comment,nickname,
   semester,status,created_at,updated_at,content_hash,network_hash,submitted_at,account_id)
SELECT ?1,?2,identity.visitor_id,?4,?5,?6,?7,?8,?9,'visible',?10,?11,?12,?13,?14,
  CASE WHEN identity.visitor_id=?3 THEN NULL ELSE ?15 END
FROM identity
WHERE EXISTS(SELECT 1 FROM accounts WHERE id=?15 AND status='active') AND (
  EXISTS (SELECT 1 FROM reviews WHERE course_code=?2 AND visitor_id=identity.visitor_id)
  OR (
    (SELECT COUNT(*) FROM reviews WHERE network_hash=?13 AND course_code=?2
     AND submitted_at > unixepoch()-86400) < 2
    AND (SELECT COUNT(*) FROM reviews WHERE network_hash=?13
     AND submitted_at > unixepoch()-86400) < 20
    AND (SELECT COUNT(*) FROM reviews WHERE visitor_id=identity.visitor_id
     AND submitted_at > unixepoch()-86400) < 6
  )
)
ON CONFLICT(course_code,visitor_id) DO UPDATE SET
  usefulness=excluded.usefulness,interest=excluded.interest,
  difficulty=excluded.difficulty,comment=excluded.comment,
  nickname=excluded.nickname,semester=excluded.semester,
  updated_at=excluded.updated_at,content_hash=excluded.content_hash
WHERE reviews.status='visible'
RETURNING id
`;

// Both listings and writes use this ownership predicate. In particular, a
// signed visitor cookie cannot access another account's authenticated review.
export const REVIEW_OWNER_SQL =
  "(account_id=? OR (account_id IS NULL AND visitor_id=?))";
