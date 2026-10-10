@echo off
setlocal
title Miss Sky - Sistema de Reservaciones
cd /d "%~dp0"
if errorlevel 1 goto carpeta_error

echo.
echo ===================================================
echo   MISS SKY CANOPY TOUR - INICIAR EL SISTEMA
echo ===================================================
echo.

if not exist "package.json" goto carpeta_error
if not exist "scripts\local-db.mjs" goto carpeta_error
if not exist ".env.local" goto configuracion_error

where node >nul 2>&1
if errorlevel 1 goto node_error
node -e "process.exit(Number(process.versions.node.split('.')[0]) >= 24 ? 0 : 1)"
if errorlevel 1 goto node_error
where npm.cmd >nul 2>&1
if errorlevel 1 goto node_error
where docker >nul 2>&1
if errorlevel 1 goto docker_error

if exist "node_modules\.bin\next.cmd" goto docker_preparar
echo [1/4] Instalando los componentes del programa...
call npm.cmd ci --no-fund --no-audit
if errorlevel 1 goto instalacion_error

:docker_preparar
echo [1/4] Comprobando Docker. Puede tardar unos minutos...
powershell.exe -NoProfile -Command ^
  "$out = [IO.Path]::GetTempFileName(); $err = [IO.Path]::GetTempFileName(); function Ready { try { $p = Start-Process -FilePath 'docker.exe' -ArgumentList @('info','--format','{{.ServerVersion}}') -PassThru -WindowStyle Hidden -RedirectStandardOutput $out -RedirectStandardError $err; $null = $p.Handle; if (-not $p.WaitForExit(8000)) { $p.Kill(); $p.WaitForExit(); return $false }; return ($p.ExitCode -eq 0) } catch { return $false } }; try { if (Ready) { exit 0 }; $desktop = Join-Path $env:ProgramFiles 'Docker\Docker\Docker Desktop.exe'; if (-not (Test-Path -LiteralPath $desktop)) { exit 1 }; Start-Process -FilePath $desktop; $end = (Get-Date).AddMinutes(3); while ((Get-Date) -lt $end) { Start-Sleep -Seconds 3; if (Ready) { exit 0 } }; exit 1 } finally { Remove-Item -LiteralPath $out,$err -Force -ErrorAction SilentlyContinue }"
if errorlevel 1 goto docker_error

echo.
echo [2/4] Iniciando PostgreSQL sin borrar datos...
call npm.cmd run db:local
if errorlevel 1 goto base_error

echo.
echo [3/4] Comprobando las tablas del sistema...
call npm.cmd run db:migrate
if errorlevel 1 goto base_error

echo.
echo [4/4] Abriendo el panel de reservaciones...
rem Exit 2 means this application is already running; exit 1 means another service owns the port.
powershell.exe -NoProfile -Command ^
  "$tcp = New-Object Net.Sockets.TcpClient; try { $connected = $tcp.ConnectAsync('127.0.0.1',3000); if (-not $connected.Wait(1500)) { exit 0 }; if (-not $tcp.Connected) { exit 0 } } catch { exit 0 } finally { $tcp.Dispose() }; try { $response = Invoke-WebRequest -Uri 'http://localhost:3000/admin' -UseBasicParsing -TimeoutSec 20; if ($response.StatusCode -eq 200 -and $response.Content -match 'Miss Sky Canopy Tour') { Start-Process 'http://localhost:3000/admin'; exit 2 } } catch {}; exit 1"
if errorlevel 2 goto ya_abierto
if errorlevel 1 goto puerto_error

rem This bounded background check opens the browser only after the application responds.
start "Miss Sky - Abrir navegador" /b powershell.exe -NoProfile -Command ^
  "$end = (Get-Date).AddMinutes(3); while ((Get-Date) -lt $end) { try { $response = Invoke-WebRequest -Uri 'http://localhost:3000/admin' -UseBasicParsing -TimeoutSec 3; if ($response.StatusCode -eq 200 -and $response.Content -match 'Miss Sky Canopy Tour') { Start-Process 'http://localhost:3000/admin'; exit 0 } } catch {}; Start-Sleep -Seconds 2 }; Write-Host 'El navegador no se abrio automaticamente. Si ves Ready, abre http://localhost:3000/admin. Si hay un error, envia una captura de esta ventana.'"
echo.
echo Deja esta ventana y Docker abiertos mientras uses el programa.
echo Para detener el programa, presiona Ctrl+C en esta ventana.
echo.
call npm.cmd run dev -- --port 3000
if errorlevel 1 goto programa_error
goto fin

:ya_abierto
echo El programa ya estaba funcionando. Se abrio el panel en el navegador.
echo Conserva abierta la ventana que ya ejecutaba el programa.
goto fin

:carpeta_error
echo ERROR: coloca este archivo dentro de la carpeta del programa,
echo junto a package.json y a la carpeta scripts.
goto fallo

:configuracion_error
echo ERROR: aqui falta el archivo privado .env.local.
echo Copia SOLO INICIAR_MISS_SKY.bat a la carpeta original que ya usabas,
echo donde estan package.json, node_modules y .env.local.
echo No borres ni reemplaces tu configuracion privada.
goto fallo

:node_error
echo ERROR: se necesita Node.js 24 o posterior y npm.
echo Instala Node.js desde https://nodejs.org y vuelve a abrir este archivo.
goto fallo

:docker_error
echo ERROR: Docker no esta disponible o no termino de arrancar.
echo Abre Docker Desktop y espera hasta que indique Engine running.
echo Luego vuelve a abrir este archivo. No restablezcas ni borres datos.
goto fallo

:instalacion_error
echo ERROR: no se pudieron instalar los componentes.
echo Comprueba tu conexion a internet y revisa el mensaje anterior.
goto fallo

:base_error
echo ERROR: no se pudo preparar PostgreSQL.
echo Revisa el mensaje anterior. No se borraron las reservas.
echo No compartas el contenido de .env.local.
goto fallo

:puerto_error
echo ERROR: el puerto 3000 esta ocupado y no se pudo verificar Miss Sky.
echo Si tienes otra ventana de npm run dev, detenla con Ctrl+C y reintenta.
goto fallo

:programa_error
echo ERROR: el programa no pudo iniciarse. Revisa el mensaje anterior.
goto fallo

:fallo
echo.
echo Puedes enviar una captura de este mensaje para recibir ayuda.
pause
exit /b 1

:fin
echo.
pause
exit /b 0
