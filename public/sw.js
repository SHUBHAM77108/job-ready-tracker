// Job-Ready Tracker service worker.
// Its job: show task reminders as real system notifications (required on Android Chrome and installed apps)
// and open the tracker when a notification is tapped. It does not cache anything.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/daily";
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of all) { if ("focus" in client) { await client.focus(); return; } }
    await self.clients.openWindow(url);
  })());
});
