import { NextRequest, NextResponse } from "next/server";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { announcements, dayExceptions, departures, routes } from "@/db/schema";
import { moscowNow } from "@/lib/schedule";
import { ensureDbReady } from "@/lib/init-db";

export const dynamic = "force-dynamic";

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  await ensureDbReady();
  const now = moscowNow();
  const url = new URL(req.url);
  const dateParam = url.searchParams.get("date") || now.dateStr;

  const routeRows = await db.select().from(routes).limit(1);
  let route = routeRows[0];
  if (!route) {
    return NextResponse.json({ error: "Маршрут не настроен" }, { status: 404 });
  }

  const deps = await db
    .select()
    .from(departures)
    .where(eq(departures.routeId, route.id))
    .orderBy(asc(departures.time));

  const exc = await db
    .select()
    .from(dayExceptions)
    .where(and(eq(dayExceptions.routeId, route.id), eq(dayExceptions.date, dateParam)));

  const todayStr = now.dateStr;
  const allAnn = await db
    .select()
    .from(announcements)
    .where(eq(announcements.isActive, true))
    .orderBy(desc(announcements.createdAt));
  const ann = allAnn.filter((a) => {
    const s = a.startsAt ? String(a.startsAt) : null;
    const e = a.endsAt ? String(a.endsAt) : null;
    if (s && s > todayStr) return false;
    if (e && e < todayStr) return false;
    return true;
  });

  // weekday for requested date (0=Sun)
  const weekday = new Date(`${dateParam}T12:00:00Z`).getUTCDay();

  return NextResponse.json(
    {
      route,
      departures: deps,
      exceptions: exc.map((x) => ({ ...x, date: String(x.date) })),
      announcements: ann.map((a) => ({
        ...a,
        startsAt: a.startsAt ? String(a.startsAt) : null,
        endsAt: a.endsAt ? String(a.endsAt) : null,
      })),
      date: dateParam,
      weekday,
      serverNow: { ...now, iso: new Date().toISOString(), todayStr: toDateStr(new Date()) },
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
