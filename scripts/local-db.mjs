import { existsSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

// Only for local development. Never replaces an existing configuration.
const localFile = existsSync(".env.local");
const existingConfiguration = localFile || Boolean(process.env.DATABASE_URL);
let password;
if (existingConfiguration) {
  if (localFile) process.loadEnvFile(".env.local");
  if (!process.env.DATABASE_URL)
    throw new Error(
      "Completa DATABASE_URL en el archivo existente; no se reemplazó.",
    );
  const url = new URL(process.env.DATABASE_URL);
  if (
    url.hostname !== "127.0.0.1" ||
    url.port !== "5433" ||
    url.pathname !== "/miss_sky" ||
    url.username !== "miss_sky"
  ) {
    console.log(
      "La conexión configurada usa otro PostgreSQL. No se modificó la configuración ni se inició un contenedor local.",
    );
    process.exit(0);
  }
  password = decodeURIComponent(url.password);
  if (!password)
    throw new Error(
      "La conexión local necesita una contraseña; no se reemplazó la configuración.",
    );
} else {
  password = randomBytes(24).toString("hex");
}
const exists =
  spawnSync("docker", ["container", "inspect", "miss-sky-postgres"], {
    stdio: "ignore",
  }).status === 0;
if (exists) {
  if (!existingConfiguration)
    throw new Error(
      "El contenedor ya existe, pero falta .env.local. Recupera su configuración antes de continuar; no se borró nada.",
    );
  const result = spawnSync("docker", ["start", "miss-sky-postgres"], {
    stdio: "inherit",
  });
  if (result.status !== 0)
    throw new Error(
      "No se pudo iniciar el contenedor existente; no se borró nada.",
    );
} else {
  const directory = mkdtempSync(join(tmpdir(), "miss-sky-db-"));
  const envPath = join(directory, "postgres.env");
  writeFileSync(
    envPath,
    `POSTGRES_USER=miss_sky\nPOSTGRES_DB=miss_sky\nPOSTGRES_PASSWORD=${password}\n`,
    { mode: 0o600 },
  );
  try {
    const result = spawnSync(
      "docker",
      [
        "run",
        "--detach",
        "--name",
        "miss-sky-postgres",
        "--env-file",
        envPath,
        "--publish",
        "127.0.0.1:5433:5432",
        "--volume",
        "miss-sky-pgdata:/var/lib/postgresql/data",
        "postgres:17-alpine@sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24",
      ],
      { stdio: "inherit" },
    );
    if (result.status !== 0)
      throw new Error(
        "No se pudo iniciar PostgreSQL. Revisa Docker y el puerto 5433.",
      );
    if (!existingConfiguration)
      writeFileSync(
        ".env.local",
        `DATABASE_URL=postgresql://miss_sky:${password}@127.0.0.1:5433/miss_sky\nADMIN_PASSWORD=${randomBytes(18).toString("base64url")}\nSESSION_SECRET=${randomBytes(32).toString("hex")}\n`,
        { mode: 0o600, flag: "wx" },
      );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}
let ready = false;
for (let attempt = 0; attempt < 30; attempt++) {
  const result = spawnSync(
    "docker",
    [
      "exec",
      "miss-sky-postgres",
      "pg_isready",
      "-U",
      "miss_sky",
      "-d",
      "miss_sky",
    ],
    { stdio: "ignore" },
  );
  if (result.status === 0) {
    ready = true;
    break;
  }
  await new Promise((resolve) => setTimeout(resolve, 500));
}
if (!ready)
  throw new Error(
    "PostgreSQL no respondió. Consulta docker logs miss-sky-postgres.",
  );
console.log(
  "PostgreSQL local disponible. No se muestran claves privadas. Ejecuta npm run db:migrate.",
);
