/* ============================================================
   推送 / 提醒管理
   - 原生：Capacitor LocalNotifications（APK 内置，关闭 APP 也能弹）
   - 兜底：浏览器 Notification（已安装 PWA 打开时弹）
   - 永远可用：应用内「今日推送」卡片（in-app 展示，不依赖权限）
   内容用「日期种子」稳定选取：同一周/同一天不变，跨周期变化。
   ============================================================ */
(function (global) {
 var KEY = 'catdesk.push.markers';
 var ID = { week: 2001, sentence: 2002, health: 2003, beauty: 2004 };

 function markers() {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { return {}; }
 }
 function saveMarkers(m) { try { localStorage.setItem(KEY, JSON.stringify(m)); } catch (e) {} }

 /* 稳定哈希：把字符串映射成数组下标 */
 function hash(s) {
  var h = 2166136261;
  for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
 }
 function pick(arr, seed) { return (arr && arr.length) ? arr[hash(seed) % arr.length] : null; }

 function isoDate(d) {
  function p(n) { return (n < 10 ? '0' : '') + n; }
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
 }

 /* 原生本地通知是否可用（APK 内置插件时存在）。
    远程加载的网页不会 import 插件的 web shim，因此 Plugins.LocalNotifications 默认未注册；
    需在原生环境下用 Capacitor.registerPlugin 主动注册（借助原生 PluginHeaders 路由调用）。 */
 var _lnHandle = null, _lnProbed = false;
 function nativeLN() {
  if (_lnProbed) return _lnHandle;
  _lnProbed = true;
  try {
   if (global.Capacitor && typeof Capacitor.isNativePlatform === 'function' && Capacitor.isNativePlatform()) {
    if (Capacitor.registerPlugin && !(Capacitor.Plugins && Capacitor.Plugins.LocalNotifications)) {
     try { Capacitor.registerPlugin('LocalNotifications'); } catch (e) {}
    }
    var h = Capacitor.Plugins && Capacitor.Plugins.LocalNotifications;
    if (h) _lnHandle = h;
   }
  } catch (e) {}
  return _lnHandle;
 }

 /* 当前周期应展示的内容（in-app 永远用这个） */
 function current() {
  var td = Store.today();
  var ws = Store.weekKey(td);
  var C = global.PushContent || { changsha: [], sentences: [], health: [], beauty: [] };
  return {
   week: pick(C.changsha, ws),
   sentence: pick(C.sentences, td),
   health: pick(C.health, td),
   beauty: pick(C.beauty, td)
  };
 }

 /* 计算下次触发时间 */
 function nextDailyFire(hour, minute) {
  var now = new Date();
  var t = new Date(now);
  t.setHours(hour, minute, 0, 0);
  if (t <= now) t.setDate(t.getDate() + 1);
  return t;
 }
 function nextMondayFire() {
  var now = new Date();
  var d = new Date(now);
  var off = (8 - d.getDay()) % 7; // 周日=0→1；周一=1→0
  if (off === 0 && now.getHours() >= 9) off = 7; // 已过今天 9 点则排下周一
  d.setDate(d.getDate() + off);
  d.setHours(9, 0, 0, 0);
  return d;
 }

 /* 权限状态（同步标记：null=未知, granted/denied） */
 var _perm = null;

 /* 权限 */
 async function ensurePermission() {
  var ln = nativeLN();
  if (ln) {
   try {
    var st = await ln.checkPermissions();
    if (st && st.display === 'granted') { _perm = 'granted'; return 'granted'; }
    if (st && st.display === 'denied') { _perm = 'denied'; return 'denied'; }
    var r = await ln.requestPermissions();
    if (r && r.display === 'granted') { _perm = 'granted'; return 'granted'; }
    _perm = 'denied'; return 'denied';
   } catch (e) { return 'error'; }
  }
  if (!('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'granted') { _perm = 'granted'; return 'granted'; }
  if (Notification.permission === 'denied') { _perm = 'denied'; return 'denied'; }
  try { var p = await Notification.requestPermission(); if (p === 'granted') _perm = 'granted'; return p; } catch (e) { return 'denied'; }
 }

 async function cancelNative(ids) {
  var ln = nativeLN();
  if (!ln) return;
  try {
   await ln.cancel({ notifications: ids.map(function (i) { return { id: i }; }) });
  } catch (e) {}
 }

/* 精确排程，失败降级为重复提醒 */
async function doSchedule(LN, items) {
 try {
   await LN.schedule({ notifications: withIdle(items) });
  } catch (e) {
   var fb = items.map(function (it) {
    var c = JSON.parse(JSON.stringify(it));
    var ty = (it.extra && it.extra.type);
    if (ty === 'week') c.schedule = { on: { weekday: 2, hour: 9, minute: 0 } };
    else if (ty === 'sentence') c.schedule = { on: { hour: 8, minute: 0 } };
    else if (ty === 'beauty') c.schedule = { on: { hour: 21, minute: 0 } };
    /* 待办提醒 / 番茄结束都是一次性的「某个精确时刻」，不做重复降级
       （否则会变成每天 20:00 的错点提醒，比不提醒更糟） */
    else if (ty === 'todo' || ty === 'pomo') return null;
    else c.schedule = { on: { hour: 20, minute: 0 } };
    return c;
   }).filter(Boolean);
   if (!fb.length) return;
   try { await LN.schedule({ notifications: withIdle(fb) }); } catch (e2) {}
  }
 }

/* ★ 熄屏也要能收到：必须给每条原生排程加 allowWhileIdle: true。
   插件里 `whileIdle = schedule.getBoolean("allowWhileIdle", false)` —— 默认 false 时走
   `alarmManager.set(RTC, …)`，手机熄屏进入 Doze 后闹钟会被推迟到下次唤醒才响
   （表现就是「熄屏收不到通知，一拿起手机才弹」）。
   加了之后走 `setAndAllowWhileIdle(RTC_WAKEUP, …)`，待机中也能按时唤醒。
   顺手把 Date 归一化成 ISO 字符串（原生侧解析的就是这个格式）。 */
function withIdle(items) {
 return items.map(function (it) {
  var c = JSON.parse(JSON.stringify(it));
  c.schedule = c.schedule || {};
  if (c.schedule.allowWhileIdle === undefined) c.schedule.allowWhileIdle = true;
  return c;
 });
}

 /* 原生排程：每周一长沙地 / 每日句子 / 每日健康 */
 async function scheduleNative() {
  if (!nativeLN()) return false;
  var perm = await ensurePermission();
  if (perm !== 'granted') return false;
  var LN = nativeLN();
  var C = global.PushContent || { changsha: [], sentences: [], health: [] };
  var m = markers();
  var sched = [];

  // 每周一 9:00 长沙地点（内容对齐「下次周一」所在周）
  var wf = nextMondayFire();
  var wKey = Store.weekKey(isoDate(wf));
  if (m.week !== wKey) {
   await cancelNative([ID.week]);
   var wp = pick(C.changsha, wKey) || { name: '出去走走', tip: '换换心情' };
   sched.push({
    id: ID.week, title: '本周出门去哪儿？',
    body: wp.name + ' · ' + wp.tip,
    schedule: { at: wf }, extra: { type: 'week' }
   });
   m.week = wKey;
  }

  // 每日 8:00 句子（通知只放短引导，全文在玉琢模块）
  var sf = nextDailyFire(8, 0);
  var sKey = isoDate(sf);
  if (m.sentence !== sKey) {
   await cancelNative([ID.sentence]);
   var sObj = pick(C.sentences, sKey) || {};
   sched.push({
    id: ID.sentence, title: '今日深度思考 · 自信表达',
    body: sObj.brief || '今天给自己一段安静的思考',
    schedule: { at: sf }, extra: { type: 'sentence' }
   });
   m.sentence = sKey;
  }

  // 每日 20:00 健康
  var hf = nextDailyFire(20, 0);
  var hKey = isoDate(hf);
  if (m.health !== hKey) {
   await cancelNative([ID.health]);
   sched.push({
    id: ID.health, title: '健康小知识',
    body: pick(C.health, hKey) || '照顾好身体，它是你长期的资产',
    schedule: { at: hf }, extra: { type: 'health' }
   });
   m.health = hKey;
  }

  // 每日 21:00 美商修炼（玉琢模块）
  var bf = nextDailyFire(21, 0);
  var bKey = isoDate(bf);
  if (m.beauty !== bKey) {
   await cancelNative([ID.beauty]);
   var bObj = pick(C.beauty, bKey) || {};
   sched.push({
    id: ID.beauty, title: '美商修炼 · 今日',
    body: bObj.brief || '今天提升一点审美眼光',
    schedule: { at: bf }, extra: { type: 'beauty' }
   });
   m.beauty = bKey;
  }

  if (sched.length) await doSchedule(LN, sched);
  saveMarkers(m);
  return true;
 }

 /* 网页兜底：打开时若进入新周期，弹一个浏览器通知（仅页面打开时有效） */
 async function fireWebIfNew() {
  if (nativeLN()) return;
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  var td = Store.today();
  var ws = Store.weekKey(td);
  var m = markers();
  var cur = current();
  try {
   if (m.sentence !== td) {
    var sObj = cur.sentence || {};
    new Notification('今日深度思考 · 自信表达', { body: sObj.brief || '今天给自己一段安静的思考' });
    new Notification('健康小知识', { body: cur.health || '' });
    m.sentence = td; m.health = td;
   }
   if (m.week !== ws) {
    new Notification('本周出门去哪儿？', { body: (cur.week ? cur.week.name + ' · ' + cur.week.tip : '') });
    m.week = ws;
   }
   saveMarkers(m);
  } catch (e) {}
 }

 /* ---------------- 待办提醒（精确时刻，支持提前量） ---------------- */
 var _todoTimers = {};
 /* 原生通知 id 区间 5000~8999，避开固定推送（2001~2004） */
 function todoRemindId(date, id) { return 5000 + (hash(date + '|' + id) % 4000); }
 /* 计算提醒触发时刻（date 当天 + time - 提前量分钟） */
 function todoFireAt(date, time, remind) {
  var p = (time || '').split(':');
  if (p.length < 2) return null;
  var d = Store.parse(date);
  d.setHours(+p[0], +p[1], 0, 0);
  if (remind > 0) d.setMinutes(d.getMinutes() - remind);
  return d;
 }
 /* 到点触发：应用内 toast 永远有效；网页环境再补一条系统通知 */
 function fireTodoReminder(t) {
  try { if (UI && UI.toast) UI.toast('待办提醒：' + (t.title || '')); } catch (e) {}
  try {
   if (!nativeLN() && ('Notification' in window) && Notification.permission === 'granted') {
    new Notification('待办提醒', { body: (t.title || '') + (t.time ? ' · ' + t.time : '') });
   }
  } catch (e) {}
 }
 /* 重新排程今日所有带提醒的待办：原生 LocalNotifications（关 App 也能弹）+ in-app 定时器（打开时弹） */
 async function scheduleTodoReminders() {
  Object.keys(_todoTimers).forEach(function (k) { clearTimeout(_todoTimers[k]); delete _todoTimers[k]; });
  var td = Store.today();
  var todos = Store.sortedTodos(td) || [];
  var ln = nativeLN();
  var natItems = [];
  var now = Date.now();
  todos.forEach(function (t) {
   if (t.done) return;
   if (t.remind == null || t.remind < 0) return;
   if (!t.time) return;
   var at = todoFireAt(td, t.time, t.remind);
   if (!at || at.getTime() <= now) return; // 已过时刻不再排
   if (ln) {
    natItems.push({
     id: todoRemindId(td, t.id), title: '待办提醒',
     body: (t.title || '') + (t.time ? ' · ' + t.time : ''),
     schedule: { at: at }, extra: { type: 'todo' }
    });
   }
   var delay = at.getTime() - now;
   if (delay > 0 && delay < 86400000 * 2) {
    var key = td + '|' + t.id;
    _todoTimers[key] = setTimeout(function () { fireTodoReminder(t); }, delay);
   }
  });
  if (ln && natItems.length) {
   try {
    var perm = await ensurePermission();
    if (perm === 'granted') await doSchedule(ln, natItems);
   } catch (e) {}
  }
 }
 /* 取消某条待办的提醒（删除 / 勾选完成时调用） */
 async function cancelTodoReminder(date, id) {
  var key = date + '|' + id;
  if (_todoTimers[key]) { clearTimeout(_todoTimers[key]); delete _todoTimers[key]; }
  var ln = nativeLN();
  if (ln) { try { await cancelNative([todoRemindId(date, id)]); } catch (e) {} }
 }

 /* ---------------- 番茄钟「专注结束」通知 ----------------
   与「今天 / 周日」这类日期周期完全无关：只要番茄钟真的跑起来，
   就按它自己的精确结束时刻排一条通知；暂停 / 停止 / 跳过立即撤销。
   - 原生（APK）：即使 APP 被关掉，到点系统也会弹（这才是关键）
   - 网页：到点时由 notifyFocusEnd() 补一条系统通知（需页面开着）
   注意：这是一次性提醒，只排一条，不参与 sync() 的周期重排。 */
var FOCUS_ID = 3001;                 // 避开固定推送 2001~2004、待办 5000~8999
var FOCUS_TITLE = '专注结束';
var FOCUS_BODY = '这一轮 25 分钟专注完成，休息 5 分钟 · 记得记录刚才做了什么';
var _focusScheduled = false;         // 本轮是否已成功排上原生通知

/* 排程：endTs = 本轮专注的精确结束时刻（毫秒时间戳） */
async function scheduleFocusEnd(endTs) {
 if (!endTs || endTs - Date.now() < 1000) return;
 var ln = nativeLN();
 if (!ln) return;                   // 网页环境：到点由 notifyFocusEnd 兜底
 try {
  var perm = await ensurePermission();
  if (perm !== 'granted') return;
  await cancelNative([FOCUS_ID]);
  await doSchedule(ln, [{
   id: FOCUS_ID, title: FOCUS_TITLE, body: FOCUS_BODY,
   schedule: { at: new Date(endTs) }, extra: { type: 'pomo' }
  }]);
  _focusScheduled = true;
 } catch (e) {}
}

/* 撤销本轮通知（暂停 / 停止 / 跳过 / 换模式 / 已到点） */
async function cancelFocusEnd() {
 _focusScheduled = false;
 var ln = nativeLN();
 if (!ln) return;
 try { await cancelNative([FOCUS_ID]); } catch (e) {}
}

/* 到点提示：应用内的提示由番茄钟自己弹，这里只补系统通知 */
function notifyFocusEnd() {
 if (_focusScheduled) return;       // 原生通知会自己弹，避免重复
 try {
  if (('Notification' in window) && Notification.permission === 'granted') {
   new Notification(FOCUS_TITLE, { body: FOCUS_BODY });
  }
 } catch (e) {}
}

/* 主入口：进入应用时调用，自动按周期排程 */
 async function sync() {
  var ok = await scheduleNative();
  if (!ok) await fireWebIfNew();
  return ok;
 }

 /* 开关状态：native / granted / denied / default / unsupported */
 function status() {
  if (nativeLN()) return (_perm === 'granted') ? 'granted' : 'native';
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission; // granted / denied / default
 }

global.Push = {
 current: current, sync: sync, ensurePermission: ensurePermission,
 nativeAvailable: nativeLN, status: status,
 scheduleTodoReminders: scheduleTodoReminders, cancelTodoReminder: cancelTodoReminder,
 scheduleFocusEnd: scheduleFocusEnd, cancelFocusEnd: cancelFocusEnd, notifyFocusEnd: notifyFocusEnd
};
})(window);
