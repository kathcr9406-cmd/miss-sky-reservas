import { existsSync, readFileSync, readdirSync } from "node:fs";
import pg from "pg";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
if (!process.env.DATABASE_URL)
  throw new Error("Configura DATABASE_URL en .env.local antes de migrar.");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();
try {
  await client.query("BEGIN");
  await client.query("SELECT pg_advisory_xact_lock(867104)");
  const directory = new URL("../database/", import.meta.url);
  await client.query(
    "CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())",
  );
  for (const name of readdirSync(directory)
    .filter((name) => /^\d+_.+\.sql$/.test(name))
    .sort()) {
    const existing = await client.query(
      "SELECT 1 FROM schema_migrations WHERE name = $1",
      [name],
    );
    if (existing.rowCount) continue;
    await client.query(readFileSync(new URL(name, directory), "utf8"));
    await client.query("INSERT INTO schema_migrations(name) VALUES ($1)", [
      name,
    ]);
    console.log(`Migración aplicada: ${name}`);
  }
  await client.query("COMMIT");
  console.log(
    "Esquema PostgreSQL preparado. Se conservaron los registros y la configuración existentes.",
  );
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}
