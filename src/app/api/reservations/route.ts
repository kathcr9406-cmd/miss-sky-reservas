import { NextResponse } from "next/server";
import { reservationSchema } from "@/lib/validation";
import { createReservation, BookingError } from "@/lib/tours";
import { sameOrigin } from "@/lib/auth";

export async function POST(request: Request) {
  if (!sameOrigin(request))
    return NextResponse.json(
      { error: "Solicitud no permitida." },
      { status: 403 },
    );
  const input = reservationSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!input.success)
    return NextResponse.json(
      { error: input.error.issues[0].message },
      { status: 400 },
    );
  try {
    return NextResponse.json(await createReservation(input.data), {
      status: 201,
    });
  } catch (error) {
    if (error instanceof BookingError)
      return NextResponse.json({ error: error.message }, { status: 409 });
    return NextResponse.json(
      { error: "No se pudo registrar la reserva. Intenta de nuevo más tarde." },
      { status: 503 },
    );
  }
}
