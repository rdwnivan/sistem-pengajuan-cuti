import { prisma } from "@/lib/prisma";
import { userDariSesi } from "@/lib/auth";
import { namaBulan, teksAman, tglWib } from "@/lib/pdf";

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

  T("SLIP GAJI - PT ANIME JAPAN", 14, bold);
  T(`Status: ${s.status}`, 11, bold); y -= 8;
  T(`Periode: ${namaBulan(s.bulan)} ${s.tahun}`);
  T(`Karyawan: ${s.user.nama}`);
  T(`NIP: ${s.user.nip ?? "-"}`);
  T(`Email: ${s.user.email}`);
  T(`Jabatan: ${s.user.jabatan ?? "-"}`);
  y -= 4;
  T("PENGHASILAN", 11, bold);
  T(`Gaji Pokok: Rp ${s.gajiPokok.toLocaleString("id-ID")}`);
  T(`Tunjangan Jabatan: Rp ${s.tunjanganJabatan.toLocaleString("id-ID")}`);
  T(`Tunjangan Transport: Rp ${s.tunjanganTransport.toLocaleString("id-ID")}`);
  T(`Tunjangan Makan: Rp ${s.tunjanganMakan.toLocaleString("id-ID")}`);
  T(`Lembur: Rp ${s.lembur.toLocaleString("id-ID")}`);
  T(`Bonus: Rp ${s.bonus.toLocaleString("id-ID")}`);
  y -= 4;
  T("POTONGAN", 11, bold);
  T(`PPh 21: Rp ${s.pph21.toLocaleString("id-ID")}`);
  T(`BPJS Kesehatan: Rp ${s.bpjsKesehatan.toLocaleString("id-ID")}`);
  T(`BPJS Ketenagakerjaan: Rp ${s.bpjsKetenagakerjaan.toLocaleString("id-ID")}`);
  T(`Potongan Lain: Rp ${s.potonganLain.toLocaleString("id-ID")}`);
  y -= 4;
  T(`GAJI BERSIH: Rp ${s.gajiBersih.toLocaleString("id-ID")}`, 12, bold); y -= 4;
  if (s.catatan) T(`Catatan: ${s.catatan}`);
  y -= 10;
  T("Slip ini bersifat rahasia. Jangan dibagikan ke siapa pun.", 9, bold);
  y -= 20;
  const now = new Date();
  T(`Palangka Raya, ${tglWib(now)}`, 11);
  y -= 24;
  T("HR                                        Karyawan", 11);

  const bytes = await doc.save();
  return new Response(bytes as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="slip-gaji-${s.userId}-${s.tahun}-${String(s.bulan).padStart(2, "0")}.pdf"`,
    },
  });
}
