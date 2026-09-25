# Operations

## Publish

Deploy to the owner's Cloudflare account using `wrangler.json`, with D1 binding `DB`. See [deployment and Google setup](cloudflare-deployment.md). Dashboard-managed custom domains are preserved; never add secrets to Git. The old Sites deployment is historical and does not receive these changes.

## Database migrations

Edit `db/schema.ts`, generate and inspect migrations, test them locally with `npm run db:local`, then back up production and apply with `wrangler d1 migrations apply DB --remote --config wrangler.json`. Applied migrations are immutable. The official catalogue is bundled read-only; community courses and reviews live in D1.

## Authentication

Google ID tokens must pass signature, issuer, audience, expiry and nonce checks. Authorization flows expire in 10 minutes and are consumed once. Login sessions use random 256-bit cookies; only hashes are stored, with a 7-day expiration. `ADMIN_USER_IDS` contains verified Google subject IDs, not email addresses. Identity request headers from the previous hosting gateway are ignored. No development sign-in endpoint is shipped.

## Anti-abuse and storage verification

See [Security controls and verification](security.md) for admission quotas, cookie rotation, network assumptions, end-to-end tests and safe production verification. Keep the single-statement admission checks in `lib/review-sql.ts` when changing review storage. Rolling back to an older Worker also removes those defenses; fix forward when possible.

## Moderation

Open `/admin` as an allowlisted moderator. Review context via the course link, hide inappropriate reviews, or dismiss reports. Hidden reviews disappear from public totals and rankings. To restore a mistakenly hidden review, call the same-origin `POST /api/admin/reviews` with `{ "reviewId": "UUID", "action": "restore" }` from an authenticated administrator session. All decisions are logged. Do not publish names, email addresses or anonymous visitor IDs.

## Backups and recovery

Export the D1 database with Wrangler export before major migrations. Keep encrypted backups outside Git. A backup must include community_courses, reviews, reports, moderation_log, settings auth_flows, auth_sessions and any migration ledger. Test a restoration into a separate private environment, apply later migrations in order, and compare row counts and representative review/ranking results. Never restore production data into a public test site. For an incident, pause writes or restrict traffic through Cloudflare while preserving the database, inspect logs and deploy a reviewed fix.

## Routine checks

- Review dependabot updates monthly; Vinext/Worker upgrades require the complete CI and browser smoke tests.
- Refresh the official current catalogue at each semester boundary, review the import/translation diff and publish the approved snapshot.
- Review the moderation queue and rate-limit errors regularly. Anonymous access requires continuing operational moderation.
- Validate links and translation corrections against their source documents. Never turn model outputs into official university statements.
- Review the GitHub Actions result after pushing; local passing checks are not a claim that remote CI already ran.
