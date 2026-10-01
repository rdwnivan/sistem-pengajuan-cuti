"use client";

import { useState } from "react";
import { aksiKeluar } from "@/actions";
import { resetTautanPush } from "@/components/NotificationPermission";

/**
 * Tombol Keluar yang memutus tautan Web Push perangkat ini dari akun
 * SEBELUM sesi dihapus.
 *
 * Alasan: PushSubscription milik browser (satu endpoint per origin),
 * sedangkan row DB menunjuk ke userId. Tanpa DELETE, setelah ganti akun
 * notifikasi milik akun lama tetap bunyi di browser ini.
 *
 * SENGAJA tidak memanggil sub.unsubscribe(): subscription browser
 * dipertahankan agar login berikutnya (akun sama maupun beda) bisa
 * ditautkan ulang secara diam-diam tanpa banner (lihat
 * NotificationPermission). Menghapusnya justru membuat akun yang sama
 * ditanya banner berulang-ulang.
 */
export function LogoutButton() {
  const [busy, setBusy] = useState(false);

  async function keluar() {
    if (busy) return;
    setBusy(true);
    try {
      if ("serviceWorker" in navigator) {
        const reg = await navigator.serviceWorker.getRegistration().catch(() => undefined);
        const sub = await reg?.pushManager.getSubscription().catch(() => undefined);
        if (sub) {
          resetTautanPush();
          await fetch("/api/push/subscribe", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ endpoint: sub.endpoint }),
          }).catch(() => {});
        }
      }
    } finally {
      await aksiKeluar();
    }
  }

  return (
    <button
      type="button"
      onClick={keluar}
      disabled={busy}
      className="rounded-lg bg-white/15 px-3 py-1.5 text-sm font-semibold disabled:opacity-60"
    >
      {busy ? "Keluar…" : "Keluar"}
    </button>
  );
}
