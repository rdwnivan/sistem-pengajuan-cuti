import { prisma } from "@/lib/prisma";
import { userDariSesi } from "@/lib/auth";
import { delegasiAktifUntuk } from "@/lib/cron";
import { bacaLampiranPrivat } from "@/lib/lampiran";
import { sniffFile } from "@/lib/upload";

export async function GET(_req: Request, { params }: { params: Promise<{ jenis: string; id: string }> }) {
  const user = await userDariSesi();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { jenis, id } = await params;
  let reference: string | null = null;
  if (jenis === "cuti") {
    const record = await prisma.pengajuan.findUnique({ where: { id }, include: { pemohon: { select: { atasanId: true } } } });
    if (!record) return new Response(null, { status: 404 });
    const atasanId = record.pemohon.atasanId;
    const delegate = atasanId ? await delegasiAktifUntuk(atasanId) : null;
    if (record.pemohonId !== user.id && user.role !== "HR_ADMIN" && atasanId !== user.id && delegate !== user.id && record.eskalasiKeId !== user.id) return new Response(null, { status: 404 });
    reference = record.lampiranPath;
  } else if (jenis === "laporan" || jenis === "foto") {
    const photo = jenis === "foto" ? await prisma.laporanFoto.findUnique({ where: { id }, include: { laporan: true } }) : null;
    const record = jenis === "foto" ? photo?.laporan : await prisma.laporanLapangan.findUnique({ where: { id } });
    if (!record || (record.pembuatId !== user.id && record.approverId !== user.id)) return new Response(null, { status: 404 });
    reference = jenis === "foto" ? photo!.path : record.lampiranPath;
  } else return new Response(null, { status: 404 });
  if (!reference) return new Response(null, { status: 404 });
  try {
    const bytes = await bacaLampiranPrivat(reference);
    if (!bytes) return new Response(null, { status: 404 });
    const safe = await sniffFile(new File([new Uint8Array(bytes)], "lampiran"));
    return new Response(new Uint8Array(safe.buffer), { headers: {
      "Content-Type": safe.mime,
      "Content-Disposition": `inline; filename="lampiran.${safe.ext}"`,
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    } });
  } catch {
    console.error("[LAMPIRAN-BACA-GAGAL]", { jenis, id });
    return Response.json({ error: "Lampiran belum dapat dibaca" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
