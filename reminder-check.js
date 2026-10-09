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

/* 台灣時間(Asia/Taipei)。GitHub 的伺服器是 UTC,直接用 new Date().getHours() 會差 8 小時 */
const TZ = 'Asia/Taipei';
function nowInTaipei() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).formatToParts(new Date());
  const g = (t) => parts.find((p) => p.type === t).value;
  return { date: `${g('year')}-${g('month')}-${g('day')}`, minutes: Number(g('hour')) * 60 + Number(g('minute')) };
}
/* 排程每 5 分鐘才跑一次,而且常常晚幾分鐘,所以不能要求「時:分完全相同」。
   改成:提醒時間已經到了,而且在 CATCH_UP_MIN 分鐘內,今天還沒提醒過,就送出。
   超過這個時間窗(例如半夜才新增、早上的提醒時間早就過了)就不補送,避免深夜突然收到早上的提醒 */
const CATCH_UP_MIN = 20;
async function processHabitReminders() {
  const { date: today, minutes: nowMin } = nowInTaipei();
  const snap = await db.collection('habitReminders').get();
  for (const doc of snap.docs) {
    const h = doc.data();
    if (!/^\d{2}:\d{2}$/.test(h.remindTime || '')) continue;
    if (h.lastRemindedDate === today) continue;
    const [hh, mm] = h.remindTime.split(':').map(Number);
    const diff = nowMin - (hh * 60 + mm);
    if (diff < 0 || diff > CATCH_UP_MIN) continue;
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
