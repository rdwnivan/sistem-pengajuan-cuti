import { NextRequest } from "next/server";
import { jalankanReminderEskalasi } from "@/lib/cron";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const q = req.nextUrl.searchParams.get("secret");
  if (!secret) return Response.json({ error: "CRON_SECRET belum dikonfigurasi" }, { status: 500 });
  if (q !== secret) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const hasil = await jalankanReminderEskalasi();
  return Response.json({ ok: true, ...hasil });
}

export async function POST(req: NextRequest) {
  return GET(req);
}
