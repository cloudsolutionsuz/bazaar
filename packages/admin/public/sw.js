self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || "Bazaar";
  const body = data.body || "";
  const url = data.url || "/chat";

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const path = event.notification.data?.url || "/chat";
  const target = self.location.origin + path;
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      // Focus existing admin tab if open
      for (const client of windowClients) {
        if (client.url.startsWith(self.location.origin)) {
          return client.focus().then(() =>
            "navigate" in client ? client.navigate(target) : clients.openWindow(target)
          );
        }
      }
      return clients.openWindow(target);
    })
  );
});
