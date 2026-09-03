import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

const COOKIE = "lc_admin";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 ngày

function secret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) {
    throw new Error("AUTH_SECRET chưa đặt (>= 16 ký tự) trong .env.local");
  }
  return new TextEncoder().encode(s);
}

export function verifyCredentials(user: string, pass: string): boolean {
  const u = process.env.ADMIN_USER || "admin";
  const p = process.env.ADMIN_PASSWORD || "";
  if (!p) return false;
  return timingSafeEqual(user, u) && timingSafeEqual(pass, p);
}

export async function createSession(): Promise<string> {
  return new SignJWT({ role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject("admin")
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());
}

/** Dùng trong middleware (Edge) — verify raw token string. */
export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  try {
    await jwtVerify(token, secret());
    return true;
  } catch {
    return false;
  }
}

/** Dùng trong Server Component / Route Handler. */
export async function getSession(): Promise<boolean> {
  const token = (await cookies()).get(COOKIE)?.value;
  return verifySessionToken(token);
}

export async function setSessionCookie(token: string): Promise<void> {
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function clearSessionCookie(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

export const SESSION_COOKIE = COOKIE;

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}
