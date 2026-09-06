/* ============================================================
  页面：健康饮食与睡眠管理
  睡眠打卡（23:00 睡 / 07:00 起） · 饮水 5 杯 · 卡路里记录
  ============================================================ */
(function (global) {
 var Pages = global.Pages = global.Pages || {};
 var esc = UI.esc;
 var TARGET_SLEEP = '23:00', TARGET_WAKE = '07:00';

 function nowHM() {
  var d = new Date();
  return (d.getHours() < 10 ? '0' : '') + d.getHours() + ':' + (d.getMinutes() < 10 ? '0' : '') + d.getMinutes();
 }
 function hm2min(s) { if (!s) return 0; var a = s.split(':'); return +a[0] * 60 + +a[1]; }
 function calcSleep(sleepAt, wakeAt) {
  if (!sleepAt || !wakeAt) return 0;
  var a = hm2min(sleepAt), b = hm2min(wakeAt);
  if (b <= a) b += 1440;
  return b - a;
 }

 /* ---------- 睡眠 ---------- */
 function sleepCard() {
  var td = Store.today();
  var h = Store.health(td);
  var mins = calcSleep(h.sleepAt, h.wakeAt);
  var goal = 480;
  var pct = Math.min(100, Math.round(mins / goal * 100));
  var lateTip = '';
  if (h.sleepAt) {
   var diff = hm2min(h.sleepAt) - hm2min(TARGET_SLEEP);
   if (h.sleepAt < '05:00') diff = hm2min(h.sleepAt) + 1440 - hm2min(TARGET_SLEEP);
   lateTip = diff > 15 ? '比目标晚了 ' + diff + ' 分钟' : '按时入睡，很棒';
  }
  return '' +
   '<div class="card">' +
    '<div class="sec-title"><h2><span class="bar-mark"></span>睡眠打卡</h2>' +
     '<span class="more">目标 ' + TARGET_SLEEP + ' 睡 · ' + TARGET_WAKE + ' 起</span></div>' +
    '<div class="row" style="gap:16px">' +
     UI.donut(pct, { size: 92, stroke: 11, text: mins ? (mins / 60).toFixed(1) + 'h' : '--', fontSize: 17, c1: '#95a8ff', c2: '#bac8ff' }) +
     '<div class="grow">' +
      '<div class="row" style="justify-content:space-between;font-size:13px;margin-bottom:6px"><span class="muted">入睡</span><b>' + (h.sleepAt || '--:--') + '</b></div>' +
      '<div class="row" style="justify-content:space-between;font-size:13px;margin-bottom:6px"><span class="muted">起床</span><b>' + (h.wakeAt || '--:--') + '</b></div>' +
      '<div class="row" style="justify-content:space-between;font-size:13px"><span class="muted">时长</span><b style="color:#5a7d70">' + (mins ? UI.fmtMin(mins) : '待记录') + '</b></div>' +
      (lateTip ? '<div class="muted" style="font-size:11px;margin-top:6px">' + lateTip + '</div>' : '') +
     '</div>' +
    '</div>' +
    '<div class="sleep-row">' +
     '<button class="sleep-btn' + (h.sleepAt ? ' on' : '') + '" data-act="sleep">' +
      '<div class="ic">' + Icons.cat('sleep', { radius: 11 }) + '</div>' +
      '<b>' + (h.sleepAt ? h.sleepAt : '入睡打卡') + '</b><span>' + (h.sleepAt ? '点击修改' : '目标 23:00') + '</span></button>' +
     '<button class="sleep-btn' + (h.wakeAt ? ' on' : '') + '" data-act="wake">' +
      '<div class="ic">' + Icons.cat('energy', { radius: 11 }) + '</div>' +
      '<b>' + (h.wakeAt ? h.wakeAt : '起床打卡') + '</b><span>' + (h.wakeAt ? '点击修改' : '目标 07:00') + '</span></button>' +
    '</div>' +
    weekSleep() +
   '</div>';
 }

 function weekSleep() {
  var data = Store.lastDays(7).map(function (dt) {
   var h = Store.state.health[dt];
   var m = h ? calcSleep(h.sleepAt, h.wakeAt) : 0;
   return { label: Store.weekShort(dt), value: Math.round(m / 6) / 10, hi: dt === Store.today() };
  });
  var has = data.some(function (x) { return x.value > 0; });
  if (!has) return '';
  return '<div style="margin-top:12px">' + UI.barChart(data, { height: 96 }) +
   '<div class="muted" style="text-align:center;font-size:11px">近 7 天睡眠时长（小时）</div></div>';
 }

 /* ---------- 饮水 ---------- */
 function waterCard() {
  var h = Store.health();
  var goal = Store.state.profile.waterGoal || 5;
  var cups = '';
  for (var i = 0; i < goal; i++) {
   cups += '<button class="cup' + (i < h.water ? ' on' : '') + '" data-cup="' + (i + 1) + '">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M6 4h12l-1.4 15.2a2 2 0 0 1-2 1.8H9.4a2 2 0 0 1-2-1.8z"/><path d="M6.7 11h10.6"/></svg></button>';
  }
  return '' +
   '<div class="card">' +
    '<div class="sec-title"><h2><span class="bar-mark"></span>饮水打卡</h2>' +
     '<span class="more">' + h.water + ' / ' + goal + ' 杯</span></div>' +
    '<div class="water-grid">' + cups + '</div>' +
    '<div class="muted" style="font-size:11.5px;margin-top:10px">' +
     (h.water >= goal ? '今日饮水已达标，身体很开心 ' : '还差 ' + (goal - h.water) + ' 杯，点一下水杯即可打卡') + '</div>' +
   '</div>';
 }

 /* ---------- 饮食 ---------- */
 function foodCard() {
  var h = Store.health();
  var goal = Store.state.profile.kcalGoal || 1800;
  var total = (h.meals || []).reduce(function (a, m) { return a + (+m.kcal || 0); }, 0);
  var pct = Math.min(100, Math.round(total / goal * 100));
  var list = (h.meals || []).map(function (m, i) {
   return '<div class="meal-item"><div class="grow"><b style="font-size:13.5px">' + esc(m.name) + '</b>' +
    '<div class="muted" style="font-size:11px">' + esc(m.time || '') + '</div></div>' +
    '<b style="color:#c9803a">' + m.kcal + ' kcal</b>' +
    '<button class="mini-act" data-del="' + i + '"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div>';
  }).join('');
  return '' +
   '<div class="card">' +
    '<div class="sec-title"><h2><span class="bar-mark"></span>饮食管理</h2>' +
     '<button class="pill-btn plain" id="addMeal">+ 记一餐</button></div>' +
    '<div class="kcal-ring">' +
     UI.donut(pct, { size: 96, stroke: 11, text: total + '', fontSize: 19, c1: '#ffa94d', c2: '#ffd8a8' }) +
     '<div class="grow">' +
      '<div style="font-size:13px" class="muted">今日摄入总卡路里</div>' +
      '<div style="font-size:26px;font-weight:800;line-height:1.2">' + total + ' <small style="font-size:12px;color:#93a3bd">kcal</small></div>' +
      '<div class="muted" style="font-size:11.5px">目标 ' + goal + ' kcal · ' +
       (total > goal ? '超出 ' + (total - goal) : '剩余 ' + (goal - total)) + ' kcal</div>' +
     '</div>' +
    '</div>' +
    (list ? '<div style="margin-top:14px">' + list + '</div>' : '<div class="muted" style="font-size:12.5px;margin-top:12px">还没有记录，点右上角添加</div>') +
   '</div>';
 }

 function mealSheet() {
  UI.sheet(
   '<h3>记录一餐</h3>' +
   '<div class="field"><label>名称</label><input type="text" id="mName" placeholder="例如：早餐 · 燕麦牛奶" maxlength="30"/></div>' +
   '<div class="field"><label>卡路里（kcal）</label><input type="number" id="mKcal" min="0" max="5000" step="10" placeholder="例如 420"/></div>' +
   '<div class="field"><label>快捷选择</label><div class="chips">' +
    ['早餐', '午餐', '晚餐', '加餐', '饮品'].map(function (t) { return '<button class="chip" data-quick="' + t + '">' + t + '</button>'; }).join('') +
   '</div></div>' +
   '<div class="sheet-actions"><button class="btn-ghost" data-act="cancel">取消</button>' +
   '<button class="btn-primary" data-act="ok">保存</button></div>',
   function (el) {
    UI.$$('[data-quick]', el).forEach(function (b) {
     b.onclick = function () { el.querySelector('#mName').value = b.dataset.quick + ' · '; el.querySelector('#mName').focus(); };
    });
    el.querySelector('[data-act=cancel]').onclick = UI.closeSheet;
    el.querySelector('[data-act=ok]').onclick = function () {
     var n = el.querySelector('#mName').value.trim();
     var k = +el.querySelector('#mKcal').value || 0;
     if (!n) { UI.toast('请填写名称'); return; }
     var h = Store.health();
     h.meals = h.meals || [];
     h.meals.push({ name: n, kcal: k, time: nowHM() });
     Store.save(); UI.closeSheet(); refresh(); UI.toast('已记录 ' + k + ' kcal');
    };
   }
  );
 }

 function timeSheet(which) {
  var h = Store.health();
  var cur = which === 'sleep' ? (h.sleepAt || TARGET_SLEEP) : (h.wakeAt || TARGET_WAKE);
  UI.sheet(
   '<h3>' + (which === 'sleep' ? '入睡时间' : '起床时间') + '</h3>' +
   '<div class="field"><label>选择时间</label><input type="time" id="tVal" value="' + cur + '"/></div>' +
   '<div class="field"><div class="chips">' +
    '<button class="chip" data-now="1">用当前时间 ' + nowHM() + '</button>' +
    '<button class="chip" data-set="' + (which === 'sleep' ? TARGET_SLEEP : TARGET_WAKE) + '">目标时间 ' + (which === 'sleep' ? TARGET_SLEEP : TARGET_WAKE) + '</button>' +
   '</div></div>' +
   '<div class="sheet-actions"><button class="btn-ghost" data-act="cancel">取消</button>' +
   '<button class="btn-primary" data-act="ok">打卡</button></div>',
   function (el) {
    var input = el.querySelector('#tVal');
    var q = el.querySelector('[data-now]'); if (q) q.onclick = function () { input.value = nowHM(); };
    var s = el.querySelector('[data-set]'); if (s) s.onclick = function () { input.value = s.dataset.set; };
    el.querySelector('[data-act=cancel]').onclick = UI.closeSheet;
    el.querySelector('[data-act=ok]').onclick = function () {
     var hh = Store.health();
     if (which === 'sleep') hh.sleepAt = input.value; else hh.wakeAt = input.value;
     hh.sleepMin = calcSleep(hh.sleepAt, hh.wakeAt);
     Store.save(); UI.closeSheet(); refresh();
     UI.toast(which === 'sleep' ? '晚安，好梦' : '早安，元气满满');
    };
   }
  );
 }

 function render() {
  return '<div class="fade-in">' + sleepCard() + waterCard() + foodCard() +
   '<div style="height:12px"></div></div>';
 }

 function refresh() {
  var view = UI.$('#view'); var st = view.scrollTop;
  view.innerHTML = render(); mount(view); view.scrollTop = st;
 }

 function mount(root) {
  UI.$$('[data-act]', root).forEach(function (b) {
   if (b.dataset.act === 'sleep' || b.dataset.act === 'wake') {
    b.onclick = function () { timeSheet(b.dataset.act); };
   }
  });
  UI.$$('[data-cup]', root).forEach(function (b) {
   b.onclick = function () {
    var h = Store.health(); var n = +b.dataset.cup;
    h.water = (h.water === n) ? n - 1 : n;
    Store.save(); refresh();
    if (h.water >= (Store.state.profile.waterGoal || 5)) UI.toast('喝水目标达成 ');
   };
  });
  var am = root.querySelector('#addMeal'); if (am) am.onclick = mealSheet;
  UI.$$('[data-del]', root).forEach(function (b) {
   b.onclick = function () {
    var h = Store.health(); h.meals.splice(+b.dataset.del, 1); Store.save(); refresh();
   };
  });
 }

 Pages.health = { key: 'health', name: '健康管理', sub: '睡眠 · 饮水 · 饮食', icon: 'health', render: render, mount: mount };
})(window);
