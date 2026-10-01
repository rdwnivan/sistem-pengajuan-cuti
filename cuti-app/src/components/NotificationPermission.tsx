"use client";

import { useEffect, useState } from "react";

type Status = "default" | "granted" | "denied" | "unsupported";

/** Banner "Nanti saja" menunda tawaran 7 hari (bukan selamanya). */
const SNOOZE_KEY = "notif-banner-snooze";
const SNOOZE_MS = 7 * 86400000;

function sedangSnooze(): boolean {
  try {
    const t = Number(localStorage.getItem(SNOOZE_KEY) || 0);
    return Date.now() - t < SNOOZE_MS;
  } catch {
    return false;
  }
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function pesanGalatPush(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/push service error/i.test(msg)) {
    return "Browser gagal menghubungi layanan push. Coba berurutan: (1) matikan VPN/proxy lalu coba lagi; (2) pastikan jaringan tidak memblokir Google (firewall kantor/DNS filter) — cek status di chrome://gcm-internals; (3) nonaktifkan ad-block untuk situs ini; (4) bila tetap gagal, coba browser lain (Firefox/Edge).";
  }
  if (e instanceof DOMException && (e.name === "AbortError" || e.name === "InvalidAccessError")) {
    return "Kunci notifikasi server tidak valid. Hubungi admin/HR (VAPID tidak cocok).";
  }
  if (e instanceof DOMException && e.name === "NotAllowedError") {
    return "Izin notifikasi diblokir browser. Aktifkan manual di pengaturan situs (ikon gembok di address bar).";
  }
  if (/register/i.test(msg) && /undefined|not a function/i.test(msg)) {
    return "Browser/alamat ini tidak mendukung notifikasi push. Buka via localhost atau HTTPS.";
  }
  return msg || "Gagal mengaktifkan notifikasi, silakan coba lagi";
}

export function NotificationPermission() {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  const [ditutup, setDitutup] = useState(false);

  useEffect(() => {
    if (sedangSnooze()) {
      setDitutup(true);
      return;
    }
    if (!("Notification" in window)) {
      setStatus("unsupported");
      return;
    }
    if (Notification.permission !== "granted") {
      setStatus(Notification.permission);
      return;
    }
    // Permission granted di level browser belum tentu ada subscription
    // (misal setelah logout yang meng-unsubscribe). Cek dulu.
    (async () => {
      try {
        const reg = await navigator.serviceWorker.getRegistration().catch(() => undefined);
        const sub = await reg?.pushManager.getSubscription().catch(() => undefined);
        setStatus(sub ? "granted" : "default");
      } catch {
        setStatus("granted");
      }
    })();
  }, []);

  async function enable() {
    if (!("Notification" in window)) return;
    setLoading(true);
    setGalat(null);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setStatus(perm);
        return;
      }

      const res = await fetch("/api/push/subscribe");
      if (!res.ok) throw new Error("Server menolak permintaan (mungkin sesi habis — silakan login ulang lalu coba lagi)");
      const { publicKey } = (await res.json()) as { publicKey: string | null };
      if (!publicKey) {
        throw new Error("Server belum dikonfigurasi untuk notifikasi (VAPID kosong di server)");
      }

      const reg = await navigator.serviceWorker.register("/sw.js");
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      const simpan = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      if (!simpan.ok) throw new Error("Gagal menyimpan subscription ke server");

      // Sembunyikan banner HANYA bila seluruh alur sukses.
      setStatus("granted");
    } catch (e) {
      setGalat(pesanGalatPush(e));
    } finally {
      setLoading(false);
    }
  }

  function nantiSaja() {
    try {
      localStorage.setItem(SNOOZE_KEY, String(Date.now()));
    } catch {
      // abaikan (mode privat dsb) — banner cukup hilang sesi ini
    }
    setDitutup(true);
  }

  if (ditutup) return null;
  if (status === null) return null;
  if (status === "unsupported") return null;
  if (status === "granted") return null;

  return (
    <div className="rounded-xl border-2 border-blue-500 bg-blue-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-bold text-blue-900">Aktifkan Notifikasi Browser</h2>
          <p className="mt-1 text-sm text-blue-800">
            Kami akan mengirim notifikasi ke browser Anda saat ada pembaruan penting
            (persetujuan cuti, slip gaji terbit, atau laporan lapangan).
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-1">
          <button
            onClick={enable}
            disabled={loading || status === "denied"}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
          >
            {loading ? "Memproses..." : status === "denied" ? "Diblokir Browser" : "Aktifkan"}
          </button>
          <button
            type="button"
            onClick={nantiSaja}
            className="rounded-lg px-4 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100"
          >
            Nanti saja
          </button>
        </div>
      </div>
      {status === "denied" && (
        <p className="mt-2 text-xs text-red-700">
          Notifikasi diblokir browser. Aktifkan manual di pengaturan situs (ikon gembok di address bar).
        </p>
      )}
      {galat && (
        <p className="mt-2 text-xs font-semibold text-red-700">
          {galat}
        </p>
      )}
    </div>
  );
}
