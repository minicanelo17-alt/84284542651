import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { routes, siteImages } from "@/db/schema";
import { requireUser } from "@/lib/auth";

const MAX_BYTES = 3 * 1024 * 1024; // 3 МБ
const ALLOWED_MIME = ["image/png", "image/jpeg", "image/webp", "image/gif"];

// Куда сразу применить картинку после загрузки
const APPLY_FIELDS: Record<string, "bannerImageUrl" | "heroImageUrl" | "coatKingiseppUrl" | "coatSpbUrl"> = {
  banner: "bannerImageUrl",
  hero: "heroImageUrl",
  coatK: "coatKingiseppUrl",
  coatS: "coatSpbUrl",
};

export async function POST(req: NextRequest) {
  const user = await requireUser(["admin", "editor"], req);
  if (!user) return NextResponse.json({ error: "Нет доступа. Войдите снова." }, { status: 401 });
  try {
    const form = await req.formData();
    const file = form.get("file");
    const apply = String(form.get("apply") || "");
    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "Прикрепите файл-картинку" }, { status: 400 });
    }
    const f = file as File;
    if (!ALLOWED_MIME.includes(f.type)) {
      return NextResponse.json({ error: "Только картинки: PNG, JPG, WEBP, GIF" }, { status: 400 });
    }
    if (f.size === 0) return NextResponse.json({ error: "Пустой файл" }, { status: 400 });
    if (f.size > MAX_BYTES) {
      return NextResponse.json({ error: "Файл больше 3 МБ — сожмите картинку и попробуйте снова" }, { status: 400 });
    }
    const buf = Buffer.from(await f.arrayBuffer());
    const [row] = await db
      .insert(siteImages)
      .values({ mime: f.type, size: f.size, data: buf.toString("base64") })
      .returning({ id: siteImages.id });
    const url = `/api/images/${row.id}`;

    let field: string | null = null;
    if (apply && APPLY_FIELDS[apply]) {
      field = APPLY_FIELDS[apply];
      const existing = await db.select().from(routes).limit(1);
      const current = existing[0];
      if (current) {
        // Удаляем старую загруженную картинку, чтобы не копился мусор
        const prev = String((current as Record<string, unknown>)[field] || "");
        if (prev.startsWith("/api/images/")) {
          const oldId = prev.replace("/api/images/", "");
          try {
            await db.delete(siteImages).where(eq(siteImages.id, oldId));
          } catch {
            /* ignore */
          }
        }
        await db
          .update(routes)
          .set({ [field]: url, updatedAt: new Date() })
          .where(eq(routes.id, current.id));
      }
    }
    return NextResponse.json({ ok: true, url, field });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Ошибка загрузки" }, { status: 500 });
  }
}
