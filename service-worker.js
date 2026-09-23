importScripts('https://www.gstatic.com/firebasejs/12.19.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.19.0/firebase-messaging-compat.js');

/* 這裡的設定值要跟 index.html 裡的 FIREBASE_CONFIG 完全一樣 */
firebase.initializeApp({
  apiKey: "AIzaSyBeztpgvYaM-ehRP0rh-qKwuY2Xs3_sNWI",
  authDomain: "notebook-app-509000.firebaseapp.com",
  projectId: "notebook-app-509000",
  storageBucket: "notebook-app-509000.firebasestorage.app",
  messagingSenderId: "826476371547",
  appId: "1:826476371547:web:1ce534bb5fd1fed891697e"
});
const messaging = firebase.messaging();
messaging.onBackgroundMessage((payload) => {
  const title = (payload.notification && payload.notification.title) || '提醒';
  const options = {
    body: (payload.notification && payload.notification.body) || '',
    icon: 'icon-192.png',
    badge: 'icon-notification.png'
  };
  self.registration.showNotification(title, options);
});

const CACHE_NAME = 'jishibu-cache-v14';
const CORE_ASSETS = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return networkResponse;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
