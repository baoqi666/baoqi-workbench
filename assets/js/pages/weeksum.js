/* ============================================================
   页面：周总结（每周自动归档 + 随时回看）
   - 进入应用时自动归档「上周」数据（静态 PWA 的“每周自动”实现）
   - 本页可查看本周实时进度、历史周总结存档、补全历史、生成本周存档、添加手记
   ============================================================ */
(function (global) {
 var Pages = global.Pages = global.Pages || {};
 var esc = UI.esc;
 var viewing = null; // 正在查看详情的周总结 id

 function humanWeek(wk) {
  var p = wk.split('-W');
  return p[0] + ' 年第 ' + (+p[1]) + ' 周';
 }
 function stateSummaries() { return Store.state.summaries || []; }

 /* ---------------- 通用小块 ---------------- */
 function statCard(ic, num, lb) {
  return '<div class="stat-card"><div class="ic">' + Icons.cat(ic) + '</div>' +
   '<div class="num">' + num + '</div><div class="lb">' + lb + '</div></div>';
 }
 function bstat(label, val) {
  return '<div class="bstat"><span>' + label + '</span><b>' + val + '</b></div>';
 }

 /* ---------------- 列表视图 ---------------- */
 function liveCard(live, alreadyArchived) {
  var chart = UI.barChart(live.daily.map(function (x) { return { label: x.label, value: x.value }; }), { height: 110 });
  return '<div class="card">' +
   '<div class="sec-title"><h2><span class="bar-mark"></span>本周进行中</h2>' +
    '<span class="more">' + esc(live.range) + '</span></div>' +
   '<div class="muted" style="margin:-4px 0 12px">每天数据自动累计，进入下一周时会自动归档成一篇周总结</div>' +
   '<div class="stat-grid">' +
    statCard('timer', UI.fmtMinShort(live.focusMin), '专注时长') +
    statCard('plan', live.done + '<small>/' + live.taskTotal + '</small>', '完成任务') +
    statCard('timer', live.pomos + '<small>个</small>', '番茄数') +
    statCard('fitness', live.fitCount + '<small>次</small>', '运动打卡') +
   '</div>' +
   chart +
   '<button class="pill-btn plain" id="liveGen" style="width:100%;justify-content:center;margin-top:12px">' +
    (alreadyArchived ? '本周已存档 · 点此重新生成' : '生成本周总结（存档）') + '</button>' +
  '</div>';
 }
 function sumItem(s) {
  var chip = '<div class="chips" style="margin-top:8px">' +
   '<span class="chip">专注 ' + UI.fmtMin(s.focusMin) + '</span>' +
   '<span class="chip">任务 ' + s.done + '/' + s.taskTotal + '</span>' +
   '<span class="chip">运动 ' + s.fitCount + ' 次</span>' +
   (s.note ? '<span class="chip">有手记</span>' : '') +
  '</div>';
  return '<div class="review-item" data-id="' + s.id + '">' +
   '<h4><span>' + esc(s.range) + '</span><span class="tag blue">周总结</span></h4>' +
   '<p>' + esc(s.tagline) + '</p>' + chip +
   '<div class="muted" style="font-size:var(--fs-4);margin-top:8px">' + humanWeek(s.week) + ' · ' +
    new Date(s.generatedAt).toLocaleDateString('zh-CN') + ' 生成</div>' +
  '</div>';
 }
 function listView() {
  var thisMon = Store.monday();
  var live = Store.genWeekStats(thisMon);
  var alreadyArchived = stateSummaries().some(function (x) { return x.week === live.week; });
  var sums = stateSummaries().slice().sort(function (a, b) { return a.week < b.week ? 1 : -1; });
  return '<div class="fade-in">' +
   liveCard(live, alreadyArchived) +
   '<div class="sec-title"><h2><span class="bar-mark"></span>历史周总结</h2><span class="more">共 ' + sums.length + ' 篇</span></div>' +
   (sums.length ? sums.map(sumItem).join('') : UI.emptyBox('还没有存档的周总结。继续记录几天，进入下一周时会自动生成第一篇 ')) +
   (sums.length ? '<button class="link-act" id="backfill">补全更早的历史周总结</button>' : '') +
   '<div style="height:56px"></div></div>' +
   '<button class="fab" id="genNow" title="生成本周总结"><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg></button>';
 }

 /* ---------------- 详情视图 ---------------- */
 function detailView(s) {
  var chart = UI.barChart((s.daily || []).map(function (x) { return { label: x.label, value: x.value }; }), { height: 120 });
  var grid = '<div class="stat-grid">' +
   statCard('timer', UI.fmtMinShort(s.focusMin), '专注时长') +
   statCard('timer', s.pomos + '<small>个</small>', '番茄数') +
   statCard('plan', s.done + '<small>/' + s.taskTotal + '</small>', '完成任务') +
   statCard('fitness', s.fitCount + '<small>次</small>', '运动打卡') +
   statCard('fitness', UI.fmtMin(s.fitMin), '运动时长') +
   statCard('water', s.water + '<small>杯</small>', '饮水') +
   statCard('sleep', s.sleepDays + '<small>天</small>', '睡眠记录') +
   statCard('idea', s.ideasDone + '<small>项</small>', '灵感完成') +
  '</div>';

  var budgetCard = '';
  if (s.budget) {
   budgetCard = '<div class="card tight"><div class="sec-title"><h2><span class="bar-mark"></span>本月预算快照</h2></div>' +
    '<div class="bstats">' +
     bstat('预算', s.budget.amount) + bstat('已支出', s.budget.spent) +
     bstat('已存罐', s.budget.saved) + bstat('剩余', s.budget.left) +
    '</div></div>';
  }
  var fundsCard = '';
  if (s.funds && s.funds.length) {
   var rows = s.funds.map(function (f) {
    var pct = f.target ? Math.round((f.balance || 0) / f.target * 100) : 0;
    return '<div class="fund-card" style="margin-bottom:10px;padding:12px">' +
     '<div class="fund-top"><span class="fund-name">' + esc(f.name) + '</span></div>' +
     '<div class="fund-num">' + (f.balance || 0) + '<span> / ' + (f.target || 0) + ' 元</span></div>' +
     '<div class="fund-prog"><i style="width:' + pct + '%"></i></div></div>';
   }).join('');
   fundsCard = '<div class="card tight"><div class="sec-title"><h2><span class="bar-mark"></span>储蓄罐快照</h2>' +
    '<span class="more">合计 ' + s.fundsTotal + ' 元</span></div>' + rows + '</div>';
  }
  var reviewCard = '';
  if (s.review && s.review.fields && s.review.fields.length) {
   reviewCard = '<div class="card tight"><div class="sec-title"><h2><span class="bar-mark"></span>本周复盘</h2></div>' +
    '<div class="rv-detail">' + s.review.fields.map(function (f) {
     return '<h5>' + esc(f.n) + '</h5><p>' + esc(f.t) + '</p>';
    }).join('') + '</div></div>';
  }
  var noteCard = '<div class="card tight"><div class="sec-title"><h2><span class="bar-mark"></span>本周手记</h2></div>' +
   '<div class="field"><textarea id="sumNote" placeholder="给这一周写几句感想，存档后随时可回看">' + esc(s.note || '') + '</textarea></div>' +
   '<button class="pill-btn plain" id="saveNote" style="width:100%;justify-content:center;margin-top:10px">保存手记</button></div>';

  return '<div class="fade-in">' +
   '<div class="card">' +
    '<div class="row" style="margin-bottom:6px">' +
     '<button class="mini-act" id="backList"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M15 5l-7 7 7 7"/></svg></button>' +
     '<div class="grow" style="margin-left:8px"><b style="font-size:var(--fs-2)">' + esc(s.range) + '</b>' +
      '<div class="muted" style="font-size:var(--fs-4)">' + humanWeek(s.week) + ' · ' + new Date(s.generatedAt).toLocaleDateString('zh-CN') + ' 生成</div></div>' +
     '<button class="pill-btn plain" id="delSum">删除</button>' +
    '</div>' +
    '<p style="font-size:var(--fs-3);line-height:1.7;color:var(--ink);margin:6px 0 2px">' + esc(s.tagline) + '</p>' +
   '</div>' +
   grid +
   '<div class="card tight"><div class="sec-title"><h2><span class="bar-mark"></span>每日专注分布</h2></div>' + chart + '</div>' +
   budgetCard + fundsCard + reviewCard + noteCard +
   '<div style="height:16px"></div></div>';
 }

 /* ---------------- 渲染 / 挂载 ---------------- */
 function render() {
  if (viewing) {
   var s = null;
   stateSummaries().forEach(function (x) { if (x.id === viewing) s = x; });
   if (s) return detailView(s);
   viewing = null;
  }
  return listView();
 }
 function refresh() { var v = UI.$('#view'); v.innerHTML = render(); mount(v); }

 function doGen(mon) {
  var wk = Store.weekKey(mon);
  var existing = null;
  stateSummaries().forEach(function (x) { if (x.week === wk) existing = x; });
  if (existing) Store.removeSummary(existing.id);
  Store.archiveWeek(mon);
  UI.toast('周总结已' + (existing ? '重新' : '') + '生成并存档 ');
  viewing = null;
  refresh();
  UI.$('#view').scrollTop = 0;
 }

 function mount(root) {
  var back = root.querySelector('#backList');
  if (back) back.onclick = function () { viewing = null; refresh(); };
  var del = root.querySelector('#delSum');
  if (del) del.onclick = function () {
   var s = null; stateSummaries().forEach(function (x) { if (x.id === viewing) s = x; });
   UI.confirm('删除这篇周总结？', (s ? s.range : '') + ' 的存档将移除，无法恢复', function () {
    Store.removeSummary(viewing); viewing = null; refresh(); UI.toast('已删除');
   }, '删除');
  };
  var saveNote = root.querySelector('#saveNote');
  if (saveNote) saveNote.onclick = function () {
   var ta = root.querySelector('#sumNote');
   Store.updateSummary(viewing, { note: ta.value.trim() });
   UI.toast('手记已保存');
  };
  var liveGen = root.querySelector('#liveGen');
  if (liveGen) liveGen.onclick = function () { doGen(Store.monday()); };
  var genNow = root.querySelector('#genNow');
  if (genNow) genNow.onclick = function () { doGen(Store.monday()); };
  var backfill = root.querySelector('#backfill');
  if (backfill) backfill.onclick = function () {
   var n = Store.autoArchiveWeeks(52);
   UI.toast(n ? ('已补全 ' + n + ' 篇周总结') : '没有可补全的历史周');
   refresh();
  };
  UI.$$('.review-item[data-id]', root).forEach(function (el) {
   el.onclick = function () { viewing = el.dataset.id; refresh(); UI.$('#view').scrollTop = 0; };
  });
 }

 Pages.weeksum = {
  key: 'weeksum', name: '周总结', sub: '每周自动归档 · 随时回看', icon: 'summary',
  render: render, mount: mount,
  onEnter: function () { viewing = null; Store.autoArchiveWeeks(); }
 };
})(window);
