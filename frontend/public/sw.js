// RepairCoin Web Push Service Worker
// Handles push notifications and notification click routing

// Notification type → URL routing map
const NOTIFICATION_ROUTES = {
  // Shop-facing
  new_booking: '/shop/orders',
  reschedule_request: '/shop/orders',
  subscription_expiring: '/shop/settings',
  new_order: '/shop/orders',
  // Customer-facing
  booking_confirmed: '/customer/bookings',
  appointment_reminder: '/customer/bookings',
  order_completed: '/customer/bookings',
  reward_issued: '/customer/dashboard',
  token_gifted: '/customer/dashboard',
  redemption_approved: '/customer/dashboard',
  redemption_rejected: '/customer/dashboard',
};

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'RepairCoin', body: event.data.text() };
  }

  const { title = 'RepairCoin', body = '', data = {} } = payload;

  // `icon` is the small corner image (OS-controlled size ~48-96px).
  // `image` is the big hero banner under the text — Chromium/Edge/Firefox
  // desktop show it in full, so reuse the sender image here so message
  // pushes get a visibly large logo.
  const heroImage = data.image || data.icon;

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: data.icon || '/img/favicon-logo.png',
      badge: '/img/favicon-logo.png',
      ...(heroImage ? { image: heroImage } : {}),
      data,
      tag: data.tag || data.type || 'default',
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  const targetPath = data.route || NOTIFICATION_ROUTES[data.type] || '/';

  const handleClick = self.clients
    .matchAll({ type: 'window', includeUncontrolled: true })
    .then((clientList) => {
      // Try to focus an existing tab at our origin
      for (const client of clientList) {
        if (new URL(client.url).origin === self.location.origin) {
          client.focus();
          client.navigate(targetPath);
          return;
        }
      }
      // No existing tab — open a new one
      return self.clients.openWindow(targetPath);
    });

  event.waitUntil(handleClick);
});

self.addEventListener('activate', (event) => {
  // Take control of all open tabs immediately
  event.waitUntil(self.clients.claim());
});
