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

  var c = Push.current();
  var sText = (c.sentence && c.sentence.text) || '今天也给自己一段安静的思考，去慢一点、深一点地活着。';
  var sentenceCard = '<div class="card daily-deep" id="dailySentence">' +
   '<div class="row" style="gap:10px;align-items:flex-start;margin-bottom:9px">' +
    '<div class="grow"><b style="font-size:var(--fs-3)">今日深度思考 · 玉琢</b></div>' +
    '<button data-act="edit-sentence" style="flex:none;border:none;background:none;color:#b9a07a;font-weight:700;font-size:var(--fs-4);padding:2px 4px;cursor:pointer">编辑</button>' +
   '</div>' +
   '<div class="deep-quote">' + esc(sText) + '</div>' +
   '</div>';

  var b = c.beauty || {};
  var beautyCard = '<div class="card daily-deep" id="beautyCard">' +
   '<div class="row" style="gap:10px;align-items:flex-start;margin-bottom:10px">' +
    '<div class="grow"><b style="font-size:var(--fs-3)">美商修炼 · 今日</b></div>' +
    '<button data-act="edit-beauty" style="flex:none;border:none;background:none;color:#b9a07a;font-weight:700;font-size:var(--fs-4);padding:2px 4px;cursor:pointer">编辑</button>' +
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
  var editMap = { 'edit-sentence': editSentenceSheet, 'edit-beauty': editBeautySheet, 'edit-remind': remindSheet };
  Object.keys(editMap).forEach(function (act) {
   var btn = UI.$('[data-act=' + act + ']', root);
   if (btn) btn.onclick = editMap[act];
  });
 }

 /* 写入当天的玉琢内容覆盖（容错初始化 yuzhuo 结构） */
 function yzDay(td) {
  Store.state.yuzhuo = Store.state.yuzhuo || { content: {}, remind: {} };
  Store.state.yuzhuo.content = Store.state.yuzhuo.content || {};
  return Store.state.yuzhuo.content[td] || (Store.state.yuzhuo.content[td] = {});
 }

 /* 七类每日提醒（键 / 名称 / 默认小时），顺序即展示顺序 */
 var REMINDS = [
  { key: 'changsha', label: '出门地点', def: 8 },
  { key: 'sentence', label: '今日深度思考', def: 8 },
  { key: 'health', label: '健康小知识', def: 20 },
  { key: 'beauty', label: '美商修炼', def: 21 },
  { key: 'stretchA', label: '睡前拉伸 · 晨', def: 8 },
  { key: 'stretchB', label: '睡前拉伸 · 夜', def: 11 },
  { key: 'sleep', label: '睡觉提醒', def: 11 }
 ];

 /* 编辑「今日深度思考」：正文 + 可选通知引言，保存到 yuzhuo.content[td].sentence */
 function editSentenceSheet() {
  var td = Store.today();
  var s = (Push.current().sentence) || {};
  UI.sheet(
   '<h3>编辑今日深度思考</h3>' +
   '<div class="field"><label>正文</label><textarea id="yzSText" placeholder="写一句今天想对自己说的话">' + esc(s.text || '') + '</textarea></div>' +
   '<div class="field"><label>通知引言（可选）</label><input type="text" id="yzSBrief" maxlength="40" placeholder="推送通知里的一句话引导" value="' + esc(s.brief || '') + '"/></div>' +
   '<div class="sheet-actions">' +
    '<button class="btn-ghost" data-act="cancel">取消</button>' +
    '<button class="btn-primary" data-act="ok">保存</button>' +
   '</div>',
   function (el) {
    el.querySelector('[data-act=cancel]').onclick = UI.closeSheet;
    el.querySelector('[data-act=ok]').onclick = function () {
     var text = el.querySelector('#yzSText').value.trim();
     if (!text) { UI.toast('请填写正文'); return; }
     yzDay(td).sentence = { text: text, brief: el.querySelector('#yzSBrief').value.trim() };
     Store.save(); UI.closeSheet(); refresh(); UI.toast('已更新今日深度思考');
    };
   }
  );
 }

 /* 编辑「美商修炼」：方法 / 内容 / 知识，保存到 yuzhuo.content[td].beauty */
 function editBeautySheet() {
  var td = Store.today();
  var b = (Push.current().beauty) || {};
  UI.sheet(
   '<h3>编辑美商修炼</h3>' +
   '<div class="field"><label>方法</label><textarea id="yzBMethod" placeholder="今天怎么练">' + esc(b.method || '') + '</textarea></div>' +
   '<div class="field"><label>内容</label><textarea id="yzBContent" placeholder="今天留意什么">' + esc(b.content || '') + '</textarea></div>' +
   '<div class="field"><label>知识</label><textarea id="yzBKnowledge" placeholder="今天积累的知识点">' + esc(b.knowledge || '') + '</textarea></div>' +
   '<div class="sheet-actions">' +
    '<button class="btn-ghost" data-act="cancel">取消</button>' +
    '<button class="btn-primary" data-act="ok">保存</button>' +
   '</div>',
   function (el) {
    el.querySelector('[data-act=cancel]').onclick = UI.closeSheet;
    el.querySelector('[data-act=ok]').onclick = function () {
     yzDay(td).beauty = {
      method: el.querySelector('#yzBMethod').value.trim(),
      content: el.querySelector('#yzBContent').value.trim(),
      knowledge: el.querySelector('#yzBKnowledge').value.trim()
     };
     Store.save(); UI.closeSheet(); refresh(); UI.toast('已更新美商修炼');
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
