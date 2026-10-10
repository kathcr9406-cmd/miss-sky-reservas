import { NextResponse } from "next/server";
import { authenticated, sameOrigin } from "@/lib/auth";
import { settingsSchema } from "@/lib/validation";
import { db } from "@/lib/db";
import { randomUUID } from "node:crypto";

export async function PUT(request: Request) {
  if (!sameOrigin(request) || !(await authenticated()))
    return NextResponse.json(
      { error: "Acceso no autorizado." },
      { status: 401 },
    );
  const input = settingsSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!input.success)
    return NextResponse.json(
      {
        error:
          "Revisa la tarifa, los horarios, los días y los cupos. No repitas horas.",
      },
      { status: 400 },
    );
  const client = await db()
    .connect()
    .catch(() => null);
  if (!client)
    return NextResponse.json(
      { error: "No hay conexión con la base de datos." },
      { status: 503 },
    );
  try {
    await client.query("BEGIN");
    await client.query(
      "UPDATE tour_settings SET price_cents = $1, currency = $2, updated_at = now() WHERE id = true",
      [input.data.priceCents, input.data.currency],
    );
    // Keep historical schedule rows so existing reservations retain their references.
    await client.query("UPDATE tour_schedules SET active = false");
    for (const slot of input.data.schedules) {
      await client.query(
        `INSERT INTO tour_schedules (id,starts_at,capacity,weekdays,active) VALUES ($1,$2,$3,$4,$5)
        ON CONFLICT(starts_at) DO UPDATE SET capacity = EXCLUDED.capacity, weekdays = EXCLUDED.weekdays, active = EXCLUDED.active`,
        [
          randomUUID(),
          slot.startsAt,
          slot.capacity,
          slot.weekdays,
          slot.active,
        ],
      );
    }
    await client.query("COMMIT");
    return NextResponse.json({ ok: true });
  } catch {
    await client.query("ROLLBACK");
    return NextResponse.json(
      {
        error:
          "No se guardaron los cambios. Revisa los horarios e intenta de nuevo.",
      },
      { status: 409 },
    );
  } finally {
    client.release();
  }
}
