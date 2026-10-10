# Miss Sky Reservas: descargar, actualizar y crear el acceso directo

Esta versión incluye el logo oficial, adultos y niños por salida, una salida extra activada por fecha, pagos recibidos, empresas y personas con comisión del 10 %, gastos y reportes mensuales para Excel.

## Si ya usabas el programa en esta computadora

1. No borres la carpeta original, `.env.local`, ni los datos de Docker.
2. Detén solamente la ventana del programa con Ctrl+C. Deja Docker abierto.
3. Descarga el ZIP actualizado: https://github.com/kathcr9406-cmd/miss-sky-reservas/archive/refs/heads/main.zip
4. Extrae el ZIP en otra carpeta. Copia su contenido a tu carpeta ORIGINAL, la que ya tiene `.env.local` y `package.json`. Acepta reemplazar los archivos del programa. El ZIP no contiene `.env.local` ni la base de datos.
5. Abre la carpeta original en el Explorador, escribe `cmd` en su barra de dirección y presiona Enter.
6. Ejecuta UNA vez, una línea a la vez:

```
npm ci
npm run escritorio
npm run abrir
```

Se creará **Miss Sky Reservas** en el escritorio. Después usa doble clic en ese acceso directo. La primera apertura aplica la actualización de tablas conservando reservas, clientes, tarifas y horarios. Si el sistema ya estaba abierto, abre el panel existente.

La contraseña sigue siendo la que usabas. Conserva el archivo `.env.local` privado. El acceso directo depende de la carpeta: no la muevas después de crearlo; si la mueves, ejecuta `npm run escritorio` desde la nueva ubicación.

El lanzador requiere Node.js 24 o posterior y Docker Desktop con WSL ya configurados para la base local. No desactiva las protecciones de Windows. Se ha revisado su sintaxis; su funcionamiento con accesos directos debe comprobarse en Windows.

## Para la computadora del canopy y la de administración

Las dos deben abrir **el mismo sistema central**. No crees una base local independiente en cada equipo si necesitas ver las mismas reservas.

- En lugares diferentes: se necesita una aplicación publicada por HTTPS y una base PostgreSQL central persistente. Luego ambas computadoras usan su misma dirección `/admin`. No necesitan Node ni Docker como clientes.
- En la misma red: pueden acceder a un servidor central de la oficina, que debe permanecer encendido. Primero configura su dirección, la red y el acceso del firewall. Las reservas públicas por internet requieren publicación aparte.

Cuando exista la dirección real del sistema central, crea un acceso directo desde Chrome: abre el panel, menú de tres puntos → **Transmitir, guardar y compartir → Crear acceso directo** (el nombre puede variar según la versión). En Edge puedes usar **Aplicaciones → Instalar este sitio como una aplicación**. Este acceso abre el mismo sistema en ambas computadoras.

También está disponible `npm run escritorio -- DIRECCION_HTTPS_REAL_DEL_PANEL` en equipos con Node y esta carpeta: crea un acceso web sin instalar otra base. Sustituye la dirección por la real; no ejecutes literalmente el marcador.

**Esta descarga no publica la aplicación en internet ni reemplaza el formulario de missskycanopytour.com.** Eso requiere un alojamiento para la aplicación/base de datos y, para cambiar BOOK NOW, acceso al sitio actual.

## Dónde encontrar las nuevas funciones

- **Configuración:** tarifa, horario, cupo total, máximo de adultos y máximo de niños. Campos de máximos en blanco usan el cupo total; cero impide nuevas reservas de esa categoría.
- Para un tercer tour, agrega su horario REAL y marca **Salida extra**. En **Calendario**, elige la fecha y pulsa **Activar salida extra**. El precio sigue siendo la tarifa general del Canopy Tour. No se inventaron precios ni horarios.
- **Calendario:** todas las reservas de la fecha seleccionada, incluso si tienes más de 200 registros. Permite consultar fechas anteriores y actualiza nuevas reservas cada 30 segundos mientras la pestaña está visible.
- **Pagos y reportes:** registra empresas o personas y un código de referencia. El cliente puede usarlo al reservar, o el personal asignarlo a una reserva existente. La comisión es el 10 % del total de la reserva, redondeada al centavo, y empieza pendiente.
- **Pago recibido:** registra pagos realmente recibidos. La moneda se toma de la reserva y no se permite superar su saldo.
- **Gasto pagado:** salarios, insumos, proveedores, mantenimiento, servicios y otros.
- **Pagar comisión:** descuenta del saldo pendiente y queda como un gasto de comisiones, contado una sola vez.
- **Reporte mensual:** selecciona el mes para ver ingresos cobrados, gastos pagados, saldo y comisiones, con USD y CRC separados. Descarga el CSV para Excel. No es una declaración fiscal ni un estado contable de devengo.
- **Anular registro:** corrige pagos o gastos con motivo obligatorio, sin borrar el historial. No realiza un reembolso bancario.
- **Desglose de participantes:** clasifica reservas antiguas que solo guardaban el total. Mientras estén sin desglose, sus participantes cuentan contra ambos máximos para evitar sobreventa. No se inventa la cantidad de niños de reservas pasadas.

La aplicación no cobra tarjetas ni envía correos automáticamente. El panel sigue usando una contraseña compartida; no hay cuentas individuales ni permisos separados.

## Eliminar la reserva de prueba inicial

En **Calendario**, selecciona su fecha, busca su código y pulsa **Eliminar reserva de prueba**. El mensaje muestra el cliente, código, fecha y personas antes de eliminarla. Solo permite reservas sin registros de pagos ni comisiones. Los movimientos financieros requieren corrección con historial, no borrado.
