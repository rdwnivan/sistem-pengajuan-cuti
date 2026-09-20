import { prisma } from "@/lib/prisma";
import { userDariSesi } from "@/lib/auth";
import { fmtTgl } from "@/lib/cuti";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await userDariSesi();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const p = await prisma.pengajuan.findUnique({ where: { id: params.id }, include: { pemohon: true, jenis: true } });
  if (!p) return Response.json({ error: "Tidak ditemukan" }, { status: 404 });
  const allowed = p.pemohonId === user.id || user.role === "HR_ADMIN" || p.pemohon.atasanId === user.id;
  if (!allowed) return Response.json({ error: "Forbidden" }, { status: 403 });
  if (p.status !== "DISETUJUI") return Response.json({ error: "Formulir hanya untuk pengajuan DISETUJUI" }, { status: 400 });

  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([595, 842]);
  let y = 800;
  const T = (t: string, size = 11, f = font) => { page.drawText(t.slice(0, 90), { x: 50, y, size, font: f }); y -= size + 6; };
  T("FORMULIR PERMOHONAN CUTI - ANIME JAPAN", 14, bold);
  T(`Status: DISETUJUI`, 11, bold);
  y -= 6;
  T(`Nama: ${p.pemohon.nama}`);
  T(`Email: ${p.pemohon.email}`);
  T(`Jabatan: ${p.pemohon.jabatan ?? "-"}`);
  T(`Jenis cuti: ${p.jenis.nama}`);
  T(`Tanggal: ${fmtTgl(p.tglMulai)} s/d ${fmtTgl(p.tglSelesai)} (${p.jumlahHariKerja} hari kerja)`);
  T(`Alasan: ${p.alasan.slice(0, 80)}`);
  T(`PIC Pengganti: ${p.picPengganti ?? "-"}`);
  T(`Kontak: ${p.kontakSelamaCuti ?? "-"}`);
  T(`Catatan approver: ${(p.catatanApprover ?? "-").slice(0, 80)}`);
  y -= 10;
  T("Cuti sah karena berstatus DISETUJUI.", 10, bold);
  y -= 20;
  T("Palangka Raya, ........................", 11);
  y -= 30;
  T("Pemohon                                      HR / Atasan", 11);
  page.drawText("Dicetak dari Sistem Pengajuan Cuti Online", { x: 50, y: 40, size: 8, font, color: rgb(0.4, 0.4, 0.4) });
  const bytes = await doc.save();
  return new Response(bytes as unknown as BodyInit, {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="formulir-cuti-${p.id.slice(0, 8)}.pdf"` },
  });
}
