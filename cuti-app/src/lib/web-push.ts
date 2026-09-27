import webPush from "web-push";

import { prisma } from "./prisma";

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
  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  if (subs.length === 0) return;

  const payload = JSON.stringify({ judul, pesan, url, tag: `notif-${Date.now()}` });

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webPush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          } as never,
          payload,
        );
      } catch (e) {
        // Gagal = subscription expired/invalid, hapus
        if (e instanceof Error && (e as { statusCode?: number }).statusCode === 410) {
          await prisma.pushSubscription.delete({ where: { endpoint: sub.endpoint } }).catch(() => {});
        }
      }
    }),
  );
}
