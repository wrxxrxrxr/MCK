const CACHE = 'msk-v1';

self.addEventListener('install', e => {
    self.skipWaiting();
});

self.addEventListener('activate', e => {
    e.waitUntil(clients.claim());
});

self.addEventListener('fetch', e => {
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});

// ─── Push-уведомление ────────────────────────────────────────────
self.addEventListener('push', e => {
    if (!e.data) return;

    let payload;
    try { payload = e.data.json(); }
    catch { payload = { title: 'МСК-Релайбл', body: e.data.text() }; }

    const options = {
        body:    payload.body    || 'Обновление по вашему заказу',
        icon:    payload.icon    || '/icons/icon-192.png',
        badge:   payload.badge   || '/icons/badge-72.png',
        tag:     payload.tag     || 'order-update',
        renotify: true,
        data:    { url: payload.url || '/client' },
        actions: [
            { action: 'open',    title: 'Открыть' },
            { action: 'dismiss', title: 'Закрыть' }
        ]
    };

    e.waitUntil(
        self.registration.showNotification(payload.title || 'МСК-Релайбл', options)
    );
});

// ─── Клик по уведомлению ─────────────────────────────────────────
self.addEventListener('notificationclick', e => {
    e.notification.close();

    if (e.action === 'dismiss') return;

    const targetUrl = e.notification.data?.url || '/client';

    e.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
            // Если вкладка уже открыта — фокусируем её
            for (const c of list) {
                if (c.url.includes('/client') && 'focus' in c) {
                    return c.focus();
                }
            }
            // Иначе открываем новую
            return clients.openWindow(targetUrl);
        })
    );
});