import webPush from "web-push";

import { prisma } from "./prisma";
import { agenPushAman, subscriptionSchema } from "./push-security";

const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY ?? "";
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY ?? "";

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webPush.setVapidDetails("mailto:admin@anime.id", VAPID_PUBLIC, VAPID_PRIVATE);
}

export async function kirimWebPush(
  userId: string,
  judul: string,
  pesan: string,
  url: string = "/notifikasi",
) {
  // Web Push is explicitly disabled without a complete VAPID configuration.
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return;
  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  if (subs.length === 0) return;

  const payload = JSON.stringify({ judul, pesan, url, tag: `notif-${Date.now()}` });

  await Promise.all(
    subs.map(async (sub) => {
      let agent;
      try {
        const parsed = subscriptionSchema.safeParse({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } });
        if (!parsed.success) { console.warn("[PUSH-DITOLAK] Subscription tersimpan tidak valid", { id: sub.id }); return; }
        agent = await agenPushAman(sub.endpoint);
        await webPush.sendNotification(
          parsed.data,
          payload,
          { timeout: 5000, agent },
        );
      } catch (e) {
        // Gagal = subscription expired/invalid, hapus
        if (e instanceof Error && (e as { statusCode?: number }).statusCode === 410) {
          try { await prisma.pushSubscription.deleteMany({ where: { id: sub.id } }); }
          catch { console.error("[PUSH-BERSIHKAN-GAGAL] Subscription kedaluwarsa belum dihapus", { id: sub.id }); }
        } else {
          // Notification failure must not undo a committed business operation.
          console.warn("[PUSH-GAGAL] Pengiriman ditunda hingga notifikasi berikutnya", { id: sub.id, status: (e as { statusCode?: number } | null)?.statusCode ?? "network-or-validation" });
        }
      } finally {
        agent?.destroy();
      }
    }),
  );
}
