import { createHmac, timingSafeEqual, createHash } from "node:crypto";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "miss_sky_session";
export function authConfigured() {
  return Boolean(
    process.env.ADMIN_PASSWORD &&
    process.env.ADMIN_PASSWORD.length >= 12 &&
    process.env.SESSION_SECRET &&
    process.env.SESSION_SECRET.length >= 32,
  );
}
export function verifyPassword(password: string) {
  if (!authConfigured()) return false;
  return timingSafeEqual(
    createHash("sha256").update(password).digest(),
    createHash("sha256").update(process.env.ADMIN_PASSWORD!).digest(),
  );
}
export function createSession() {
  const expiry = String(Date.now() + 8 * 60 * 60 * 1000);
  const signature = createHmac("sha256", process.env.SESSION_SECRET!)
    .update(expiry)
    .digest("hex");
  return `${expiry}.${signature}`;
}
export async function authenticated() {
  if (!authConfigured()) return false;
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return false;
  const [expiry, signature] = token.split(".");
  if (
    !/^\d+$/.test(expiry) ||
    !/^[a-f0-9]{64}$/.test(signature ?? "") ||
    Number(expiry) <= Date.now()
  )
    return false;
  const expected = createHmac("sha256", process.env.SESSION_SECRET!)
    .update(expiry)
    .digest();
  return timingSafeEqual(expected, Buffer.from(signature, "hex"));
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return false;
  try {
    const parsed = new URL(origin);
    // Next.js may construct request.url with its internal bind hostname.
    // Host identifies the browser-facing destination, including its port.
    return (
      ["http:", "https:"].includes(parsed.protocol) &&
      parsed.origin === origin &&
      parsed.host === host
    );
  } catch {
    return false;
  }
}
