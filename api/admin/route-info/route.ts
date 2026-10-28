import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { routes } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { eq } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const user = await requireUser(["admin", "editor"], req);
  if (!user) return NextResponse.json({ error: "Нет доступа. Войдите снова." }, { status: 401 });
  const rows = await db.select().from(routes).limit(1);
  return NextResponse.json({ route: rows[0] || null });
}

export async function PUT(req: NextRequest) {
  const user = await requireUser(["admin", "editor"], req);
  if (!user) return NextResponse.json({ error: "Нет доступа. Войдите снова." }, { status: 401 });
  try {
    const body = await req.json();
    const rows = await db.select().from(routes).limit(1);
    const current = rows[0];
    if (!current) return NextResponse.json({ error: "Маршрут не найден" }, { status: 404 });
    const allowed = [
      "number", "carrier", "fromCity", "toCity", "fromAddress", "toAddress",
      "dispatcherPhone", "dispatcherPhoneHref", "bookingUrl", "bookingLabel",
      "vkUrl", "vkLabel", "maxUrl", "appealEmail", "heroImageUrl", "bannerImageUrl",
      "coatKingiseppUrl", "coatSpbUrl",
    ] as const;
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    for (const k of allowed) {
      if (typeof body[k] === "string") patch[k] = body[k].slice(0, 512);
    }
    const [row] = await db.update(routes).set(patch).where(eq(routes.id, current.id)).returning();
    return NextResponse.json({ route: row });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Ошибка сохранения" }, { status: 500 });
  }
}
