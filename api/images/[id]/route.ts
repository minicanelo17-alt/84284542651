import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { siteImages } from "@/db/schema";

export const dynamic = "force-dynamic";

// Публичная отдача загруженных картинок (для пассажиров, без входа)
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{10,64}$/i.test(id)) {
    return new NextResponse("Not found", { status: 404 });
  }
  const rows = await db.select().from(siteImages).where(eq(siteImages.id, id)).limit(1);
  const img = rows[0];
  if (!img) return new NextResponse("Not found", { status: 404 });
  const buf = Buffer.from(img.data, "base64");
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": img.mime,
      "Content-Length": String(buf.length),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
