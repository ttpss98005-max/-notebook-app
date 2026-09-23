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
    badge: 'icon-192.png'
  };
  self.registration.showNotification(title, options);
});
