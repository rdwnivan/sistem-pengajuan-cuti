"use client";

import { useEffect, useState } from "react";

type Status = "default" | "granted" | "denied" | "unsupported";

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

export function NotificationPermission() {
  const [status, setStatus] = useState<Status>("default");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!("Notification" in window)) {
      setStatus("unsupported");
      return;
    }
    setStatus(Notification.permission);
  }, []);

  async function enable() {
    if (!("Notification" in window)) return;
    setLoading(true);
    try {
      const perm = await Notification.requestPermission();
      setStatus(perm);
      if (perm !== "granted") return;

      const res = await fetch("/api/push/subscribe");
      const { publicKey } = (await res.json()) as { publicKey: string | null };
      if (!publicKey) {
        console.error("VAPID public key belum dikonfigurasi");
        return;
      }

      const reg = await navigator.serviceWorker.register("/sw.js");
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
    } catch (e) {
      console.error("Gagal mengaktifkan notifikasi:", e);
    } finally {
      setLoading(false);
    }
  }

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
        <button
          onClick={enable}
          disabled={loading || status === "denied"}
          className="shrink-0 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
        >
          {loading ? "Memproses..." : status === "denied" ? "Diblokir Browser" : "Aktifkan"}
        </button>
      </div>
      {status === "denied" && (
        <p className="mt-2 text-xs text-red-700">
          Notifikasi diblokir browser. Aktifkan manual di pengaturan situs (ikon gembok di address bar).
        </p>
      )}
    </div>
  );
}
