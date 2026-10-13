/* ============================================================
   微交互 / 动效层（finesse animate · h5 工作台）
   原则：
   1) 只叠加动画，绝不改动原有业务逻辑 / 文案 / 布局结构；
   2) 任何一步抛错都被吞掉，动画失败不影响功能；
   3) 尊重 prefers-reduced-motion，降低动效时直接走原逻辑；
   4) 时长统一控制在 0.3~1.2s，节奏舒缓。
   ============================================================ */
(function (global) {
 'use strict';
 var D = document;
 var RM = false;
 try { RM = !!(global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) {}
 var WA = !!(global.Element && Element.prototype.animate);

 function $(s, c) { try { return (c || D).querySelector(s); } catch (e) { return null; } }
 function $$(s, c) { try { return Array.prototype.slice.call((c || D).querySelectorAll(s)); } catch (e) { return []; } }
 function intOf(s) { var m = String(s == null ? '' : s).match(/\d+/); return m ? +m[0] : null; }
 function safe(fn) { return function () { try { return fn.apply(this, arguments); } catch (e) {} }; }

 /* 主滚动容器 */
 function scroller() {
  var v = $('#view');
  if (v && v.scrollHeight - v.clientHeight > 4) return v;
  var app = $('.app');
  if (app && app.scrollHeight - app.clientHeight > 4) return app;
  return D.scrollingElement || D.documentElement;
 }

 /* ============================================================
    1. 完成反馈按钮（#enterBtn「开始今天」= 每日签到打卡入口）
    点击 → 收缩成圆 → 画出对勾 → 粒子迸发 → 更新连续打卡天数（1.2s）
    ============================================================ */
 function playParticles(el) {
  if (!WA || RM) return;
  var r = el.getBoundingClientRect();
  var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  var colors = ['#7fb8f5', '#a9c9b8', '#f0c98a', '#e6a9a0', '#c9b6e4'];
  for (var i = 0; i < 14; i++) {
   var node = D.createElement('i');
   node.className = 'fin-particle';
   node.style.left = (cx - 3.5) + 'px';
   node.style.top = (cy - 3.5) + 'px';
   node.style.background = colors[i % colors.length];
   D.body.appendChild(node);
   (function (n, idx) {
    var ang = (Math.PI * 2) * (idx / 14) + (Math.random() * 0.5);
    var dist = 42 + Math.random() * 40;
    var dx = Math.cos(ang) * dist, dy = Math.sin(ang) * dist;
    var a = n.animate([
     { transform: 'translate(0,0) scale(.35)', opacity: 0 },
     { transform: 'translate(' + (dx * .55) + 'px,' + (dy * .55) + 'px) scale(1)', opacity: 1, offset: .28 },
     { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(.18)', opacity: 0 }
    ], { duration: 720 + Math.random() * 240, easing: 'cubic-bezier(.2,.8,.3,1)', delay: 380 + idx * 8 });
    a.onfinish = function () { try { n.remove(); } catch (e) {} };
   })(node, i);
   (function (n) { setTimeout(function () { try { n.remove(); } catch (e) {} }, 1500); })(node);
  }
 }

 /* 数字平滑滚动（保留原有后缀，如 <small>天</small>） */
 function animateCount(el, from, to, dur) {
  if (!el) return;
  if (from == null || to == null || from === to) return;
  var html = el.innerHTML;
  var m = html.match(/\d+/);
  if (!m) return;
  var idx = m.index, len = m[0].length, t0 = 0;
  dur = dur || 620;
  function step(now) {
   if (!t0) t0 = now;
   var p = Math.min(1, (now - t0) / dur);
   var e = 1 - Math.pow(1 - p, 3);
   var v = Math.round(from + (to - from) * e);
   el.innerHTML = html.slice(0, idx) + v + html.slice(idx + len);
   if (p < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
 }

 function streakBefore() {
  try { return global.Store && Store.state && Store.state.streak ? Store.state.streak.count : null; } catch (e) { return null; }
 }
 function animateStreak(from) {
  var el = $('.streak-card .v');
  if (!el) return;
  var to = streakBefore();
  animateCount(el, from, to, 620);
 }

 function initCheckin() {
  var btn = $('#enterBtn');
  if (!btn || btn.dataset.finBound) return;
  btn.dataset.finBound = '1';
  var chk = D.createElement('span');
  chk.className = 'fin-check';
  chk.innerHTML = '<svg viewBox="0 0 24 24"><path d="M4 12.5 9.5 18 20 6.5"/></svg>';
  btn.appendChild(chk);

  /* 捕获阶段拦截：先播动画，再放行原有 enter() 逻辑（100% 保留原功能） */
  D.addEventListener('click', safe(function (e) {
   var t = e.target; if (!t || !t.closest) return;
   var b = t.closest('#enterBtn');
   if (!b || b.dataset.finDone || RM) return;
   e.stopPropagation(); e.preventDefault();
   var before = streakBefore();
   try { b.classList.add('fin-run'); } catch (err) {}
   setTimeout(safe(function () { b.classList.add('fin-draw'); }), 60);
   playParticles(b);
   setTimeout(safe(function () {
    b.dataset.finDone = '1';
    try { b.click(); } catch (err) {}
    setTimeout(safe(function () { animateStreak(before); }), 320);
   }), 1200);
  }), true);
 }

 /* ============================================================
    2. 勾选联动（.task-item / .todo-item 的 [data-act=toggle]）
    ① 统计数字平滑滚动 ② 顶部小型环形进度条增长 ③ 顶部背景柔和渐变（0.7s 恢复）
    三者同步执行
    ============================================================ */
 var pendingOld = null;

 function ensureRing() {
  var bar = $('.topbar');
  if (!bar) return null;
  var ring = bar.querySelector('.fin-ring');
  if (!ring) {
   ring = D.createElement('div');
   ring.className = 'fin-ring';
   ring.innerHTML = '<svg viewBox="0 0 30 30"><circle class="bg" cx="15" cy="15" r="13"></circle>' +
    '<circle class="fg" cx="15" cy="15" r="13" stroke-dasharray="81.7" stroke-dashoffset="81.7"></circle></svg>';
   bar.appendChild(ring);
  }
  var fl = bar.querySelector('.fin-flashlayer');
  if (!fl) {
   fl = D.createElement('div');
   fl.className = 'fin-flashlayer';
   bar.insertBefore(fl, bar.firstChild);
  }
  return { ring: ring, flash: fl };
 }

 function todayPct() {
  try {
   var td = global.Store.today();
   var tasks = (global.Store.day(td).tasks) || [];
   if (!tasks.length) return 0;
   var dn = tasks.filter(function (t) { return t.done; }).length;
   return dn / tasks.length;
  } catch (e) { return 0; }
 }

 function numTargetOf(tick) {
  var g = tick.closest('.task-group') || tick.closest('.card') || tick.closest('.todo-item');
  var el = g && g.querySelector('.group-head .muted');
  return el || $('.streak-card .v');
 }

 function runLinkage() {
  if (RM) return;
  var kit = ensureRing();
  var pct = todayPct();

  /* ① 统计数字平滑滚动 */
  var target = numTargetOf(D.querySelector('[data-act="toggle"]') || D.body);
  if (target && pendingOld != null) {
   var now = intOf(target.textContent);
   animateCount(target, pendingOld, now, 620);
  }
  pendingOld = null;

  if (!kit) return;
  /* ② 环形进度条平滑增长 */
  var fg = kit.ring.querySelector('.fg');
  var C = 81.7;
  fg.style.transition = 'none';
  fg.style.strokeDashoffset = C;
  kit.ring.classList.add('on');
  requestAnimationFrame(safe(function () {
   requestAnimationFrame(safe(function () {
    fg.style.transition = 'stroke-dashoffset .72s cubic-bezier(.25,.9,.3,1)';
    fg.style.strokeDashoffset = (C * (1 - pct)).toFixed(2);
   }));
  }));
  /* ③ 顶部背景柔和渐变，0.7s 后恢复 */
  var fl = kit.flash;
  fl.classList.remove('on');
  void fl.offsetWidth;
  fl.classList.add('on');
  setTimeout(safe(function () { fl.classList.remove('on'); }), 720);
  setTimeout(safe(function () { kit.ring.classList.remove('on'); }), 1250);
 }

 function initToggle() {
  /* 捕获阶段：记下旧值（业务会立刻 refresh 重渲染） */
  D.addEventListener('click', safe(function (e) {
   var t = e.target; if (!t || !t.closest) return;
   var tick = t.closest('[data-act="toggle"]');
   if (!tick) return;
   var el = numTargetOf(tick);
   pendingOld = el ? intOf(el.textContent) : null;
  }), true);
  /* 冒泡阶段：业务逻辑（含 refresh）已执行完，播放联动动画 */
  D.addEventListener('click', safe(function (e) {
   var t = e.target; if (!t || !t.closest) return;
   if (!t.closest('[data-act="toggle"]')) return;
   requestAnimationFrame(safe(function () { setTimeout(safe(runLinkage), 40); }));
  }), false);
 }

 /* ============================================================
    3. 叠卡展开（首页 .stat-grid 的统计卡片组）
    初始堆叠（每张向右上偏移露边）→ 点顶层依次展开（间隔 .2s）→ 再点原路收起
    ============================================================ */
 function initDeck() {
  /* 2026-10-13 关闭：初始堆叠让首页统计区看起来是「一堆歪着的卡片」，是「排版杂乱」的直接来源。
     现在统计网格保持正常平铺；需要叠卡效果时把下面这行 return 去掉即可。 */
  return;
  var grid = $('.stat-grid');
  if (!grid || grid.dataset.finDeck) return;
  var cards = $$('.stat-card', grid);
  if (cards.length < 2) return;
  grid.dataset.finDeck = '1';
  grid.classList.add('fin-deck', 'fin-collapsed');
  cards.forEach(function (c) { c.style.transitionDuration = '.38s'; });
 }

 function toggleDeck(grid) {
  var cards = $$('.stat-card', grid);
  var collapsed = grid.classList.contains('fin-collapsed');
  var n = cards.length;
  cards.forEach(function (c, i) {
   /* 展开：正序；收起：原路（倒序） */
   var order = collapsed ? i : (n - 1 - i);
   c.style.transitionDelay = (order * 200) + 'ms';
  });
  if (collapsed) grid.classList.remove('fin-collapsed');
  else grid.classList.add('fin-collapsed');
  setTimeout(safe(function () {
   cards.forEach(function (c) { c.style.transitionDelay = ''; });
  }), n * 200 + 500);
 }

 function initDeckClick() {
  D.addEventListener('click', safe(function (e) {
   var t = e.target; if (!t || !t.closest) return;
   var card = t.closest('.stat-card');
   if (!card) return;
   var grid = card.parentElement;
   if (!grid || !grid.classList.contains('fin-deck')) return;
   if (RM) { grid.classList.remove('fin-collapsed'); return; }
   toggleDeck(grid);
  }), false);
 }

 /* ============================================================
    4. 吸附卡 + 侧边连接线逐笔绘制
    ============================================================ */
 var snapTimer = null;
 function drawLink(item) {
  if (!item || RM) return;
  var old = item.querySelector('.fin-linkline');
  if (old) { try { old.remove(); } catch (e) {} }
  var h = item.offsetHeight || 60;
  var NS = 'http://www.w3.org/2000/svg';
  var total = h + 16, segH = total / 3;
  var svg = D.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'fin-linkline');
  svg.setAttribute('viewBox', '0 0 16 ' + total);
  svg.setAttribute('width', '16');
  svg.setAttribute('height', String(total));
  for (var i = 0; i < 3; i++) {
   var p = D.createElementNS(NS, 'path');
   var y1 = i * segH + 6, y2 = (i + 1) * segH - 6;
   var len = Math.max(2, y2 - y1);
   p.setAttribute('d', 'M8 ' + y1.toFixed(1) + ' L8 ' + y2.toFixed(1));
   p.style.strokeDasharray = len;
   p.style.strokeDashoffset = len;
   svg.appendChild(p);
   (function (path, l, delay) {
    setTimeout(safe(function () {
     path.style.transition = 'stroke-dashoffset .26s ease';
     path.style.strokeDashoffset = '0';
    }), delay);
   })(p, len, i * 140);
  }
  var dot = D.createElementNS(NS, 'circle');
  dot.setAttribute('cx', '8'); dot.setAttribute('cy', '8'); dot.setAttribute('r', '3.2');
  dot.style.opacity = '0';
  dot.style.transition = 'opacity .3s ease';
  svg.appendChild(dot);
  item.appendChild(svg);
  setTimeout(safe(function () { dot.style.opacity = '1'; }), 380);
 }

 function onScrollEnd() {
  var sc = scroller();
  var items = $$('.task-item');
  if (!items.length) return;
  var vr = sc.getBoundingClientRect();
  var mid = vr.top + vr.height / 2;
  var best = null, bd = Infinity;
  items.forEach(function (it) {
   var r = it.getBoundingClientRect();
   var d = Math.abs((r.top + r.height / 2) - mid);
   if (d < bd) { bd = d; best = it; }
  });
  if (!best) return;
  $$('.task-item.fin-snapped').forEach(function (x) { x.classList.remove('fin-snapped'); });
  best.classList.add('fin-snapped');
  drawLink(best);
 }

 function initSnap() {
  /* 2026-10-13 关闭：scroll-snap 与下面第 5 项的手动位移、以及原生惯性三者互相打架，
     在 Android WebView 上表现为滑动顿挫 + 松手后位置乱跳；且 onScrollEnd 会对每个
     .task-item 做 getBoundingClientRect（强制同步布局）。需要时去掉下面这行 return。 */
  return;
  var sc = scroller();
  if (!sc) return;
  if ($$('.task-item').length) {
   sc.classList.add('fin-snap');
   $$('.task-item').forEach(function (it) { it.classList.add('fin-snap-align'); });
  } else {
   sc.classList.remove('fin-snap');
  }
  if (sc.dataset.finSnapBound) return;
  sc.dataset.finSnapBound = '1';
  sc.addEventListener('scroll', safe(function () {
   clearTimeout(snapTimer);
   snapTimer = setTimeout(safe(onScrollEnd), 140);
  }), { passive: true });
 }

 /* ============================================================
    5. 惯性滚动 + 边界阻尼回弹（不劫持原生惯性，只在边界做阻尼）
    ============================================================ */
 function bindMomentum() {
  /* 2026-10-13 关闭：对「滚动容器自身」做 translateY 会让它脱离原生滚动的合成路径，
     是滑动掉帧最确定的一个来源（触摸移动期间每帧写 transform + 读 scrollHeight）。
     边界回弹这个效果代价大于收益。需要时去掉下面这行 return。 */
  return;
  var sc = scroller();
  if (!sc || sc.dataset.finMom) return;
  sc.dataset.finMom = '1';
  sc.classList.add('fin-momentum');
  var startY = 0, dragging = false, edge = '', base = 0;

  sc.addEventListener('touchstart', safe(function (e) {
   if (RM) return;
   var t = e.touches && e.touches[0]; if (!t) return;
   startY = t.clientY; dragging = true;
   var max = sc.scrollHeight - sc.clientHeight;
   edge = (sc.scrollTop <= 0) ? 'top' : (sc.scrollTop >= max - 1 ? 'bottom' : '');
   sc.classList.add('fin-rubber');
  }), { passive: true });

  sc.addEventListener('touchmove', safe(function (e) {
   if (!dragging || !edge || RM) return;
   var t = e.touches && e.touches[0]; if (!t) return;
   var dy = t.clientY - startY;
   if (edge === 'top' && dy > 0) base = Math.min(46, dy * 0.32);
   else if (edge === 'bottom' && dy < 0) base = Math.max(-46, dy * 0.32);
   else base = 0;
   sc.style.transform = 'translateY(' + base.toFixed(1) + 'px)';
  }), { passive: true });

  function release() {
   if (!dragging) return;
   dragging = false;
   if (base !== 0) {
    sc.style.transition = 'transform .42s cubic-bezier(.2,.9,.3,1)';
    sc.style.transform = 'translateY(0)';
    setTimeout(safe(function () {
     sc.style.transition = ''; sc.style.transform = '';
     sc.classList.remove('fin-rubber');
    }), 450);
   } else {
    sc.classList.remove('fin-rubber');
   }
   base = 0; edge = '';
  }
  sc.addEventListener('touchend', safe(release), { passive: true });
  sc.addEventListener('touchcancel', safe(release), { passive: true });
 }

 /* ============================================================
    6. 圆形扩散转场（语录卡 / 计划卡 → 详情弹窗，关闭反向收缩）
    ============================================================ */
 function maxR(x, y) {
  var w = global.innerWidth, h = global.innerHeight;
  return Math.sqrt(Math.max(x, w - x) * Math.max(x, w - x) + Math.max(y, h - y) * Math.max(y, h - y)) + 40;
 }

 function openReveal(srcEl, x, y) {
  var overlay = D.createElement('div');
  overlay.className = 'fin-reveal';
  var panel = D.createElement('div');
  panel.className = 'fin-reveal-panel';
  /* 只复用卡片原有内容，不新增文案 */
  var body = srcEl.cloneNode(true);
  $$( 'button, .fin-linkline, .fin-check', body).forEach(function (b) { try { b.remove(); } catch (e) {} });
  panel.appendChild(body);
  var close = D.createElement('button');
  close.className = 'fin-close';
  close.type = 'button';
  close.textContent = '关闭';
  panel.appendChild(close);
  overlay.appendChild(panel);
  D.body.appendChild(overlay);

  var R = maxR(x, y);
  function setClip(r) {
   overlay.style.clipPath = 'circle(' + r + 'px at ' + x + 'px ' + y + 'px)';
   overlay.style.webkitClipPath = 'circle(' + r + 'px at ' + x + 'px ' + y + 'px)';
  }
  setClip(0);
  if (WA && !RM) {
   overlay.animate([
    { clipPath: 'circle(0px at ' + x + 'px ' + y + 'px)' },
    { clipPath: 'circle(' + R + 'px at ' + x + 'px ' + y + 'px)' }
   ], { duration: 420, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'forwards' });
   setTimeout(safe(function () { setClip(R); overlay.classList.add('in'); }), 400);
  } else {
   setClip(R); overlay.classList.add('in');
  }

  function closeIt() {
   if (overlay.dataset.finClosing) return;
   overlay.dataset.finClosing = '1';
   overlay.classList.remove('in');
   if (WA && !RM) {
    var a = overlay.animate([
     { clipPath: 'circle(' + R + 'px at ' + x + 'px ' + y + 'px)' },
     { clipPath: 'circle(0px at ' + x + 'px ' + y + 'px)' }
    ], { duration: 340, easing: 'cubic-bezier(.4,0,.5,1)', fill: 'forwards' });
    a.onfinish = function () { try { overlay.remove(); } catch (e) {} };
   }
   setTimeout(safe(function () { try { overlay.remove(); } catch (e) {} }), 420);
  }
  close.onclick = safe(closeIt);
  overlay.addEventListener('click', safe(function (e) { if (e.target === overlay) closeIt(); }));
 }

 function initReveal() {
  D.addEventListener('click', safe(function (e) {
   var t = e.target; if (!t || !t.closest) return;
   /* 语录卡（排除「换一条」按钮） */
   var quote = t.closest('#quoteCard');
   if (quote && !t.closest('#quoteRefresh')) {
    if (RM) return;
    openReveal(quote, e.clientX || 0, e.clientY || 0);
    return;
   }
   /* 计划卡（只命中卡片主体，避开 tick / edit / bind 等按钮） */
   var item = t.closest('.task-item');
   if (item && !t.closest('button') && !t.closest('[data-act]')) {
    if (RM) return;
    openReveal(item, e.clientX || 0, e.clientY || 0);
   }
  }), false);
 }

 /* ============================================================
    装配 + 页面重渲染后重新绑定
    ============================================================ */
 function applyAll() {
  initDeck();
  initSnap();
  bindMomentum();
 }

 function boot() {
  initCheckin();
  initToggle();
  initDeckClick();
  initReveal();
  applyAll();
  var v = $('#view');
  if (v && global.MutationObserver) {
   var timer = null;
   new MutationObserver(safe(function () {
    clearTimeout(timer);
    timer = setTimeout(safe(applyAll), 80);
   })).observe(v, { childList: true, subtree: false });
  }
 }

 if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', safe(boot));
 else boot();

 global.FinMotion = { version: '1.0', boot: boot, applyAll: applyAll };
})(window);
