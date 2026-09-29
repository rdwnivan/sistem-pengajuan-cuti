import { prisma } from "@/lib/prisma";
import { userDariSesi } from "@/lib/auth";
import { fmtTgl } from "@/lib/cuti";

export async function GET(req: Request) {
  const user = await userDariSesi();
  if (!user || user.role !== "HR_ADMIN") return Response.json({ error: "Hanya HR" }, { status: 403 });

  const url = new URL(req.url);
  const format = url.searchParams.get("format") ?? "excel";
  const dari = url.searchParams.get("dari");
  const sampai = url.searchParams.get("sampai");
  const blok = url.searchParams.get("blok");
  const kegiatan = url.searchParams.get("kegiatan");
  const status = url.searchParams.get("status");

  const where: Record<string, unknown> = {};
  if (dari || sampai) {
    where.tglLaporan = {
      ...(dari ? { gte: new Date(dari + "T00:00:00") } : {}),
      ...(sampai ? { lte: new Date(sampai + "T23:59:59") } : {}),
    };
  }
  if (blok) where.blok = blok;
  if (kegiatan) where.kegiatan = { contains: kegiatan, mode: "insensitive" };
  if (status) where.status = status;

  const list = await prisma.laporanLapangan.findMany({
    where, include: { pembuat: true, approver: true }, orderBy: { tglLaporan: "desc" }, take: 1000,
  });

  if (format === "excel") {
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Rekap Laporan");
    ws.columns = [
      { header: "Tanggal", key: "tgl", width: 12 },
      { header: "Pelapor", key: "pelapor", width: 22 },
      { header: "Blok", key: "blok", width: 14 },
      { header: "Kegiatan", key: "kegiatan", width: 22 },
      { header: "TK", key: "tk", width: 8 },
      { header: "Hasil", key: "hasil", width: 24 },
      { header: "Cuaca", key: "cuaca", width: 14 },
      { header: "Judul", key: "judul", width: 28 },
      { header: "Status", key: "status", width: 14 },
      { header: "Approver", key: "approver", width: 20 },
    ];
    for (const l of list) {
      ws.addRow({
        tgl: fmtTgl(l.tglLaporan), pelapor: l.pembuat.nama, blok: l.blok ?? "-",
        kegiatan: l.kegiatan ?? "-", tk: l.jumlahTenagaKerja ?? "-",
        hasil: l.hasil ?? "-", cuaca: l.cuaca ?? "-", judul: l.judul,
        status: l.status, approver: l.approver?.nama ?? "-",
      });
    }
    const buf = await wb.xlsx.writeBuffer();
    return new Response(buf as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="rekap-laporan-${dari ?? "semua"}-${sampai ?? "semua"}.xlsx"`,
      },
    });
  }

  if (format === "pdf-rekap") {
    const { PDFDocument, StandardFonts } = await import("pdf-lib");
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    let page = doc.addPage([595, 842]);
    let y = 800;
    page.drawText("Rekap Laporan Lapangan - PT ANIME JAPAN", { x: 50, y, size: 14, font: bold });
    y -= 20;
    page.drawText(`Periode: ${dari ?? "-"} s/d ${sampai ?? "-"} | Blok: ${blok ?? "semua"} | Total: ${list.length}`, { x: 50, y, size: 9, font });
    y -= 18;
    for (const l of list.slice(0, 60)) {
      if (y < 50) { page = doc.addPage([595, 842]); y = 800; }
      page.drawText(`${fmtTgl(l.tglLaporan)} | ${l.pembuat.nama} | ${l.blok ?? "-"} | ${l.kegiatan ?? "-"} | ${l.judul.slice(0, 30)} | ${l.status}`, { x: 50, y, size: 8, font });
      y -= 12;
    }
    const bytes = await doc.save();
    return new Response(bytes as unknown as BodyInit, {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="rekap-laporan.pdf"` },
    });
  }

  return Response.json({ error: "format tidak dikenal" }, { status: 400 });
}
