import { NextResponse } from "next/server";
import {
  authConfigured,
  verifyPassword,
  createSession,
  SESSION_COOKIE,
  sameOrigin,
} from "@/lib/auth";

// Single-instance guard. Use a shared rate limiter before scaling to multiple instances.
const attempts = new Map<string, { count: number; expires: number }>();
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return NextResponse.json(
      { error: "Solicitud no permitida." },
      { status: 403 },
    );
  if (!authConfigured())
    return NextResponse.json(
      { error: "El acceso del personal está pendiente de configuración." },
      { status: 503 },
    );
  const key = "staff";
  const recent = attempts.get(key);
  if (recent && recent.expires > Date.now() && recent.count >= 8)
    return NextResponse.json(
      { error: "Demasiados intentos. Intenta en 15 minutos." },
      { status: 429 },
    );
  const body = await request.json().catch(() => null);
  if (
    typeof body?.password !== "string" ||
    body.password.length > 200 ||
    !verifyPassword(body.password)
  ) {
    attempts.set(key, {
      count: recent && recent.expires > Date.now() ? recent.count + 1 : 1,
      expires:
        recent && recent.expires > Date.now()
          ? recent.expires
          : Date.now() + 900000,
    });
    return NextResponse.json(
      { error: "La contraseña no es correcta." },
      { status: 401 },
    );
  }
  attempts.delete(key);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, createSession(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 28800,
    path: "/",
  });
  return response;
}
