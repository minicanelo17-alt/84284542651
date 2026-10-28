import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { hashPassword, requireUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const user = await requireUser(["admin"], req);
  if (!user) return NextResponse.json({ error: "Только для администратора. Войдите снова." }, { status: 403 });
  const rows = await db.select({ id: users.id, login: users.login, name: users.name, role: users.role, isActive: users.isActive, createdAt: users.createdAt }).from(users);
  return NextResponse.json({ users: rows });
}

export async function POST(req: NextRequest) {
  const me = await requireUser(["admin"], req);
  if (!me) return NextResponse.json({ error: "Только для администратора. Войдите снова." }, { status: 403 });
  try {
    const body = await req.json();
    const { login, name, password, role } = body;
    if (!String(login || "").trim() || !String(password || "") || !String(name || "").trim()) {
      return NextResponse.json({ error: "Заполните логин, имя и пароль" }, { status: 400 });
    }
    if (String(password).length < 6) return NextResponse.json({ error: "Пароль минимум 6 символов" }, { status: 400 });
    const passwordHash = await hashPassword(String(password));
    const [row] = await db
      .insert(users)
      .values({
        login: String(login).trim(),
        name: String(name).trim().slice(0, 128),
        passwordHash,
        role: role === "admin" ? "admin" : "editor",
      })
      .returning({ id: users.id, login: users.login, name: users.name, role: users.role });
    return NextResponse.json({ user: row });
  } catch (e: unknown) {
    console.error(e);
    const msg = String((e as Error)?.message || "");
    if (msg.includes("unique") || msg.includes("duplicate")) {
      return NextResponse.json({ error: "Такой логин уже занят" }, { status: 400 });
    }
    return NextResponse.json({ error: "Ошибка создания" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const me = await requireUser(["admin"], req);
  if (!me) return NextResponse.json({ error: "Только для администратора. Войдите снова." }, { status: 403 });
  try {
    const body = await req.json();
    const { id, name, role, isActive, password } = body;
    if (!id) return NextResponse.json({ error: "Нет id" }, { status: 400 });
    const patch: Record<string, unknown> = {};
    if (typeof name === "string") patch.name = name.slice(0, 128);
    if (role === "admin" || role === "editor") patch.role = role;
    if (typeof isActive === "boolean") patch.isActive = isActive;
    if (typeof password === "string" && password.length > 0) {
      if (password.length < 6) return NextResponse.json({ error: "Пароль минимум 6 символов" }, { status: 400 });
      patch.passwordHash = await hashPassword(password);
    }
    await db.update(users).set(patch).where(eq(users.id, id));
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Ошибка" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const me = await requireUser(["admin"], req);
  if (!me) return NextResponse.json({ error: "Только для администратора. Войдите снова." }, { status: 403 });
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Нет id" }, { status: 400 });
  if (id === me.id) return NextResponse.json({ error: "Нельзя удалить себя" }, { status: 400 });
  await db.delete(users).where(eq(users.id, id));
  return NextResponse.json({ ok: true });
}
