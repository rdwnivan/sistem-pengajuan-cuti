import { prisma } from "@/lib/prisma";
import { userDariSesi } from "@/lib/auth";
import { fmtTgl } from "@/lib/cuti";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const format = url.searchParams.get("format") ?? "excel";
  const dari = url.searchParams.get("dari");
  const sampai = url.searchParams.get("sampai");
  const status = url.searchParams.get("status");

  const user = await userDariSesi();
  if (!user || user.role !== "HR_ADMIN") return Response.json({ error: "Hanya HR" }, { status: 403 });

  const where: Record<string, unknown> = {};
  if (dari || sampai) {
    where.tglMulai = {
      ...(dari ? { gte: new Date(dari + "T00:00:00") } : {}),
      ...(sampai ? { lte: new Date(sampai + "T23:59:59") } : {}),
    };
  }
  if (status) where.status = status;

  const list = await prisma.pengajuan.findMany({
    where, include: { pemohon: true, jenis: true }, orderBy: { createdAt: "desc" }, take: 1000,
  });

  if (format === "excel") {
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Rekap Cuti");
    ws.columns = [
      { header: "Pemohon", key: "pemohon", width: 22 },
      { header: "Email", key: "email", width: 26 },
      { header: "Jenis", key: "jenis", width: 16 },
      { header: "Mulai", key: "mulai", width: 12 },
      { header: "Selesai", key: "selesai", width: 12 },
      { header: "Hari", key: "hari", width: 8 },
      { header: "Status", key: "status", width: 16 },
      { header: "Diajukan", key: "diajukan", width: 14 },
    ];
    for (const p of list) {
      ws.addRow({
        pemohon: p.pemohon.nama, email: p.pemohon.email, jenis: p.jenis.nama,
        mulai: fmtTgl(p.tglMulai), selesai: fmtTgl(p.tglSelesai), hari: p.jumlahHariKerja,
        status: p.status, diajukan: fmtTgl(p.createdAt),
      });
    }
    const buf = await wb.xlsx.writeBuffer();
    return new Response(buf as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="rekap-cuti-${dari ?? "semua"}-${sampai ?? "semua"}.xlsx"`,
      },
    });
  }

  if (format === "pdf-rekap") {
    const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    let page = doc.addPage([595, 842]);
    let y = 800;
    page.drawText("Rekap Pengajuan Cuti - Anime Japan", { x: 50, y, size: 14, font: bold });
    y -= 20;
    page.drawText(`Periode: ${dari ?? "-"} s/d ${sampai ?? "-"} | Status: ${status ?? "semua"} | Total: ${list.length}`, { x: 50, y, size: 9, font });
    y -= 18;
    for (const p of list.slice(0, 60)) {
      if (y < 50) { page = doc.addPage([595, 842]); y = 800; }
      page.drawText(`${p.pemohon.nama} | ${p.jenis.nama} ${p.jumlahHariKerja}hr | ${fmtTgl(p.tglMulai)}-${fmtTgl(p.tglSelesai)} | ${p.status}`, { x: 50, y, size: 8, font });
      y -= 12;
    }
    const bytes = await doc.save();
    return new Response(bytes as unknown as BodyInit, {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="rekap-cuti.pdf"` },
    });
  }

  return Response.json({ error: "format tidak dikenal" }, { status: 400 });
}
