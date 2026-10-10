# Una sola aplicación para las dos oficinas

El canopy y administración están en lugares distintos. Para ver las mismas reservas necesitan una dirección HTTPS compartida y una base PostgreSQL central. Los accesos directos abren esa dirección; las computadoras cliente no requieren Docker ni Node.

## Lo que falta para activarla en internet

Se necesitan una cuenta de alojamiento compatible con Next.js y una cuenta de PostgreSQL persistente. Vercel y un proveedor PostgreSQL como Neon son opciones, no servicios ya contratados o configurados por esta descarga. Revisa sus condiciones y costos al crear las cuentas.

1. En el proveedor de PostgreSQL, crea una base de datos y conserva su dirección de conexión en privado. Usa TLS con verificación del certificado.
2. En el alojamiento web, importa el repositorio `kathcr9406-cmd/miss-sky-reservas`. Selecciona Next.js y Node.js 24 o una versión posterior compatible. La instalación es `npm ci` y la compilación `npm run build`.
3. En las variables privadas del alojamiento, configura `DATABASE_URL`, una `ADMIN_PASSWORD` propia de al menos 12 caracteres y `SESSION_SECRET` aleatoria de al menos 32 caracteres. No escribas estos valores en el repositorio, una captura ni el chat.
4. Antes del primer uso, aplica las migraciones una vez contra la base central con `npm run db:migrate` desde una terminal con esa conexión privada. La compilación no migra automáticamente la base. El comando conserva registros y registra las migraciones aplicadas.
5. Publica la aplicación, abre `/admin`, inicia sesión y configura la tarifa y salidas reales. No conectes un alojamiento remoto a una dirección `127.0.0.1` de tu computadora.
6. Comprueba una reserva de prueba desde la página pública y su aparición en Calendario desde las dos oficinas. El calendario se actualiza cada 30 segundos mientras esté visible.
7. En cada computadora, crea un acceso directo a esa misma dirección del panel usando Chrome o Edge, según la guía de Windows.

La configuración y reservas de una base local no se copian automáticamente a la central. Si existen datos operativos, conserva un respaldo y planifica su traslado; no crees bases independientes esperando sincronización. La reserva local de prueba puede eliminarse desde Calendario si no tiene pagos ni comisiones.

## Conectar el sitio actual

Para reemplazar el formulario antiguo en `www.missskycanopytour.com`, la persona con acceso a ese sitio debe cambiar **BOOK NOW** para abrir la página pública de esta aplicación, en su sección `#reservar`. Comparte la dirección publicada, nunca la de localhost ni la del panel privado. Si se desea un subdominio de la marca, también hace falta acceso a su configuración de dominio.

Hasta completar estas operaciones, el ZIP funciona como aplicación local; no existe una dirección pública compartida creada por esta actualización.
