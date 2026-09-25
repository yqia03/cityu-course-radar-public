# Contributing to CityU Course Radar

Use Node 24+ and Python 3.11+. Start with README.md. Keep pull requests focused on an observable change.

- The official catalogue is a versioned dataset, not a hand-written list. Correct translations through the dictionaries under `data/translation/` and rerun the merge pipeline.
- Every user-facing label belongs in `lib/messages.ts` with all three language variants. Original student reviews are never automatically translated or rewritten.
- Authorization and input validation belong in the API even when the interface hides a control. Never trust browser-supplied identity headers.
- Course identity is the canonical course code. Synchronization must not delete existing courses or detach reviews. Missing courses become archived records.
- Use prepared statements. Append schema migrations; do not edit a migration already deployed.
- Run `npm test`, `npm run typecheck` and `npm run format:check`. API changes need `npm run test:integration` on a local preview; clean fixtures afterward with `npm run test:cleanup`.
- Report security vulnerabilities privately to the repository owner rather than publishing exploit details in an issue. Never commit `.env`, credentials, production database exports or identity data.
