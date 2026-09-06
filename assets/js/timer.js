/* ============================================================
  Timer：番茄钟 / 正计时 双模式计时引擎
  - 番茄钟：专注 25min → 短休 5min，每 4 个番茄 → 长休 15min
  - 完成一个番茄：累计专注时长 + 自动扣减绑定任务精力
  - 正计时：自由计时，停止时记录单项任务耗时
  ============================================================ */
(function (global) {
 var TKEY = 'catdesk.timer';
 var CONF = { focus: 25 * 60, short: 5 * 60, long: 15 * 60, longEvery: 4 };

 var s = {
  mode: 'pomo',   // pomo | watch
  phase: 'focus',  // focus | short | long
  running: false,
  remain: CONF.focus,
  elapsed: 0,
  taskId: '',
  cycle: 0,     // 连续番茄计数
  endTs: 0,
  startTs: 0
 };

 var listeners = [];
 var ticker = null;

 function persist() {
  IDB.set(TKEY, s);
 }
 function restore() {
  return IDB.get(TKEY).then(function (o) {
   if (!o || typeof o !== 'object') return;
   for (var k in o) if (k in s) s[k] = o[k];
   if (s.running) {
    var now = Date.now();
    if (s.mode === 'pomo') {
     s.remain = Math.max(0, Math.round((s.endTs - now) / 1000));
     if (s.remain <= 0) { s.running = false; s.remain = phaseTotal(); }
    } else {
     s.elapsed = Math.max(0, Math.round((now - s.startTs) / 1000));
    }
   }
  });
 }

 function phaseTotal() {
  return s.phase === 'focus' ? CONF.focus : (s.phase === 'short' ? CONF.short : CONF.long);
 }
 function phaseName() {
  return s.phase === 'focus' ? '专注中' : (s.phase === 'short' ? '短休息' : '长休息');
 }
 function emit() { listeners.forEach(function (f) { try { f(snapshot()); } catch (e) { } }); }
 function snapshot() {
  var total = s.mode === 'pomo' ? phaseTotal() : Math.max(60, Math.ceil((s.elapsed + 1) / 60) * 60);
  var cur = s.mode === 'pomo' ? s.remain : s.elapsed;
  var pct = s.mode === 'pomo'
   ? (total ? (total - s.remain) / total : 0)
   : (s.elapsed % 3600) / 3600;
  return {
   mode: s.mode, phase: s.phase, phaseName: phaseName(), running: s.running,
   seconds: cur, text: mmss(cur), pct: Math.min(1, pct), taskId: s.taskId, cycle: s.cycle
  };
 }
 function mmss(sec) {
  sec = Math.max(0, Math.round(sec));
  var m = Math.floor(sec / 60), ss = sec % 60;
  if (m >= 60) {
   var h = Math.floor(m / 60);
   return h + ':' + pad(m % 60) + ':' + pad(ss);
  }
  return pad(m) + ':' + pad(ss);
 }
 function pad(n) { return n < 10 ? '0' + n : '' + n; }

 function loop() {
  clearInterval(ticker);
  ticker = setInterval(function () {
   if (!s.running) return;
   var now = Date.now();
   if (s.mode === 'pomo') {
    s.remain = Math.max(0, Math.round((s.endTs - now) / 1000));
    if (s.remain <= 0) { finishPhase(); }
   } else {
    s.elapsed = Math.max(0, Math.round((now - s.startTs) / 1000));
   }
   emit();
  }, 250);
 }

 function beep(times) {
  try {
   var AC = global.AudioContext || global.webkitAudioContext;
   if (!AC) return;
   var ctx = new AC();
   for (var i = 0; i < (times || 2); i++) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = 660 + i * 130;
    g.gain.value = 0.0001;
    o.connect(g); g.connect(ctx.destination);
    var t0 = ctx.currentTime + i * 0.34;
    g.gain.exponentialRampToValueAtTime(0.13, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.28);
    o.start(t0); o.stop(t0 + 0.3);
   }
   setTimeout(function () { try { ctx.close(); } catch (e) { } }, 1600);
  } catch (e) { }
 }

 /** 番茄阶段结束 */
 function finishPhase() {
  var td = Store.today();
  if (s.phase === 'focus') {
   Store.addPomo(td, s.taskId);
   Store.addFocus(td, s.taskId, CONF.focus / 60);
   if (s.taskId) Store.chargePomo(td, s.taskId);
   s.cycle += 1;
   var isLong = s.cycle % CONF.longEvery === 0;
   s.phase = isLong ? 'long' : 'short';
   UI.toast(isLong ? '完成 4 个番茄，进入长休息 15 分钟' : '一个番茄完成，休息 5 分钟');
  } else {
   s.phase = 'focus';
   UI.toast('休息结束，准备下一个番茄 ~');
  }
  s.remain = phaseTotal();
  s.running = false;
  s.endTs = 0;
  beep(s.phase === 'focus' ? 2 : 3);
  persist();
  emit();
  if (global.Pages && Pages.plan && Pages.plan.refresh) Pages.plan.refresh();
  if (global.App && App.syncChrome) App.syncChrome();
 }

 var API = {
  CONF: CONF,
  get: snapshot,
  onChange: function (fn) { listeners.push(fn); return fn; },
  off: function (fn) { listeners = listeners.filter(function (f) { return f !== fn; }); },

  setMode: function (m) {
   if (s.mode === m) return;
   if (s.running) API.stop(true);
   s.mode = m;
   s.phase = 'focus';
   s.remain = CONF.focus;
   s.elapsed = 0;
   persist(); emit();
  },
  bind: function (taskId) { s.taskId = taskId || ''; persist(); emit(); },

  start: function () {
   if (s.running) return;
   s.running = true;
   var now = Date.now();
   if (s.mode === 'pomo') s.endTs = now + s.remain * 1000;
   else s.startTs = now - s.elapsed * 1000;
   persist(); emit(); loop();
  },
  pause: function () {
   if (!s.running) return;
   s.running = false;
   if (s.mode === 'pomo') s.remain = Math.max(0, Math.round((s.endTs - Date.now()) / 1000));
   persist(); emit();
  },
  /** 停止：正计时结算耗时；番茄放弃当前 */
  stop: function (silent) {
   var td = Store.today();
   if (s.mode === 'watch') {
    var min = Math.round(s.elapsed / 60);
    if (min > 0) {
     Store.addFocus(td, s.taskId, min);
     if (!silent) UI.toast('已记录本次耗时 ' + min + ' 分钟');
    }
    s.elapsed = 0;
   } else {
    if (s.phase === 'focus' && !silent) {
     var done = Math.round((phaseTotal() - s.remain) / 60);
     if (done >= 1) { Store.addFocus(td, s.taskId, done); UI.toast('已记录专注 ' + done + ' 分钟'); }
    }
    s.remain = phaseTotal();
   }
   s.running = false;
   s.endTs = 0;
   persist(); emit();
   if (global.Pages && Pages.plan && Pages.plan.refresh) Pages.plan.refresh();
   if (global.App && App.syncChrome) App.syncChrome();
  },
  reset: function () {
   s.running = false;
   s.phase = 'focus';
   s.remain = CONF.focus;
   s.elapsed = 0;
   s.endTs = 0;
   persist(); emit();
  },
  resetCycle: function () { s.cycle = 0; persist(); emit(); },
  /** 跳过当前阶段（用于休息阶段直接开始） */
  skip: function () {
   if (s.mode !== 'pomo') return;
   s.phase = s.phase === 'focus' ? 'short' : 'focus';
   s.remain = phaseTotal();
   s.running = false;
   persist(); emit();
  },
  init: function () { restore().then(function () { emit(); }); loop(); emit(); }
 };

 global.Timer = API;
})(window);
