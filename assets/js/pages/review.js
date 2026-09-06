/* ============================================================
  页面：复盘（日历默认视图 + 八维周复盘 + 日/月复盘 + 待办）
  所有复盘均关联日期；日历点击日期可查看当日复盘、任务完成度与待办
  ============================================================ */
(function (global) {
 var Pages = global.Pages = global.Pages || {};
 var esc = UI.esc;

 // 八维周复盘模板
 var FIELDS = [
  { k: 'work',  n: '本周工作总结', p: '完成了哪些事？产出如何？' },
  { k: 'study',  n: '学习进度',   p: '学了什么？进度到哪了？' },
  { k: 'life',  n: '生活收获',   p: '生活中有什么值得记录的？' },
  { k: 'sport',  n: '运动执行',   p: '计划完成度如何？身体状态？' },
  { k: 'money',  n: '理财消费',   p: '本周收支 / 消费复盘' },
  { k: 'problem', n: '存在问题',   p: '哪里卡住了？根因是什么？' },
  { k: 'improve', n: '下周改进',   p: '具体可执行的改进动作' },
  { k: 'goal',  n: '下周核心目标', p: '只写 1~3 个最重要的' }
 ];
 // 日复盘模板
 var DAY_FIELDS = [
  { k: 'done',   n: '今日完成事项', p: '今天做了哪些值得记录的事？' },
  { k: 'highlight', n: '高光时刻',   p: '今天最开心 / 最有成就感的一件事' },
  { k: 'reflect',  n: '精力反思',   p: '今天精力状态如何？什么消耗/恢复最多？' },
  { k: 'adjust',  n: '明日调整点',  p: '明天想改进的一小步' }
 ];
 // 月复盘模板
 var MONTH_FIELDS = [
  { k: 'done',   n: '本月完成事项', p: '这个月推进了哪些大事？' },
  { k: 'highlight', n: '本月高光',   p: '本月最闪亮的高光时刻' },
  { k: 'reflect',  n: '本月精力反思', p: '整月精力节奏怎样？如何优化？' },
  { k: 'adjust',  n: '下月调整点',  p: '下个月最想达成的 1~3 件事' }
 ];
 var TYPE_NAME = { day: '日复盘', week: '周复盘', month: '月复盘' };

 function pad2(n) { return n < 10 ? '0' + n : '' + n; }
 function fieldsFor(type) {
  if (type === 'month') return MONTH_FIELDS;
  if (type === 'week') return FIELDS;
  return DAY_FIELDS;
 }

 var mode = 'calendar';   // calendar | week
 var curMonth = null;    // 'YYYY-MM'
 var selDate = null;    // 选中的日期（进入日详情）
 var viewing = null;    // 归档中正在查看的复盘 id

 function initMonth() {
  var d = new Date();
  curMonth = d.getFullYear() + '-' + pad2(d.getMonth() + 1);
 }
 function weekRange(dateStr) {
  var s = Store.monday(dateStr || Store.today());
  var e = Store.shift(s, 6);
  return s.slice(5).replace('-', '/') + ' - ' + e.slice(5).replace('-', '/');
 }

 /** 自动汇总本周数据，作为复盘参考 */
 function weekSummary(dateStr) {
  var start = Store.monday(dateStr || Store.today());
  var focus = 0, pomos = 0, done = 0, fit = 0, fitMin = 0, water = 0, sleepDays = 0;
  for (var i = 0; i < 7; i++) {
   var d = Store.shift(start, i);
   var day = Store.state.days[d];
   if (day) {
    focus += day.focusMin || 0;
    pomos += day.pomos || 0;
    (day.tasks || []).forEach(function (t) { if (t.done) done++; });
   }
   (Store.state.fitness.logs[d] || []).forEach(function (l) { fit++; fitMin += l.minutes; });
   var h = Store.state.health[d];
   if (h) { water += h.water || 0; if (h.sleepAt && h.wakeAt) sleepDays++; }
  }
  return { focus: focus, pomos: pomos, done: done, fit: fit, fitMin: fitMin, water: water, sleepDays: sleepDays };
 }
 function summaryCard(dateStr) {
  var s = weekSummary(dateStr);
  return '<div class="card tight">' +
   '<b style="font-size:13px">本周数据自动汇总（供复盘参考）</b>' +
   '<div class="chips" style="margin-top:9px">' +
    '<span class="chip">专注 ' + UI.fmtMin(s.focus) + '</span>' +
    '<span class="chip">番茄 ' + s.pomos + ' 个</span>' +
    '<span class="chip">完成任务 ' + s.done + ' 项</span>' +
    '<span class="chip">运动 ' + s.fit + ' 次 / ' + s.fitMin + ' 分</span>' +
    '<span class="chip">饮水 ' + s.water + ' 杯</span>' +
    '<span class="chip">睡眠记录 ' + s.sleepDays + ' 天</span>' +
   '</div></div>';
 }

 /* ---------------- 复盘编辑（支持 日/周/月） ---------------- */
 function openReviewSheet(date, type, rv) {
  var fields = fieldsFor(type);
  var isEdit = !!rv;
  var v = rv || {};
  var week = type === 'week' ? Store.weekKey(date) : '';
  var range = type === 'week' ? weekRange(date) : '';
  UI.sheet(
   '<h3>' + (isEdit ? '编辑' : '新建') + (TYPE_NAME[type] || '复盘') + '</h3>' +
   (type === 'week'
    ? '<div class="field"><label>周期</label><input type="text" id="rRange" value="' + esc(range) + '" placeholder="如 08/01 - 08/07"/></div>'
    : '') +
   fields.map(function (f) {
    return '<div class="field"><label>' + f.n + '</label>' +
     '<textarea data-f="' + f.k + '" placeholder="' + f.p + '">' + esc(v[f.k] || '') + '</textarea></div>';
   }).join('') +
   '<div class="sheet-actions">' +
   (isEdit ? '<button class="btn-danger" data-act="del">删除</button>' : '<button class="btn-ghost" data-act="cancel">取消</button>') +
   '<button class="btn-primary" data-act="ok">保存归档</button></div>',
   function (el) {
    var c = el.querySelector('[data-act=cancel]'); if (c) c.onclick = UI.closeSheet;
    var dl = el.querySelector('[data-act=del]');
    if (dl) dl.onclick = function () {
     UI.closeSheet();
     setTimeout(function () {
      UI.confirm('删除这份复盘？', (v.range || v.date || '') + ' 的记录将无法恢复', function () {
       Store.removeReview(v.id); viewing = null; refresh(); UI.toast('已删除');
      }, '删除');
     }, 260);
    };
    el.querySelector('[data-act=ok]').onclick = function () {
     var data = { id: v.id, type: type, date: date, week: week, range: type === 'week' ? (el.querySelector('#rRange').value.trim() || range) : '' };
     var hasContent = false;
     UI.$$('[data-f]', el).forEach(function (t) {
      data[t.dataset.f] = t.value.trim();
      if (t.value.trim()) hasContent = true;
     });
     if (!hasContent) { UI.toast('至少填写一个维度吧 '); return; }
     Store.saveReview(data);
     UI.closeSheet(); refresh(); UI.toast('复盘已归档 ');
    };
   }
  );
 }

 /* ---------------- 顶部标签切换 ---------------- */
 function tabs(active) {
  return '<div class="rev-tabs">' +
   '<button class="rev-tab' + (active === 'calendar' ? ' on' : '') + '" data-mode="calendar"> 日历</button>' +
   '<button class="rev-tab' + (active === 'week' ? ' on' : '') + '" data-mode="week"> 复盘</button>' +
   '</div>';
 }

 /* ---------------- 日历视图 ---------------- */
 function hasContent(ds) {
  var hit = Store.state.reviews.some(function (r) { return r.date === ds; });
  if (hit) return true;
  return (Store.day(ds).todos || []).length > 0;
 }
 function calendarView() {
  var parts = curMonth.split('-'), y = +parts[0], m = +parts[1];
  var first = new Date(y, m - 1, 1);
  var startW = first.getDay();
  var daysInMonth = new Date(y, m, 0).getDate();
  var today = Store.today();
  var cells = [];
  for (var i = 0; i < startW; i++) cells.push(null);
  for (var d = 1; d <= daysInMonth; d++) {
   cells.push(y + '-' + pad2(m) + '-' + pad2(d));
  }
  var grid = cells.map(function (ds) {
   if (!ds) return '<div class="cal-cell empty"></div>';
   var isToday = ds === today;
   var has = hasContent(ds);
   var num = +ds.slice(8, 10);
   return '<div class="cal-cell' + (isToday ? ' today' : '') + (has ? ' has' : '') + '" data-date="' + ds + '">' +
    '<span class="cal-d">' + num + '</span>' + (has ? '<i class="cal-dot"></i>' : '') + '</div>';
  }).join('');
  return '<div class="fade-in">' +
   tabs('calendar') +
   '<div class="card tight cal-nav">' +
    '<button class="mini-act" data-navm="-1"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M15 5l-7 7 7 7"/></svg></button>' +
    '<b>' + y + ' 年 ' + m + ' 月</b>' +
    '<button class="mini-act" data-navm="1"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M9 5l7 7-7 7"/></svg></button>' +
   '</div>' +
   '<div class="cal-week"><span>日</span><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span></div>' +
   '<div class="cal-grid">' + grid + '</div>' +
   '<div class="muted" style="text-align:center;margin-top:12px;font-size:11.5px">点击日期查看当日复盘与待办，也可添加带时间的待办 </div>' +
   '<div style="height:24px"></div></div>';
 }

 /* ---------------- 日详情视图 ---------------- */
 function todoItem(t) {
  return '<div class="todo-item' + (t.done ? ' done' : '') + '" data-id="' + t.id + '">' +
   '<button class="tick' + (t.done ? ' on' : '') + '" data-act="ttoggle">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5 9.5 18 20 6.5"/></svg></button>' +
   '<div class="grow"><div class="todo-time">' + (t.time || '—') + '</div><div class="t-name">' + esc(t.title) + '</div></div>' +
   '<button class="mini-act" data-act="tdel" title="删除">' +
    '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 7h14M9 7V5h6v2M7 7l1 13h8l1-13"/></svg></button>' +
   '</div>';
 }
 function revMini(r) {
  var tm = TYPE_NAME[r.type] || '复盘';
  var fields = fieldsFor(r.type);
  var first = '';
  for (var i = 0; i < fields.length; i++) { if (r[fields[i].k]) { first = r[fields[i].k]; break; } }
  return '<div class="review-item" data-rid="' + r.id + '">' +
   '<h4><span>' + esc(r.range || r.date || '') + '</span><span class="tag blue">' + tm + '</span></h4>' +
   (first ? '<p>' + esc(first) + '</p>' : '') + '</div>';
 }
 function dayDetailView(date) {
  var day = Store.day(date);
  var tasks = day.tasks || [];
  var doneN = tasks.filter(function (t) { return t.done; }).length;
  var tpct = tasks.length ? Math.round(doneN / tasks.length * 100) : 0;
  var todos = Store.sortedTodos(date);
  var revs = Store.state.reviews.filter(function (r) { return r.date === date; });
  return '<div class="fade-in">' +
   '<div class="card tight row" style="margin-bottom:14px">' +
    '<button class="mini-act" id="backCal"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M15 5l-7 7 7 7"/></svg></button>' +
    '<div class="grow" style="margin-left:8px"><b style="font-size:15px">' + date.slice(5).replace('-', '/') + '</b>' +
     '<div class="muted" style="font-size:11px">' + Store.weekName(date) + '</div></div>' +
   '</div>' +
   '<div class="card tight">' +
    '<div class="sec-title"><h2><span class="bar-mark"></span>任务完成度</h2></div>' +
    '<div class="row" style="justify-content:space-between;font-size:13px"><span class="muted">当日计划</span><b>' + doneN + ' / ' + tasks.length + ' 已完成</b></div>' +
    (tasks.length ? '<div class="fund-prog" style="margin-top:9px"><i style="width:' + tpct + '%"></i></div>' : '') +
   '</div>' +
   '<div class="card">' +
    '<div class="sec-title"><h2><span class="bar-mark"></span>当日待办</h2><span class="more">' + todos.length + ' 项</span></div>' +
    (todos.length ? todos.map(todoItem).join('') : '<div class="muted" style="padding:4px 2px 8px">还没有待办</div>') +
    '<button class="pill-btn plain" id="addTodo" style="width:100%;justify-content:center;margin-top:8px">＋ 添加待办（可设时间）</button>' +
   '</div>' +
   '<div class="card">' +
    '<div class="sec-title"><h2><span class="bar-mark"></span>当日复盘</h2></div>' +
    (revs.length ? revs.map(revMini).join('') : '<div class="muted" style="padding:4px 2px 8px">还没有复盘记录</div>') +
    '<div class="row" style="gap:8px;margin-top:8px">' +
     '<button class="pill-btn plain" data-rtype="day">日复盘</button>' +
     '<button class="pill-btn plain" data-rtype="week">周复盘</button>' +
     '<button class="pill-btn plain" data-rtype="month">月复盘</button>' +
    '</div>' +
   '</div>' +
   '<div style="height:24px"></div></div>';
 }

 /* ---------------- 复盘列表（周模板 + 归档） ---------------- */
 function revItem(r) {
  var tm = TYPE_NAME[r.type] || '复盘';
  var fields = fieldsFor(r.type);
  var preview = '';
  for (var i = 0; i < fields.length; i++) { if (r[fields[i].k]) { preview = r[fields[i].k]; break; } }
  return '<div class="review-item" data-id="' + r.id + '">' +
   '<h4><span>' + esc(r.range || r.date || '') + '</span><span class="tag blue">' + tm + '</span></h4>' +
   (preview ? '<p>' + esc(preview) + '</p>' : '') +
   '<div class="muted" style="font-size:11px;margin-top:8px">' +
    new Date(r.updatedAt || r.createdAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) + ' 更新</div>' +
   '</div>';
 }
 function reviewListView() {
  var list = Store.state.reviews;
  return '<div class="fade-in">' +
   tabs('week') +
   summaryCard() +
   '<div class="sec-title"><h2><span class="bar-mark"></span>复盘归档</h2><span class="more">共 ' + list.length + ' 份</span></div>' +
   (list.length ? list.map(revItem).join('') : UI.emptyBox('还没有复盘记录，点右下角开始第一份')) +
   '<div style="height:56px"></div></div>' +
   '<button class="fab" id="addReview"><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg></button>';
 }

 function detailView(r) {
  var fields = fieldsFor(r.type);
  return '<div class="fade-in">' +
   '<div class="card">' +
    '<div class="row" style="margin-bottom:6px">' +
     '<button class="mini-act" id="backList"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M15 5l-7 7 7 7"/></svg></button>' +
     '<div class="grow" style="margin-left:8px"><b style="font-size:15px">' + esc(r.range || r.date || '') + '</b>' +
      '<div class="muted" style="font-size:11px">' + (TYPE_NAME[r.type] || '复盘') + (r.week ? ' · ' + esc(r.week) : '') + '</div></div>' +
     '<button class="pill-btn plain" id="editReview">编辑</button>' +
    '</div>' +
    '<div class="rv-detail">' +
     fields.map(function (f) {
      if (!r[f.k]) return '';
      return '<h5>' + f.n + '</h5><p>' + esc(r[f.k]) + '</p>';
     }).join('') +
    '</div>' +
   '</div><div style="height:16px"></div></div>';
 }

 /* ---------------- 待办弹层 ---------------- */
 function todoSheet(date) {
  UI.sheet(
   '<h3>添加待办</h3>' +
   '<div class="field"><label>事项</label>' +
    '<input type="text" id="tTitle" placeholder="例如：16:00 给妈妈打电话" maxlength="40"/></div>' +
   '<div class="field"><label>具体时间（小时 : 分钟）</label>' +
    '<input type="time" id="tTime"/></div>' +
   '<div class="sheet-actions">' +
    '<button class="btn-ghost" data-act="cancel">取消</button>' +
    '<button class="btn-primary" data-act="ok">添加</button></div>',
   function (el) {
    var c = el.querySelector('[data-act=cancel]'); if (c) c.onclick = UI.closeSheet;
    el.querySelector('[data-act=ok]').onclick = function () {
     var title = el.querySelector('#tTitle').value.trim();
     if (!title) { UI.toast('写点什么吧 '); return; }
     var time = el.querySelector('#tTime').value || '';
     Store.addTodo(date, { title: title, time: time });
     UI.closeSheet(); refresh(); UI.toast('已添加待办' + (time ? ' · ' + time : ''));
    };
   }
  );
 }

 /* ---------------- 渲染 / 挂载 ---------------- */
 function render() {
  if (viewing) {
   var r = null;
   Store.state.reviews.forEach(function (x) { if (x.id === viewing) r = x; });
   if (r) return detailView(r);
   viewing = null;
  }
  if (selDate) return dayDetailView(selDate);
  if (mode === 'week') return reviewListView();
  return calendarView();
 }

 function refresh() {
  var view = UI.$('#view'); view.innerHTML = render(); mount(view);
 }

 function mount(root) {
  // 标签切换
  UI.$$('[data-mode]', root).forEach(function (b) {
   b.onclick = function () { mode = b.dataset.mode; selDate = null; viewing = null; refresh(); };
  });
  // 月份切换
  UI.$$('[data-navm]', root).forEach(function (b) {
   b.onclick = function () {
    var dy = +b.dataset.navm;
    var p = curMonth.split('-'); var y = +p[0], m = +p[1];
    m += dy; if (m < 1) { m = 12; y--; } else if (m > 12) { m = 1; y++; }
    curMonth = y + '-' + pad2(m); refresh();
   };
  });
  // 日历日期点击
  UI.$$('.cal-cell[data-date]', root).forEach(function (el) {
   el.onclick = function () { selDate = el.dataset.date; viewing = null; refresh(); UI.$('#view').scrollTop = 0; };
  });
  // 返回日历
  var bc = root.querySelector('#backCal');
  if (bc) bc.onclick = function () { selDate = null; refresh(); };
  var bl = root.querySelector('#backList');
  if (bl) bl.onclick = function () { viewing = null; refresh(); };

  // 日详情：添加待办
  var at = root.querySelector('#addTodo');
  if (at) at.onclick = function () { todoSheet(selDate); };
  // 日详情：复盘类型按钮
  UI.$$('[data-rtype]', root).forEach(function (b) {
   b.onclick = function () {
    var type = b.dataset.rtype;
    var exist = null;
    Store.state.reviews.forEach(function (r) { if (r.date === selDate && r.type === type) exist = r; });
    openReviewSheet(selDate, type, exist);
   };
  });
  // 日详情：待办操作
  UI.$$('.todo-item', root).forEach(function (el) {
   var id = el.dataset.id;
   UI.$$('[data-act]', el).forEach(function (b) {
    b.onclick = function (ev) {
     ev.stopPropagation();
     if (b.dataset.act === 'ttoggle') { Store.toggleTodo(selDate, id); refresh(); }
     else { Store.removeTodo(selDate, id); refresh(); UI.toast('已删除'); }
    };
   });
  });
  // 日详情：现有复盘点击编辑
  UI.$$('.review-item[data-rid]', root).forEach(function (el) {
   el.onclick = function () {
    var rid = el.dataset.rid, r = null;
    Store.state.reviews.forEach(function (x) { if (x.id === rid) r = x; });
    if (r) openReviewSheet(r.date, r.type, r);
   };
  });

  // 复盘列表：新建（周模板，关联本周）
  var add = root.querySelector('#addReview');
  if (add) add.onclick = function () {
   var date = Store.today(), wk = Store.weekKey(date), exist = null;
   Store.state.reviews.forEach(function (r) { if (r.type === 'week' && r.week === wk) exist = r; });
   if (exist) { UI.toast('本周已有复盘，进入编辑'); openReviewSheet(date, 'week', exist); }
   else openReviewSheet(date, 'week', null);
  };
  // 复盘列表：条目点击查看
  UI.$$('.review-item[data-id]', root).forEach(function (el) {
   el.onclick = function () { viewing = el.dataset.id; refresh(); UI.$('#view').scrollTop = 0; };
  });
  // 详情：编辑
  var ed = root.querySelector('#editReview');
  if (ed) ed.onclick = function () {
   var r = null; Store.state.reviews.forEach(function (x) { if (x.id === viewing) r = x; });
   if (r) openReviewSheet(r.date, r.type, r);
  };
 }

 Pages.review = {
  key: 'review', name: '复盘', sub: '日历 · 八维复盘模板', icon: 'review',
  render: render, mount: mount,
  onEnter: function () { mode = 'calendar'; selDate = null; viewing = null; initMonth(); }
 };
})(window);
