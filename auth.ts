import { scrypt, randomBytes, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { NextRequest } from "next/server";
import { cookies, headers } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";

const scryptAsync = promisify(scrypt);
export const SESSION_COOKIE = "atp_session";
const SESSION_DAYS = 14;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    const [salt, key] = hash.split(":");
    if (!salt || !key) return false;
    const derived = (await scryptAsync(password, salt, 64)) as Buffer;
    const expected = Buffer.from(key, "hex");
    if (derived.length !== expected.length) return false;
    return timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

export function generateToken(): string {
  return randomBytes(32).toString("hex");
}

/** Создаёт сессию в БД. Cookie на ответ ставит сам route-handler. */
export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.insert(sessions).values({ userId, token, expiresAt });
  return { token, expiresAt };
}

export async function deleteSessionByToken(token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.token, token));
}

function bearerFromHeader(auth: string | null): string | null {
  if (auth && auth.toLowerCase().startsWith("bearer ")) {
    const t = auth.slice(7).trim();
    if (t) return t;
  }
  return null;
}

/**
 * Достаём токен сессии. Сначала — напрямую из запроса (надёжнее всего),
 * затем запасные варианты через next/headers.
 * 1) cookie atp_session
 * 2) заголовок Authorization: Bearer <token>
 * 3) дублирующий заголовок x-atp-token (на случай, если прокси режет Authorization)
 */
export async function getRequestToken(req?: NextRequest): Promise<string | null> {
  if (req) {
    try {
      const fromCookie = req.cookies.get(SESSION_COOKIE)?.value;
      if (fromCookie) return fromCookie;
    } catch {
      /* ignore */
    }
    try {
      const t = bearerFromHeader(req.headers.get("authorization")) || req.headers.get("x-atp-token")?.trim();
      if (t) return t;
    } catch {
      /* ignore */
    }
  }
  try {
    const jar = await cookies();
    const fromCookie = jar.get(SESSION_COOKIE)?.value;
    if (fromCookie) return fromCookie;
  } catch {
    /* ignore */
  }
  try {
    const h = await headers();
    const t = bearerFromHeader(h.get("authorization")) || h.get("x-atp-token")?.trim();
    if (t) return t;
  } catch {
    /* ignore */
  }
  return null;
}

export async function getUserByToken(token: string) {
  const rows = await db
    .select({
      sessionId: sessions.id,
      expiresAt: sessions.expiresAt,
      userId: users.id,
      login: users.login,
      name: users.name,
      role: users.role,
      isActive: users.isActive,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.token, token))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  if (!row.isActive) return null;
  if (new Date(row.expiresAt).getTime() < Date.now()) {
    await db.delete(sessions).where(eq(sessions.token, token));
    return null;
  }
  return { id: row.userId, login: row.login, name: row.name, role: row.role as string };
}

export async function getSessionUser(req?: NextRequest) {
  const token = await getRequestToken(req);
  if (!token) return null;
  return getUserByToken(token);
}

export async function requireUser(roles?: string[], req?: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return null;
  if (roles && roles.length > 0 && !roles.includes(user.role)) return null;
  return user;
}
