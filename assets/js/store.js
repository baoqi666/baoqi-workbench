/* ============================================================
  Store：本地数据仓库（IndexedDB，替代 localStorage）
  负责：任务 / 精力 / 打卡 / 专注统计 / 健康 / 运动 / 复盘
  数据存于手机应用私有数据库，清理缓存不会丢失
  ============================================================ */
(function (global) {
 var KEY = 'catdesk.v1';

 /* ---------- 日期工具 ---------- */
 function pad(n) { return n < 10 ? '0' + n : '' + n; }
 function fmt(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
 function parse(s) { var a = s.split('-'); return new Date(+a[0], +a[1] - 1, +a[2]); }
 function today() { return fmt(new Date()); }
 function shift(dateStr, n) { var d = parse(dateStr); d.setDate(d.getDate() + n); return fmt(d); }
 function diffDays(a, b) { return Math.round((parse(a) - parse(b)) / 86400000); }
 var WEEK_CN = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
 function weekName(dateStr) { return WEEK_CN[parse(dateStr).getDay()]; }
 function weekShort(dateStr) { return weekName(dateStr).replace('星期', ''); }
 /** 本周一 */
 function monday(dateStr) {
  var d = parse(dateStr), w = d.getDay() || 7;
  d.setDate(d.getDate() - (w - 1));
  return fmt(d);
 }
 /** ISO 周标识，如 2026-W31 */
 function weekKey(dateStr) {
  var d = parse(dateStr);
  var day = d.getDay() || 7;
  d.setDate(d.getDate() + 4 - day);
  var y0 = new Date(d.getFullYear(), 0, 1);
  var wk = Math.ceil((((d - y0) / 86400000) + 1) / 7);
  return d.getFullYear() + '-W' + pad(wk);
 }
 function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

 /* ---------- 默认数据 ---------- */
 var FIT_PRESETS = [
  { id: 'leg',   name: '练腿日',   icon: 'leg',   perWeek: 2, minutes: 40, desc: '深蹲 / 硬拉 / 弓步' },
  { id: 'shoulder', name: '练肩日',   icon: 'shoulder', perWeek: 1, minutes: 30, desc: '推举 / 侧平举 / 面拉' },
  { id: 'back',   name: '练背日',   icon: 'back',   perWeek: 2, minutes: 40, desc: '引体 / 划船 / 下拉' },
  { id: 'arm',   name: '手臂日',   icon: 'arm',   perWeek: 1, minutes: 25, desc: '弯举 / 臂屈伸' },
  { id: 'hip',   name: '臀腿塑形',  icon: 'hip',   perWeek: 2, minutes: 30, desc: '臀桥 / 侧抬腿 / 蚌式' },
  { id: 'posture', name: '体态训练',  icon: 'posture', perWeek: 5, minutes: 15, desc: '开肩 / 靠墙站 / 猫牛式' },
  { id: 'eye',   name: '眼部放松',  icon: 'eye',   perWeek: 7, minutes: 5, desc: '远眺 / 转眼 / 热敷' }
 ];

 function defaults() {
  return {
   v: 1,
   createdAt: today(),
   profile: { name: '喵の工作台', energyMax: 100, waterGoal: 5, kcalGoal: 1800 },
   streak: { count: 0, last: '', dates: [] },
   stats: {
    english:  { min: 0, count: 0 },
    knowledge: { min: 0, count: 0 },
    account:  { min: 0, count: 0 },
    other:   { min: 0, count: 0 },
    output:  { min: 0, count: 0 }
   },
   days: {},
   ideas: [],
   health: {},
   fitness: { presets: FIT_PRESETS.slice(), logs: {}, scope: 'week' },
   funds: [],
   reviews: [],
   express: {},
   rewards: [],
   redeemLog: [],
   redeemed: 0,
   budget: { month: '', amount: 0, expenses: [], settledMonth: '' },
   quote: { date: '', idx: 0 },
   budgets: {},
   seeded: false
  };
 }

 /* ---------- 载入 / 保存（IndexedDB） ---------- */
 var state = null;
 var ready = null;

 /** 启动时调用：从 IndexedDB 载入，若无则用默认数据 */
 function open() {
  if (ready) return ready;
  ready = IDB.get(KEY).then(function (raw) {
   if (raw && typeof raw === 'object') {
    var d = defaults();
    for (var k in d) if (!(k in raw)) raw[k] = d[k];
    if (!raw.fitness.presets || !raw.fitness.presets.length) raw.fitness.presets = FIT_PRESETS.slice();
    if (!raw.stats.output) raw.stats.output = { min: 0, count: 0 };
    if (!raw.funds) raw.funds = [];
    if (!raw.express) raw.express = {};
    if (!raw.rewards) raw.rewards = [];
    if (!raw.redeemLog) raw.redeemLog = [];
    if (raw.redeemed == null) raw.redeemed = 0;
    if (!raw.budget || !raw.budget.expenses) raw.budget = { month: '', amount: 0, expenses: [], settledMonth: '' };
    // 迁移：历史已完成的任务（未走过计时器、无 doneCredit）补记预计时长为积分来源
    Object.keys(raw.days || {}).forEach(function (dt) {
     (raw.days[dt].tasks || []).forEach(function (t) {
      if (t.done && !t.doneCredit && (t.focusMin || 0) === 0 && t.cat !== 'charge') {
       var est = t.estMin || 25;
       t.doneCredit = est;
       var st = raw.stats[t.tag] || raw.stats.other;
       st.min = (st.min || 0) + est;
       raw.days[dt].focusMin = (raw.days[dt].focusMin || 0) + est;
       t.focusMin = est;
      }
     });
    });
    state = raw;
   } else {
    state = defaults();
   }
   return state;
  }).catch(function () {
   state = defaults();
   return state;
  });
  return ready;
 }
 /** 持久化：异步写入 IndexedDB，失败静默降级 */
 function save() {
  if (!state) return;
  IDB.set(KEY, state);
 }

 /* ---------- 天数据 ---------- */
 function day(date) {
  date = date || today();
  if (!state.days[date]) {
   state.days[date] = { tasks: [], pomos: 0, focusMin: 0, energyMax: state.profile.energyMax, charges: [], todos: [] };
  }
  var d = state.days[date];
  if (d.energyMax == null) d.energyMax = state.profile.energyMax;
  if (!d.tasks) d.tasks = [];
  if (!d.charges) d.charges = [];
  if (!d.todos) d.todos = [];
  return d;
 }
 function health(date) {
  date = date || today();
  if (!state.health[date]) {
   state.health[date] = { sleepAt: '', wakeAt: '', sleepMin: 0, water: 0, meals: [] };
  }
  return state.health[date];
 }

 /* ---------- 精力 ---------- */
 var ENERGY_MAP = { 1: 5, 2: 10, 3: 15, 4: 20, 5: 25 };
 var LEVEL_LABEL = { 1: '微耗', 2: '轻度', 3: '中等', 4: '较重', 5: '极重' };
 var LEVEL_LABEL_UP = { 1: '微充', 2: '小憩', 3: '中等', 4: '充分', 5: '满血' };
 function taskEnergy(t) { return ENERGY_MAP[t.level] || 10; }

 function energyOf(date) {
  var d = day(date);
  var used = 0, restored = 0;
  (d.charges || []).forEach(function (c) { restored += c.amount || 0; });
  d.tasks.forEach(function (t) {
   var c = t.charged || 0;
   if (t.cat === 'charge') restored += c; else used += c;
  });
  var max = d.energyMax || 100;
  var left = Math.max(0, Math.min(max + restored, max - used + restored));
  return {
   max: max, used: used, restored: restored, left: left,
   pctUsed: Math.min(100, Math.round(used / max * 100)),
   pctRest: Math.min(100, Math.round(restored / max * 100)),
   pctLeft: Math.max(0, Math.round(left / max * 100))
  };
 }

 /* ---------- 任务 ---------- */
 var CATS = {
  invest: { name: '主动投资', tag: 'blue',  desc: '自我提升' },
  system: { name: '系统消耗', tag: 'orange', desc: '琐事杂活' },
  charge: { name: '充能',   tag: 'green', desc: '恢复精力' }
 };
 var TAGS = {
  english:  { name: '英语听力', tag: 'violet' },
  knowledge: { name: '知识学习', tag: 'blue' },
  account:  { name: '账号更新', tag: 'pink' },
  other:   { name: '其他',   tag: 'gray' }
 };
 var PRIOS = {
  high: { name: '高', tag: 'pink' },
  mid: { name: '中', tag: 'orange' },
  low: { name: '低', tag: 'gray' }
 };

 function addTask(date, data) {
  var d = day(date);
  var cat = data.cat || 'invest';
  var t = {
   id: uid(),
   title: data.title,
   cat: cat,
   tag: data.tag || 'other',
   priority: data.priority || 'mid',
   estMin: +data.estMin || 25,
   level: +data.level || 2,
   ideaId: data.ideaId || null,
   done: false,
   // 创建时立即按精力消耗档位扣减（充能类任务不预先扣）
   charged: cat === 'charge' ? 0 : taskEnergy({ level: +data.level || 2 }),
   focusMin: 0,
   pomos: 0,
   createdAt: Date.now()
  };
  d.tasks.push(t);
  save();
  return t;
 }
 function updateTask(date, id, data) {
  var t = findTask(date, id);
  if (!t) return null;
  ['title', 'cat', 'tag', 'priority'].forEach(function (k) { if (data[k] != null) t[k] = data[k]; });
  if (data.estMin != null) t.estMin = +data.estMin;
  if (data.level != null) {
   t.level = +data.level;
   // 消耗类未完成任务：按新档位重新预扣；充能类已完成：按新档位重新结算
   if (t.cat === 'charge') { if (t.done) t.charged = taskEnergy(t); }
   else if (!t.done) { t.charged = taskEnergy(t); }
  }
  save();
  return t;
 }
 function removeTask(date, id) {
  var d = day(date);
  d.tasks = d.tasks.filter(function (t) { return t.id !== id; });
  save();
 }
 function findTask(date, id) {
  var d = day(date), r = null;
  d.tasks.forEach(function (t) { if (t.id === id) r = t; });
  return r;
 }
 /** 勾选完成 / 取消：统计计数；精力在创建时已扣，充能类在勾选完成时恢复 */
 function toggleTask(date, id) {
  var t = findTask(date, id);
  if (!t) return null;
  t.done = !t.done;
  if (t.done) {
   if (t.cat === 'charge') t.charged = taskEnergy(t); // 充能任务：完成时恢复精力
   t.doneAt = Date.now();
   var s = state.stats[t.tag] || state.stats.other;
   s.count += 1;
   // 完成任务：把预计时长折算成专注分钟计入积分（不与计时器已记录的时长重复）
   if (t.cat !== 'charge' && !t.doneCredit) {
    var est = t.estMin || 25;
    var had = t.focusMin || 0;
    var credit = Math.max(0, est - had);
    if (credit > 0) {
     t.doneCredit = credit;
     s.min += credit;
     var dd = day(date);
     dd.focusMin = (dd.focusMin || 0) + credit;
     t.focusMin = had + credit;
    }
   }
  } else {
   t.charged = 0; // 取消：退还已扣精力（消耗类）/移除恢复（充能类）
   t.doneAt = null;
   var s2 = state.stats[t.tag] || state.stats.other;
   s2.count = Math.max(0, s2.count - 1);
   // 撤销完成：扣回之前计入的专注分钟（保留计时器额外记录的时长）
   if (t.cat !== 'charge' && t.doneCredit) {
    var back = t.doneCredit || 0;
    s2.min = Math.max(0, s2.min - back);
    var d2 = day(date);
    d2.focusMin = Math.max(0, (d2.focusMin || 0) - back);
    t.focusMin = Math.max(0, (t.focusMin || 0) - back);
    t.doneCredit = 0;
   }
  }
  save();
  return t;
 }
 /** 番茄完成时按比例预扣精力 */
 function chargePomo(date, id) {
  var t = findTask(date, id);
  if (!t || t.done) return;
  var full = taskEnergy(t);
  var estPomos = Math.max(1, Math.round((t.estMin || 25) / 25));
  var step = Math.ceil(full / estPomos);
  t.charged = Math.min(full, (t.charged || 0) + step);
  save();
 }
 /** 累计专注时长 → 任务 + 当日 + 全局分类统计 */
 function addFocus(date, taskId, minutes) {
  minutes = Math.max(0, Math.round(minutes));
  if (!minutes) return;
  var d = day(date);
  d.focusMin = (d.focusMin || 0) + minutes;
  var tag = 'other';
  if (taskId) {
   var t = findTask(date, taskId);
   if (t) { t.focusMin = (t.focusMin || 0) + minutes; tag = t.tag || 'other'; }
  }
  var s = state.stats[tag] || state.stats.other;
  s.min += minutes;
  save();
 }
 function addPomo(date, taskId) {
  var d = day(date);
  d.pomos = (d.pomos || 0) + 1;
  if (taskId) { var t = findTask(date, taskId); if (t) t.pomos = (t.pomos || 0) + 1; }
  save();
 }

 /** 手动充能（计划页「+充能」按钮）：记录一笔精力恢复，不依赖任务 */
 function addCharge(date, amount, label) {
  amount = Math.max(0, Math.round(amount || 0));
  if (!amount) return;
  day(date).charges.push({ amount: amount, label: label || '充能', ts: Date.now() });
  save();
 }

 /** 自信表达完成：累计口语输出时长（分钟）到首页统计 */
 function addOutput(date, minutes) {
  minutes = Math.max(0, Math.round(minutes || 0));
  if (!minutes) return;
  state.stats.output.min += minutes;
  state.stats.output.count += 1;
  save();
 }

 /** 未完成任务自动留存到今天 */
 function rollover() {
  var td = today(), moved = 0;
  Object.keys(state.days).forEach(function (date) {
   if (date >= td) return;
   if (diffDays(td, date) > 7) return;
   state.days[date].tasks.forEach(function (t) {
    if (t.done || t.moved) return;
    t.moved = true;
    moved++;
    var copy = JSON.parse(JSON.stringify(t));
    copy.id = uid();
    copy.moved = false;
    copy.charged = 0;
    copy.focusMin = 0;
    copy.pomos = 0;
    copy.carried = true;
    copy.fromDate = date;
    day(td).tasks.push(copy);
   });
  });
  if (moved) save();
  return moved;
 }

 /* ---------- 打卡 ---------- */
 function checkin() {
  var td = today(), st = state.streak;
  if (st.last === td) return st.count;
  if (st.last && diffDays(td, st.last) === 1) st.count += 1;
  else st.count = 1;
  st.last = td;
  st.dates = (st.dates || []).filter(function (d) { return diffDays(td, d) < 60; });
  if (st.dates.indexOf(td) < 0) st.dates.push(td);
  save();
  return st.count;
 }

 /* ---------- 统计 ---------- */
 function lastDays(n) {
  var arr = [], td = today();
  for (var i = n - 1; i >= 0; i--) arr.push(shift(td, -i));
  return arr;
 }
 function trend(n) {
  return lastDays(n).map(function (date) {
   var d = state.days[date];
   var done = 0;
   if (d) d.tasks.forEach(function (t) { if (t.done) done++; });
   return {
    date: date,
    label: weekShort(date),
    focusMin: d ? (d.focusMin || 0) : 0,
    pomos: d ? (d.pomos || 0) : 0,
    done: done,
    energy: d ? energyOf(date).used : 0
   };
  });
 }
 function totalFocus() {
  var s = state.stats;
  return s.english.min + s.knowledge.min + s.account.min + s.other.min;
 }

 /* ---------- 灵感清单 ---------- */
 function addIdea(data) {
  state.ideas.unshift({ id: uid(), title: data.title, tag: data.tag || '想尝试', note: data.note || '', feel: '', done: false, createdAt: Date.now() });
  save();
 }
 function toggleIdea(id) {
  state.ideas.forEach(function (i) { if (i.id === id) { i.done = !i.done; i.doneAt = i.done ? Date.now() : null; } });
  save();
 }
 function setIdeaFeel(id, feel) {
  state.ideas.forEach(function (i) { if (i.id === id) { i.feel = feel || ''; } });
  save();
 }
 function removeIdea(id) {
  state.ideas = state.ideas.filter(function (i) { return i.id !== id; });
  save();
 }

 /* ---------- 运动 ---------- */
 function fitLogs(date) {
  date = date || today();
  if (!state.fitness.logs[date]) state.fitness.logs[date] = [];
  return state.fitness.logs[date];
 }
 function addFitLog(date, item) {
  fitLogs(date).push({ id: uid(), presetId: item.presetId || '', name: item.name, minutes: +item.minutes || 15, ts: Date.now() });
  save();
 }
 function removeFitLog(date, id) {
  state.fitness.logs[date] = fitLogs(date).filter(function (l) { return l.id !== id; });
  save();
 }
 /** 周内某预设完成次数 */
 function fitWeekCount(presetId, dateStr) {
  var start = monday(dateStr || today()), c = 0;
  for (var i = 0; i < 7; i++) {
   var d = shift(start, i);
   (state.fitness.logs[d] || []).forEach(function (l) { if (l.presetId === presetId) c++; });
  }
  return c;
 }
 function fitMonthMinutes(dateStr) {
  var t = parse(dateStr || today()), pre = t.getFullYear() + '-' + pad(t.getMonth() + 1), m = 0, n = 0;
  Object.keys(state.fitness.logs).forEach(function (d) {
   if (d.indexOf(pre) === 0) state.fitness.logs[d].forEach(function (l) { m += l.minutes; n++; });
  });
  return { minutes: m, count: n };
 }

 /* ---------- 日历待办（按日期，可设具体时间） ---------- */
 function addTodo(date, data) {
  day(date).todos.push({
   id: uid(), title: data.title, time: data.time || '',
   done: false, createdAt: Date.now()
  });
  save();
 }
 function toggleTodo(date, id) {
  var list = day(date).todos;
  list.forEach(function (t) { if (t.id === id) { t.done = !t.done; t.doneAt = t.done ? Date.now() : null; } });
  save();
 }
 function removeTodo(date, id) {
  var d = day(date);
  d.todos = d.todos.filter(function (t) { return t.id !== id; });
  save();
 }
 function sortedTodos(date) {
  var list = day(date).todos.slice();
  list.sort(function (a, b) {
   var ta = a.time || '99:99', tb = b.time || '99:99';
   if (ta === tb) return 0;
   return ta < tb ? -1 : 1;
  });
  return list;
 }

 /* ---------- 梦想储蓄罐（多基金） ---------- */
 function addFund(data) {
  state.funds.push({
   id: uid(), name: data.name || '梦想基金',
   target: Math.max(0, +data.target || 0),
   balance: 0, deposits: [], createdAt: Date.now()
  });
  save();
 }
 function updateFund(id, data) {
  var f = null;
  state.funds.forEach(function (x) { if (x.id === id) f = x; });
  if (!f) return;
  if (data.name != null) f.name = data.name;
  if (data.target != null) f.target = Math.max(0, +data.target || 0);
  save();
 }
 function removeFund(id) {
  state.funds = state.funds.filter(function (x) { return x.id !== id; });
  save();
 }
 /** 存入某个基金（amount 可正可负；负值为取出） */
 function depositFund(id, amount, note) {
  var f = null;
  state.funds.forEach(function (x) { if (x.id === id) f = x; });
  if (!f) return;
  amount = Math.round(amount || 0);
  f.balance = Math.max(0, (f.balance || 0) + amount);
  f.deposits.push({ amount: amount, note: note || '', ts: Date.now() });
  save();
}

/* ---------- 本月预算 ---------- */
function curMonth() { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1); }
function getBudget() {
  var m = curMonth();
  if (!state.budgets) state.budgets = {};
  if (!state.budgets[m]) state.budgets[m] = { amount: 0, spent: 0, saved: 0, expenses: [] };
  return state.budgets[m];
}
function setBudgetAmount(amount) {
  amount = Math.max(0, Math.round(amount || 0));
  getBudget().amount = amount;
  save();
}
function addExpense(amount, cat, note) {
  amount = Math.max(0, Math.round(amount || 0));
  if (!amount) return;
  var b = getBudget();
  b.expenses.unshift({ id: uid(), cat: cat || '其他', amount: amount, note: note || '', ts: Date.now() });
  b.spent += amount;
  save();
}
function removeExpense(id) {
  var b = getBudget();
  var ex = null;
  b.expenses = b.expenses.filter(function (e) { if (e.id === id) { ex = e; return false; } return true; });
  if (ex) b.spent = Math.max(0, (b.spent || 0) - ex.amount);
  save();
}
function budgetLeft() {
  var b = getBudget();
  return Math.max(0, (b.amount || 0) - (b.spent || 0) - (b.saved || 0));
}
function addBudgetSaved(amount) {
  amount = Math.max(0, Math.round(amount || 0));
  if (!amount) return;
  getBudget().saved = (getBudget().saved || 0) + amount;
  save();
}

/* ---------- 复盘 ---------- */
 function saveReview(data) {
  var idx = -1;
  state.reviews.forEach(function (r, i) { if (r.id === data.id) idx = i; });
  if (idx >= 0) { state.reviews[idx] = Object.assign(state.reviews[idx], data, { updatedAt: Date.now() }); }
  else {
   data.id = data.id || uid();
   data.createdAt = Date.now();
   data.updatedAt = Date.now();
   state.reviews.unshift(data);
  }
  save();
  return data;
 }
 function removeReview(id) {
  state.reviews = state.reviews.filter(function (r) { return r.id !== id; });
  save();
 }

 /* ---------- 积分与奖励 ---------- */
 /** 累计已专注总分钟（含口语输出） */
 function totalFocusMinutes() {
  return totalFocus() + (state.stats.output ? state.stats.output.min : 0);
 }
 /** 可用积分 = 累计专注分钟每 60 分钟换 1 分 - 已兑换消耗 */
 function availablePoints() {
  var earned = Math.floor(totalFocusMinutes() / 60);
  return Math.max(0, earned - (state.redeemed || 0));
 }
 /** 累计获得的总分（不含兑换扣除），用于展示「已赚取」 */
 function earnedPoints() {
  return Math.floor(totalFocusMinutes() / 60);
 }
 function addReward(data) {
  state.rewards.unshift({
   id: uid(), name: data.name || '奖励',
   cost: Math.max(0, Math.round(+data.cost || 0)),
   createdAt: Date.now()
  });
  save();
 }
 function updateReward(id, data) {
  var r = null;
  state.rewards.forEach(function (x) { if (x.id === id) r = x; });
  if (!r) return;
  if (data.name != null) r.name = data.name;
  if (data.cost != null) r.cost = Math.max(0, Math.round(+data.cost || 0));
  save();
 }
 function removeReward(id) {
  state.rewards = state.rewards.filter(function (x) { return x.id !== id; });
  save();
 }
 /** 兑换：校验可用积分，扣除并记入兑换历史（同一奖励可重复兑换） */
 function redeem(rewardId) {
  var r = null;
  state.rewards.forEach(function (x) { if (x.id === rewardId) r = x; });
  if (!r) return { ok: false, err: '奖励不存在' };
  var cost = r.cost || 0;
  if (availablePoints() < cost) return { ok: false, err: '积分不足' };
  state.redeemed = (state.redeemed || 0) + cost;
  state.redeemLog.unshift({ id: uid(), rewardId: rewardId, name: r.name, cost: cost, ts: Date.now() });
  save();
  return { ok: true };
 }

 /* ---------- 本月预算 / 支出 / 结余存罐 ---------- */
 function curMonth() { return new Date().getFullYear() + '-' + pad(new Date().getMonth() + 1); }
 /** 设置本月预算：切换月份时自动重置支出记录 */
 function setBudget(amount) {
  amount = Math.max(0, Math.round(amount || 0));
  var b = state.budget, cm = curMonth();
  if (b.month !== cm) { b.month = cm; b.expenses = []; }
  b.amount = amount;
  b.settledMonth = '';
  save();
 }
 /** 记录一笔支出（记在当天，计入本月已支出） */
 function addExpense(amount, note) {
  amount = Math.max(0, Math.round(amount || 0));
  if (!amount) return;
  state.budget.expenses.push({ id: uid(), date: today(), amount: amount, note: note || '' });
  state.budget.settledMonth = '';
  save();
 }
 function removeExpense(id) {
  state.budget.expenses = state.budget.expenses.filter(function (x) { return x.id !== id; });
  state.budget.settledMonth = '';
  save();
 }
 /** 本月已支出合计 */
 function budgetSpent() {
  var cm = curMonth();
  return state.budget.expenses.reduce(function (a, e) { return a + ((e.date || '').indexOf(cm) === 0 ? (e.amount || 0) : 0); }, 0);
 }
 /** 本月剩余 = 预算 − 已支出（不为负） */
 function budgetRemaining() {
  return Math.max(0, (state.budget.amount || 0) - budgetSpent());
 }

 /* ---------- 首次示例数据 ---------- */
 function seed() {
  if (state.seeded) return;
  state.seeded = true;
  var td = today();
  var d = day(td);
  if (!d.tasks.length) {
   [
    { title: '英语听力精听 25 分钟', cat: 'invest', tag: 'english',  priority: 'high', estMin: 25, level: 2 },
    { title: '深度阅读 / 专业课学习', cat: 'invest', tag: 'knowledge', priority: 'high', estMin: 50, level: 3 },
    { title: '更新个人账号内容',   cat: 'invest', tag: 'account',  priority: 'mid', estMin: 40, level: 3 },
    { title: '处理邮件与日常杂事',  cat: 'system', tag: 'other',   priority: 'low', estMin: 20, level: 2 },
    { title: '午间冥想 15 分钟',   cat: 'charge', tag: 'other',   priority: 'mid', estMin: 15, level: 2 }
   ].forEach(function (t) { addTask(td, t); });
  }
  if (!state.ideas.length) {
   [
    { title: '学会一首完整的钢琴曲', tag: '兴趣' },
    { title: '尝试一次城市 Citywalk 摄影', tag: '想尝试' },
    { title: '读完《思考，快与慢》', tag: '阅读' },
    { title: '研究一下副业变现路径', tag: '长期探索' }
   ].forEach(addIdea);
  }
  save();
 }

 function reset() {
  IDB.del(KEY);
  state = defaults();
  save();
 }

 /** 完整导出（深拷贝），用于备份 */
 function exportAll() {
  return JSON.parse(JSON.stringify(state));
 }
 /** 用备份对象覆盖当前数据 */
 function importAll(obj) {
  if (!obj || typeof obj !== 'object') return false;
  var d = defaults();
  for (var k in d) if (!(k in obj)) obj[k] = d[k];
  if (!obj.fitness || !obj.fitness.presets || !obj.fitness.presets.length) obj.fitness.presets = FIT_PRESETS.slice();
  if (!obj.stats.output) obj.stats.output = { min: 0, count: 0 };
  if (!obj.funds) obj.funds = [];
  if (!obj.express) obj.express = {};
  if (!obj.rewards) obj.rewards = [];
  if (!obj.redeemLog) obj.redeemLog = [];
  if (obj.redeemed == null) obj.redeemed = 0;
  if (!obj.budget || !obj.budget.expenses) obj.budget = { month: '', amount: 0, expenses: [], settledMonth: '' };
  state = obj;
  save();
  return true;
 }

 /* ---------- 导出 ---------- */
 global.Store = {
  get state() { return state; },
  save: save, reset: reset, seed: seed, open: open,
  exportAll: exportAll, importAll: importAll,
  today: today, fmt: fmt, parse: parse, shift: shift, diffDays: diffDays,
  weekName: weekName, weekShort: weekShort, monday: monday, weekKey: weekKey, uid: uid,
  day: day, health: health,
  ENERGY_MAP: ENERGY_MAP, LEVEL_LABEL: LEVEL_LABEL, LEVEL_LABEL_UP: LEVEL_LABEL_UP,
  CATS: CATS, TAGS: TAGS, PRIOS: PRIOS,
  taskEnergy: taskEnergy, energyOf: energyOf,
  addTask: addTask, updateTask: updateTask, removeTask: removeTask,
  findTask: findTask, toggleTask: toggleTask, chargePomo: chargePomo,
  addFocus: addFocus, addPomo: addPomo, addCharge: addCharge, addOutput: addOutput, rollover: rollover,
  checkin: checkin, trend: trend, lastDays: lastDays, totalFocus: totalFocus,
  addIdea: addIdea, toggleIdea: toggleIdea, setIdeaFeel: setIdeaFeel, removeIdea: removeIdea,
  fitLogs: fitLogs, addFitLog: addFitLog, removeFitLog: removeFitLog,
  fitWeekCount: fitWeekCount, fitMonthMinutes: fitMonthMinutes,
  addTodo: addTodo, toggleTodo: toggleTodo, removeTodo: removeTodo, sortedTodos: sortedTodos,
  addFund: addFund, updateFund: updateFund, removeFund: removeFund, depositFund: depositFund,
  curMonth: curMonth, getBudget: getBudget, setBudgetAmount: setBudgetAmount,
  addExpense: addExpense, removeExpense: removeExpense, budgetLeft: budgetLeft, addBudgetSaved: addBudgetSaved,
  saveReview: saveReview, removeReview: removeReview,
  totalFocusMinutes: totalFocusMinutes, availablePoints: availablePoints, earnedPoints: earnedPoints,
  addReward: addReward, updateReward: updateReward, removeReward: removeReward, redeem: redeem,
  curMonth: curMonth, setBudget: setBudget, addExpense: addExpense, removeExpense: removeExpense,
  budgetSpent: budgetSpent, budgetRemaining: budgetRemaining
 };
})(window);
