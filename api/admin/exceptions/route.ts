import { NextRequest, NextResponse } from "next/server";
import { and, asc, eq, gte } from "drizzle-orm";
import { db } from "@/db";
import { dayExceptions, routes } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { moscowNow } from "@/lib/schedule";

async function getRouteId(): Promise<string | null> {
  const r = await db.select().from(routes).limit(1);
  return r[0]?.id ?? null;
}

export async function GET(req: NextRequest) {
  const user = await requireUser(["admin", "editor"], req);
  if (!user) return NextResponse.json({ error: "Нет доступа. Войдите снова." }, { status: 401 });
  const routeId = await getRouteId();
  if (!routeId) return NextResponse.json({ exceptions: [] });
  const url = new URL(req.url);
  const date = url.searchParams.get("date");
  const where = date
    ? and(eq(dayExceptions.routeId, routeId), eq(dayExceptions.date, date))
    : and(eq(dayExceptions.routeId, routeId), gte(dayExceptions.date, moscowNow().dateStr));
  const rows = await db.select().from(dayExceptions).where(where).orderBy(asc(dayExceptions.date), asc(dayExceptions.time)).limit(200);
  return NextResponse.json({ exceptions: rows.map((r) => ({ ...r, date: String(r.date) })) });
}

export async function POST(req: NextRequest) {
  const user = await requireUser(["admin", "editor"], req);
  if (!user) return NextResponse.json({ error: "Нет доступа. Войдите снова." }, { status: 401 });
  try {
    const body = await req.json();
    const { date, direction, time, status, note } = body;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ""))) return NextResponse.json({ error: "Дата в формате ГГГГ-ММ-ДД" }, { status: 400 });
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(time || ""))) return NextResponse.json({ error: "Время ЧЧ:ММ" }, { status: 400 });
    if (!["from_kingisepp", "from_spb"].includes(direction)) return NextResponse.json({ error: "Направление?" }, { status: 400 });
    if (!["cancelled", "added", "note"].includes(status)) return NextResponse.json({ error: "Статус?" }, { status: 400 });
    const routeId = await getRouteId();
    if (!routeId) return NextResponse.json({ error: "Маршрут не найден" }, { status: 404 });
    const [row] = await db
      .insert(dayExceptions)
      .values({ routeId, date, direction, time, status, note: String(note || "").slice(0, 256) })
      .returning();
    return NextResponse.json({ exception: { ...row, date: String(row.date) } });
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
  await db.delete(dayExceptions).where(eq(dayExceptions.id, id));
  return NextResponse.json({ ok: true });
}
