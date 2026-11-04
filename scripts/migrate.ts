import "dotenv/config";
import { Client } from "pg";
import { readdir, readFile } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
// Transactional, forward-only SQL migrations. Uses Prisma's migration ledger
// format so standard `prisma migrate status/deploy` can inspect the same history.
async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query("SELECT pg_advisory_lock(739204113)");
    await client.query(`CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
      id VARCHAR(36) PRIMARY KEY, checksum VARCHAR(64) NOT NULL, finished_at TIMESTAMPTZ,
      migration_name VARCHAR(255) NOT NULL, logs TEXT, rolled_back_at TIMESTAMPTZ,
      started_at TIMESTAMPTZ NOT NULL DEFAULT now(), applied_steps_count INTEGER NOT NULL DEFAULT 0
    )`);
    const root = path.join(process.cwd(), "prisma/migrations");
    const directories = (await readdir(root, { withFileTypes: true }))
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();
    for (const name of directories) {
      const sql = await readFile(
        path.join(root, name, "migration.sql"),
        "utf8",
      );
      const checksum = createHash("sha256").update(sql).digest("hex");
      const existing = await client.query(
        'SELECT checksum, finished_at FROM "_prisma_migrations" WHERE migration_name = $1 AND rolled_back_at IS NULL',
        [name],
      );
      if (existing.rows.length) {
        if (
          existing.rows.some(
            (row) => !row.finished_at || row.checksum !== checksum,
          )
        )
          throw new Error(
            `Migration ${name} is incomplete or its checksum changed. Review it before continuing.`,
          );
        console.log(`Already applied: ${name}`);
        continue;
      }
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO "_prisma_migrations" (id, checksum, migration_name, finished_at, applied_steps_count) VALUES ($1, $2, $3, now(), 1)',
          [randomUUID(), checksum, name],
        );
        await client.query("COMMIT");
        console.log(`Applied: ${name}`);
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      }
    }
  } finally {
    await client.query("SELECT pg_advisory_unlock(739204113)").catch(() => {});
    await client.end();
  }
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : "Migration failed");
  process.exitCode = 1;
});
