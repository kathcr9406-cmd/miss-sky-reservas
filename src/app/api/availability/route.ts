import { NextResponse } from "next/server";
import { dateSchema } from "@/lib/validation";
import { getAvailability } from "@/lib/tours";

export async function GET(request: Request) {
  const date = dateSchema.safeParse(
    new URL(request.url).searchParams.get("date"),
  );
  if (!date.success)
    return NextResponse.json(
      { error: "Selecciona una fecha válida." },
      { status: 400 },
    );
  try {
    return NextResponse.json(await getAvailability(date.data), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      { error: "No podemos consultar los cupos ahora. Intenta de nuevo." },
      { status: 503 },
    );
  }
}
