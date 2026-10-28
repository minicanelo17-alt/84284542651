import { NextRequest, NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { departures, routes } from "@/db/schema";
import { requireUser } from "@/lib/auth";

async function getRouteId(): Promise<string | null> {
  const r = await db.select().from(routes).limit(1);
  return r[0]?.id ?? null;
}

function validTime(t: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
}

export async function GET(req: NextRequest) {
  const user = await requireUser(["admin", "editor"], req);
  if (!user) return NextResponse.json({ error: "Нет доступа. Войдите снова." }, { status: 401 });
  const routeId = await getRouteId();
  if (!routeId) return NextResponse.json({ departures: [] });
  const rows = await db
    .select()
    .from(departures)
    .where(eq(departures.routeId, routeId))
    .orderBy(asc(departures.direction), asc(departures.time));
  return NextResponse.json({ departures: rows });
}

export async function POST(req: NextRequest) {
  const user = await requireUser(["admin", "editor"], req);
  if (!user) return NextResponse.json({ error: "Нет доступа. Войдите снова." }, { status: 401 });
  try {
    const body = await req.json();
    const { direction, time, daysOfWeek, note, isActive } = body;
    if (!["from_kingisepp", "from_spb"].includes(direction)) {
      return NextResponse.json({ error: "Неверное направление" }, { status: 400 });
    }
    if (!validTime(time)) return NextResponse.json({ error: "Время в формате ЧЧ:ММ" }, { status: 400 });
    const routeId = await getRouteId();
    if (!routeId) return NextResponse.json({ error: "Маршрут не найден" }, { status: 404 });
    const days = Array.isArray(daysOfWeek) && daysOfWeek.length ? daysOfWeek.map(Number).filter((n: number) => n >= 0 && n <= 6) : [0, 1, 2, 3, 4, 5, 6];
    const [row] = await db
      .insert(departures)
      .values({ routeId, direction, time, daysOfWeek: days, note: String(note || "").slice(0, 256), isActive: isActive !== false })
      .returning();
    return NextResponse.json({ departure: row });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Ошибка создания" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const user = await requireUser(["admin", "editor"], req);
  if (!user) return NextResponse.json({ error: "Нет доступа. Войдите снова." }, { status: 401 });
  try {
    const body = await req.json();
    const { id, direction, time, daysOfWeek, note, isActive } = body;
    if (!id) return NextResponse.json({ error: "Нет id" }, { status: 400 });
    if (time && !validTime(time)) return NextResponse.json({ error: "Время в формате ЧЧ:ММ" }, { status: 400 });
    const patch: Record<string, unknown> = {};
    if (direction) patch.direction = direction;
    if (time) patch.time = time;
    if (Array.isArray(daysOfWeek)) patch.daysOfWeek = daysOfWeek.map(Number).filter((n: number) => n >= 0 && n <= 6);
    if (typeof note === "string") patch.note = note.slice(0, 256);
    if (typeof isActive === "boolean") patch.isActive = isActive;
    const [row] = await db.update(departures).set(patch).where(eq(departures.id, id)).returning();
    if (!row) return NextResponse.json({ error: "Не найдено" }, { status: 404 });
    return NextResponse.json({ departure: row });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Ошибка обновления" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const user = await requireUser(["admin", "editor"], req);
  if (!user) return NextResponse.json({ error: "Нет доступа. Войдите снова." }, { status: 401 });
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Нет id" }, { status: 400 });
  await db.delete(departures).where(and(eq(departures.id, id)));
  return NextResponse.json({ ok: true });
}
