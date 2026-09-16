/* ============================================================
   推送 / 提醒管理
   - 原生：Capacitor LocalNotifications（APK 内置，关闭 APP 也能弹）
   - 兜底：浏览器 Notification（已安装 PWA 打开时弹）
   - 永远可用：应用内「今日推送」卡片（in-app 展示，不依赖权限）
   内容用「日期种子」稳定选取：同一周/同一天不变，跨周期变化。
   ============================================================ */
(function (global) {
 var KEY = 'catdesk.push.markers';
 var ID = { week: 2001, sentence: 2002, health: 2003 };

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
   await LN.schedule({ notifications: items });
  } catch (e) {
   var fb = items.map(function (it) {
    var c = JSON.parse(JSON.stringify(it));
    var ty = (it.extra && it.extra.type);
    if (ty === 'week') c.schedule = { on: { weekday: 2, hour: 9, minute: 0 } };
    else if (ty === 'sentence') c.schedule = { on: { hour: 8, minute: 0 } };
    else if (ty === 'beauty') c.schedule = { on: { hour: 21, minute: 0 } };
    else c.schedule = { on: { hour: 20, minute: 0 } };
    return c;
   });
   try { await LN.schedule({ notifications: fb }); } catch (e2) {}
  }
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
  nativeAvailable: nativeLN, status: status
 };
})(window);
