import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, deleteSessionByToken, getRequestToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const token = await getRequestToken(req);
  if (token) {
    try {
      await deleteSessionByToken(token);
    } catch {
      /* ignore */
    }
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
