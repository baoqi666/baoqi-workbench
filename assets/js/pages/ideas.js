/* ============================================================
  页面：学有余力 · 灵感备忘录
  ============================================================ */
(function (global) {
 var Pages = global.Pages = global.Pages || {};
 var esc = UI.esc;
 var TAGS = ['想尝试', '兴趣', '阅读', '技能', '旅行', '长期探索'];
 var TAG_STYLE = { '想尝试': 'blue', '兴趣': 'pink', '阅读': 'violet', '技能': 'green', '旅行': 'orange', '长期探索': 'gray' };
 var filter = '全部';

 function ideaSheet(item) {
  var isEdit = !!item;
  var v = item || { title: '', tag: '想尝试', note: '' };
  var cur = { tag: v.tag };
  UI.sheet(
   '<h3>' + (isEdit ? '编辑灵感' : '记一条灵感') + '</h3>' +
   '<div class="field"><label>想做的事</label>' +
    '<input type="text" id="iTitle" placeholder="例如：学会做一道拿手菜" value="' + esc(v.title) + '" maxlength="50"/></div>' +
   '<div class="field"><label>标签分类</label><div class="chips" data-seg="tag">' +
    TAGS.map(function (t) { return '<button class="chip' + (v.tag === t ? ' on' : '') + '" data-val="' + t + '">' + t + '</button>'; }).join('') +
   '</div></div>' +
   '<div class="field"><label>备注（可选）</label>' +
    '<textarea id="iNote" placeholder="为什么想做？打算怎么开始？">' + esc(v.note || '') + '</textarea></div>' +
   (v.done ? '<div class="field"><label>完成时的感受</label>' +
    '<textarea id="iFeel" placeholder="记录一下完成时的心情…">' + esc(v.feel || '') + '</textarea></div>' : '') +
   '<div class="sheet-actions">' +
    (isEdit ? '<button class="btn-danger" data-act="del">删除</button>' : '<button class="btn-ghost" data-act="cancel">取消</button>') +
    '<button class="btn-primary" data-act="ok">' + (isEdit ? '保存' : '添加') + '</button></div>',
   function (el) {
    UI.$$('[data-seg=tag] .chip', el).forEach(function (b) {
     b.onclick = function () {
      UI.$$('[data-seg=tag] .chip', el).forEach(function (x) { x.classList.remove('on'); });
      b.classList.add('on'); cur.tag = b.dataset.val;
     };
    });
    var c = el.querySelector('[data-act=cancel]'); if (c) c.onclick = UI.closeSheet;
    var dl = el.querySelector('[data-act=del]');
    if (dl) dl.onclick = function () {
     UI.closeSheet();
     setTimeout(function () {
      UI.confirm('删除这条灵感？', item.title, function () { Store.removeIdea(item.id); refresh(); UI.toast('已删除'); }, '删除');
     }, 260);
    };
    el.querySelector('[data-act=ok]').onclick = function () {
     var title = el.querySelector('#iTitle').value.trim();
     if (!title) { UI.toast('写点什么吧 '); return; }
     var note = el.querySelector('#iNote').value.trim();
     if (isEdit) {
      item.title = title; item.tag = cur.tag; item.note = note;
      var feelEl = el.querySelector('#iFeel');
      if (feelEl) item.feel = feelEl.value.trim();
      Store.save();
     } else {
      Store.addIdea({ title: title, tag: cur.tag, note: note });
     }
     UI.closeSheet(); refresh(); UI.toast(isEdit ? '已保存' : '已记下');
    };
   }
  );
 }

 function item(i) {
  var inPlan = Store.day(Store.today()).tasks.some(function (t) { return t.ideaId === i.id; });
  return '' +
   '<div class="idea-item' + (i.done ? ' done' : '') + '" data-id="' + i.id + '">' +
    '<button class="tick' + (i.done ? ' on' : '') + '" data-act="toggle">' +
     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5 9.5 18 20 6.5"/></svg>' +
    '</button>' +
    '<div class="grow" data-act="edit">' +
     '<div class="i-name">' + esc(i.title) + '</div>' +
     '<div class="t-meta">' +
      '<span class="tag ' + (TAG_STYLE[i.tag] || 'gray') + '">' + esc(i.tag) + '</span>' +
      (i.note ? '<span class="muted" style="font-size:11.5px">' + esc(i.note.slice(0, 22)) + (i.note.length > 22 ? '…' : '') + '</span>' : '') +
      (inPlan ? '<span class="tag green">已在今日计划</span>' : '') +
     '</div>' +
     (i.feel ? '<div class="i-feel">「' + esc(i.feel) + '」</div>' : '') +
    '</div>' +
    (inPlan || i.done ? '' : '<button class="mini-act" data-act="plan" title="加入今日计划">' +
     '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg></button>') +
   '</div>';
 }

 /* 完成时记录当下感受（可选） */
 function openFeel(idea) {
  var val = idea.feel || '';
  UI.sheet(
   '<h3>记录此刻的感受</h3>' +
   '<div class="muted" style="text-align:center;font-size:12px;margin-bottom:12px">「' + esc(idea.title) + '」已完成</div>' +
   '<div class="field"><label>一句话记录当下的心情（可选）</label>' +
    '<textarea id="fFeel" placeholder="例如：原来我真的可以做到，很踏实。">' + esc(val) + '</textarea></div>' +
   '<div class="sheet-actions">' +
    '<button class="btn-ghost" data-act="skip">稍后再写</button>' +
    '<button class="btn-primary" data-act="ok">保存感受</button></div>',
   function (el) {
    var skip = el.querySelector('[data-act=skip]');
    if (skip) skip.onclick = UI.closeSheet;
    el.querySelector('[data-act=ok]').onclick = function () {
     var txt = el.querySelector('#fFeel').value.trim();
     Store.setIdeaFeel(idea.id, txt);
     UI.closeSheet(); refresh(); UI.toast(txt ? '已记录感受' : '已完成');
    };
   }
  );
 }

 function render() {
  var list = Store.state.ideas.slice();
  if (filter !== '全部') list = list.filter(function (i) { return i.tag === filter; });
  var undone = list.filter(function (i) { return !i.done; });
  var done = list.filter(function (i) { return i.done; });
  var all = Store.state.ideas;

  return '<div class="fade-in">' +
   '<div class="card tight">' +
    '<div class="row" style="gap:12px">' +
     '<div style="width:44px;height:44px;border-radius:14px;overflow:hidden;flex:none">' + Icons.cat('idea') + '</div>' +
     '<div class="grow"><b style="font-size:14.5px">未来想做的事</b>' +
      '<div class="muted" style="font-size:11.5px">共 ' + all.length + ' 条 · 已实现 ' + all.filter(function (i) { return i.done; }).length + ' 条</div></div>' +
    '</div>' +
   '</div>' +
   '<div class="chips" style="margin:2px 2px 14px">' +
    ['全部'].concat(TAGS).map(function (t) {
     return '<button class="chip' + (filter === t ? ' on' : '') + '" data-filter="' + t + '">' + t + '</button>';
    }).join('') +
   '</div>' +
   (list.length ? '' : UI.emptyBox('这里空空的，先记下一个小心愿吧')) +
   (undone.length ? '<div class="group-head"><b>待探索</b><span>· ' + undone.length + ' 条</span></div>' + undone.map(item).join('') : '') +
   (done.length ? '<div class="group-head"><b>已实现</b><span>· ' + done.length + ' 条</span></div>' + done.map(item).join('') : '') +
   '<div style="height:56px"></div></div>' +
   '<button class="fab" id="addIdea"><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg></button>';
 }

 function refresh() {
  var view = UI.$('#view'); var st = view.scrollTop;
  view.innerHTML = render(); mount(view); view.scrollTop = st;
 }

 function mount(root) {
  root.querySelector('#addIdea').onclick = function () { ideaSheet(null); };
  UI.$$('[data-filter]', root).forEach(function (b) {
   b.onclick = function () { filter = b.dataset.filter; refresh(); };
  });
  UI.$$('.idea-item', root).forEach(function (el) {
   var id = el.dataset.id;
   var idea = null;
   Store.state.ideas.forEach(function (i) { if (i.id === id) idea = i; });
   UI.$$('[data-act]', el).forEach(function (b) {
    b.onclick = function () {
     var act = b.dataset.act;
     if (act === 'toggle') {
      Store.toggleIdea(id); refresh();
      if (idea && idea.done) openFeel(idea);
     } else if (act === 'plan') {
      var r = App.addIdeaToPlan(idea);
      refresh();
      UI.toast(r && r.exists ? '已在今日计划中' : '已加入今日计划 ');
     } else {
      ideaSheet(idea);
     }
    };
   });
  });
 }

 Pages.ideas = { key: 'ideas', name: '学有余力', sub: '灵感备忘录', icon: 'idea', render: render, mount: mount };
})(window);
