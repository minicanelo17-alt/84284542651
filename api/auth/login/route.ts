import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { SESSION_COOKIE, createSession, verifyPassword } from "@/lib/auth";
import { ensureDbReady } from "@/lib/init-db";

// Защита от подбора пароля: не больше 10 неудачных попыток за 10 минут с одного адреса
const attempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 10;
const WINDOW_MS = 10 * 60 * 1000;

function getClientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}

function isBlocked(ip: string): boolean {
  const rec = attempts.get(ip);
  if (!rec) return false;
  if (Date.now() > rec.resetAt) {
    attempts.delete(ip);
    return false;
  }
  return rec.count >= MAX_ATTEMPTS;
}

function registerFailure(ip: string) {
  const now = Date.now();
  const rec = attempts.get(ip);
  if (!rec || now > rec.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
  } else {
    rec.count += 1;
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureDbReady();
    const ip = getClientIp(req);
    if (isBlocked(ip)) {
      return NextResponse.json(
        { error: "Слишком много неудачных попыток. Подождите 10 минут и попробуйте снова." },
        { status: 429 }
      );
    }
    const { login, password } = await req.json();
    if (!login || !password) {
      return NextResponse.json({ error: "Введите логин и пароль" }, { status: 400 });
    }
    const rows = await db.select().from(users).where(eq(users.login, String(login).trim())).limit(1);
    const user = rows[0];
    if (!user || !user.isActive) {
      registerFailure(ip);
      return NextResponse.json({ error: "Неверный логин или пароль" }, { status: 401 });
    }
    const ok = await verifyPassword(String(password), user.passwordHash);
    if (!ok) {
      registerFailure(ip);
      return NextResponse.json({ error: "Неверный логин или пароль" }, { status: 401 });
    }
    attempts.delete(ip);
    const { token, expiresAt } = await createSession(user.id);
    const res = NextResponse.json({
      ok: true,
      token,
      user: { id: user.id, login: user.login, name: user.name, role: user.role },
    });
    // Cookie ставим явно на ответе. secure:false — чтобы вход работал и по http,
    // и по https, и внутри предпросмотра. Дополнительно токен дублируется
    // в localStorage на клиенте и шлётся заголовком Authorization.
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      expires: expiresAt,
      secure: false,
    });
    return res;
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Ошибка входа" }, { status: 500 });
  }
}
