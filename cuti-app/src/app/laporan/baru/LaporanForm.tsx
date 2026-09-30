"use client";
import { useEffect, useState } from "react";
import { useFormState } from "react-dom";
import { aksiBuatLaporan, aksiRevisiLaporan } from "@/actions";
import { ErrorMsg, Field, btnCls, inputCls } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";

type A = { id: string; nama: string; jabatan: string | null };
type Initial = {
  tglLaporan?: string; lokasi?: string; blok?: string | null; kegiatan?: string | null;
  jumlahTenagaKerja?: number | null; hasil?: string | null; cuaca?: string | null;
  lat?: number | null; lng?: number | null;
  shift?: string | null; judul?: string; isi?: string; approverId?: string;
};

export function LaporanForm({ editId, initial, dariDraf }: { editId?: string; initial?: Initial; dariDraf?: boolean }) {
  const [state, action] = useFormState(editId ? aksiRevisiLaporan : aksiBuatLaporan, { error: "" } as { error?: string });
  const [approverId, setApproverId] = useState(initial?.approverId ?? "");
  const [list, setList] = useState<A[]>([]);
  const [lat, setLat] = useState(initial?.lat != null ? String(initial.lat) : "");
  const [lng, setLng] = useState(initial?.lng != null ? String(initial.lng) : "");
  const [gpsMsg, setGpsMsg] = useState("");
  const [fotos, setFotos] = useState<{ ket: string }[]>([]);

  useEffect(() => {
    fetch("/api/approver")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setList(Array.isArray(d) ? d : []))
      .catch(() => setList([]));
  }, []);

  const ambilGps = () => {
    if (!navigator.geolocation) { setGpsMsg("Browser tidak mendukung GPS"); return; }
    setGpsMsg("Mengambil lokasi...");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLat(String(p.coords.latitude));
        setLng(String(p.coords.longitude));
        setGpsMsg(`Terkunci: ${p.coords.latitude.toFixed(5)}, ${p.coords.longitude.toFixed(5)}`);
      },
      () => setGpsMsg("Gagal mengambil lokasi — pastikan izin lokasi diizinkan"),
      { timeout: 15000 },
    );
  };

  return (
    <form action={action} className="space-y-3 rounded-xl border bg-white p-4">
      {editId && <input type="hidden" name="id" value={editId} />}
      <Field label="Tanggal laporan">
        <input name="tglLaporan" type="date" required defaultValue={initial?.tglLaporan ?? new Date().toISOString().slice(0, 10)} className={inputCls} />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Lokasi">
          <input name="lokasi" required defaultValue={initial?.lokasi ?? ""} className={inputCls} placeholder="Misal: Kantor Pusat" />
        </Field>
        <Field label="Blok / Afdeling">
          <input name="blok" defaultValue={initial?.blok ?? ""} className={inputCls} placeholder="Misal: Blok A1" />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Kegiatan / pekerjaan">
          <input name="kegiatan" defaultValue={initial?.kegiatan ?? ""} className={inputCls} placeholder="Misal: Panen, pemupukan" />
        </Field>
        <Field label="Jumlah tenaga kerja">
          <input name="jumlahTenagaKerja" type="number" min="0" defaultValue={initial?.jumlahTenagaKerja ?? ""} className={inputCls} placeholder="0" />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Hasil / output">
          <input name="hasil" defaultValue={initial?.hasil ?? ""} className={inputCls} placeholder="Misal: 2,5 ton TBS" />
        </Field>
        <Field label="Cuaca">
          <input name="cuaca" defaultValue={initial?.cuaca ?? ""} className={inputCls} placeholder="Misal: Cerah, hujan ringan" />
        </Field>
      </div>
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-sm font-semibold">Koordinat GPS</span>
          <button type="button" onClick={ambilGps} className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white">Ambil lokasi HP</button>
        </div>
        <input type="hidden" name="lat" value={lat} />
        <input type="hidden" name="lng" value={lng} />
        <p className="text-xs text-zinc-600">{gpsMsg || (lat && lng ? `Tersimpan: ${lat}, ${lng}` : "Belum ada koordinat — opsional")}</p>
      </div>
      <Field label="Shift">
        <input name="shift" defaultValue={initial?.shift ?? ""} className={inputCls} placeholder="Contoh: Pagi / Siang / Malam" />
      </Field>
      <Field label="Judul laporan">
        <input name="judul" required minLength={3} defaultValue={initial?.judul ?? ""} className={inputCls} placeholder="Misal: Laporan kegiatan lapangan" />
      </Field>
      <Field label="Isi laporan">
        <textarea name="isi" required minLength={10} rows={5} defaultValue={initial?.isi ?? ""} className={inputCls} placeholder="Tulis laporan lengkap di sini (minimal 10 karakter)..." />
      </Field>
      <Field label="Foto / lampiran (opsional, PDF/JPG/PNG maks 2MB)">
        <input name="lampiran" type="file" accept=".pdf,.jpg,.jpeg,.png" className={inputCls} />
      </Field>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">Foto bukti lapangan (maks 5, JPG/PNG + keterangan)</span>
          {fotos.length < 5 && (
            <button type="button" onClick={() => setFotos((f) => [...f, { ket: "" }])} className="rounded-lg border border-emerald-700 px-2 py-1 text-xs font-bold text-emerald-700">+ Tambah foto</button>
          )}
        </div>
        {fotos.map((f, i) => (
          <div key={i} className="flex gap-2">
            <input name="fotos" type="file" accept=".jpg,.jpeg,.png" className={`${inputCls} flex-1`} />
            <input name="fotoKeterangan" value={f.ket} onChange={(e) => setFotos((arr) => arr.map((x, j) => (j === i ? { ket: e.target.value } : x)))} className={`${inputCls} flex-1`} placeholder="Keterangan foto" />
            <button type="button" onClick={() => setFotos((arr) => arr.filter((_, j) => j !== i))} className="px-2 font-bold text-red-600">×</button>
          </div>
        ))}
      </div>
      <Field label="Kirim ke atasan">
        <select name="approverId" required value={approverId} onChange={(e) => setApproverId(e.target.value)} className={inputCls}>
          <option value="">-- pilih approver --</option>
          {list.map((a) => <option key={a.id} value={a.id}>{a.nama}{a.jabatan ? ` (${a.jabatan})` : ""}</option>)}
        </select>
      </Field>
      <ErrorMsg msg={state?.error} />
      <SubmitButton className={btnCls}>
        {!editId ? "Simpan Laporan" : dariDraf ? "Simpan Perubahan" : "Simpan & Kirim Ulang"}
      </SubmitButton>
    </form>
  );
}
