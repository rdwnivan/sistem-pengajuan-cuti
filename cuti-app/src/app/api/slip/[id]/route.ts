import { prisma } from "@/lib/prisma";
import { userDariSesi } from "@/lib/auth";
import { teksAman } from "@/lib/pdf";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await userDariSesi();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const s = await prisma.slipGaji.findUnique({ where: { id: params.id }, include: { user: true } });
  if (!s) return Response.json({ error: "Tidak ditemukan" }, { status: 404 });
  const allowed = s.userId === user.id || user.role === "HR_ADMIN";
  if (!allowed) return Response.json({ error: "Forbidden" }, { status: 403 });
  if (s.status !== "TERBIT") return Response.json({ error: "Slip belum diterbitkan" }, { status: 400 });

  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([595, 842]);
  let y = 780;
  const T = (t: string, size = 11, f = font) => { page.drawText(teksAman(t.slice(0, 90)), { x: 50, y, size, font: f }); y -= size + 5; };

  T("SLIP GAJI — PT ANIME JAPAN", 14, bold);
  T(`Status: ${s.status}`, 11, bold); y -= 8;
  T(`Periode: ${s.tahun} - ${s.bulan}`);
  T(`Karyawan: ${s.user.nama}`);
  T(`Email: ${s.user.email}`);
  T(`Jabatan: ${s.user.jabatan ?? "-"}`);
  T(`Periode: ${s.tahun} - ${s.bulan}`);
  T(`Gaji Pokok: Rp ${s.gajiPokok.toLocaleString("id-ID")}`);
  T(`Tunjangan: Rp ${s.tunjangan.toLocaleString("id-ID")}`);
  T(`Potongan: Rp ${s.potongan.toLocaleString("id-ID")}`);
  T(`GAJI BERSIH: Rp ${s.gajiBersih.toLocaleString("id-ID")}`, 12, bold); y -= 4;
  if (s.catatan) T(`Catatan: ${s.catatan}`);
  y -= 10;
  T("Slip ini bersifat rahasia. Jangan dibagikan ke siapa pun.", 9, bold);
  y -= 20;
  T("Diterbitkan oleh HR", 11);

  const bytes = await doc.save();
  return new Response(bytes as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="slip-gaji-${s.userId}-${s.tahun}-${String(s.bulan).padStart(2, "0")}.pdf"`,
    },
  });
}
