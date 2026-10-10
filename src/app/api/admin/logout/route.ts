import { NextResponse } from "next/server";
import { SESSION_COOKIE, sameOrigin } from "@/lib/auth";

export async function POST(request: Request) {
  if (!sameOrigin(request))
    return NextResponse.json(
      { error: "Solicitud no permitida." },
      { status: 403 },
    );
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", { maxAge: 0, path: "/" });
  return response;
}
