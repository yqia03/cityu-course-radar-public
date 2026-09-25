# Security controls and verification

## Data storage

Visitor submissions go to the managed D1 `reviews` table. A 201 response is
returned only after the parameterized INSERT/UPDATE returns a stored ID. The
unique `(course_code, visitor_id)` key makes retries and concurrent edits update
one review. Public reads and rankings query D1 and include only `visible` rows.
External platform references are separate catalogue data and never become votes.

The browser's HttpOnly cookie holds an HMAC-signed UUID and issue timestamp.
The signing key is randomly generated once and persisted in `settings`; it is
not a build-time key or process-local secret. Keep this table in backups. Never
log or publish cookies, signing keys or network hashes. Unsigned legacy cookies
are replaced with a new identity, not trusted as ownership proof. The production
review table was empty before this migration; any pre-existing legacy reviews
would require moderator-assisted ownership recovery.

## Abuse limits

| Control                   | Default                                                                                                                                                           |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| New signed identities     | 30 per network per fixed hour, shared across all GET issuance routes                                                                                              |
| Review write attempts     | 15 per visitor and 60 per network per fixed hour                                                                                                                  |
| New votes on one course   | 2 per network in a rolling 24 hours                                                                                                                               |
| New votes across courses  | 20 per network / 6 per visitor in a rolling 24 hours                                                                                                              |
| Repeated text on a course | Nonempty normalized text has a unique HMAC fingerprint after Unicode normalization, removal of invisible formatting, whitespace and punctuation, and case folding |

The guarded INSERT statement in `lib/review-sql.ts` checks and admits new votes atomically,
including across concurrent Workers. Editing an admitted review does not spend
another vote. Hidden/withdrawn rows count toward quotas and nonempty content uniqueness.
Every future review write must reuse this statement. Direct INSERTs or a rollback
to a Worker predating these guards bypass admission checks; prefer forward fixes.
Different visitors cannot withdraw or update another visitor's review. Withdrawal
soft-hides the row, preserves the anti-abuse record and removes it from public
scores; it does not enable reposting from the same identity.

Exhausted identity issuance leaves public reads available with `canReview:false`.
Existing valid identities can still edit. Write errors include a Retry-After
header (one hour for attempt limits, 24 hours for admission limits) and the UI
explains the relevant limit in all three languages. A server-side strict schema,
20 KB streamed body cap, same-origin JSON writes and honeypot also apply.
SQL values are bound parameters; user content is rendered as React text, never
as HTML. Experience text is optional, without a product character minimum or
maximum; the streamed request body cap remains. Omitted text is stored as an
empty string. Empty, invisible-only and punctuation-only text normalize to no
content and use a NULL fingerprint, so independent rating-only reviews do not
collide. They still require all three valid ratings and pass the same identity,
network, rate, ownership and moderation checks. New signed-in rating-only reviews
follow the existing once-per-account/course reward rules; adding or removing text
does not issue another reward or award points to an old anonymous review.

Network identity uses only the trusted edge's `CF-Connecting-IP`, groups IPv6
addresses by /64, handles IPv4-mapped IPv6, and ignores client `X-Forwarded-For`.
A missing/invalid IP falls into a shared limited bucket. Cloudflare edge semantics
apply on the deployed route: [Cloudflare documents Worker subrequest
differences](https://developers.cloudflare.com/fundamentals/reference/http-headers/).
Network identifiers are HMAC hashes, not raw IPs. Review network hashes expire
after 24 hours and are cleared on subsequent review writes; expired rate-counter
rows are deleted on subsequent limiter use. They are not on a guaranteed timer.

Shared campus/NAT networks can hit these limits even for legitimate students.
Change thresholds with a reviewed forward migration and regression tests. These
controls do not establish that a voter took the course, or guarantee one person
one vote against rotating proxies, slow bots or rewritten spam. Configure real
moderators with `ADMIN_USER_IDS`, review reports, and add an independently verified
bot challenge/edge WAF if observed abuse needs stronger controls. Do not accept a
client `isAdmin` flag or expose a public endpoint that can grant moderation rights.

## Reproducible verification

Run `npm test`, `npm run typecheck`, `npm run db:local`, then the local preview
and `npm run test:integration`. Integration tests refuse non-loopback origins,
create only a generated `ZZTEST` course, and write exact cleanup SQL to the ignored
`.sites-runtime/test-cleanup.sql`. `npm run test:cleanup` removes that fixture.
Local test clients simulate independent edge IPs; this is not evidence that a
production browser can spoof the edge IP header.

Coverage includes forged/modified cookies, same-browser concurrent upserts,
concurrent identity rotation on one network, normalized duplicate comments,
hidden-row reuse, SQL and HTML payload round trips, invalid ratings/extra fields,
honeypot and body limits, optional/short/long experience text, independent rating-only
reviews, cross-origin writes, moderation permissions, reporting,
withdrawal ownership and read availability after identity issuance is exhausted.
The integration runner writes a local-only persistence receipt. Stop and restart
the preview, then read its course reviews with the same signed cookie: `own.id`
must match the receipt. Check the row in the persisted local D1 SQLite database
as an independent confirmation. Never copy production credentials into this receipt.

For production smoke verification, use a fresh anonymous session, publish one
clearly labelled temporary test review, read its returned ID independently from
the owner’s Cloudflare D1 Console, and withdraw it immediately using that same visitor
cookie and same-origin DELETE with `{}`. Confirm the stored row is hidden and
public counts return to their starting values. Do not run load tests or fixture
generation on the public site. Keep any maintenance canary record hidden.

Dependency advisories must also be reviewed periodically. An audit finding is
not proof of an exploitable route in the bundled Vinext Worker; determine whether
the affected feature is reachable, update compatible packages and rerun the build
and regression suite. Do not use forced dependency fixes that downgrade tooling.
