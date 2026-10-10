# Miss Sky Canopy Tour — Sistema de Reservaciones

Aplicación web en español con **Next.js 16, TypeScript, Tailwind CSS 4 y PostgreSQL 17**. Incluye reservas públicas con desglose de adultos y niños, calendario diario, configuración de cupos, salidas extra por fecha, pagos recibidos, comisiones, gastos y reportes mensuales.

## Visualizar el programa

### Windows: descarga, actualización y acceso directo

Consulta [LEEME_PRIMERO_WINDOWS.md](LEEME_PRIMERO_WINDOWS.md). En la carpeta original, instala dependencias con `npm ci`, crea el acceso directo con `npm run escritorio` y abre el programa con `npm run abrir`. Después usa doble clic en **Miss Sky Reservas** desde el escritorio. Conserva `.env.local` y el volumen de PostgreSQL. El archivo BAT anterior sigue disponible; no desactives las protecciones de Windows si lo bloquean.

Para compartir reservas entre varias computadoras, ambas deben usar el mismo servidor y la misma base. Una descarga local por equipo no sincroniza bases distintas. La guía explica los accesos web cuando exista el alojamiento central.

Requiere Node.js 24 y npm. Desde el repositorio:

```bash
npm ci
npm run dev
```

Abre `http://localhost:3000` en tu navegador local. La página pública funciona sin base de datos, pero muestra la tarifa y los horarios pendientes y no acepta reservas. El acceso del personal está en `/admin`.

En el entorno en la nube, ejecuta los comandos desde `/workspace/miss-sky-reservas`. El servidor escucha en `0.0.0.0:3000`; usa la función de puertos de tu editor si está disponible. Esta interfaz de onboarding no publica una vista previa web. Ejecutar el programa tampoco lo despliega en internet.

## Habilitar PostgreSQL y el panel

### Desarrollo local con Docker

```bash
npm run db:local
npm run db:migrate
npm run dev
```

`db:local` inicia PostgreSQL 17 en `127.0.0.1:5433`, con el contenedor `miss-sky-postgres` y el volumen persistente `miss-sky-pgdata`. Genera claves aleatorias en `.env.local` con permisos privados y nunca reemplaza un archivo existente. La imagen está fijada por digest. Ejecutarlo otra vez reinicia el mismo contenedor y conserva los datos.

Para entrar a `/admin`, usa la contraseña `ADMIN_PASSWORD` de tu archivo privado `.env.local` o sustitúyela por una contraseña propia de al menos 12 caracteres. Reinicia Next.js después de cambiar variables. No compartas ese archivo ni lo subas a Git. `SESSION_SECRET` debe tener al menos 32 caracteres.

### PostgreSQL existente

Copia `.env.example` a `.env.local` y completa `DATABASE_URL`, `ADMIN_PASSWORD` y `SESSION_SECRET` de manera privada. No uses `db:local` para un servicio externo. Crea la base de datos y ejecuta `npm run db:migrate`; el comando es repetible y no elimina registros. Usa la conexión TLS y las autoridades de confianza que indique tu proveedor, sin desactivar la verificación.

En `/admin` → **Configuración**, establece la tarifa, la moneda (CRC o USD) y cada horario con sus cupos y días de operación. No hay precios, horas o capacidades reales predefinidos. Los horarios usan `America/Costa_Rica`. Cada reserva conserva el precio vigente al registrarse. El transporte no se ofrece.

## Flujo disponible

1. El cliente elige una fecha, la cantidad de adultos y niños y una salida disponible.
2. Completa nombre, correo, teléfono, nota opcional y consentimiento.
3. Revisa los datos y confirma. El servidor valida nuevamente precio y cupos, registra al cliente y entrega un código de reserva.
4. El personal consulta las reservas, los contactos y el calendario. Puede configurar salidas, cupos totales y máximos de adultos y niños desde el panel. Las salidas marcadas como extra requieren activación manual por fecha.

El precio se calcula en el servidor, en centavos enteros. Las transacciones bloquean la salida al contar cupos para evitar sobreventa por solicitudes simultáneas. El panel usa una sesión firmada de ocho horas en una cookie HttpOnly, SameSite y Secure en producción. Las escrituras verifican el origen de la solicitud. El acceso inicial usa una contraseña compartida; las cuentas individuales y permisos quedan para una siguiente etapa.

## Archivos principales

- `src/app/page.tsx`: página pública y composición visual.
- `src/app/globals.css`: diseño adaptable para escritorio y móvil, sobre Tailwind.
- `src/components/booking-form.tsx`: formulario, validación, resumen y confirmación.
- `src/components/calendar.tsx`: selector de fechas.
- `src/components/forest-art.tsx`: ilustración vectorial local, sin servicios de imágenes externos.
- `src/app/admin/page.tsx` y `src/components/admin-*.tsx`: acceso y panel del personal.
- `src/app/api/`: disponibilidad, registro de reservas, sesiones y configuración.
- `src/lib/`: conexión PostgreSQL, consultas, validación, formatos y autenticación.
- `database/001_initial.sql`: tablas de tarifa, salidas, clientes, reservas y pagos.
- `scripts/`: creación del PostgreSQL local y aplicación del esquema.
- `.env.example`: nombres de configuración sin valores secretos.
- `tests/`: validaciones y pruebas de concurrencia contra PostgreSQL.

## Validación

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm start
```

Las pruebas de integración requieren `TEST_DATABASE_URL` apuntando a una **base desechable separada cuyo nombre termine en `_test`**. No uses la base del programa: esas pruebas vacían sus propias tablas antes y después de ejecutarse.

```bash
npm run test:integration
```

Las verificaciones incluyen validación, origen de solicitudes, CSV seguro y pruebas PostgreSQL de concurrencia de cupos, salidas extra, desglose histórico, idempotencia, comisiones, correcciones y reportes por moneda. El lanzador de Windows tiene validación de sintaxis; necesita una comprobación real en Windows.

## Alcance y límites

- La reserva se guarda con **pago pendiente**. El personal registra abonos recibidos sin superar el total. No se cobran tarjetas desde el sistema.
- Se registran gastos y pagos de comisiones del 10 % del total de cada reserva asociada. Los reportes mensuales usan la fecha del pago, separan USD/CRC y exportan CSV. Las correcciones anulan con motivo, conservando el historial. No hay conciliación bancaria automática, reembolsos ni cancelación de reservas en esta versión.
- La confirmación se muestra en pantalla: no se envía un correo automáticamente.
- Las listas de reservas recientes y clientes muestran hasta 200 reservas por fecha de visita. El calendario diario, los indicadores de hoy y los reportes financieros consultan todos los registros aplicables. Falta un directorio paginado de todos los clientes.
- La información de privacidad es provisional. Antes de publicar, hay que completar responsable, contacto y conservación de datos, configurar respaldo de PostgreSQL, un limitador compartido de solicitudes para producción y cuentas individuales del personal si se requieren.
- El contenedor y las claves locales son de desarrollo. No se debe asumir que el volumen Docker se conserva en nuevas tareas de la nube: para datos operativos usa un PostgreSQL externo persistente y copias de seguridad. Un despliegue público necesita PostgreSQL persistente, HTTPS, variables privadas del proveedor y una revisión de operación. No está desplegado ni publicado.

## Operación financiera y migraciones

`src/lib/operations.ts` concentra operaciones administrativas transaccionales y reportes; `src/app/api/admin/operations/route.ts` exige sesión para lectura y origen válido para escrituras. `src/components/operations-panel.tsx` contiene el calendario diario y los formularios. `database/002_operations.sql` añade datos sin eliminar los anteriores. `scripts/migrate.mjs` ejecuta migraciones ordenadas una sola vez y conserva su historial.

Los pagos y los gastos requieren un ID de solicitud UUID: una repetición idéntica no duplica registros y un mismo ID con datos diferentes se rechaza. Las comisiones se redondean al centavo; un pago de comisión genera un gasto y asignaciones contra reservas, y su anulación restaura la deuda. El saldo mensual es ingresos cobrados menos gastos pagados; las comisiones pendientes no se cuentan como gastos pagados.

El logo de `public/miss-sky-logo.png` se renderizó directamente del PDF oficial aportado por el usuario, con fondo transparente y sin el margen vacío de la hoja.

Para usarla desde el canopy y administración en lugares diferentes, consulta [PUBLICAR_PARA_DOS_OFICINAS.md](PUBLICAR_PARA_DOS_OFICINAS.md). La versión debe publicarse con una única base central; los accesos directos de cada computadora abrirán la misma dirección.
