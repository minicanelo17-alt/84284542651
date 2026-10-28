import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { announcements, routes } from "@/db/schema";
import { requireUser } from "@/lib/auth";

async function getRouteId(): Promise<string | null> {
  const r = await db.select().from(routes).limit(1);
  return r[0]?.id ?? null;
}

export async function GET(req: NextRequest) {
  const user = await requireUser(["admin", "editor"], req);
  if (!user) return NextResponse.json({ error: "Нет доступа. Войдите снова." }, { status: 401 });
  const rows = await db.select().from(announcements).orderBy(desc(announcements.createdAt)).limit(100);
  return NextResponse.json({
    announcements: rows.map((r) => ({ ...r, startsAt: r.startsAt ? String(r.startsAt) : null, endsAt: r.endsAt ? String(r.endsAt) : null })),
  });
}

export async function POST(req: NextRequest) {
  const user = await requireUser(["admin", "editor"], req);
  if (!user) return NextResponse.json({ error: "Нет доступа. Войдите снова." }, { status: 401 });
  try {
    const body = await req.json();
    const { title, body: text, level, isActive, startsAt, endsAt } = body;
    if (!String(title || "").trim()) return NextResponse.json({ error: "Введите заголовок" }, { status: 400 });
    const routeId = await getRouteId();
    const [row] = await db
      .insert(announcements)
      .values({
        routeId,
        title: String(title).slice(0, 256),
        body: String(text || "").slice(0, 4000),
        level: ["info", "warning", "important"].includes(level) ? level : "info",
        isActive: isActive !== false,
        startsAt: startsAt || null,
        endsAt: endsAt || null,
      })
      .returning();
    return NextResponse.json({ announcement: row });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Ошибка" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const user = await requireUser(["admin", "editor"], req);
  if (!user) return NextResponse.json({ error: "Нет доступа. Войдите снова." }, { status: 401 });
  try {
    const body = await req.json();
    const { id, title, body: text, level, isActive, startsAt, endsAt } = body;
    if (!id) return NextResponse.json({ error: "Нет id" }, { status: 400 });
    const patch: Record<string, unknown> = {};
    if (typeof title === "string") patch.title = title.slice(0, 256);
    if (typeof text === "string") patch.body = text.slice(0, 4000);
    if (level) patch.level = level;
    if (typeof isActive === "boolean") patch.isActive = isActive;
    patch.startsAt = startsAt || null;
    patch.endsAt = endsAt || null;
    const [row] = await db.update(announcements).set(patch).where(eq(announcements.id, id)).returning();
    return NextResponse.json({ announcement: row });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Ошибка" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const user = await requireUser(["admin", "editor"], req);
  if (!user) return NextResponse.json({ error: "Нет доступа. Войдите снова." }, { status: 401 });
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Нет id" }, { status: 400 });
  await db.delete(announcements).where(eq(announcements.id, id));
  return NextResponse.json({ ok: true });
}
