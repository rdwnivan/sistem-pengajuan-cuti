import { NextRequest } from "next/server";
import { jalankanReminderEskalasi } from "@/lib/cron";
import { samaAman } from "@/lib/aman-sama";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const q = req.nextUrl.searchParams.get("secret");
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!secret) return Response.json({ error: "CRON_SECRET belum dikonfigurasi" }, { status: 500 });
  // Perbandingan constant-time: waktu eksekusi tidak boleh membocorkan berapa
  // karakter prefix secret yang sudah benar (lihat src/lib/aman-sama.ts).
  if (!samaAman(q, secret) && !samaAman(bearer, secret)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const hasil = await jalankanReminderEskalasi();
  return Response.json({ ok: true, ...hasil });
}

export async function POST(req: NextRequest) {
  return GET(req);
}
