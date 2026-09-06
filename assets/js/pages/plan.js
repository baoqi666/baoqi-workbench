/* ============================================================
  页面：每日计划与精力管理（核心）
  精力条 / 任务 CRUD / 番茄钟 + 正计时
  ============================================================ */
(function (global) {
 var Pages = global.Pages = global.Pages || {};
 var esc = UI.esc;
 var RING_R = 92, RING_C = 2 * Math.PI * RING_R;

 var curDate = null;     // 当前查看日期
 var timerHandle = null;

 function d() { return curDate || Store.today(); }
 function isToday() { return d() === Store.today(); }

 /* ---------------- 充能弹层（计划页「+充能」） ---------------- */
 function chargeSheet() {
  var opts = [
   { label: '休息', amt: 10 },
   { label: '听歌', amt: 5 },
   { label: '写日记', amt: 15 }
  ];
  UI.sheet(
   '<h3> 充能一下</h3>' +
   '<div class="chips" style="margin-bottom:14px">' +
    opts.map(function (o) {
     return '<button class="chip" data-amt="' + o.amt + '" data-label="' + o.label + '">' + o.label + ' +' + o.amt + '</button>';
    }).join('') +
   '</div>' +
   '<div class="field"><label>自定义充能量（点）</label>' +
    '<input type="number" id="cAmt" min="1" max="100" step="1" placeholder="例如 8"/></div>' +
   '<div class="sheet-actions">' +
    '<button class="btn-ghost" data-act="cancel">取消</button>' +
    '<button class="btn-primary" data-act="ok">自定义充能</button></div>',
   function (el) {
    var c = el.querySelector('[data-act=cancel]'); if (c) c.onclick = UI.closeSheet;
    UI.$$('.chip', el).forEach(function (b) {
     b.onclick = function () {
      var amt = +b.dataset.amt, label = b.dataset.label;
      Store.addCharge(Store.today(), amt, label);
      UI.closeSheet(); refresh(); UI.toast('已充能 +' + amt + '');
     };
    });
    el.querySelector('[data-act=ok]').onclick = function () {
     var amt = +el.querySelector('#cAmt').value || 0;
     if (!amt) { UI.toast('请输入充能量'); return; }
     Store.addCharge(Store.today(), amt, '自定义充能');
     UI.closeSheet(); refresh(); UI.toast('已充能 +' + amt + '');
    };
   }
  );
 }

 /* ---------------- 从「学有余力」挑选，直接加入今日计划 ---------------- */
 function ideaPicker() {
  var ideas = Store.state.ideas.filter(function (i) { return !i.done; });
  var todayTasks = Store.day(Store.today()).tasks;
  var rows = ideas.map(function (i) {
   var added = todayTasks.some(function (t) { return t.ideaId === i.id; });
   return '<div class="picker-row" data-id="' + i.id + '">' +
    '<div class="grow">' +
     '<div class="pr-name">' + esc(i.title) + '</div>' +
     '<div class="t-meta"><span class="tag gray">' + esc(i.tag) + '</span></div>' +
    '</div>' +
    '<button class="mini-act' + (added ? ' added' : '') + '" data-act="add" ' + (added ? 'disabled' : '') + ' title="加入今日计划">' +
     (added ? '已加入' : '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>') +
    '</button>' +
   '</div>';
  }).join('');
  UI.sheet(
   '<h3>从学有余力挑选</h3>' +
   (ideas.length ? rows : UI.emptyBox('学有余力里还没有待办，先去记几条灵感吧')) +
   '<div style="height:12px"></div>',
   function (el) {
    UI.$$('[data-act=add]', el).forEach(function (b) {
     b.onclick = function () {
      var pid = b.closest('[data-id]').dataset.id;
      var idea = null;
      Store.state.ideas.forEach(function (i) { if (i.id === pid) idea = i; });
      var r = App.addIdeaToPlan(idea);
      UI.closeSheet(); refresh();
      UI.toast(r && r.exists ? '已在今日计划中' : '已加入今日计划 ');
     };
    });
   }
  );
 }

 /* ---------------- 精力头部 ---------------- */
 function energyHead() {
  var e = Store.energyOf(d());
  var usedW = Math.min(100, e.used / e.max * 100);
  var restW = Math.min(100 - usedW, e.restored / e.max * 100);
  var mood = e.left > 60 ? '状态在线，适合啃硬骨头' : (e.left > 30 ? '精力过半，注意节奏' : '快没电了，去充能吧');
  return '' +
   '<div class="energy-head">' +
    '<div class="eh-top">' +
     '<div class="eh-left">' +
      '<div class="t">剩余精力</div>' +
      '<div class="n">' + e.left + '<small> / ' + e.max + '</small></div>' +
     '</div>' +
     '<div class="eh-right">' +
      '<button class="eh-charge" id="chargeBtn">＋ 充能</button>' +
      '<div class="eh-stat">已消耗 <b>' + e.used + '</b><br/>已充能 <b>+' + e.restored + '</b></div>' +
     '</div>' +
    '</div>' +
    '<div class="energy-bar">' +
     '<i class="used" style="width:' + usedW + '%"></i>' +
     '<i class="rest" style="width:' + restW + '%"></i>' +
    '</div>' +
    '<div class="energy-legend">' +
     '<span><i style="background:#dcab9f"></i>已消耗</span>' +
     '<span><i style="background:#a9c9b8"></i>已充能</span>' +
     '<span style="margin-left:auto;opacity:.9">' + mood + '</span>' +
    '</div>' +
   '</div>';
 }

 /* ---------------- 计时器 ---------------- */
 function timerCard() {
  var t = Timer.get();
  var day = Store.day(d());
  var task = t.taskId ? Store.findTask(Store.today(), t.taskId) : null;
  var pomos = day.pomos || 0;
  var dots = '';
  for (var i = 0; i < 8; i++) dots += '<i class="' + (i < Math.min(8, pomos) ? 'on' : '') + '"></i>';

  return '' +
   '<div class="card timer-card">' +
    '<div class="timer-modes">' +
     '<button data-mode="pomo" class="' + (t.mode === 'pomo' ? 'on' : '') + '">番茄钟</button>' +
     '<button data-mode="watch" class="' + (t.mode === 'watch' ? 'on' : '') + '">正计时</button>' +
    '</div>' +
    '<div class="ring-wrap">' +
     '<svg viewBox="0 0 206 206">' +
      '<defs><linearGradient id="ringG" x1="0" y1="0" x2="1" y2="1">' +
       '<stop offset="0" stop-color="#63b0fb"/><stop offset="1" stop-color="#7fd3f2"/></linearGradient>' +
       '<linearGradient id="ringR" x1="0" y1="0" x2="1" y2="1">' +
       '<stop offset="0" stop-color="#8ce8c4"/><stop offset="1" stop-color="#b7f5cf"/></linearGradient></defs>' +
      '<circle cx="103" cy="103" r="' + RING_R + '" fill="none" stroke="rgba(150,185,225,.2)" stroke-width="13"/>' +
      '<circle id="ringProg" cx="103" cy="103" r="' + RING_R + '" fill="none" stroke-linecap="round" stroke-width="13"' +
       ' stroke="url(#' + (t.phase === 'focus' ? 'ringG' : 'ringR') + ')"' +
       ' stroke-dasharray="' + RING_C.toFixed(1) + '" stroke-dashoffset="' + (RING_C * (1 - t.pct)).toFixed(1) + '"/>' +
     '</svg>' +
     '<div class="ring-center">' +
      '<div class="ring-time" id="ringTime">' + t.text + '</div>' +
      '<div class="ring-phase" id="ringPhase">' + (t.mode === 'pomo' ? t.phaseName : '自由计时') + '</div>' +
      '<div class="ring-task" id="ringTask">' + (task ? '▸ ' + esc(task.title) : '未绑定任务') + '</div>' +
     '</div>' +
    '</div>' +
    '<div class="timer-ctrl">' +
     '<button class="tbtn" id="tStart">' + (t.running ? '暂停' : '开始') + '</button>' +
     '<button class="tbtn sec" id="tStop">' + (t.mode === 'watch' ? '结束记录' : '结束') + '</button>' +
    '</div>' +
    '<div class="timer-meta">' +
     '<div><b>' + pomos + '</b>今日番茄</div>' +
     '<div><b>' + Math.round((day.focusMin || 0)) + '</b>专注分钟</div>' +
     '<div><b>' + (t.cycle % Timer.CONF.longEvery) + '/4</b>距长休</div>' +
    '</div>' +
    '<div class="tomato-row">' + dots + '</div>' +
    '<div class="muted" style="margin-top:10px;font-size:11.5px">点击任务右侧 ▶ 可绑定该任务，番茄完成后自动累计专注时长（精力在创建任务时已扣除）</div>' +
   '</div>';
 }

 function updateTimerUI(t) {
  var ring = document.getElementById('ringProg');
  if (!ring) return;
  ring.setAttribute('stroke-dashoffset', (RING_C * (1 - t.pct)).toFixed(1));
  ring.setAttribute('stroke', 'url(#' + (t.phase === 'focus' || t.mode === 'watch' ? 'ringG' : 'ringR') + ')');
  var a = document.getElementById('ringTime'); if (a) a.textContent = t.text;
  var b = document.getElementById('ringPhase'); if (b) b.textContent = t.mode === 'pomo' ? t.phaseName : '自由计时';
  var c = document.getElementById('tStart'); if (c) c.textContent = t.running ? '暂停' : '开始';
  var task = t.taskId ? Store.findTask(Store.today(), t.taskId) : null;
  var e = document.getElementById('ringTask'); if (e) e.textContent = task ? '▸ ' + task.title : '未绑定任务';
 }

 /* ---------------- 任务 ---------------- */
 function taskItem(t) {
  var cat = Store.CATS[t.cat] || Store.CATS.invest;
  var pr = Store.PRIOS[t.priority] || Store.PRIOS.mid;
  var tg = Store.TAGS[t.tag] || Store.TAGS.other;
  var en = Store.taskEnergy(t);
  var sign = t.cat === 'charge' ? '+' : '-';
  var bound = Timer.get().taskId === t.id;
  return '' +
   '<div class="task-item' + (t.done ? ' done' : '') + (t.carried ? ' overdue' : '') + '" data-id="' + t.id + '">' +
    '<button class="tick' + (t.done ? ' on' : '') + '" data-act="toggle">' +
     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5 9.5 18 20 6.5"/></svg>' +
    '</button>' +
    '<div class="t-body">' +
     '<div class="t-name">' + esc(t.title) + '</div>' +
     '<div class="t-meta">' +
      '<span class="tag ' + cat.tag + '">' + cat.name + '</span>' +
      (t.tag !== 'other' ? '<span class="tag ' + tg.tag + '">' + tg.name + '</span>' : '') +
      '<span class="tag gray">' + pr.name + '优先</span>' +
      '<span class="muted" style="font-size:11px">⏳' + t.estMin + '分</span>' +
      '<span class="muted" style="font-size:11px;color:' + (t.cat === 'charge' ? '#2c9a70' : '#c9803a') + '">' + sign + en + '</span>' +
      (t.pomos ? '<span class="muted" style="font-size:11px">番茄 ' + t.pomos + '</span>' : '') +
      (t.focusMin ? '<span class="muted" style="font-size:11px">已投入' + t.focusMin + '分</span>' : '') +
      (t.carried ? '<span class="tag orange">昨日留存</span>' : '') +
     '</div>' +
    '</div>' +
    '<div class="t-actions">' +
     (isToday() && !t.done
      ? '<button class="mini-act' + (bound ? ' play' : '') + '" data-act="bind" title="绑定计时">' +
       '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M8 5.5v13l11-6.5z"/></svg></button>'
      : '') +
     '<button class="mini-act" data-act="edit" title="编辑">' +
      '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15.2 4.3 19.7 8.8 8.5 20H4v-4.5z"/></svg></button>' +
    '</div>' +
   '</div>';
 }

 function group(catKey, list) {
  var cat = Store.CATS[catKey];
  var iconKey = catKey === 'invest' ? 'knowledge' : (catKey === 'system' ? 'plan' : 'energy');
  var doneN = list.filter(function (t) { return t.done; }).length;
  var sum = list.reduce(function (a, t) { return a + Store.taskEnergy(t); }, 0);
  return '' +
   '<div class="task-group">' +
    '<div class="group-head">' +
     '<div class="gh-ic">' + Icons.cat(iconKey, { radius: 9, badge: false }) + '</div>' +
     '<b>' + cat.name + '</b><span>· ' + cat.desc + '</span>' +
     '<span style="margin-left:auto;font-size:11.5px" class="muted">' + doneN + '/' + list.length + ' · ' +
     (catKey === 'charge' ? '+' : '-') + sum + '</span>' +
    '</div>' +
    (list.length ? list.map(taskItem).join('') : '<div class="muted" style="padding:6px 4px 10px;font-size:12.5px">暂无任务</div>') +
   '</div>';
 }

 /* ---------------- 任务编辑弹层 ---------------- */
 function taskSheet(task) {
  var isEdit = !!task;
  var v = task || { title: '', cat: 'invest', tag: 'other', priority: 'mid', estMin: 25, level: 2 };
  var cur = { cat: v.cat, tag: v.tag, priority: v.priority, level: v.level };

  function segHtml(name, map, val, extra) {
   return '<div class="seg" data-seg="' + name + '">' + Object.keys(map).map(function (k) {
    return '<button data-val="' + k + '" class="' + (val === k ? 'on' : '') + '">' + map[k].name +
     (extra && map[k].desc ? '<small>' + map[k].desc + '</small>' : '') + '</button>';
   }).join('') + '</div>';
  }
  var lvHtml = '<div class="lv-seg" data-seg="level">' + [1, 2, 3, 4, 5].map(function (i) {
   return '<button data-val="' + i + '" class="' + (+v.level === i ? 'on' : '') + '">' + i +
    '<small>' + Store.ENERGY_MAP[i] + '</small></button>';
  }).join('') + '</div>';

  UI.sheet(
   '<h3>' + (isEdit ? '编辑计划' : '新增今日计划') + '</h3>' +
   '<div class="field"><label>任务名称</label>' +
    '<input type="text" id="fTitle" placeholder="例如：英语听力精听 25 分钟" value="' + esc(v.title) + '" maxlength="40"/></div>' +
   '<div class="field"><label>任务分类</label>' + segHtml('cat', Store.CATS, v.cat, true) + '</div>' +
   '<div class="field"><label>统计归类（自动同步到首页大屏）</label>' + segHtml('tag', Store.TAGS, v.tag) + '</div>' +
   '<div class="field"><label>优先级</label>' + segHtml('priority', Store.PRIOS, v.priority) + '</div>' +
   '<div class="field"><label>预计时长（分钟）</label>' +
    '<input type="number" id="fMin" min="5" max="480" step="5" value="' + (v.estMin || 25) + '"/></div>' +
   '<div class="field"><label id="lvLabel">精力消耗档位（1~5 级）</label>' + lvHtml + '</div>' +
   (isEdit ? '' : '<button class="link-act" id="fromIdeas">＋ 从「学有余力」挑一项作为今日任务</button>') +
   '<div class="sheet-actions">' +
    (isEdit ? '<button class="btn-danger" data-act="del">删除</button>' : '<button class="btn-ghost" data-act="cancel">取消</button>') +
    '<button class="btn-primary" data-act="ok">' + (isEdit ? '保存' : '添加计划') + '</button>' +
   '</div>',
   function (el) {
    UI.$$('[data-seg]', el).forEach(function (g) {
     var name = g.dataset.seg;
     UI.segGroup(g, function (val) {
      cur[name] = name === 'level' ? +val : val;
      if (name === 'cat') {
       var lab = el.querySelector('#lvLabel');
       var lv = el.querySelector('.lv-seg');
       lv.className = 'lv-seg ' + (val === 'charge' ? 'green' : (val === 'system' ? 'warm' : ''));
       lab.textContent = val === 'charge' ? '精力恢复档位（1~5 级）' : '精力消耗档位（1~5 级）';
      }
     });
    });
    if (v.cat === 'charge') el.querySelector('.lv-seg').className = 'lv-seg green';
    if (v.cat === 'system') el.querySelector('.lv-seg').className = 'lv-seg warm';

    // 从「学有余力」灵感清单挑一项直接加入今日计划
    var fi = el.querySelector('#fromIdeas');
    if (fi) fi.onclick = function () { UI.closeSheet(); setTimeout(ideaPicker, 220); };

    var cancel = el.querySelector('[data-act=cancel]');
    if (cancel) cancel.onclick = UI.closeSheet;
    var del = el.querySelector('[data-act=del]');
    if (del) del.onclick = function () {
     UI.closeSheet();
     setTimeout(function () {
      UI.confirm('删除这条计划？', task.title, function () {
       Store.removeTask(d(), task.id);
       if (Timer.get().taskId === task.id) Timer.bind('');
       refresh(); UI.toast('已删除');
      }, '删除');
     }, 260);
    };
    el.querySelector('[data-act=ok]').onclick = function () {
     var title = el.querySelector('#fTitle').value.trim();
     if (!title) { UI.toast('请先填写任务名称'); return; }
     var data = {
      title: title, cat: cur.cat, tag: cur.tag, priority: cur.priority,
      estMin: +el.querySelector('#fMin').value || 25, level: cur.level
     };
     if (isEdit) Store.updateTask(d(), task.id, data);
     else Store.addTask(d(), data);
     UI.closeSheet(); refresh();
     UI.toast(isEdit ? '已保存' : '计划已添加 ');
    };
   }
  );
 }

 /* ---------------- 页面 ---------------- */
 function render() {
  var day = Store.day(d());
  var tasks = day.tasks;
  var invest = tasks.filter(function (t) { return t.cat === 'invest'; });
  var system = tasks.filter(function (t) { return t.cat === 'system'; });
  var charge = tasks.filter(function (t) { return t.cat === 'charge'; });
  var doneN = tasks.filter(function (t) { return t.done; }).length;

  return '<div class="fade-in">' +
   dateBar() +
   energyHead() +
   timerCard() +
   '<div class="sec-title"><h2><span class="bar-mark"></span>今日计划</h2>' +
    '<span class="more">' + doneN + ' / ' + tasks.length + ' 已完成</span></div>' +
   (tasks.length ? '' : UI.emptyBox('还没有安排，点右下角 + 添加今天的第一件事')) +
   group('invest', invest) +
   group('system', system) +
   group('charge', charge) +
   '<div style="height:56px"></div>' +
   '</div>' +
   '<button class="fab" id="addTask"><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg></button>';
 }

 function dateBar() {
  var cn = d().split('-');
  return '<div class="card tight row" style="margin-bottom:14px">' +
   '<button class="mini-act" data-nav="-1"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M15 5l-7 7 7 7"/></svg></button>' +
   '<div class="grow" style="text-align:center">' +
    '<b style="font-size:14.5px">' + cn[1] + ' 月 ' + cn[2] + ' 日 · ' + Store.weekName(d()) + '</b>' +
    '<div class="muted" style="font-size:11px">' + (isToday() ? '今天' : (d() < Store.today() ? '历史记录' : '未来计划')) + '</div>' +
   '</div>' +
   '<button class="mini-act" data-nav="1"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M9 5l7 7-7 7"/></svg></button>' +
   '</div>';
 }

 function refresh() {
  var view = UI.$('#view');
  var st = view.scrollTop;
  view.innerHTML = render();
  mount(view);
  view.scrollTop = st;
  App.syncChrome();
 }

 function mount(root) {
  // 日期切换
  UI.$$('[data-nav]', root).forEach(function (b) {
   b.onclick = function () { curDate = Store.shift(d(), +b.dataset.nav); refresh(); };
  });
  // 新增
  var add = root.querySelector('#addTask');
  if (add) add.onclick = function () { taskSheet(null); };
  // 充能
  var chg = root.querySelector('#chargeBtn');
  if (chg) chg.onclick = function () { chargeSheet(); };

  // 计时器
  UI.$$('[data-mode]', root).forEach(function (b) {
   b.onclick = function () { Timer.setMode(b.dataset.mode); refresh(); };
  });
  var st = root.querySelector('#tStart');
  if (st) st.onclick = function () {
   var t = Timer.get();
   if (t.running) { Timer.pause(); } else { Timer.start(); }
   App.syncChrome();
  };
  var sp = root.querySelector('#tStop');
  if (sp) sp.onclick = function () { Timer.stop(); refresh(); };

  // 任务操作（事件委托）
  UI.$$('.task-item', root).forEach(function (item) {
   var id = item.dataset.id;
   UI.$$('[data-act]', item).forEach(function (b) {
    b.onclick = function (ev) {
     ev.stopPropagation();
     var act = b.dataset.act;
     if (act === 'toggle') {
      var t = Store.toggleTask(d(), id);
      if (t && t.done) {
       UI.toast(t.cat === 'charge' ? '充能完成 +' + Store.taskEnergy(t) + '' : '已完成，干得漂亮 ');
      }
      refresh();
     } else if (act === 'edit') {
      taskSheet(Store.findTask(d(), id));
     } else if (act === 'bind') {
      var cur = Timer.get().taskId;
      Timer.bind(cur === id ? '' : id);
      UI.toast(cur === id ? '已解除绑定' : '已绑定，开始专注吧');
      refresh();
     }
    };
   });
  });

  timerHandle = Timer.onChange(updateTimerUI);
 }

 function unmount() { if (timerHandle) { Timer.off(timerHandle); timerHandle = null; } }

 Pages.plan = {
  key: 'plan', name: '每日计划', sub: '精力管理 · 番茄专注', icon: 'plan',
  render: render, mount: mount, unmount: unmount, refresh: refresh,
  onEnter: function () { curDate = Store.today(); }
 };
})(window);
