/**
 * ============================================================
 * 記事簿 - 推播提醒排程（GitHub Actions 免費版）
 * ============================================================
 * 跟 cloud-function-reminders.js 做的事情完全一樣：
 * 掃描 Firestore 裡到期但還沒發送的提醒，透過 FCM 推播出去。
 * 差別只是這個版本由 GitHub Actions 排程執行，完全免費、
 * 不需要 Google Cloud 帳單帳戶。
 * ============================================================
 */

const admin = require('firebase-admin');

admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
});

const db = admin.firestore();
const messaging = admin.messaging();

async function sendToUser(uid, title, body) {
  const tokensSnap = await db.collection('deviceTokens').where('uid', '==', uid).get();
  const tokens = tokensSnap.docs.map((d) => d.id);
  if (tokens.length === 0) return;
  try {
    await messaging.sendEachForMulticast({ tokens, notification: { title, body } });
  } catch (e) {
    console.error('發送推播失敗', e);
  }
}

async function processReminders() {
  const now = Date.now();
  const snap = await db.collection('reminders')
    .where('sent', '==', false)
    .where('dueAt', '<=', now)
    .get();
  for (const doc of snap.docs) {
    const r = doc.data();
    await sendToUser(r.uid, '提醒：' + r.title, r.body || '');
    await doc.ref.update({ sent: true });
    console.log('已發送提醒：', r.title);
  }
}

function todayStrInTZ() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function nowHHMM() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
async function processHabitReminders() {
  const currentHHMM = nowHHMM();
  const today = todayStrInTZ();
  const snap = await db.collection('habitReminders')
    .where('remindTime', '==', currentHHMM)
    .get();
  for (const doc of snap.docs) {
    const h = doc.data();
    if (h.lastRemindedDate === today) continue;
    await sendToUser(h.uid, '習慣提醒：' + h.habitName, '今天還沒打卡喔');
    await doc.ref.update({ lastRemindedDate: today });
    console.log('已發送習慣提醒：', h.habitName);
  }
}

(async () => {
  try {
    await processReminders();
    await processHabitReminders();
    console.log('檢查完成', new Date().toISOString());
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
