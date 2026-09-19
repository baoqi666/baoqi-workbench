/* ============================================================
  App：开屏 / 路由 / 抽屉导航 / 全局同步
  ============================================================ */
(function (global) {
 var $ = UI.$, $$ = UI.$$;
 var ROUTES = ['home', 'plan', 'ideas', 'express', 'dream', 'reward', 'health', 'fitness', 'review', 'weeksum'];
 var current = null;
 var entered = false;
 var fgHandle = null;    // 专注启动台的定时器监听
 var fgTask = '';        // 启动台上选中的今日计划项

 /* ---------------- 开屏 ---------------- */
 function dayHash(s) {
  var h = 0;
  for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
 }
 function paintQuote(force) {
  var q = Store.state.quote || { date: '', idx: 0 };
  var td = Store.today();
  if (force) {
   q.idx = Math.floor(Math.random() * QUOTES.length);
   q.date = td;
  } else if (q.date !== td) {
   q.idx = dayHash(td) % QUOTES.length;
   q.date = td;
  }
  Store.state.quote = q;
  Store.save();
  var item = QUOTES[q.idx % QUOTES.length];
  var el = $('#quoteText');
  el.style.opacity = 0;
  setTimeout(function () {
   el.textContent = item.t;
   $('#quoteAuthor').textContent = '—— ' + item.a;
   el.style.transition = 'opacity .3s ease';
   el.style.opacity = 1;
  }, force ? 140 : 0);
 }
 function paintSplashTime() {
  var d = new Date();
  $('#splashDate').textContent = d.getFullYear() + ' 年 ' + (d.getMonth() + 1) + ' 月 ' + d.getDate() + ' 日';
  $('#splashWeek').textContent = Store.weekName(Store.today());
  $('#splashTime').textContent = (d.getHours() < 10 ? '0' : '') + d.getHours() + ':' + (d.getMinutes() < 10 ? '0' : '') + d.getMinutes();
 }

 /* ---------------- 开屏：出门地点 + 开福区天气 ---------------- */
 function wxCodeText(code) {
  var map = { 0: '晴', 1: '大致晴朗', 2: '局部多云', 3: '阴', 45: '雾', 48: '雾凇',
   51: '毛毛雨', 53: '毛毛雨', 55: '毛毛雨', 56: '冻毛毛雨', 57: '冻毛毛雨',
   61: '小雨', 63: '中雨', 65: '大雨', 66: '冻雨', 67: '冻雨',
   71: '小雪', 73: '中雪', 75: '大雪', 77: '雪粒',
   80: '阵雨', 81: '阵雨', 82: '强阵雨', 85: '阵雪', 86: '阵雪',
   95: '雷阵雨', 96: '雷阵雨伴冰雹', 99: '雷阵雨伴冰雹' };
  return map[code] || '多云';
 }

 function paintSplashPlace() {
  var tEl = $('#placeText'), tipEl = $('#placeTip');
  if (!tEl) return;
  var c = (global.Push && Push.current) ? Push.current() : {};
  if (c.changsha) { tEl.textContent = c.changsha.name; if (tipEl) tipEl.textContent = c.changsha.tip; }
  else { tEl.textContent = '出去走走'; if (tipEl) tipEl.textContent = '换换心情'; }
 }

 function paintWeather() {
  var el = $('#weatherText'); if (!el) return;
  var td = Store.today();
  var cacheKey = 'catdesk.weather.' + td;
  function render(w) {
   if (!w) { el.textContent = '联网后显示开福区天气'; return; }
   el.innerHTML = w.temp + '° · ' + w.text +
    '<span style="font-size:var(--fs-4);color:var(--ink-3);font-weight:600;margin-left:6px">最高 ' + w.max + '° 最低 ' + w.min + '°</span>';
  }
  try {
   var cached = JSON.parse(localStorage.getItem(cacheKey) || 'null');
   if (cached) { render(cached); return; }
  } catch (e) {}
  if (typeof fetch !== 'function') { render(null); return; }
  var url = 'https://api.open-meteo.com/v1/forecast?latitude=28.2278&longitude=112.9389' +
   '&current=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min' +
   '&timezone=Asia%2FShanghai&forecast_days=1';
  fetch(url, { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (d) {
   try {
    var cur = d.current || {}; var dy = d.daily || {};
    var w = {
     temp: Math.round(cur.temperature_2m),
     text: wxCodeText(cur.weather_code),
     max: Math.round((dy.temperature_2m_max || [0])[0]),
     min: Math.round((dy.temperature_2m_min || [0])[0])
    };
    try { localStorage.setItem(cacheKey, JSON.stringify(w)); } catch (e2) {}
    render(w);
   } catch (e) { render(null); }
  }).catch(function () { render(null); });
 }

 /* 每日随机称呼：按日期取，同一天保持稳定 */
 var NAMES = ['宝子', '小可爱', '朋友', '小伙伴', '元气星人', '追光的人', '生活家',
  '认真的人', '小太阳', '早睡选手', '努力家', '慢半拍', '行动派', '小确幸', '今天的你'];
 function paintHi() {
  var el = $('#splashHi');
  if (!el) return;
  var s = Store.today(), n = 0, i;
  for (i = 0; i < s.length; i++) n = (n * 31 + s.charCodeAt(i)) % 100000;
  el.textContent = '嗨，' + NAMES[n % NAMES.length];
 }

 function initSplash() {
  $('#splashCat').innerHTML = Icons.splash();
  paintHi();
  paintSplashTime();
  paintQuote(false);
  paintSplashPlace();
  paintWeather();
  setInterval(paintSplashTime, 20000);

  $('#quoteRefresh').addEventListener('click', function (e) {
   e.stopPropagation();
   paintQuote(true);
  });
  $('#enterBtn').addEventListener('click', function (e) { e.stopPropagation(); enter(); });
  $('#splash').addEventListener('click', function () { enter(); });
 }

 function enter() {
  if (entered) return;
  entered = true;
  var sp = $('#splash');
  sp.classList.add('hide');
  $('#app').hidden = false;
  setTimeout(function () { sp.style.display = 'none'; }, 480);

  var n = Store.checkin();
  var moved = Store.rollover();
  var newSum = Store.autoArchiveWeeks();
  go('home');
  openFocusGate();          // 开屏之后直接给一个大号番茄钟，可立即开始计时
  if (global.Push && Push.sync) Push.sync();
  if (global.Push && Push.scheduleTodoReminders) Push.scheduleTodoReminders();
  setTimeout(function () {
   if (newSum > 0) UI.toast('已自动生成 ' + newSum + ' 篇周总结，去「周总结」查看 ');
   else if (moved) UI.toast('有 ' + moved + ' 项未完成任务已留存到今天');
   else UI.toast('连续打卡第 ' + n + ' 天，欢迎回来 ');
  }, 620);
 }

 /* ============ 专注启动台：开屏之后直接呈现的大号番茄钟 ============ */
 var FG_R = 92, FG_C = 2 * Math.PI * FG_R;

 function fgChips() {
  var list = Store.day(Store.today()).tasks.filter(function (t) { return !t.done; });
  if (!list.length) return '<div class="fg-empty">今日计划还没安排任务，直接开始计时也可以</div>';
  return list.map(function (t) {
   return '<button type="button" class="fg-chip' + (fgTask === t.id ? ' on' : '') + '" data-fgtask="' + t.id + '">' +
    UI.esc(t.title) + '</button>';
  }).join('');
 }

 function fgRenderTasks() {
  var box = $('#fgTasks');
  if (!box) return;
  box.innerHTML = fgChips();
  $$('[data-fgtask]', box).forEach(function (b) {
   b.onclick = function () {
    fgTask = (fgTask === b.dataset.fgtask) ? '' : b.dataset.fgtask;
    Timer.bind(fgTask);
    fgRenderTasks();
   };
  });
 }

 function fgPaint(t) {
  var gate = $('#focusGate');
  if (!gate || gate.hidden || !t) return;
  var pomo = t.mode === 'pomo';
  // 「本轮已进行了一部分但当前没在跑」= 暂停中
  var mid = pomo && t.phase === 'focus' && t.seconds > 0 && t.seconds < Timer.CONF.focus;
  var tm = $('#fgTime'); if (tm) tm.textContent = t.text;
  var ph = $('#fgPhase'); if (ph) ph.textContent = pomo ? t.phaseName : '自由计时';
  var sub = $('#fgSub');
  if (sub) sub.textContent = t.running
   ? '正在专注中 · 需要时点下方「带着计时器进入工作台」'
   : (mid ? '已暂停 · 继续专注，或进入工作台'
          : '选一项今日计划，按下开始即进入专注 · 不必先进工作台');
  var pr = $('#fgProg');
  if (pr) {
   pr.setAttribute('stroke-dashoffset', (FG_C * (1 - t.pct)).toFixed(1));
   pr.setAttribute('stroke', 'url(#' + (pomo && t.phase !== 'focus' ? 'fgRingR' : 'fgRingG') + ')');
  }
  var st = $('#fgStart');
  if (st) st.textContent = t.running ? '暂停' : (mid ? '继续专注' : (pomo ? '开始专注' : '开始计时'));
  var sk = $('#fgSkip');
  if (sk) sk.textContent = (t.running || mid) ? '带着计时器进入工作台' : '先进入工作台';
 }

 function openFocusGate() {
  var gate = $('#focusGate');
  if (!gate) return;
  var t = Timer.get();
  fgTask = t.taskId || '';
  gate.hidden = false;
  fgRenderTasks();
  fgPaint(t);
  setTimeout(function () { gate.classList.add('show'); }, 20);

  var st = $('#fgStart');
  if (st) st.onclick = function () {
   var cur = Timer.get();
   if (cur.running) { Timer.pause(); fgPaint(Timer.get()); syncChrome(); return; }
   if (cur.mode !== 'pomo') Timer.setMode('pomo');
   Timer.bind(fgTask);
   Timer.start();
   fgPaint(Timer.get());
   syncChrome();
   UI.toast('专注开始 · ' + Math.round(Timer.get().seconds / 60) + ' 分钟后提醒你');
   // 刻意「不」自动进入工作台：就停在启动台上直接计时，需要时再点「带着计时器进入工作台」
  };
  var sk = $('#fgSkip');
  if (sk) sk.onclick = function () { closeFocusGate(); };

  if (fgHandle) Timer.off(fgHandle);
  fgHandle = Timer.onChange(fgPaint);
 }

 function closeFocusGate() {
  var gate = $('#focusGate');
  if (!gate || gate.hidden) return;
  gate.classList.remove('show');
  if (fgHandle) { Timer.off(fgHandle); fgHandle = null; }
  setTimeout(function () { gate.hidden = true; }, 400);
  syncChrome();
 }

 /* ============ 计时结束 → 补录任务内容 → 自动完成今日计划项并记积分 ============ */
 /** 在今日计划中按标题匹配（先全等、再包含），只匹配未完成项 */
 function matchTodayTask(title) {
  var list = Store.day(Store.today()).tasks;
  var v = String(title || '').trim();
  if (!v) return null;
  var hit = null;
  list.forEach(function (t) {
   if (hit || t.done || !t.title) return;
   if (String(t.title).trim() === v) hit = t;
  });
  if (hit) return hit;
  list.forEach(function (t) {
   if (hit || t.done || !t.title) return;
   var tv = String(t.title).trim();
   if (!tv) return;
   if (tv.indexOf(v) >= 0 || v.indexOf(tv) >= 0) hit = t;
  });
  return hit;
 }

function sessionSheet(info) {
 info = info || {};
 var td = Store.today();
 var minutes = Math.max(1, Math.round(info.minutes || 0));
 var endAt = info.endTs || Date.now();      // 本轮真正的结束时刻
 var settled = false;                        // 已按用户所填记入 → 关闭时不再补「留痕」
 var bound = info.taskId ? Store.findTask(td, info.taskId) : null;
 var undone = Store.day(td).tasks.filter(function (t) { return !t.done; });
 var picks = undone.map(function (t) {
  return '<button type="button" class="fg-chip" data-pick="' + t.id + '">' + UI.esc(t.title) + '</button>';
 }).join('');

 /* 与「每日计划 → 新增今日计划」完全同构的字段初始值 */
 var v = {
  title: bound ? bound.title : '',
  cat: bound ? (bound.cat || 'invest') : 'invest',
  tag: bound ? (bound.tag || 'other') : 'other',
  priority: bound ? (bound.priority || 'mid') : 'mid',
  estMin: bound ? (bound.estMin || minutes) : minutes,
  level: bound ? (+bound.level || 2) : 2
 };
 var cur = { cat: v.cat, tag: v.tag, priority: v.priority, level: v.level };

 function hm(ts) {
  var d = new Date(ts);
  function p(n) { return (n < 10 ? '0' : '') + n; }
  return p(d.getHours()) + ':' + p(d.getMinutes());
 }

 /** 用户没填就离开（点「跳过填写」/ 点遮罩 / Esc）→ 也必须留痕：
     自动补一条已完成的计划项「专注 N 分钟 · 起-止」，把这段时长转到它名下。
     因为 estMin = 实到时长，toggleTask 的 doneCredit 折算为 0 → 当日专注不重复累加。 */
 function keepRecord() {
  if (settled) return;
  settled = true;
  var title = '专注 ' + minutes + ' 分钟 · ' + hm(endAt - minutes * 60000) + '-' + hm(endAt);
  var t = Store.addTask(td, {
   title: title, cat: 'system', tag: 'other',
   priority: 'mid', estMin: minutes, level: 2
  });
  if (Store.attributeFocus) Store.attributeFocus(td, minutes, info.taskId || '', t.id);
  Store.toggleTask(td, t.id);
  if (current === 'home' || current === 'plan') go(current); else syncChrome();
  UI.toast('已自动记下这一轮「' + title + '」，稍后可改成你做的事');
 }

 function segHtml(name, map, val, extra) {
  return '<div class="seg" data-seg="' + name + '">' + Object.keys(map).map(function (k) {
   return '<button type="button" data-val="' + k + '" class="' + (val === k ? 'on' : '') + '">' + map[k].name +
    (extra && map[k].desc ? '<small>' + map[k].desc + '</small>' : '') + '</button>';
  }).join('') + '</div>';
 }
 var lvHtml = '<div class="lv-seg" data-seg="level">' + [1, 2, 3, 4, 5].map(function (i) {
  return '<button type="button" data-val="' + i + '" class="' + (+v.level === i ? 'on' : '') + '">' + i +
   '<small>' + Store.ENERGY_MAP[i] + '</small></button>';
 }).join('') + '</div>';

 UI.sheet(
  '<h3>这一轮专注完成了</h3>' +
  '<p class="muted" style="text-align:center;margin:-6px 0 12px;font-size:var(--fs-4)">' +
   (info.late ? '上一轮专注在 APP 关闭时已经走完了 · ' : '') +
   '刚刚专注 ' + minutes + ' 分钟 · 像安排今日计划一样填好这次做的事，提交后自动勾选完成并记入积分</p>' +
  (picks ? '<div class="field"><label>今日计划（点一下直接带入）</label><div class="fg-picks">' + picks + '</div></div>' : '') +
  '<div class="muted" id="sessHint" style="margin:-6px 0 12px;font-size:var(--fs-4);color:var(--brand-ink)" ' +
   (bound ? '' : 'hidden') + '></div>' +
  '<div class="field"><label>任务名称</label>' +
   '<input type="text" id="fTitle" maxlength="40" placeholder="例如：英语听力精听 25 分钟" value="' +
    UI.esc(v.title) + '"/></div>' +
  '<div class="field"><label>任务分类</label>' + segHtml('cat', Store.CATS, v.cat, true) + '</div>' +
  '<div class="field"><label>统计归类（自动同步到首页大屏）</label>' + segHtml('tag', Store.TAGS, v.tag) + '</div>' +
  '<div class="field"><label>优先级</label>' + segHtml('priority', Store.PRIOS, v.priority) + '</div>' +
  '<div class="field"><label>预计时长（分钟）</label>' +
   '<input type="number" id="fMin" min="5" max="480" step="5" value="' + (v.estMin || minutes) + '"/></div>' +
  '<div class="field"><label id="lvLabel">精力消耗档位（1~5 级）</label>' + lvHtml + '</div>' +
  '<div class="sheet-actions">' +
   '<button class="btn-ghost" data-act="skip">跳过填写</button>' +
   '<button class="btn-primary" data-act="ok">完成并记入</button>' +
  '</div>',
  function (el) {
   var input = el.querySelector('#fTitle');
   var minEl = el.querySelector('#fMin');
   var hint = el.querySelector('#sessHint');
   var lvBox = el.querySelector('.lv-seg');
   var lvLabel = el.querySelector('#lvLabel');

   /** 档位区跟着任务分类变色（与计划页一致） */
   function syncLv() {
    if (lvBox) lvBox.className = 'lv-seg ' + (cur.cat === 'charge' ? 'green' : (cur.cat === 'system' ? 'warm' : ''));
    if (lvLabel) lvLabel.textContent = cur.cat === 'charge' ? '精力恢复档位（1~5 级）' : '精力消耗档位（1~5 级）';
   }
   function setSeg(name, val) {
    var box = el.querySelector('[data-seg="' + name + '"]');
    if (!box) return;
    UI.$$('button', box).forEach(function (b) { b.classList.toggle('on', b.dataset.val === String(val)); });
   }
   /** 命中今日计划项 → 把该项的填法整套带入（和编辑一条计划看到的一模一样） */
   function applyMatch(t) {
    if (!t) { if (hint) { hint.hidden = true; hint.textContent = ''; } return; }
    cur.cat = t.cat || 'invest'; cur.tag = t.tag || 'other';
    cur.priority = t.priority || 'mid'; cur.level = +t.level || 2;
    setSeg('cat', cur.cat); setSeg('tag', cur.tag);
    setSeg('priority', cur.priority); setSeg('level', cur.level);
    syncLv();
    if (minEl) minEl.value = t.estMin || minutes;
    if (hint) {
     hint.hidden = false;
     hint.textContent = '已匹配今日计划项「' + t.title + '」，提交后直接勾选完成';
    }
   }

   UI.$$('[data-seg]', el).forEach(function (g) {
    var name = g.dataset.seg;
    UI.segGroup(g, function (val) {
     cur[name] = name === 'level' ? +val : val;
     if (name === 'cat') syncLv();
    });
   });
   syncLv();
   if (bound) applyMatch(bound);

   $$('[data-pick]', el).forEach(function (b) {
    b.onclick = function () {
     var t = Store.findTask(td, b.dataset.pick);
     if (!t) return;
     if (input) input.value = t.title;
     applyMatch(t);
     $$('[data-pick]', el).forEach(function (x) { x.classList.toggle('on', x === b); });
    };
   });
   if (input) {
    input.addEventListener('input', function () { applyMatch(matchTodayTask(input.value)); });
    setTimeout(function () { try { input.focus(); } catch (e) {} }, 260);
   }
   var sk = el.querySelector('[data-act=skip]');
   if (sk) sk.onclick = function () { keepRecord(); UI.closeSheet(); };
   /* 点遮罩 / Esc 关掉也一样要留痕（不留「没记录」的空档） */
   if (UI.onClose) UI.onClose(keepRecord);
   el.querySelector('[data-act=ok]').onclick = function () {
    var title = input ? input.value.trim() : '';
    if (!title) { UI.toast('先填写这次做的事'); if (input) input.focus(); return; }
    var estMin = Math.max(5, (+(minEl && minEl.value)) || minutes);
    var before = Store.availablePoints();
    settled = true;                            // 已按所填记入 → 关闭钩子不再补留痕
    var target = matchTodayTask(title);
    if (target) {
     /* 命中已有计划项：按表单里的填法更新它，再勾选完成 */
     Store.updateTask(td, target.id, {
      title: title, cat: cur.cat, tag: cur.tag,
      priority: cur.priority, estMin: estMin, level: cur.level
     });
    } else {
     target = Store.addTask(td, {
      title: title, cat: cur.cat, tag: cur.tag,
      priority: cur.priority, estMin: estMin, level: cur.level
     });
    }
    // 本次专注时长转正到该任务（未绑定时原先记在「其他」下），当日专注总时长不重复累加
    if (Store.attributeFocus) Store.attributeFocus(td, minutes, info.taskId || '', target.id);
    Store.toggleTask(td, target.id);
    UI.closeSheet();
    var gain = Math.max(0, Store.availablePoints() - before);
    if (current === 'home' || current === 'plan') go(current); else syncChrome();
    UI.toast('已完成「' + title + '」 · 专注 +' + minutes + ' 分钟' + (gain ? ' · 积分 +' + gain : ''));
   };
  }
 );
}

 /* ---------------- PWA：安装到主屏 ---------------- */
 var deferredPrompt = null;
 function setupPWA() {
  // Capacitor 打包的安卓 App 已是原生壳，无需 Service Worker，且离线资源已内置
  if (window.Capacitor) return;
  // 注册离线缓存（仅 http/https 环境，file:// 不支持 Service Worker）
  if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
   window.addEventListener('load', function () {
    navigator.serviceWorker.register('sw.js').catch(function () {});
   });
  }
  // 捕获浏览器原生安装提示
  window.addEventListener('beforeinstallprompt', function (e) {
   e.preventDefault();
   deferredPrompt = e;
   var bar = $('#installBar');
   if (bar) bar.hidden = false;
  });
  window.addEventListener('appinstalled', function () {
   var bar = $('#installBar');
   if (bar) bar.hidden = true;
   deferredPrompt = null;
  });
  var bar = $('#installBar');
  if (bar) {
   $('#installBtn').onclick = function () {
    if (!deferredPrompt) { showInstallGuide(); return; }
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then(function () { deferredPrompt = null; bar.hidden = true; });
   };
   $('#installClose').onclick = function () { bar.hidden = true; };
  }
  var hint = $('#installHintBtn');
  if (hint) hint.onclick = function () { closeDrawer(); showInstallGuide(); };
 }
 function showInstallGuide() {
  var ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  var txt = ios
   ? 'iOS：点开 Safari 底部「分享」按钮 → 选「添加到主屏幕」→ 命名为「喵の工作台」。'
   : '安卓 / 桌面：点浏览器右上角菜单 →「安装应用 / 添加到主屏幕」即可。若没看到该选项，说明当前浏览器不支持，换个 Chrome 试试。';
  UI.confirm('安装到手机主屏', txt, function () {}, '我知道了');
 }

 /* ---------------- 全局底图：相册选择 + 智能取色 ---------------- */
 var THEME_KEYS = ['--bg', '--card', '--card-2', '--line', '--line-2', '--ink', '--ink-2', '--ink-3',
  '--brand', '--brand-ink', '--brand-soft', '--on-brand', '--shadow',
  '--wall-scrim', '--wall-blur', '--wall-sat', '--wall-bri', '--splash-veil',
  '--splash-glow', '--scene', '--wall-src'];

 function setWallImage(src) {
  var w = $('#wallpaper'), s = $('#wallScrim');
  var root = document.documentElement;
  if (!w) return;
  if (src) {
   root.style.setProperty('--wall-src', 'url("' + src + '")');   // 与开屏共用同一底图源
   w.classList.add('on');
   if (s) s.classList.add('on');
  } else {
   root.style.removeProperty('--wall-src');
   w.classList.remove('on');
   if (s) s.classList.remove('on');
  }
 }

 /** 启动恢复上次保存的底图与配色 */
 function initTheme() {
  if (!global.Theme || !Store.getWallpaper) return;
  var wp = Store.getWallpaper();
  if (!wp || !wp.src) return;
  if (wp.palette) { Theme.applyVars(wp.palette); setWallImage(wp.src); return; }
  Theme.setWallpaper(wp.src, function (vars) {
   if (vars) Store.setWallpaper(wp.src, vars);
  });
 }

 function setupWallpaper() {
  var btn = $('#wallpaperBtn'), file = $('#wallpaperFile');
  if (!btn || !file || !global.Theme) return;
  btn.onclick = function () { closeDrawer(); file.value = ''; file.click(); };
  file.onchange = function () {
   var f = file.files && file.files[0];
   if (!f) return;
   var fr = new FileReader();
   fr.onload = function () {
    Theme.compress(String(fr.result), 1280, 0.82, function (small) {
     Theme.preview(small, function () {           // 先即时套上，看全局效果
      UI.sheet(
       '<h3>底图预览</h3>' +
       '<p class="muted" style="text-align:center;margin:0 0 14px;font-size:var(--fs-4)">界面配色已按这张图自动调整，确认后生效</p>' +
       '<div class="wall-preview" style="background-image:url(&quot;' + small + '&quot;)"></div>' +
       '<div class="sheet-actions">' +
        '<button class="btn-ghost" data-act="cancel">取消</button>' +
        '<button class="btn-primary" data-act="ok">使用这张底图</button>' +
       '</div>',
       function (el) {
        el.querySelector('[data-act=cancel]').onclick = function () {
         Theme.restore();                        // 回滚到上一张 / 默认主题
         UI.closeSheet();
        };
        el.querySelector('[data-act=ok]').onclick = function () {
         var root = document.documentElement, saved = {}, i;
         for (i = 0; i < THEME_KEYS.length; i++) saved[THEME_KEYS[i]] = root.style.getPropertyValue(THEME_KEYS[i]);
         Store.setWallpaper(small, saved);
         UI.closeSheet();
         UI.toast('底图已应用 · 配色已自动跟随');
        };
       });
     });
    });
   };
   fr.readAsDataURL(f);
  };
 }

 /* ---------------- 抽屉 ---------------- */
 function buildDrawer() {
  $('#drawerAvatar').innerHTML = Icons.cat('home');
  $('#navList').innerHTML = ROUTES.map(function (k) {
   var p = Pages[k];
   return '<li><button class="nav-item" data-go="' + k + '">' +
    '<span class="ic">' + Icons.cat(p.icon) + '</span>' +
    '<span class="tx"><b>' + UI.esc(p.name) + '</b><span>' + UI.esc(p.sub) + '</span></span>' +
    '</button></li>';
  }).join('');
  $$('[data-go]').forEach(function (b) {
   b.onclick = function () { go(b.dataset.go); closeDrawer(); };
  });
  $('#menuBtn').onclick = openDrawer;
  $('#drawerClose').onclick = closeDrawer;
  $('#drawerMask').onclick = closeDrawer;
  $('#resetBtn').onclick = function () {
   closeDrawer();
   setTimeout(function () {
    UI.confirm('清空全部本地数据？', '所有任务、打卡、复盘记录都会被删除，且无法恢复。', function () {
     Store.reset();
     IDB.del('catdesk.timer');
     location.reload();
    }, '确认清空');
   }, 240);
  };

  // 数据备份：导出 / 导入（防丢兜底）
  $('#exportBtn').onclick = function () { openExportSheet('json'); };
  $('#importBtn').onclick = function () {
   closeDrawer();
   setTimeout(function () { $('#importFile').click(); }, 240);
  };
  $('#importFile').onchange = function () {
   var f = this.files && this.files[0];
   if (!f) return;
   var reader = new FileReader();
   var self = this;
   reader.onload = function () {
    try {
     var obj = JSON.parse(reader.result);
     UI.confirm('导入备份文件？', '将用备份覆盖当前全部数据，且无法撤销。建议先导出当前数据再导入。', function () {
      if (Store.importAll(obj)) { UI.toast('备份已恢复'); location.reload(); }
      else UI.toast('备份文件格式不正确');
     }, '确认导入');
    } catch (e) { UI.toast('备份文件无法解析'); }
    self.value = '';
   };
   reader.readAsText(f);
  };

  // 文本导出：把所有记录生成可读 .txt，方便离线手动备份
  $('#exportTxtBtn').onclick = function () { openExportSheet('txt'); };

  // 复制模板链接：把当前页面地址发给朋友，对方打开即自动生成一份独立副本
  var shareTplBtn = $('#shareTplBtn');
  if (shareTplBtn) shareTplBtn.onclick = function () {
   closeDrawer();
   var url = location.href.split('#')[0];
   var tip = '把这串链接发给朋友 / 评委：\n他们打开后会自动生成一份属于自己、与你互不干扰的独立工作台——这就是「复制模板」。\n\n链接已为你复制好，也可手动长按选择。';
   var html = ''
    + '<div class="sheet-head"><div class="sheet-title">复制模板链接</div>'
    + '<div class="sheet-sub">朋友打开即拥有同款 · 数据各自独立</div></div>'
    + '<textarea class="export-area" id="shareArea" readonly>' + escapeHtml(url) + '</textarea>'
    + '<div class="sheet-actions">'
    +  '<button class="btn primary" id="shareCopyBtn">复制链接</button>'
    + '</div>'
    + '<div class="sheet-hint" id="shareHint"></div>';
   UI.sheet(html, function (el) {
    var area = el.querySelector('#shareArea');
    el.querySelector('#shareCopyBtn').onclick = function () {
     area.removeAttribute('readonly'); area.focus(); area.select();
     var done = function () { UI.toast('已复制，去微信 / 邮件粘贴吧'); area.setAttribute('readonly', ''); };
     if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(done, function () {
       try { document.execCommand('copy'); done(); } catch (e) {}
      });
     } else { try { document.execCommand('copy'); done(); } catch (e) {} }
    };
   });
   setTimeout(function () { UI.toast('把这串链接发出去，朋友打开即拥有同款工作台'); }, 200);
  };
 }

 function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
 }

 function shareFallback(el) {
  var h = el && el.querySelector('#shareHint');
  if (h) h.textContent = '当前环境不支持系统分享，请点「复制全部」后粘贴到备忘录 / 微信 / 云盘保存。';
 }

 // 导出面板：直接展示内容 + 复制 + 系统分享保存（解决 WebView 下载文件找不到的问题）
 function openExportSheet(type) {
  var isJson = type === 'json';
  var title = isJson ? '数据备份（JSON）' : '数据导出（文本）';
  var filename = isJson ? ('catdesk-backup-' + Store.today() + '.json') : ('catdesk-export-' + Store.today() + '.txt');
  var content = isJson ? JSON.stringify(Store.exportAll(), null, 2) : buildTextExport();
  var mime = isJson ? 'application/json' : 'text/plain';
  closeDrawer();
  var html = ''
   + '<div class="sheet-head"><div class="sheet-title">' + title + '</div>'
   + '<div class="sheet-sub">已生成备份，可下载文件 / 复制 / 系统分享，建议存到云盘</div></div>'
   + '<textarea class="export-area" id="exportArea" readonly>' + escapeHtml(content) + '</textarea>'
   + '<div class="sheet-actions">'
   +  '<button class="btn primary" id="downloadBtn"> 下载文件</button>'
   +  '<button class="btn ghost" id="copyBtn"> 复制全部</button>'
   +  '<button class="btn ghost" id="shareBtn"> 保存 / 分享</button>'
   + '</div>'
   + '<div class="sheet-hint" id="shareHint"></div>';
  UI.sheet(html, function (el) {
   var area = el.querySelector('#exportArea');
   el.querySelector('#downloadBtn').onclick = function () {
    try {
     var blob = new Blob([content], { type: mime + ';charset=utf-8' });
     var url = URL.createObjectURL(blob);
     var a = document.createElement('a');
     a.href = url; a.download = filename;
     document.body.appendChild(a); a.click();
     document.body.removeChild(a);
     setTimeout(function () { try { URL.revokeObjectURL(url); } catch (e) {} }, 2000);
     UI.toast('文件已下载：' + filename + '（请存到云盘保底）');
    } catch (e) { shareFallback(el); }
   };
   el.querySelector('#copyBtn').onclick = function () {
    area.removeAttribute('readonly'); area.focus(); area.select();
    var done = function () { UI.toast('已复制，可粘贴保存'); area.setAttribute('readonly', ''); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
     navigator.clipboard.writeText(content).then(done, function () {
      try { document.execCommand('copy'); done(); } catch (e) { shareFallback(el); }
     });
    } else { try { document.execCommand('copy'); done(); } catch (e) { shareFallback(el); } }
   };
   el.querySelector('#shareBtn').onclick = function () {
    var blob = new Blob([content], { type: mime + ';charset=utf-8' });
    var file = new File([blob], filename, { type: mime });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
     navigator.share({ files: [file], title: '喵の工作台' + (isJson ? ' 备份' : ' 导出') })
      .then(function () { UI.toast('已通过系统分享保存'); })
      .catch(function () {});
    } else if (navigator.share) {
     navigator.share({ title: '喵の工作台', text: content }).catch(function () {});
    } else {
     shareFallback(el);
    }
   };
  });
 }

 /* 生成可读文本备份 */
 function buildTextExport() {
  var s = Store.state, td = Store.today();
  var L = [];
  var line = function (t) { L.push(t); };
  line('========================================');
  line(' 喵の工作台 · 全部记录文本备份');
  line(' 导出日期：' + new Date().toLocaleString('zh-CN'));
  line('========================================');
  line('');
  line('【基础信息】');
  line(' 用户名：' + (s.profile && s.profile.name || '喵の工作台'));
  line(' 每日精力上限：' + (s.profile && s.profile.energyMax || 100) + ' 点');
  line(' 连续打卡：' + (s.streak && s.streak.count || 0) + ' 天');
  line('');
  line('【累计统计】');
  line(' 英语听力：' + s.stats.english.min + ' 分钟 / ' + s.stats.english.count + ' 次');
  line(' 知识学习：' + s.stats.knowledge.min + ' 分钟 / ' + s.stats.knowledge.count + ' 次');
  line(' 账号更新：' + s.stats.account.min + ' 分钟 / ' + s.stats.account.count + ' 次');
  line(' 其他：' + s.stats.other.min + ' 分钟 / ' + s.stats.other.count + ' 次');
  line('');
  line('【' + td + ' 当日计划】');
  var d = Store.day(td);
  if (d && d.tasks.length) {
   d.tasks.forEach(function (t, i) {
    var cat = (Store.CATS[t.cat] && Store.CATS[t.cat].name) || t.cat;
    var tag = (Store.TAGS[t.tag] && Store.TAGS[t.tag].name) || t.tag;
    var pri = (Store.PRIOS[t.priority] && Store.PRIOS[t.priority].name) || t.priority;
    var lvl = (Store.LEVEL_LABEL[t.level] || '') + '(L' + t.level + ')';
    line(' ' + (i + 1) + '. ' + (t.done ? '[✓]' : '[ ]') + ' ' + t.title);
    line('    分类:' + cat + ' | 标签:' + tag + ' | 优先级:' + pri + ' | 预计:' + t.estMin + '分钟 | 精力:' + lvl + (t.carried ? ' | 留存' : ''));
   });
  } else { line(' （无）'); }
  line(' 当日番茄数：' + (d ? (d.pomos || 0) : 0) + '  专注时长：' + (d ? (d.focusMin || 0) : 0) + ' 分钟');
  line(' 当日剩余精力：' + Store.energyOf(td).left + ' 点');
  line('');
  line('【灵感 / 学有余力清单】');
  if (s.ideas && s.ideas.length) {
   s.ideas.forEach(function (it, i) {
    line(' ' + (i + 1) + '. ' + (it.done ? '[✓]' : '[ ]') + ' ' + it.title + ' #' + (it.tag || '') + (it.note ? ' (' + it.note + ')' : '') + (it.feel ? ' · 感受：' + it.feel : ''));
   });
  } else { line(' （无）'); }
  line('');
  line('【健康 · 睡眠 / 饮水 / 饮食】');
  var h = Store.health(td);
  line(' 睡眠：' + (h.sleepAt || '--') + ' → ' + (h.wakeAt || '--') + ' 时长 ' + (h.sleepMin || 0) + ' 分钟');
  line(' 饮水：' + (h.water || 0) + ' 杯');
  if (h.meals && h.meals.length) {
   h.meals.forEach(function (m, i) { line('  餐' + (i + 1) + '：' + m.kcal + ' kcal ' + (m.note || '')); });
  }
  line('');
  line('【运动打卡】');
  var fl = Store.fitLogs(td);
  if (fl && fl.length) {
   fl.forEach(function (l, i) { line(' ' + (i + 1) + '. ' + l.name + ' ' + l.minutes + ' 分钟'); });
  } else { line(' （今日无）'); }
  line(' 本周运动打卡总览：');
  (s.fitness.presets || []).forEach(function (p) {
   var c = Store.fitWeekCount(p.id, td);
   var tgt = p.perWeek || 0;
   line('  · ' + p.name + '：' + c + '/' + tgt + ' 次（目标）');
  });
  line('');
  line('【周复盘归档（共 ' + (s.reviews ? s.reviews.length : 0) + ' 篇）】');
  if (s.reviews && s.reviews.length) {
   s.reviews.slice(0, 30).forEach(function (r, i) {
    line(' ' + (i + 1) + '. [' + (r.week || '') + '] ' + (r.title || '未命名') + (r.createdAt ? ' (' + new Date(r.createdAt).toLocaleDateString('zh-CN') + ')' : ''));
    ['summary', 'learn', 'life', 'sport', 'money', 'problem', 'improve', 'goal'].forEach(function (f) {
     if (r[f]) line('   - ' + f + '：' + r[f]);
    });
   });
  } else { line(' （无）'); }
  line('');

  line('【周总结归档（共 ' + (s.summaries ? s.summaries.length : 0) + ' 篇）】');
  if (s.summaries && s.summaries.length) {
   s.summaries.slice().sort(function (a, b) { return a.week < b.week ? 1 : -1; }).forEach(function (w, i) {
    line(' ' + (i + 1) + '. [' + w.week + '] ' + w.range + ' · ' + w.tagline);
    line('    专注 ' + w.focusMin + ' 分 · 番茄 ' + w.pomos + ' 个 · 任务 ' + w.done + '/' + w.taskTotal + ' · 运动 ' + w.fitCount + ' 次/' + w.fitMin + ' 分 · 饮水 ' + w.water + ' 杯 · 睡眠 ' + w.sleepDays + ' 天');
    if (w.budget) line('    预算 ' + w.budget.amount + ' / 已花 ' + w.budget.spent + ' / 已存 ' + w.budget.saved + ' / 剩余 ' + w.budget.left);
    if (w.fundsTotal) line('    储蓄罐合计 ' + w.fundsTotal + ' 元');
    if (w.note) line('    手记：' + w.note);
   });
  } else { line(' （无）'); }
  line('');

  line('【自信表达 · 口语输出】');
  line(' 累计输出时长：' + s.stats.output.min + ' 分钟 / ' + s.stats.output.count + ' 次');
  line('');

  line('【当日充能记录】');
  var ch = (Store.day(td).charges || []);
  if (ch.length) {
   ch.forEach(function (c, i) { line(' ' + (i + 1) + '. +' + c.amount + ' ' + (c.label || '') + (c.ts ? ' (' + new Date(c.ts).toLocaleString('zh-CN') + ')' : '')); });
  } else { line(' （无）'); }
  line('');

  line('【梦想储蓄罐（共 ' + (s.funds ? s.funds.length : 0) + ' 个基金）】');
  if (s.funds && s.funds.length) {
   s.funds.forEach(function (f, i) {
    var pct = f.target ? Math.round((f.balance || 0) / f.target * 100) : 0;
    line(' ' + (i + 1) + '. ' + f.name + '：已存 ' + (f.balance || 0) + ' / 目标 ' + f.target + ' 元（' + pct + '%）');
    (f.deposits || []).slice(-8).reverse().forEach(function (d) {
     line('    · ' + (d.amount > 0 ? '+' : '') + d.amount + ' 元' + (d.note ? ' · ' + d.note : '') + (d.ts ? ' (' + new Date(d.ts).toLocaleDateString('zh-CN') + ')' : ''));
    });
   });
  } else { line(' （无）'); }
  line('');

  line('【当日待办（含具体时间）】');
  var todos = Store.sortedTodos(td);
  if (todos.length) {
   todos.forEach(function (t, i) { line(' ' + (i + 1) + '. ' + (t.time ? t.time + ' ' : '') + (t.done ? '[✓]' : '[ ]') + ' ' + t.title); });
  } else { line(' （无）'); }
  line('');

  line('———— 本文件由「喵の工作台」离线导出，可安全保存到手机或云盘 ————');
  return L.join('\n');
 }
 function openDrawer() { $('#drawer').classList.add('open'); $('#drawerMask').classList.add('show'); }
 function closeDrawer() { $('#drawer').classList.remove('open'); $('#drawerMask').classList.remove('show'); }

 /* ---------------- 路由 ---------------- */
 function go(key) {
  var page = Pages[key];
  if (!page) return;
  if (current && Pages[current] && Pages[current].unmount) Pages[current].unmount();
  current = key;
  if (page.onEnter) page.onEnter();
  $('#pageTitle').textContent = page.name;
  $('#pageSub').textContent = page.sub;
  var view = $('#view');
  view.innerHTML = page.render();
  view.scrollTop = 0;
  page.mount(view);
  $$('[data-go]').forEach(function (b) {
   b.classList.toggle('active', b.dataset.go === key);
  });
  renderTopRight(key);
  syncChrome();
 }

 function renderTopRight(key) {
  var box = $('#topbarRight');
  var td = Store.today();
  if (key === 'plan') {
   var e = Store.energyOf(td);
   box.innerHTML = '<span class="tag blue" style="padding:6px 10px;font-size:var(--fs-4)">精力 ' + e.left + '</span>';
  } else if (key === 'home') {
   box.innerHTML = '<span class="tag pink" style="padding:6px 10px;font-size:var(--fs-4)">连续 ' + Store.state.streak.count + ' 天</span>';
  } else {
   box.innerHTML = '';
  }
 }

 /* ---------------- 全局同步 ---------------- */
 function syncChrome() {
  var e = Store.energyOf(Store.today());
  $('#drawerEnergy').textContent = e.left;
  $('#drawerEnergyBar').style.width = e.pctLeft + '%';
  $('#drawerStreak').textContent = '连续打卡 ' + Store.state.streak.count + ' 天 · 今日 ' + (Store.day().pomos || 0) + ' 番茄';
  renderTopRight(current);
  syncMini(Timer.get());
 }

 function syncMini(t) {
  var el = $('#miniTimer');
  if (!el) return;
  var show = t.running && current !== 'plan';
  el.hidden = !show;
  if (show) {
   $('#mtText').textContent = t.text;
   var c = 2 * Math.PI * 19;
   $('#mtProgress').setAttribute('stroke-dasharray', c.toFixed(1));
   $('#mtProgress').setAttribute('stroke-dashoffset', (c * (1 - t.pct)).toFixed(1));
  }
 }

 /* ---------------- 启动 ---------------- */
 function boot() {
  Store.seed();
  initTheme();
  initSplash();
  buildDrawer();
  setupPWA();
  setupWallpaper();
  Timer.init();
  Timer.onChange(function (t) { syncMini(t); });
  Timer.onFinish(function (info) {
   closeFocusGate();
   // 25 分钟自然走完 → 补一条系统通知（不看日期、不看星期）
   // late = APP 关着时走完、刚打开才补结算的，人就在眼前，不必再弹通知
   if (info && info.natural && !info.late && global.Push && Push.notifyFocusEnd) Push.notifyFocusEnd();
   sessionSheet(info);
  });                                  // 到点：收起启动台 → 提示 + 补录层
  $('#miniTimer').onclick = function () { go('plan'); };

  // 首次打开提示：每人自动获得独立副本（数据仅存本地，与分享者互不可见）
  if (!localStorage.getItem('catdesk_tpl_hint')) {
   localStorage.setItem('catdesk_tpl_hint', '1');
   setTimeout(function () {
    UI.toast('你已拥有这份工作台的独立副本 · 数据仅存你本地');
   }, 1300);
  }

  // 跨零点自动切换日期
  setInterval(function () {
   if (!entered) return;
   var td = Store.today();
   if (boot._d && boot._d !== td) {
    boot._d = td;
    Store.checkin();
    Store.rollover();
    go(current || 'home');
   }
  }, 60000);
  boot._d = Store.today();

  // 键盘 Esc 关闭弹层
  document.addEventListener('keydown', function (e) {
   if (e.key === 'Escape') { UI.closeSheet(); closeDrawer(); }
  });
 }

 global.App = {
  go: go, syncChrome: syncChrome, openDrawer: openDrawer, closeDrawer: closeDrawer,
  /* 将一条「学有余力」灵感直接加入指定日期的每日计划。返回 {exists:true} 或 {task:t} */
  addIdeaToPlan: function (idea, date) {
   if (!idea) return { error: true };
   date = date || Store.today();
   var day = Store.day(date);
   for (var i = 0; i < day.tasks.length; i++) {
    if (day.tasks[i].ideaId === idea.id) return { exists: true };
   }
   var t = Store.addTask(date, {
    title: idea.title, cat: 'invest', tag: 'other',
    priority: 'mid', estMin: 25, level: 2, ideaId: idea.id
   });
   return { task: t };
  }
 };
 // 先打开 IndexedDB，再启动应用（确保数据已就绪）
 document.addEventListener('DOMContentLoaded', function () {
  Store.open().then(boot).catch(function () { boot(); });
 });
})(window);
