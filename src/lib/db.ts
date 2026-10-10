import { Pool } from "pg";

const globalForDb = globalThis as unknown as { missSkyPool?: Pool };
export function databaseConfigured() {
  return Boolean(process.env.DATABASE_URL);
}
export function db() {
  if (!databaseConfigured())
    throw new Error("DATABASE_URL pendiente de configuración.");
  if (!globalForDb.missSkyPool)
    globalForDb.missSkyPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      connectionTimeoutMillis: 5000,
    });
  return globalForDb.missSkyPool;
}
