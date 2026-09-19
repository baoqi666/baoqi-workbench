/* ============================================================
  页面：自信表达 · 口语 / 演讲训练（五步曲）
  无需录音 / 语音识别；完成自动记录，向首页统计 +10 分钟输出时长
  ============================================================ */
(function (global) {
 var Pages = global.Pages = global.Pages || {};
 var esc = UI.esc;

 // 口语训练五步曲（默认模板，用户可增删改）
 var STEPS = [
  { min: 3, text: '口部热身操（嘟嘴咧嘴、舌头绕圈、弹舌）' },
  { min: 5, text: '绕口令（平翘舌 / 鼻边音 / 前后鼻音任选一条）' },
  { min: 10, text: '今日认知口头复述（从今日输入中选一个概念，假装讲给别人听）' },
  { min: 5, text: '自我检查：语速是否适中？有无卡顿？' },
  { min: 5, text: '写下 1 句下次改进点' }
 ];
 var OUTPUT_MIN = 10; // 完成当日训练计入首页的口语输出分钟数

 /* 口语训练步骤：可增删改，存 Store.state.yuzhuo.steps（带稳定 id）。
    首次进入自动把默认模板种进去（只种一次，之后读取用户自定义）。 */
 function yzSteps() {
  var yz = Store.state.yuzhuo = Store.state.yuzhuo || { content: {}, remind: {}, steps: [] };
  if (!yz.steps || !yz.steps.length) {
   yz.steps = STEPS.map(function (s, i) { return { id: 't' + i, text: s.text, min: s.min }; });
   Store.save();
  }
  return yz.steps;
 }

 function rec(date) {
  var e = Store.state.express[date];
  if (!e) {
   e = { done: {}, credited: false, doneAt: 0 };
   Store.state.express[date] = e;
  }
  if (!e.done || typeof e.done !== 'object') e.done = {};
  return e;
 }
 function allDone(e, steps) {
  if (!steps.length) return false;
  return steps.every(function (s) { return e.done[s.id]; });
 }

 function render() {
  var td = Store.today();
  var e = rec(td);
  var steps = yzSteps();
  var doneN = steps.filter(function (s) { return e.done[s.id]; }).length;

  var c = Push.current();
  var sText = (c.sentence && c.sentence.text) || '今天也给自己一段安静的思考，去慢一点、深一点地活着。';
  var sentenceCard = '<div class="card daily-deep" id="dailySentence">' +
   '<div class="row" style="gap:10px;align-items:flex-start;margin-bottom:9px">' +
    '<div class="grow"><b style="font-size:var(--fs-3)">今日深度思考 · 玉琢</b></div>' +
    '<div style="flex:none;font-size:var(--fs-4);color:#b9a07a;white-space:nowrap;margin-top:3px">每日更新</div>' +
   '</div>' +
   '<div class="deep-quote">' + esc(sText) + '</div>' +
   '</div>';

  var b = c.beauty || {};
  var beautyCard = '<div class="card daily-deep" id="beautyCard">' +
   '<div class="row" style="gap:10px;align-items:flex-start;margin-bottom:10px">' +
    '<div class="grow"><b style="font-size:var(--fs-3)">美商修炼 · 今日</b></div>' +
    '<div style="flex:none;font-size:var(--fs-4);color:#b9a07a;white-space:nowrap;margin-top:3px">每日更新</div>' +
   '</div>' +
   '<div style="margin-bottom:9px">' +
    '<div style="font-size:var(--fs-4);color:var(--ink-3);font-weight:700;margin-bottom:3px">方法</div>' +
    '<div class="deep-quote" style="font-size:var(--fs-3);line-height:1.72">' + esc(b.method || '今天做一件让眼睛舒服的小事。') + '</div>' +
   '</div>' +
   '<div style="margin-bottom:9px">' +
    '<div style="font-size:var(--fs-4);color:var(--ink-3);font-weight:700;margin-bottom:3px">内容</div>' +
    '<div class="deep-quote" style="font-size:var(--fs-3);line-height:1.72">' + esc(b.content || '留意一件身边好看的东西。') + '</div>' +
   '</div>' +
   '<div>' +
    '<div style="font-size:var(--fs-4);color:var(--ink-3);font-weight:700;margin-bottom:3px">知识</div>' +
    '<div class="deep-quote" style="font-size:var(--fs-3);line-height:1.72">' + esc(b.knowledge || '审美是可以每天积累的眼睛训练。') + '</div>' +
   '</div>' +
   '</div>';

  var stepsHtml = steps.map(function (s) {
   var on = !!e.done[s.id];
   return '' +
    '<div class="step-item' + (on ? ' on' : '') + '" data-id="' + esc(s.id) + '">' +
     '<button class="tick' + (on ? ' on' : '') + '" data-act="toggle">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5 9.5 18 20 6.5"/></svg>' +
     '</button>' +
     '<div class="step-body">' +
      '<div class="step-name">' + esc(s.text) + '</div>' +
      '<div class="step-min">' + s.min + ' 分钟</div>' +
     '</div>' +
    '</div>';
  }).join('');

  var doneBanner = e.credited
   ? '<div class="expr-done">' +
     '<div class="ed-ic"></div>' +
     '<div class="grow"><b>今日训练已完成</b>' +
     '<div class="muted">已自动记录 +' + OUTPUT_MIN + ' 分钟口语输出，计入首页统计</div></div>' +
    '</div>'
   : '';

  return '<div class="fade-in">' +
   sentenceCard +
   beautyCard +
   '<div class="card" id="yzRemindCard">' +
    '<div class="row" style="gap:10px;align-items:center">' +
     '<div class="grow">' +
      '<b style="font-size:var(--fs-3)">提醒时间</b>' +
      '<div class="muted" style="font-size:var(--fs-4);margin-top:2px">自定义七类每日提醒的推送时刻</div>' +
     '</div>' +
     '<button data-act="edit-remind" style="flex:none;border:none;background:none;color:#b9a07a;font-weight:700;font-size:var(--fs-4);padding:6px 8px;cursor:pointer">设置</button>' +
    '</div>' +
   '</div>' +
   '<div class="card expr-head">' +
    '<div class="row" style="gap:12px">' +
     '<div style="width:46px;height:46px;border-radius:var(--r-m);overflow:hidden;flex:none">' + Icons.cat('express') + '</div>' +
     '<div class="grow"><b style="font-size:var(--fs-2)">今日口语表达训练</b>' +
      '<div class="muted" style="font-size:var(--fs-4)">五步曲 · 约 30 分钟 · 无需录音</div></div>' +
    '</div>' +
    '<div class="expr-prog"><b>' + doneN + '</b>/' + steps.length + '</div>' +
   '</div>' +
   (doneBanner || '<div class="card expr-tip">逐条勾选完成五步曲，全部完成后将自动记录到首页「口语输出」统计。</div>') +
   '<div class="sec-title"><h2><span class="bar-mark"></span>训练五步曲</h2>' +
    '<span class="more">' + Store.weekName(td) +
    ' · <button data-act="edit-training" style="border:none;background:none;color:#b9a07a;font-weight:700;font-size:var(--fs-4);padding:0 2px;cursor:pointer">编辑</button></span>' +
   '</div>' +
   (stepsHtml) +
   '<div style="height:24px"></div>' +
   '</div>';
 }

 function refresh() {
  var view = UI.$('#view'); var st = view.scrollTop;
  view.innerHTML = render(); mount(view); view.scrollTop = st;
  App.syncChrome();
 }

 function mount(root) {
  UI.$$('.step-item', root).forEach(function (el) {
   el.onclick = function () {
    var id = el.dataset.id;
    var td = Store.today();
    var e = rec(td);
    var steps = yzSteps();
    e.done[id] = !e.done[id];
    Store.save();
    if (allDone(e, steps) && !e.credited) {
     e.credited = true;
     e.doneAt = Date.now();
     Store.addOutput(td, OUTPUT_MIN);
     Store.save();
     UI.toast('训练完成！已记录 +' + OUTPUT_MIN + ' 分钟输出 ');
     refresh();
     return;
    }
    refresh();
   };
  });
  var editMap = { 'edit-training': editTrainingSheet, 'edit-remind': remindSheet };
  Object.keys(editMap).forEach(function (act) {
   var btn = UI.$('[data-act=' + act + ']', root);
   if (btn) btn.onclick = editMap[act];
  });
 }

 /* 七类每日提醒（键 / 名称 / 默认小时），顺序即展示顺序 */
 var REMINDS = [
  { key: 'changsha', label: '出门地点', def: 8 },
  { key: 'sentence', label: '今日深度思考', def: 8 },
  { key: 'health', label: '健康小知识', def:20 },
  { key: 'beauty', label: '美商修炼', def:21 },
  { key: 'stretchA', label: '睡前拉伸 · 晨', def:8 },
  { key: 'stretchB', label: '睡前拉伸 · 夜', def:11 },
  { key: 'sleep', label: '睡觉提醒', def:11 }
 ];

 /* 编辑口语训练：增删改训练步骤（存 Store.yuzhuo.steps，带稳定 id） */
 function editTrainingSheet() {
  var yz = (Store.state.yuzhuo = Store.state.yuzhuo || { content: {}, remind: {}, steps: [] });
  var list = (yz.steps && yz.steps.length ? yz.steps : STEPS.map(function (s, i) {
   return { id: 't' + i, text: s.text, min: s.min };
  })).map(function (s) {
   return { id: s.id || ('t' + Date.now() + '_' + Math.random().toString(36).slice(2, 7)), text: s.text || '', min: (s.min != null ? s.min : 5) };
  });

  function renderRows(el) {
   var box = el.querySelector('#yzStepList');
   box.innerHTML = list.map(function (s, i) {
    return '<div class="yz-step-row" data-id="' + esc(s.id) + '" style="display:flex;gap:8px;align-items:center;margin-bottom:10px">' +
     '<input type="text" class="yz-step-text" value="' + esc(s.text) + '" placeholder="训练动作 / 内容" maxlength="60" style="flex:1;min-width:0"/>' +
     '<input type="number" class="yz-step-min" min="0" max="240" step="1" value="' + s.min + '" style="width:58px;flex:none"/>' +
     '<button class="yz-step-del" data-del="' + i + '" style="flex:none;border:none;background:none;color:#c98;font-weight:700;font-size:var(--fs-4);padding:4px 6px;cursor:pointer">删</button>' +
     '</div>';
   }).join('');
   UI.$$('[data-del]', box).forEach(function (b) {
    b.onclick = function () { list.splice(+b.dataset.del, 1); renderRows(el); };
   });
  }

  UI.sheet(
   '<h3>编辑口语训练</h3>' +
   '<p class="muted" style="margin:-6px 0 12px;font-size:var(--fs-4)">可增删改训练步骤；全部勾选完成后会记入首页口语输出。</p>' +
   '<div id="yzStepList"></div>' +
   '<button data-act="add" style="margin:2px 0 12px;border:1px dashed var(--line);background:none;color:var(--brand-ink);font-weight:700;font-size:var(--fs-4);padding:9px 12px;border-radius:var(--r-m);cursor:pointer">＋ 添加一步</button>' +
   '<div class="sheet-actions">' +
    '<button class="btn-ghost" data-act="cancel">取消</button>' +
    '<button class="btn-primary" data-act="ok">保存</button>' +
   '</div>',
   function (el) {
    renderRows(el);
    el.querySelector('[data-act=add]').onclick = function () {
     list.push({ id: 't' + Date.now() + '_' + Math.random().toString(36).slice(2, 7), text: '', min: 5 });
     renderRows(el);
    };
    el.querySelector('[data-act=cancel]').onclick = UI.closeSheet;
    el.querySelector('[data-act=ok]').onclick = function () {
     var saved = [];
     UI.$$('.yz-step-row', el).forEach(function (row) {
      var t = row.querySelector('.yz-step-text').value.trim();
      if (!t) return;                       // 空文本步骤丢弃
      var m = parseInt(row.querySelector('.yz-step-min').value, 10);
      saved.push({ id: row.dataset.id, text: t, min: (isNaN(m) || m < 0 ? 0 : m) });
     });
     if (!saved.length) { UI.toast('请至少保留一步'); return; }
     yz.steps = saved;
     Store.save();
     UI.closeSheet(); refresh(); UI.toast('训练步骤已更新');
    };
   }
  );
 }

 /* 设置七类提醒时间：保存到 yuzhuo.remind（"HH:MM"），并立即重新排程 */
 function remindSheet() {
  var yz = (Store.state.yuzhuo = Store.state.yuzhuo || { content: {}, remind: {} });
  yz.remind = yz.remind || {};
  var fields = REMINDS.map(function (r) {
   var h = Push.remindHour(r.key, r.def);
   var val = (h.hour < 10 ? '0' : '') + h.hour + ':' + (h.minute < 10 ? '0' : '') + h.minute;
   return '<div class="field"><label>' + esc(r.label) + '</label>' +
    '<input type="time" id="yzr_' + r.key + '" value="' + val + '"/></div>';
  }).join('');
  UI.sheet(
   '<h3>提醒时间设置</h3>' +
   '<p class="muted" style="margin:-6px 0 14px;font-size:var(--fs-4)">修改后重新排程；今天已排的提醒也会按新时刻更新。</p>' +
   fields +
   '<div class="sheet-actions">' +
    '<button class="btn-ghost" data-act="reset">恢复默认</button>' +
    '<button class="btn-ghost" data-act="cancel">取消</button>' +
    '<button class="btn-primary" data-act="ok">保存</button>' +
   '</div>',
   function (el) {
    el.querySelector('[data-act=cancel]').onclick = UI.closeSheet;
    el.querySelector('[data-act=reset]').onclick = function () {
     yz.remind = {}; Store.save();
     Push.sync(); UI.closeSheet(); refresh(); UI.toast('已恢复默认提醒时间');
    };
    el.querySelector('[data-act=ok]').onclick = function () {
     REMINDS.forEach(function (r) {
      var v = el.querySelector('#yzr_' + r.key).value;
      if (v && /^\d{1,2}:\d{2}$/.test(v)) yz.remind[r.key] = v;
     });
     Store.save();
     Push.sync();
     UI.closeSheet(); refresh(); UI.toast('提醒时间已更新');
    };
   }
  );
 }

 Pages.express = {
  key: 'express', name: '玉琢', sub: '口语表达 · 美商修炼', icon: 'express',
  render: render, mount: mount, onEnter: function () { rec(Store.today()); }
 };
})(window);
