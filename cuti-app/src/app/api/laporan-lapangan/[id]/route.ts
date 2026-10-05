import { prisma } from "@/lib/prisma";
import { userDariSesi } from "@/lib/auth";
import { teksAman } from "@/lib/pdf";
import { notifApp } from "@/lib/notif";
import { kirimWebPush } from "@/lib/web-push";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await userDariSesi();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const l = await prisma.laporanLapangan.findUnique({ where: { id }, include: { pembuat: true, approver: true, fotos: { orderBy: { createdAt: "asc" } } } });
  if (!l) return Response.json({ error: "Tidak ditemukan" }, { status: 404 });
  const allowed = l.pembuatId === user.id || l.approverId === user.id;
  if (!allowed) return Response.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(req.url);
  // ?lihat=1 -> tampilkan di browser (inline), default tetap unduh (attachment).
  const lihat = url.searchParams.get("lihat") === "1";
  if (url.searchParams.get("format") === "pdf") {
    if (l.status !== "DISETUJUI") return Response.json({ error: "PDF hanya untuk laporan disetujui" }, { status: 400 });
    const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    let page = doc.addPage([595, 842]);
    let y = 780;
    const T = (t: string, size = 11, f = font) => { page.drawText(teksAman(t.slice(0, 90)), { x: 50, y, size, font: f }); y -= size + 5; };

    T("LAPORAN LAPANGAN - PT ANIME JAPAN", 14, bold);
    T(`Status: ${l.status}`, 11, bold); y -= 8;
    T(`Judul: ${l.judul}`);
    T(`Tanggal: ${l.tglLaporan.toISOString().slice(0, 10)}`);
    T(`Lokasi: ${l.lokasi}`);
    if (l.blok) T(`Blok: ${l.blok}`);
    if (l.kegiatan) T(`Kegiatan: ${l.kegiatan}`);
    if (l.jumlahTenagaKerja != null) T(`Tenaga kerja: ${l.jumlahTenagaKerja} orang`);
    if (l.hasil) T(`Hasil: ${l.hasil}`);
    if (l.cuaca) T(`Cuaca: ${l.cuaca}`);
    if (l.lat != null && l.lng != null) T(`GPS: ${l.lat.toFixed(5)}, ${l.lng.toFixed(5)}`);
    if (l.shift) T(`Shift: ${l.shift}`);
    T(`Pelapor: ${l.pembuat.nama} (${l.pembuat.email})`);
    T(`Approver: ${l.approver?.nama ?? "-"}`);
    y -= 6;
    T("Isi Laporan:", 11, bold);
    const baris = l.isi.split("\n");
    for (const b of baris) {
      if (y < 60) { page = doc.addPage([595, 842]); y = 780; }
      T(b || " ");
    }
    if (l.catatanApprover) { y -= 4; T(`Catatan approver: ${l.catatanApprover}`); }
    if (l.fotos.length > 0) {
      y -= 4; T("Foto bukti lapangan:", 11, bold);
      for (const f of l.fotos) {
        if (y < 60) { page = doc.addPage([595, 842]); y = 780; }
        T(`- ${f.path}${f.keterangan ? ` (${f.keterangan})` : ""}`);
      }
    }
    y -= 10;
    T("Dicetak dari Sistem Pengajuan Cuti Online", 8, font);
    const bytes = await doc.save();
    return new Response(bytes as unknown as BodyInit, {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `${lihat ? "inline" : "attachment"}; filename="laporan-${l.id.slice(0, 8)}.pdf"` },
    });
  }

  return Response.json({
    id: l.id, judul: l.judul, isi: l.isi, tglLaporan: l.tglLaporan.toISOString().slice(0, 10),
    lokasi: l.lokasi, blok: l.blok, kegiatan: l.kegiatan, jumlahTenagaKerja: l.jumlahTenagaKerja,
    hasil: l.hasil, cuaca: l.cuaca, lat: l.lat, lng: l.lng,
    shift: l.shift, status: l.status, lampiranPath: l.lampiranPath,
    fotos: l.fotos.map((f) => ({ path: f.path, keterangan: f.keterangan })),
    catatanApprover: l.catatanApprover,
    pembuat: { nama: l.pembuat.nama, email: l.pembuat.email },
    approver: l.approver ? { nama: l.approver.nama } : null,
  });
}

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await userDariSesi();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const l = await prisma.laporanLapangan.findUnique({ where: { id } });
  if (!l) return Response.json({ error: "Tidak ditemukan" }, { status: 404 });
  const fd = await _req.formData();
  const aksi = fd.get("aksi");
  const catatan = (fd.get("catatan") as string) ?? "";
  if (!["setuju", "tolak", "kembalikan"].includes(aksi as string)) return Response.json({ error: "Aksi tidak valid" }, { status: 400 });

  const allowed = l.approverId === user.id;
  if (!allowed) return Response.json({ error: "Forbidden" }, { status: 403 });
  if (l.status !== "MENUNGGU") return Response.json({ error: "Bukan status menunggu" }, { status: 400 });
  if ((aksi === "tolak" || aksi === "kembalikan") && !catatan.trim()) return Response.json({ error: "Catatan wajib" }, { status: 400 });

  const statusBaru = aksi === "setuju" ? "DISETUJUI" : aksi === "tolak" ? "DITOLAK" : "DIKEMBALIKAN";
  await prisma.laporanLapangan.update({ where: { id: l.id }, data: { status: statusBaru, catatanApprover: catatan.trim() || null } });
  await prisma.auditLog.create({ data: { laporanId: l.id, aktorId: user.id, aksi: aksi as string, dariStatus: l.status, keStatus: statusBaru, catatan: catatan.trim() || null } });
  await notifApp(l.pembuatId, `Laporan Anda: ${statusBaru}`, `Laporan "${l.judul}" berstatus ${statusBaru}.${catatan.trim() ? " Catatan: " + catatan.trim() : ""}`, l.id, "APP", "LAPORAN");
  await kirimWebPush(l.pembuatId, `Laporan Anda: ${statusBaru}`, `Laporan "${l.judul}" berstatus ${statusBaru}.${catatan.trim() ? " Catatan: " + catatan.trim() : ""}`);
  return Response.json({ ok: true, status: statusBaru });
}
