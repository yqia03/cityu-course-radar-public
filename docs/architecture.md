# Architecture and boundaries

The application is a React/Vinext app deployed as a Cloudflare Worker in the owner’s Cloudflare account. The framework is a beta release, pinned by the lockfile; upgrades must pass API and browser smoke tests. UI components are the bundled Radix/Shadcn primitives.

## Modules

- `lib/catalogue.ts`: joins a versioned official snapshot with community additions, normalizes identity, filters and ranks courses. Official data takes precedence when an official course later matches a community code.
- `lib/validation.ts`: shared server-side input contracts; no caller-supplied owner identities.
- `lib/http.ts`: errors, same-origin JSON writes, streaming request limits, signed anonymous cookie and atomic D1 rate counters. `lib/security.ts` implements token verification, text fingerprints and IPv6 network grouping. `lib/review-sql.ts` checks admission limits inside the INSERT statement, so parallel Workers cannot race a JavaScript quota check.
- `app/api/`: public catalogue/detail reads, anonymous review/report writes, authenticated course additions and moderator actions.
- `db/schema.ts` and `drizzle/`: schema source and append-only migrations. D1 holds reviews, community courses, reports, moderation audit records, rate counters and a random network-hash salt. Official catalogue text is bundled as a compressed read-only asset to avoid seed-database coupling; it is decompressed once inside the first request and reused per Worker isolate.
- `components/`: shared language/account context and bounded page components. `localStorage` holds only the display-language preference; user content persists in D1.
- `scripts/catalogue/`: cached, paced official imports, PDF recovery and translation pipeline. Changes are promoted through a reviewed diff.

## Identity and authorization

Public requests require no login. Course additions and moderation use Google OAuth with PKCE, browser-bound single-use state, nonce and JOSE signature/issuer/audience/expiry checks. Random session cookies are HttpOnly/Secure/SameSite=Lax; only hashes are stored in D1, with a seven-day lifetime. See `lib/auth.ts`, `lib/auth-security.ts` and `app/api/auth/`.

Caller-provided identity headers are ignored. The custom domain is canonical; default Worker and preview URLs are disabled. Moderators are explicitly allowlisted by verified `google:<subject>` IDs in `ADMIN_USER_IDS`. Production variables and encrypted secrets are managed in Cloudflare. There is no simulated sign-in endpoint: integration tests seed a short-lived session directly into the local database.

## Review semantics

An anonymous browser receives a random HttpOnly, SameSite=Lax cookie, Secure on HTTPS. A unique `(course_code, visitor_id)` constraint and an atomic UPSERT preserve one review per browser/course. Concurrent first writes require a previously established cookie. Updates retain review ID and creation time; hidden reviews cannot be resurrected by their author. A fresh browser or cleared cookies is a new identity; there is no claim of verified enrollment or one-person-one-vote.

Each rating is an integer from 1 to 5. Composite = `(usefulness + interest + 6 - difficulty) / 3`. Rankings require 3 visible reviews and sort using the full precision score, then review count, then course code. All public totals exclude hidden reviews. Difficulty measures workload/challenge rather than teaching quality.

Rate limits use atomic hourly counters. Review limit: 15 writes/browser/hour, 60/network/hour. Course limit: 5/user/hour, 20/network/hour. Reports: 10/browser/hour, 40/network/hour. Network addresses are hashed with a random database salt and hourly bucket; raw addresses are not stored. Expired counters are deleted during write traffic. School NAT users share a network bucket. A large community should add managed edge abuse controls and evaluate limits using actual traffic.

Reports are deduplicated per review/browser and do not automatically hide content. Moderation actions and report resolution are committed together with an audit log. Restore is available through the moderator API, preserving a reversible moderation workflow.

## Operational limits

Catalogue search is performed over the in-memory snapshot, and score aggregation groups visible D1 reviews. This keeps 4,422 courses simple and portable; add a materialized aggregate table after measuring substantial review volume. No mocked reviews ship. No external translation service is invoked by page visits. User-added translations must be provided by the contributor.

The anonymous editing cookie lasts one year. Review and contributor data persist until an operator processes a documented removal request. D1 backups contain private identifiers and must remain private. The project has no automated account recovery for anonymous users and no verification of student enrollment.

## Materials and points (2026-09-25)

Authenticated identities now also have durable accounts keyed by verified Google subject. Anonymous review rows retain NULL account ownership; logging in does not transfer or reward them. New authenticated reviews use account ownership across browser cookies. Ledger triggers provide once-only first-login/review rewards, reward reversals and balances; see `docs/points-accounting.md`. Do not infer balance from client state.

`lib/materials.ts` and the materials routes provide a paginated directory, private object permissions, upload reservations and moderation. `lib/material-accounting.ts` is the shared, tested purchase SQL; migration `0004` atomically creates unlocks, publishes/rewards versions and issues permanent-takedown refunds. D1 `batch` supplies the transaction boundary for adjacent state and audit changes; separate R2 calls are deliberately outside that transaction.

R2 objects use immutable server-generated version keys. Stream validation and R2-verified SHA-256 precede quarantine; manual review precedes publication. `lib/material-reconcile.ts` holds conservative capacity reservations, tracks orphan objects and records resumable scans. `lib/material-recovery.ts` recovers complete objects or retains ambiguous abandoned reservations. No object is public or embedded in the site origin; GET/HEAD/Range all require live authorization. There is no automated antivirus claim.

Production uploads remain disabled until a private MATERIALS binding, account-wide capacity review and admin allowlist exist. This feature adds no scheduled scraper, paid service or automatic subscription. External review JSON remains editorial read-only data outside rating and point tables. Official exam PDFs remain outside the library until explicit redistribution permission is obtained.
