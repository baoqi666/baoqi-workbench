/* ============================================================
  页面：自信表达 · 口语 / 演讲训练（五步曲）
  无需录音 / 语音识别；完成自动记录，向首页统计 +10 分钟输出时长
  ============================================================ */
(function (global) {
 var Pages = global.Pages = global.Pages || {};
 var esc = UI.esc;

 // 每日训练五步曲（严格按模板）
 var STEPS = [
  { min: 3, text: '口部热身操（嘟嘴咧嘴、舌头绕圈、弹舌）' },
  { min: 5, text: '绕口令（平翘舌 / 鼻边音 / 前后鼻音任选一条）' },
  { min: 10, text: '今日认知口头复述（从今日输入中选一个概念，假装讲给别人听）' },
  { min: 5, text: '自我检查：语速是否适中？有无卡顿？' },
  { min: 5, text: '写下 1 句下次改进点' }
 ];
 var OUTPUT_MIN = 10; // 完成当日训练计入首页的口语输出分钟数

 function rec(date) {
  var e = Store.state.express[date];
  if (!e) {
   e = { steps: STEPS.map(function () { return false; }), credited: false, doneAt: 0 };
   Store.state.express[date] = e;
  }
  if (!e.steps || e.steps.length !== STEPS.length) e.steps = STEPS.map(function () { return false; });
  return e;
 }
 function allDone(e) {
  return e.steps.every(function (s) { return s; });
 }

 function render() {
  var td = Store.today();
  var e = rec(td);
  var doneN = e.steps.filter(function (s) { return s; }).length;

  var steps = STEPS.map(function (s, i) {
   var on = e.steps[i];
   return '' +
    '<div class="step-item' + (on ? ' on' : '') + '" data-i="' + i + '">' +
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
   '<div class="card expr-head">' +
    '<div class="row" style="gap:12px">' +
     '<div style="width:46px;height:46px;border-radius:14px;overflow:hidden;flex:none">' + Icons.cat('express') + '</div>' +
     '<div class="grow"><b style="font-size:16px">今日口语表达训练</b>' +
      '<div class="muted" style="font-size:12px">五步曲 · 约 30 分钟 · 无需录音</div></div>' +
    '</div>' +
    '<div class="expr-prog"><b>' + doneN + '</b>/' + STEPS.length + '</div>' +
   '</div>' +
   (doneBanner || '<div class="card expr-tip">逐条勾选完成五步曲，全部完成后将自动记录到首页「口语输出」统计。</div>') +
   '<div class="sec-title"><h2><span class="bar-mark"></span>训练五步曲</h2><span class="more">' + Store.weekName(td) + '</span></div>' +
   (steps) +
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
    var i = +el.dataset.i;
    var td = Store.today();
    var e = rec(td);
    e.steps[i] = !e.steps[i];
    Store.save();
    if (allDone(e) && !e.credited) {
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
 }

 Pages.express = {
  key: 'express', name: '自信表达', sub: '口语 · 演讲训练', icon: 'express',
  render: render, mount: mount, onEnter: function () { rec(Store.today()); }
 };
})(window);
