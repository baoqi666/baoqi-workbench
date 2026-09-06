/* ============================================================
  页面：运动计划与打卡
  预设板块 / 日周月计划 / 一键套用 / 完成度复盘
  ============================================================ */
(function (global) {
 var Pages = global.Pages = global.Pages || {};
 var esc = UI.esc;
 var scope = 'week'; // day | week | month

 function weekStats() {
  var start = Store.monday(Store.today());
  var count = 0, minutes = 0;
  for (var i = 0; i < 7; i++) {
   var d = Store.shift(start, i);
   (Store.state.fitness.logs[d] || []).forEach(function (l) { count++; minutes += l.minutes; });
  }
  var target = Store.state.fitness.presets.reduce(function (a, p) { return a + p.perWeek; }, 0);
  return { count: count, minutes: minutes, target: target, pct: target ? Math.min(100, Math.round(count / target * 100)) : 0 };
 }

 function overview() {
  var w = weekStats();
  var m = Store.fitMonthMinutes();
  var today = Store.fitLogs().length;
  return '' +
   '<div class="card">' +
    '<div class="sec-title"><h2><span class="bar-mark"></span>训练概览</h2>' +
     '<span class="more">' + Store.monday(Store.today()).slice(5) + ' 起本周</span></div>' +
    '<div class="row" style="gap:16px">' +
     UI.donut(w.pct, { size: 96, stroke: 11, text: w.pct + '%', fontSize: 19, c1: '#69db7c', c2: '#b2f2bb' }) +
     '<div class="grow">' +
      '<div class="row" style="justify-content:space-between;font-size:13px;margin-bottom:6px"><span class="muted">本周完成</span><b>' + w.count + ' / ' + w.target + ' 次</b></div>' +
      '<div class="row" style="justify-content:space-between;font-size:13px;margin-bottom:6px"><span class="muted">本周时长</span><b style="color:#2c9a70">' + UI.fmtMin(w.minutes) + '</b></div>' +
      '<div class="row" style="justify-content:space-between;font-size:13px;margin-bottom:6px"><span class="muted">本月累计</span><b>' + m.count + ' 次 · ' + UI.fmtMin(m.minutes) + '</b></div>' +
      '<div class="row" style="justify-content:space-between;font-size:13px"><span class="muted">今日已打卡</span><b>' + today + ' 项</b></div>' +
     '</div>' +
    '</div>' +
   '</div>';
 }

 function presetItem(p) {
  var done = Store.fitWeekCount(p.id);
  var pct = Math.min(100, Math.round(done / p.perWeek * 100));
  return '' +
   '<div class="fit-item" data-pid="' + p.id + '">' +
    '<div class="ic">' + Icons.cat(p.icon || 'fitness', { radius: 12 }) + '</div>' +
    '<div class="grow">' +
     '<div class="row"><b style="font-size:14px">' + esc(p.name) + '</b>' +
      '<span class="muted" style="font-size:11px;margin-left:6px">' + esc(p.desc || '') + '</span></div>' +
     '<div class="muted" style="font-size:11px;margin-top:2px">每周 ' + p.perWeek + ' 次 · 每次 ' + p.minutes + ' 分钟</div>' +
     '<div class="fit-prog"><i style="width:' + pct + '%"></i></div>' +
    '</div>' +
    '<div style="text-align:right">' +
     '<div class="fit-count">' + done + '/' + p.perWeek + '</div>' +
     '<div class="row" style="gap:5px;margin-top:6px">' +
      '<button class="mini-act" data-act="cfg"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15.2 4.3 19.7 8.8 8.5 20H4v-4.5z"/></svg></button>' +
      '<button class="mini-act play" data-act="log"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M5 12.5 9.8 17 19 7"/></svg></button>' +
     '</div>' +
    '</div>' +
   '</div>';
 }

 function todayList() {
  var logs = Store.fitLogs();
  if (!logs.length) return '<div class="muted" style="font-size:12.5px;padding:4px 4px 8px">今天还没有训练记录，点右侧 ✓ 一键打卡</div>';
  return logs.map(function (l) {
   return '<div class="meal-item"><div class="grow"><b style="font-size:13.5px">' + esc(l.name) + '</b>' +
    '<div class="muted" style="font-size:11px">' + l.minutes + ' 分钟</div></div>' +
    '<button class="mini-act" data-rm="' + l.id + '"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div>';
  }).join('');
 }

 function monthChart() {
  var data = [];
  for (var w = 3; w >= 0; w--) {
   var start = Store.shift(Store.monday(Store.today()), -7 * w);
   var m = 0;
   for (var i = 0; i < 7; i++) {
    (Store.state.fitness.logs[Store.shift(start, i)] || []).forEach(function (l) { m += l.minutes; });
   }
   data.push({ label: w === 0 ? '本周' : w + '周前', value: m, hi: w === 0 });
  }
  return '<div class="card"><div class="sec-title"><h2><span class="bar-mark"></span>近 4 周训练时长（分钟）</h2></div>' +
   UI.barChart(data, { height: 108 }) + '</div>';
 }

 function unfinished() {
  var list = Store.state.fitness.presets.filter(function (p) { return Store.fitWeekCount(p.id) < p.perWeek; });
  if (!list.length) return '<div class="card tight">' +
   '<b style="font-size:13.5px">本周计划已全部完成，太强了</b></div>';
  return '<div class="card tight">' +
   '<b style="font-size:13.5px">本周待完成提醒</b>' +
   '<div class="chips" style="margin-top:9px">' + list.map(function (p) {
    return '<span class="chip">' + esc(p.name) + ' 还差 ' + (p.perWeek - Store.fitWeekCount(p.id)) + ' 次</span>';
   }).join('') + '</div></div>';
 }

 function logSheet(preset) {
  var name = preset ? preset.name : '';
  var min = preset ? preset.minutes : 15;
  UI.sheet(
   '<h3>' + (preset ? '打卡：' + esc(preset.name) : '自定义训练打卡') + '</h3>' +
   '<div class="field"><label>训练内容</label><input type="text" id="lName" value="' + esc(name) + '" placeholder="例如：15 分钟体态训练" maxlength="30"/></div>' +
   '<div class="field"><label>时长（分钟）</label><input type="number" id="lMin" min="1" max="300" step="5" value="' + min + '"/></div>' +
   '<div class="field"><div class="chips">' +
    [5, 15, 20, 30, 45, 60].map(function (m) { return '<button class="chip" data-min="' + m + '">' + m + ' 分钟</button>'; }).join('') +
   '</div></div>' +
   '<div class="sheet-actions"><button class="btn-ghost" data-act="cancel">取消</button>' +
   '<button class="btn-primary" data-act="ok">完成打卡</button></div>',
   function (el) {
    UI.$$('[data-min]', el).forEach(function (b) { b.onclick = function () { el.querySelector('#lMin').value = b.dataset.min; }; });
    el.querySelector('[data-act=cancel]').onclick = UI.closeSheet;
    el.querySelector('[data-act=ok]').onclick = function () {
     var n = el.querySelector('#lName').value.trim();
     if (!n) { UI.toast('请填写训练内容'); return; }
     Store.addFitLog(Store.today(), { presetId: preset ? preset.id : '', name: n, minutes: +el.querySelector('#lMin').value || 15 });
     UI.closeSheet(); refresh(); UI.toast('打卡成功，继续保持');
    };
   }
  );
 }

 function cfgSheet(preset) {
  UI.sheet(
   '<h3>调整「' + esc(preset.name) + '」计划</h3>' +
   '<div class="field"><label>板块名称</label><input type="text" id="pName" value="' + esc(preset.name) + '" maxlength="20"/></div>' +
   '<div class="field"><label>训练内容说明</label><input type="text" id="pDesc" value="' + esc(preset.desc || '') + '" maxlength="40"/></div>' +
   '<div class="field"><label>每周目标次数</label><input type="number" id="pWeek" min="1" max="14" value="' + preset.perWeek + '"/></div>' +
   '<div class="field"><label>单次时长（分钟）</label><input type="number" id="pMin" min="5" max="180" step="5" value="' + preset.minutes + '"/></div>' +
   '<div class="sheet-actions">' +
   (preset.custom ? '<button class="btn-danger" data-act="del">删除板块</button>' : '<button class="btn-ghost" data-act="cancel">取消</button>') +
   '<button class="btn-primary" data-act="ok">保存</button></div>',
   function (el) {
    var c = el.querySelector('[data-act=cancel]'); if (c) c.onclick = UI.closeSheet;
    var dl = el.querySelector('[data-act=del]');
    if (dl) dl.onclick = function () {
     Store.state.fitness.presets = Store.state.fitness.presets.filter(function (p) { return p.id !== preset.id; });
     Store.save(); UI.closeSheet(); refresh(); UI.toast('已删除');
    };
    el.querySelector('[data-act=ok]').onclick = function () {
     preset.name = el.querySelector('#pName').value.trim() || preset.name;
     preset.desc = el.querySelector('#pDesc').value.trim();
     preset.perWeek = +el.querySelector('#pWeek').value || 1;
     preset.minutes = +el.querySelector('#pMin').value || 15;
     Store.save(); UI.closeSheet(); refresh(); UI.toast('计划已更新');
    };
   }
  );
 }

 function addPresetSheet() {
  var icons = ['fitness', 'leg', 'shoulder', 'back', 'arm', 'hip', 'posture', 'eye', 'calm'];
  var cur = { icon: 'fitness' };
  UI.sheet(
   '<h3>新增运动板块</h3>' +
   '<div class="field"><label>板块名称</label><input type="text" id="nName" placeholder="例如：晨跑 / 瑜伽" maxlength="20"/></div>' +
   '<div class="field"><label>内容说明</label><input type="text" id="nDesc" placeholder="例如：慢跑 3 公里" maxlength="40"/></div>' +
   '<div class="field"><label>图标</label><div class="row" style="flex-wrap:wrap;gap:8px" id="iconPick">' +
    icons.map(function (i) {
     return '<button data-icon="' + i + '" style="width:38px;height:38px;border-radius:12px;overflow:hidden;opacity:' + (i === 'fitness' ? 1 : .55) + '">' + Icons.cat(i, { radius: 12, badge: false }) + '</button>';
    }).join('') + '</div></div>' +
   '<div class="field"><label>每周目标次数</label><input type="number" id="nWeek" min="1" max="14" value="2"/></div>' +
   '<div class="field"><label>单次时长（分钟）</label><input type="number" id="nMin" min="5" max="180" step="5" value="30"/></div>' +
   '<div class="sheet-actions"><button class="btn-ghost" data-act="cancel">取消</button>' +
   '<button class="btn-primary" data-act="ok">添加</button></div>',
   function (el) {
    UI.$$('#iconPick button', el).forEach(function (b) {
     b.onclick = function () {
      UI.$$('#iconPick button', el).forEach(function (x) { x.style.opacity = .55; });
      b.style.opacity = 1; cur.icon = b.dataset.icon;
     };
    });
    el.querySelector('[data-act=cancel]').onclick = UI.closeSheet;
    el.querySelector('[data-act=ok]').onclick = function () {
     var n = el.querySelector('#nName').value.trim();
     if (!n) { UI.toast('请填写名称'); return; }
     Store.state.fitness.presets.push({
      id: Store.uid(), name: n, icon: cur.icon, custom: true,
      desc: el.querySelector('#nDesc').value.trim(),
      perWeek: +el.querySelector('#nWeek').value || 2,
      minutes: +el.querySelector('#nMin').value || 30
     });
     Store.save(); UI.closeSheet(); refresh(); UI.toast('板块已添加');
    };
   }
  );
 }

 function render() {
  var presets = Store.state.fitness.presets;
  return '<div class="fade-in">' +
   overview() +
   unfinished() +
   '<div class="chips" style="margin:2px 2px 12px">' +
    [['day', '今日打卡'], ['week', '周计划'], ['month', '月度复盘']].map(function (x) {
     return '<button class="chip' + (scope === x[0] ? ' on' : '') + '" data-scope="' + x[0] + '">' + x[1] + '</button>';
    }).join('') +
   '</div>' +
   (scope === 'day'
    ? '<div class="card"><div class="sec-title"><h2><span class="bar-mark"></span>今日训练记录</h2>' +
     '<button class="pill-btn plain" id="customLog">+ 自定义</button></div>' + todayList() + '</div>' +
     '<div class="group-head"><b>一键套用预设计划</b><span>· 点 ✓ 直接打卡</span></div>' +
     presets.map(presetItem).join('')
    : '') +
   (scope === 'week'
    ? '<div class="group-head"><b>本周计划完成度</b><span>· 周一至周日</span></div>' +
     presets.map(presetItem).join('') +
     '<button class="pill-btn plain" id="addPreset" style="width:100%;height:44px;justify-content:center;margin-top:4px">+ 新增运动板块</button>'
    : '') +
   (scope === 'month' ? monthChart() + monthList() : '') +
   '<div style="height:56px"></div></div>' +
   '<button class="fab" id="quickLog"><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg></button>';
 }

 function monthList() {
  var logs = Store.state.fitness.logs;
  var dates = Object.keys(logs).filter(function (d) { return logs[d].length; }).sort().reverse().slice(0, 14);
  if (!dates.length) return UI.emptyBox('还没有训练记录');
  return '<div class="card"><div class="sec-title"><h2><span class="bar-mark"></span>历史记录</h2></div>' +
   dates.map(function (d) {
    var mm = logs[d].reduce(function (a, l) { return a + l.minutes; }, 0);
    return '<div class="meal-item"><div class="grow"><b style="font-size:13.5px">' + d.slice(5) + ' ' + Store.weekName(d) + '</b>' +
     '<div class="muted" style="font-size:11px">' + logs[d].map(function (l) { return esc(l.name); }).join(' · ') + '</div></div>' +
     '<b style="color:#2c9a70">' + mm + ' 分</b></div>';
   }).join('') + '</div>';
 }

 function refresh() {
  var view = UI.$('#view'); var st = view.scrollTop;
  view.innerHTML = render(); mount(view); view.scrollTop = st;
 }

 function mount(root) {
  UI.$$('[data-scope]', root).forEach(function (b) {
   b.onclick = function () { scope = b.dataset.scope; refresh(); };
  });
  UI.$$('.fit-item', root).forEach(function (el) {
   var pid = el.dataset.pid;
   var preset = null;
   Store.state.fitness.presets.forEach(function (p) { if (p.id === pid) preset = p; });
   UI.$$('[data-act]', el).forEach(function (b) {
    b.onclick = function () {
     if (b.dataset.act === 'log') logSheet(preset);
     else cfgSheet(preset);
    };
   });
  });
  UI.$$('[data-rm]', root).forEach(function (b) {
   b.onclick = function () { Store.removeFitLog(Store.today(), b.dataset.rm); refresh(); };
  });
  var q = root.querySelector('#quickLog'); if (q) q.onclick = function () { logSheet(null); };
  var c = root.querySelector('#customLog'); if (c) c.onclick = function () { logSheet(null); };
  var a = root.querySelector('#addPreset'); if (a) a.onclick = addPresetSheet;
 }

 Pages.fitness = { key: 'fitness', name: '运动打卡', sub: '计划 · 执行 · 复盘', icon: 'fitness', render: render, mount: mount };
})(window);
