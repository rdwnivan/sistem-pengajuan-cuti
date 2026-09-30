"use client";

import { useState } from "react";
import { aksiKeluar } from "@/actions";

/**
 * Tombol Keluar yang membersihkan Web Push subscription browser ini
 * SEBELUM sesi dihapus.
 *
 * Alasan: PushSubscription milik browser (satu endpoint per origin),
 * bukan milik akun app. Tanpa ini, setelah ganti akun di browser yang
 * sama, notifikasi milik akun lama tetap bunyi di browser ini karena
 * row DB masih menunjuk ke endpoint browser ini.
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
          const endpoint = sub.endpoint;
          await sub.unsubscribe().catch(() => {});
          await fetch("/api/push/subscribe", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ endpoint }),
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
