/* ============================================================
  页面：首页 · 数据统计大屏
  ============================================================ */
(function (global) {
 var Pages = global.Pages = global.Pages || {};
 var esc = UI.esc;

 function pointsCard() {
  var ap = Store.availablePoints();
  var mins = Store.totalFocusMinutes();
  return '' +
   '<div class="points-card" id="pointsCard" data-go="reward">' +
    '<div class="ic">' + Icons.cat('reward') + '</div>' +
    '<div class="grow">' +
     '<div class="pc-label">我的积分</div>' +
     '<div class="pc-num">' + ap + '<small> 分</small></div>' +
     '<div class="pc-sub">已专注 ' + UI.fmtMin(mins) + ' · 每 60 分钟得 1 分</div>' +
    '</div>' +
    '<div class="pc-go">去兑换 ›</div>' +
   '</div>';
 }

 function streakCard() {
  var st = Store.state.streak;
  var days = Store.lastDays(7);
  var cells = days.map(function (dt) {
   var on = (st.dates || []).indexOf(dt) >= 0;
   return '<div class="d' + (on ? ' on' : '') + '">' + Store.weekShort(dt) + '<b>' + (on ? '✓' : '·') + '</b></div>';
  }).join('');
  return '' +
   '<div class="streak-card pop">' +
    '<div class="cat">' + Icons.streakArt() + '</div>' +
    '<div class="k">连续打卡</div>' +
    '<div class="v">' + st.count + '<small>天</small></div>' +
    '<div class="k" style="margin-top:2px">累计专注 ' + UI.fmtMin(Store.totalFocus()) + '</div>' +
    '<div class="streak-days">' + cells + '</div>' +
   '</div>';
 }

 function statCard(key, label, sub) {
  var s = Store.state.stats[key];
  return '' +
   '<div class="stat-card">' +
    '<div class="ic">' + Icons.cat(key, { radius: 12 }) + '</div>' +
    '<div class="num">' + UI.fmtMinShort(s.min) + '</div>' +
    '<div class="lb">' + label + '</div>' +
    '<div class="sub">' + sub + ' <b style="color:#5a7d70">' + s.count + '</b> 次</div>' +
   '</div>';
 }

 function todayCard() {
  var td = Store.today();
  var day = Store.day(td);
  var e = Store.energyOf(td);
  var done = day.tasks.filter(function (t) { return t.done; }).length;
  var total = day.tasks.length;
  var pct = total ? Math.round(done / total * 100) : 0;
  var h = Store.health(td);
  var fit = Store.fitLogs(td).length;
  return '' +
   '<div class="card">' +
    '<div class="sec-title"><h2><span class="bar-mark"></span>今日速览</h2>' +
    '<span class="more">' + Store.weekName(td) + '</span></div>' +
    '<div class="row" style="gap:16px">' +
     UI.donut(pct, { size: 92, stroke: 11, text: pct + '%', fontSize: 19 }) +
     '<div class="grow">' +
      '<div class="row" style="justify-content:space-between;font-size:13px;margin-bottom:7px">' +
       '<span class="muted">计划完成</span><b>' + done + ' / ' + total + '</b></div>' +
      '<div class="row" style="justify-content:space-between;font-size:13px;margin-bottom:7px">' +
       '<span class="muted">剩余精力</span><b style="color:#5a7d70">' + e.left + '</b></div>' +
      '<div class="row" style="justify-content:space-between;font-size:13px;margin-bottom:7px">' +
       '<span class="muted">今日番茄</span><b>' + (day.pomos || 0) + '</b></div>' +
      '<div class="row" style="justify-content:space-between;font-size:13px">' +
       '<span class="muted">饮水 / 运动</span><b>' + (h.water || 0) + ' 杯 · ' + fit + ' 项</b></div>' +
     '</div>' +
    '</div>' +
   '</div>';
 }

 function trendCard() {
  var tr = Store.trend(7);
  var td = Store.today();
  var data = tr.map(function (x) {
   return { label: x.label, value: x.focusMin, hi: x.date === td };
  });
  var totalW = tr.reduce(function (a, b) { return a + b.focusMin; }, 0);
  var pomoW = tr.reduce(function (a, b) { return a + b.pomos; }, 0);
  return '' +
   '<div class="card">' +
    '<div class="sec-title"><h2><span class="bar-mark"></span>近 7 天专注（分钟）</h2>' +
    '<span class="more">共 ' + UI.fmtMin(totalW) + ' · ' + pomoW + ' 番茄</span></div>' +
    UI.barChart(data, { height: 116 }) +
   '</div>';
 }

 function energyTrendCard() {
  var tr = Store.trend(7);
  var td = Store.today();
  var data = tr.map(function (x) { return { label: x.label, value: x.done, hi: x.date === td }; });
  return '' +
   '<div class="card">' +
    '<div class="sec-title"><h2><span class="bar-mark"></span>近 7 天完成任务数</h2></div>' +
    UI.barChart(data, { height: 104 }) +
   '</div>';
 }

 function render() {
  return '<div class="fade-in">' +
   pointsCard() +
   streakCard() +
   '<div class="stat-grid">' +
    statCard('english', '英语听力训练', '听力完成') +
    statCard('knowledge', '高质量知识学习', '学习') +
    statCard('account', '个人账号更新', '更新发布') +
    outputCard() +
    otherCard() +
   '</div>' +
   todayCard() +
   trendCard() +
   energyTrendCard() +
   '<div class="muted" style="text-align:center;font-size:11.5px;padding:4px 0 20px">' +
    '数据由「每日计划」的番茄钟 / 正计时自动同步汇总</div>' +
   '</div>';
 }

 function otherCard() {
  var s = Store.state.stats.other;
  var all = Store.totalFocus();
  return '' +
   '<div class="stat-card">' +
    '<div class="ic">' + Icons.cat('timer', { radius: 12 }) + '</div>' +
    '<div class="num">' + UI.fmtMinShort(all) + '</div>' +
    '<div class="lb">累计专注总时长</div>' +
    '<div class="sub">其他事务 <b style="color:#5a7d70">' + s.count + '</b> 次</div>' +
   '</div>';
 }

 function outputCard() {
  var s = Store.state.stats.output;
  return '' +
   '<div class="stat-card">' +
    '<div class="ic">' + Icons.cat('express', { radius: 12 }) + '</div>' +
    '<div class="num">' + UI.fmtMinShort(s.min) + '</div>' +
    '<div class="lb">口语输出时长</div>' +
    '<div class="sub">自信表达 <b style="color:#5a7d70">' + s.count + '</b> 次</div>' +
   '</div>';
 }

 function mount(root) {
  root = root || UI.$('#view');
  var pc = root.querySelector('#pointsCard');
  if (pc) pc.onclick = function () { App.go('reward'); };
 }

 Pages.home = {
  key: 'home', name: '首页', sub: '数据统计大屏', icon: 'home',
  render: render, mount: mount
 };
})(window);
