console.error(
  "This database has hand-authored accounting triggers in drizzle/0003 and 0004. Add a new append-only SQL migration and update the ORM schema; validate against both SQLite and local D1. Do not generate from the legacy 0002 snapshot. See docs/database-migrations.md.",
);
process.exitCode = 1;
