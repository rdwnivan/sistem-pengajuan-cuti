const CACHE = "cuti-sw-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

self.addEventListener("push", (event) => {
  let data = { judul: "Notifikasi baru", pesan: "Ada pembaruan di aplikasi." };
  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data = { judul: "Notifikasi baru", pesan: event.data.text() };
    }
  }

  const options = {
    body: data.pesan,
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: data.tag || "notif",
    renotify: true,
    requireInteraction: false,
    data: { url: data.url || "/notifikasi" },
    actions: [{ action: "buka", title: "Lihat" }],
  };

  event.waitUntil(self.registration.showNotification(data.judul, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/notifikasi";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ("focus" in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
