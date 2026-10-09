/* 推播腳本來自 Google 的伺服器。載入失敗(離線、被擋住)時,不能讓整個 Service Worker 一起壞掉,
   否則離線快取也會跟著失效。所以包在 try 裡,失敗就只是沒有背景推播,其他功能照常運作。 */
try{
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
  messaging.onBackgroundMessage(async (payload) => {
    const title = (payload.notification && payload.notification.title) || '提醒';
    const options = {
      body: (payload.notification && payload.notification.body) || '',
      icon: 'icon-192.png',
      badge: 'icon-notification.png'
    };
    /* 後端送的訊息帶有 notification 欄位時,Firebase 的程式會「自己先跳一則」(沒有圖示),接著才呼叫這裡,
       結果同一則通知出現兩次。所以先把剛剛跳出來的同標題同內容那則關掉,再用這裡的(有圖示)取代,只剩一則 */
    try{
      const shown = await self.registration.getNotifications();
      shown.filter((n) => n.title === title && (n.body || '') === options.body).forEach((n) => n.close());
    }catch(e){}
    return self.registration.showNotification(title, options);
  });
}catch(e){ /* 沒有推播也沒關係 */ }

const CACHE_NAME = 'jishibu-cache-v151';
const CORE_ASSETS = ['./index.html', './manifest.json', './icon-192.png', './icon-512.png', './icon-maskable-512.png', './icon-notification.png'];

self.addEventListener('install', (event) => {
  /* cache:'reload' = 跳過瀏覽器自己的暫存,一定拿最新的。每個檔案各自加,有一個失敗也不影響其他的 */
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(CORE_ASSETS.map((a) => cache.add(new Request(a, { cache: 'reload' })).catch(() => {})))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

/* 點通知:把已經開著的記事簿拉到前面,沒開著就開一個新的 */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ('focus' in c) return c.focus();
      }
      return self.clients.openWindow('./index.html');
    })
  );
});

/* 網頁本身:網路優先。有網路就拿最新的(程式更新後,第一次重新整理就是新版,不會新舊混在一起);
   網路太慢(4 秒)或沒網路,才用快取的。所有進入網址(包含 ?shortcut=…)共用同一份快取,離線時也開得起來 */
async function handleNavigate(req) {
  const cache = await caches.open(CACHE_NAME);
  const net = fetch(req.url, { cache: 'no-cache' }).then((res) => {
    if (res && res.status === 200) cache.put('./index.html', res.clone()).catch(() => {});
    return res;
  });
  net.catch(() => {});
  try {
    return await Promise.race([net, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 4000))]);
  } catch (e) {
    const cached = await cache.match('./index.html');
    if (cached) return cached;
    return net.catch(() => Response.error());
  }
}
/* 圖示、設定檔這類:先給快取的(快),同時在背景更新 */
async function handleAsset(req) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(req, { ignoreSearch: true });
  const net = fetch(req).then((res) => {
    if (res && res.status === 200 && res.type === 'basic') cache.put(req, res.clone()).catch(() => {});
    return res;
  }).catch(() => cached);
  return cached || net;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(req.mode === 'navigate' ? handleNavigate(req) : handleAsset(req));
});
