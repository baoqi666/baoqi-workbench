/* ============================================================
   推送 / 提醒管理
   - 原生：Capacitor LocalNotifications（APK 内置，关闭 APP 也能弹）
   - 兜底：浏览器 Notification（已安装 PWA 打开时弹）
   - 永远可用：应用内「今日推送」卡片（in-app 展示，不依赖权限）
   内容用「日期种子」稳定选取：同一周/同一天不变，跨周期变化。
   ============================================================ */
(function (global) {
 var KEY = 'catdesk.push.markers';
 var ID = { week: 2001, sentence: 2002, health: 2003, beauty: 2004, stretchM: 2005, stretchN: 2006, sleep: 2007 };
 /* 自建高优先级通知渠道。
    插件默认那条渠道 id='default' 是 IMPORTANCE_DEFAULT(3)，只会「叮一声 + 落在通知栏」，
    不会弹横幅（很多人因此以为「没收到」）。渠道的重要性一旦注册就无法再改，
    所以只能新建一条 importance=4(HIGH) 的渠道，并让所有通知都用它。 */
 var CHANNEL = 'focus';

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
 /* 排程标记：日期 + 时刻，保证「改了提醒时间」能重新排程（原仅按日期会漏掉当天未来的改时刻） */
 function dayKey(d, h, mi) {
  function p(n) { return (n < 10 ? '0' : '') + n; }
  return isoDate(d) + '@' + p(h) + ':' + p(mi);
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

 /* 当前周期应展示的内容（in-app 永远用这个）。
    玉琢：允许用户按日期覆盖「今日深度思考 / 美商修炼」的内容（Store.state.yuzhuo.content[日期]）。 */
 function current() {
  var td = Store.today();
  var C = global.PushContent || { changsha: [], sentences: [], health: [], beauty: [], stretch: [], sleep: [] };
  var yz = (Store.state && Store.state.yuzhuo && Store.state.yuzhuo.content && Store.state.yuzhuo.content[td]) || {};
  var sDef = pick(C.sentences, td) || {};
  var bDef = pick(C.beauty, td) || {};
  var sentence = yz.sentence ? Object.assign({}, sDef, yz.sentence) : sDef;
  var beauty = yz.beauty ? Object.assign({}, bDef, yz.beauty) : bDef;
  return {
   changsha: pick(C.changsha, td),   // 每天一个（原每周）
   sentence: sentence,
   health: pick(C.health, td),
   beauty: beauty,
   stretch: pick(C.stretch, td),
   sleep: pick(C.sleep, td)
  };
 }

 /* 每日提醒时间：用户可在玉琢里自定义，未设置则用默认小时。
   返回 { hour, minute }。remind 键：changsha/sentence/health/beauty/stretchA/stretchB/sleep。 */
 function remindHour(key, defHour) {
  var yz = (Store.state && Store.state.yuzhuo && Store.state.yuzhuo.remind) || {};
  var v = yz[key];
  if (v && typeof v === 'string' && /^\d{1,2}:\d{2}$/.test(v)) {
   var p = v.split(':'); var h = +p[0], m = +p[1];
   if (h >= 0 && h <= 23 && m >= 0 && m <= 59) return { hour: h, minute: m };
  }
  return { hour: defHour, minute: 0 };
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
   if (st && st.display === 'granted') { _perm = 'granted'; await ensureChannel(ln); return 'granted'; }
   if (st && st.display === 'denied') { _perm = 'denied'; return 'denied'; }
   var r = await ln.requestPermissions();
   if (r && r.display === 'granted') { _perm = 'granted'; await ensureChannel(ln); return 'granted'; }
   _perm = 'denied'; return 'denied';
  } catch (e) { return 'error'; }
 }
 if (!('Notification' in window)) return 'unsupported';
 if (Notification.permission === 'granted') { _perm = 'granted'; return 'granted'; }
 if (Notification.permission === 'denied') { _perm = 'denied'; return 'denied'; }
 try { var p = await Notification.requestPermission(); if (p === 'granted') _perm = 'granted'; return p; } catch (e) { return 'denied'; }
}

/* 建/确认高优先级渠道（Android 8+ 才有渠道概念，低版本 createChannel 会 reject，忽略即可） */
var _channelReady = false;
async function ensureChannel(ln) {
 if (_channelReady || !ln || typeof ln.createChannel !== 'function') return;
 _channelReady = true;
 try {
  await ln.createChannel({
   id: CHANNEL, name: '专注与提醒',
   description: '番茄钟到时 · 待办提醒 · 每日一句话',
   importance: 4,          // HIGH：弹横幅 + 响铃 + 锁屏可见，跟其他 App 一样
   visibility: 1,           // 锁屏显示完整内容
   vibration: true, lights: true
  });
 } catch (e) { _channelReady = false; }
}

 async function cancelNative(ids) {
  var ln = nativeLN();
  if (!ln) return;
  try {
   await ln.cancel({ notifications: ids.map(function (i) { return { id: i }; }) });
  } catch (e) {}
 }

 /* 查询系统里真正还挂着的本地通知 id 集合；查不到返回 null（插件不支持或被拦）。 */
 async function pendingIds(LN) {
  if (!LN || typeof LN.getPending !== 'function') return null;
  try {
   var r = await LN.getPending();
   var arr = (r && r.notifications) || [];
   var set = {};
   arr.forEach(function (n) { set[+n.id] = true; });
   return set;
  } catch (e) { return null; }
 }

/* 精确排程，失败降级为重复提醒 */
async function doSchedule(LN, items) {
 try {
   await LN.schedule({ notifications: withIdle(items) });
  } catch (e) {
    var fb = items.map(function (it) {
    var c = JSON.parse(JSON.stringify(it));
    var ty = (it.extra && it.extra.type);
    /* 优先用 extra 里携带的真实时刻（已含用户自定义），否则按类型回退默认 */
    if (it.extra && it.extra.hour != null) {
      c.schedule = { on: { hour: it.extra.hour, minute: (it.extra.minute != null ? it.extra.minute : 0) } };
    }
    else if (ty === 'sentence') c.schedule = { on: { hour: 8, minute: 0 } };
    else if (ty === 'beauty') c.schedule = { on: { hour: 21, minute: 0 } };
    else if (ty === 'changsha') c.schedule = { on: { hour: 8, minute: 0 } };
    else if (ty === 'stretch' || ty === 'sleep') c.schedule = { on: { hour: 11, minute: 0 } };
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
  if (c.channelId === undefined) c.channelId = CHANNEL;   // 走高优先级渠道才能弹横幅
  return c;
 });
}

 /* 原生排程：每天出门地点 + 每日句子 / 健康 / 美商 + 睡前拉伸(8&11点) + 睡觉(11点) */
 async function scheduleNative() {
  if (!nativeLN()) return false;
  var perm = await ensurePermission();
  if (perm !== 'granted') return false;
  var LN = nativeLN();
  var C = global.PushContent || { changsha: [], sentences: [], health: [], beauty: [], stretch: [], sleep: [] };
  var m = markers();
  var sched = [];

  /* ★ 自愈：localStorage 里的排程标记在杀后台、重启后都还在，
     但系统闹钟（AlarmManager）可能被清掉 —— Android 重启会清空 alarm，
     国产 ROM 的电池优化/自启动管控也会清。原来只看标记，标记说「今天排过了」
     就直接跳过，于是闹钟没了却永远补不回来，表现就是「重启或清后台后
     一条提醒都收不到，只能干等到第二天日期变了才恢复」。
     现在先看系统里真正还挂着的通知（getPending），缺失就补排；
     若无法核实（插件不支持）则每次打开都无条件补排 —— 同 id 覆盖、幂等，不会重复弹。 */
  var pending = await pendingIds(LN);
  function need(mark, key, id) {
   if (mark !== key) return true;      // 日期变了 / 用户改了提醒时刻 → 必须重排
   if (pending === null) return true;  // 无法核实系统状态 → 无条件补排（覆盖式，幂等）
   return !pending[id];                // 能核实 → 只补系统里确实已经没有的
  }

  // 每天 8:00 出门地点（内容按当天日期种子刷新，通知栏弹出）
  var ch = remindHour('changsha', 8);
  var cf = nextDailyFire(ch.hour, ch.minute);
  var cKey = isoDate(cf);
  if (need(m.changsha, cKey, ID.week)) {
   await cancelNative([ID.week]);
   var cp = pick(C.changsha, cKey) || { name: '出去走走', tip: '换换心情' };
   sched.push({
    id: ID.week, title: '今日出门去哪儿？',
    body: cp.name + ' · ' + cp.tip,
    schedule: { at: cf }, extra: { type: 'changsha', hour: ch.hour, minute: ch.minute }
   });
   m.changsha = cKey;
  }

  // 每日 8:00 句子（通知只放短引导，全文在玉琢模块）
  var sh = remindHour('sentence', 8);
  var sf = nextDailyFire(sh.hour, sh.minute);
  var sKey = isoDate(sf);
  if (need(m.sentence, sKey, ID.sentence)) {
   await cancelNative([ID.sentence]);
   var sObj = pick(C.sentences, sKey) || {};
   sched.push({
    id: ID.sentence, title: '今日深度思考 · 自信表达',
    body: sObj.brief || '今天给自己一段安静的思考',
    schedule: { at: sf }, extra: { type: 'sentence', hour: sh.hour, minute: sh.minute }
   });
   m.sentence = sKey;
  }

  // 每日 20:00 健康
  var hh = remindHour('health', 20);
  var hf = nextDailyFire(hh.hour, hh.minute);
  var hKey = dayKey(hf, hh.hour, hh.minute);
  if (need(m.health, hKey, ID.health)) {
   await cancelNative([ID.health]);
   sched.push({
    id: ID.health, title: '健康小知识',
    body: pick(C.health, hKey) || '照顾好身体，它是你长期的资产',
    schedule: { at: hf }, extra: { type: 'health', hour: hh.hour, minute: hh.minute }
   });
   m.health = hKey;
  }

  // 每日 21:00 美商修炼（玉琢模块）
  var bh = remindHour('beauty', 21);
  var bf = nextDailyFire(bh.hour, bh.minute);
  var bKey = isoDate(bf);
  if (need(m.beauty, bKey, ID.beauty)) {
   await cancelNative([ID.beauty]);
   var bObj = pick(C.beauty, bKey) || {};
   sched.push({
    id: ID.beauty, title: '美商修炼 · 今日',
    body: bObj.brief || '今天提升一点审美眼光',
    schedule: { at: bf }, extra: { type: 'beauty', hour: bh.hour, minute: bh.minute }
   });
   m.beauty = bKey;
  }

  // 睡前拉伸提醒：每天 8:00 与 11:00 各一条（内容按当天刷新）
  var sa = remindHour('stretchA', 8);
  var smf = nextDailyFire(sa.hour, sa.minute), smKey = isoDate(smf);
  if (need(m.stretchM, smKey, ID.stretchM)) {
   await cancelNative([ID.stretchM]);
   var sm = pick(C.stretch, smKey) || {};
   sched.push({
    id: ID.stretchM, title: '睡前拉伸提醒',
    body: sm.brief || '花 5–10 分钟做一组拉伸，放松肩颈和双腿，睡得更香',
    schedule: { at: smf }, extra: { type: 'stretch', hour: sa.hour, minute: sa.minute }
   });
   m.stretchM = smKey;
  }
  var sb = remindHour('stretchB', 11);
  var snf = nextDailyFire(sb.hour, sb.minute), snKey = isoDate(snf);
  if (need(m.stretchN, snKey, ID.stretchN)) {
   await cancelNative([ID.stretchN]);
   var sn = pick(C.stretch, snKey) || {};
   sched.push({
    id: ID.stretchN, title: '睡前拉伸提醒',
    body: sn.brief || '睡前拉伸一下，身体松了，入睡也更快',
    schedule: { at: snf }, extra: { type: 'stretch', hour: sb.hour, minute: sb.minute }
   });
   m.stretchN = snKey;
  }

  // 睡觉提醒：每天 11:00
  var slh = remindHour('sleep', 11);
  var slf = nextDailyFire(slh.hour, slh.minute), slKey = dayKey(slf, slh.hour, slh.minute);
  if (need(m.sleep, slKey, ID.sleep)) {
   await cancelNative([ID.sleep]);
   var sl = pick(C.sleep, slKey) || {};
   sched.push({
    id: ID.sleep, title: '睡觉提醒',
    body: sl.brief || '该准备休息了，放下手机，给身体一个完整的睡眠',
    schedule: { at: slf }, extra: { type: 'sleep', hour: slh.hour, minute: slh.minute }
   });
   m.sleep = slKey;
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
  var m = markers();
  var cur = current();
  try {
   if (m.sentence !== td) {
    var sObj = cur.sentence || {};
    new Notification('今日深度思考 · 自信表达', { body: sObj.brief || '今天给自己一段安静的思考' });
    new Notification('健康小知识', { body: cur.health || '' });
    m.sentence = td; m.health = td;
   }
   if (m.changsha !== td) {
    new Notification('今日出门去哪儿？', { body: (cur.changsha ? cur.changsha.name + ' · ' + cur.changsha.tip : '') });
    m.changsha = td;
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
 current: current, remindHour: remindHour, sync: sync, ensurePermission: ensurePermission,
 nativeAvailable: nativeLN, status: status,
 scheduleTodoReminders: scheduleTodoReminders, cancelTodoReminder: cancelTodoReminder,
 scheduleFocusEnd: scheduleFocusEnd, cancelFocusEnd: cancelFocusEnd, notifyFocusEnd: notifyFocusEnd
};
})(window);
