import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const root = dirname(dirname(fileURLToPath(import.meta.url)));
process.chdir(root);
if (process.platform !== "win32") {
  console.error("Esta herramienta crea accesos directos en Windows.");
  process.exit(1);
}
const psLiteral = (s) => "'" + s.replaceAll("'", "''") + "'";
function powershell(script) {
  const r = spawnSync("powershell.exe", ["-NoProfile", "-Command", script], {
    stdio: "inherit",
  });
  if (r.status !== 0)
    throw Error(
      "Windows no pudo completar la operación. No se cambiaron las protecciones del equipo.",
    );
}
function run(script) {
  const r = spawnSync(process.execPath, [join(root, "scripts", script)], {
    stdio: "inherit",
  });
  if (r.status !== 0)
    throw Error("Revisa el mensaje anterior; no se borraron datos.");
}
async function isApp() {
  try {
    const r = await fetch("http://localhost:3000/admin", {
      signal: AbortSignal.timeout(5000),
    });
    return r.ok && (await r.text()).includes("Miss Sky Canopy Tour");
  } catch {
    return false;
  }
}
function openBrowser() {
  powershell("Start-Process 'http://localhost:3000/admin'");
}
try {
  const mode = process.argv[2];
  if (mode === "shortcut") {
    const remote = process.argv[3];
    if (remote) {
      const url = new URL(remote);
      if (url.protocol !== "https:" || url.username || url.password)
        throw Error(
          "Usa la dirección HTTPS de la aplicación publicada, sin contraseñas.",
        );
      // Internet shortcuts open the same shared server; no independent database is installed.
      powershell(
        `$desktop=[Environment]::GetFolderPath('Desktop'); $path=Join-Path $desktop 'Miss Sky Reservas.url'; [IO.File]::WriteAllText($path,${psLiteral("[InternetShortcut]\r\nURL=" + url.toString() + "\r\n")})`,
      );
    } else {
      powershell(
        `$desktop=[Environment]::GetFolderPath('Desktop'); $shell=New-Object -ComObject WScript.Shell; $link=$shell.CreateShortcut((Join-Path $desktop 'Miss Sky Reservas.lnk')); $link.TargetPath=Join-Path $env:SystemRoot 'System32\\cmd.exe'; $link.Arguments='/k node scripts/windows.mjs start'; $link.WorkingDirectory=${psLiteral(root)}; $link.Description='Iniciar Miss Sky Reservas en este equipo'; $link.Save()`,
      );
    }
    console.log("Acceso directo Miss Sky Reservas creado en el escritorio.");
  } else if (mode === "start") {
    if (await isApp()) {
      openBrowser();
      console.log(
        "El sistema ya estaba abierto. Conserva su ventana original.",
      );
      process.exit(0);
    }
    if (!existsSync("node_modules/next/dist/bin/next"))
      throw Error("Primero ejecuta npm ci en esta carpeta.");
    if (existsSync(".env.local")) process.loadEnvFile(".env.local");
    const local =
      !process.env.DATABASE_URL ||
      new URL(process.env.DATABASE_URL).hostname === "127.0.0.1";
    if (local) {
      let ready =
        spawnSync("docker", ["info"], { stdio: "ignore", timeout: 8000 })
          .status === 0;
      if (!ready) {
        const dockerDesktop = join(
          process.env.ProgramFiles ?? "C:\\Program Files",
          "Docker",
          "Docker",
          "Docker Desktop.exe",
        );
        if (!existsSync(dockerDesktop))
          throw Error("Instala Docker Desktop para usar la base local.");
        powershell(`Start-Process -FilePath ${psLiteral(dockerDesktop)}`);
        console.log("Esperando que Docker inicie…");
        for (let n = 0; n < 40 && !ready; n++) {
          await new Promise((r) => setTimeout(r, 2000));
          ready =
            spawnSync("docker", ["info"], { stdio: "ignore", timeout: 3000 })
              .status === 0;
        }
      }
      if (!ready)
        throw Error(
          "Docker no está listo. Abre Docker Desktop y espera Engine running.",
        );
    }
    run("local-db.mjs");
    run("migrate.mjs");
    console.log(
      "Deja esta ventana abierta mientras usas el sistema. Para detenerlo, presiona Ctrl+C.",
    );
    const child = spawn(
      process.execPath,
      [
        join(root, "node_modules/next/dist/bin/next"),
        "dev",
        "--hostname",
        "0.0.0.0",
        "--port",
        "3000",
      ],
      { stdio: "inherit" },
    );
    let running = true;
    child.on("exit", (code) => {
      running = false;
      process.exitCode = code ?? 1;
    });
    for (let n = 0; n < 40 && running; n++) {
      await new Promise((r) => setTimeout(r, 1500));
      if (await isApp()) {
        openBrowser();
        break;
      }
    }
  } else throw Error("Usa npm run escritorio para crear el acceso directo.");
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
}
