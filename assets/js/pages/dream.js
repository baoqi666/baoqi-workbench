/* ============================================================
  页面：梦想储蓄罐 · 多基金理财（名称 + 目标金额 + 进度条 + 存入）
  ============================================================ */
(function (global) {
 var Pages = global.Pages = global.Pages || {};
 var esc = UI.esc;

 function money(n) { return (Math.round((n || 0) * 100) / 100).toLocaleString('zh-CN'); }

 /* ---------------- 新建 / 编辑基金 ---------------- */
 function fundSheet(fund) {
  var isEdit = !!fund;
  var v = fund || { name: '', target: '' };
  UI.sheet(
   '<h3>' + (isEdit ? '编辑梦想基金' : '新建梦想基金') + '</h3>' +
   '<div class="field"><label>基金名称</label>' +
    '<input type="text" id="fName" placeholder="例如：旅行基金 / 数码基金" value="' + esc(v.name) + '" maxlength="20"/></div>' +
   '<div class="field"><label>目标金额（元）</label>' +
    '<input type="number" id="fTarget" min="1" step="100" placeholder="例如 10000" value="' + (v.target || '') + '"/></div>' +
   (isEdit ? '<div class="field"><label>当前已存（元）</label>' +
    '<input type="number" id="fBalance" min="0" step="100" placeholder="可手动校正余额" value="' + (v.balance || 0) + '"/></div>' : '') +
   '<div class="sheet-actions">' +
    (isEdit ? '<button class="btn-danger" data-act="del">删除</button>' : '<button class="btn-ghost" data-act="cancel">取消</button>') +
    '<button class="btn-primary" data-act="ok">' + (isEdit ? '保存' : '创建基金') + '</button></div>',
   function (el) {
    var c = el.querySelector('[data-act=cancel]'); if (c) c.onclick = UI.closeSheet;
    var dl = el.querySelector('[data-act=del]');
    if (dl) dl.onclick = function () {
     UI.closeSheet();
     setTimeout(function () {
      UI.confirm('删除这个基金？', v.name + ' 的存入记录也会一并清除', function () {
       Store.removeFund(v.id); refresh(); UI.toast('已删除');
      }, '删除');
     }, 260);
    };
    el.querySelector('[data-act=ok]').onclick = function () {
     var name = el.querySelector('#fName').value.trim();
     if (!name) { UI.toast('给基金起个名字吧 '); return; }
     var target = +el.querySelector('#fTarget').value || 0;
     if (!target) { UI.toast('请填写目标金额'); return; }
     if (isEdit) {
      Store.updateFund(v.id, { name: name, target: target });
      var bal = +el.querySelector('#fBalance').value || 0;
      var diff = Math.round(bal - (v.balance || 0));
      if (diff) Store.depositFund(v.id, diff, '校正余额');
     } else {
      Store.addFund({ name: name, target: target });
     }
     UI.closeSheet(); refresh();
     UI.toast(isEdit ? '已保存' : '基金已创建 ');
    };
   }
  );
 }

 /* ---------------- 存入（含「存入哪个基金」选择） ---------------- */
 function depositSheet(presetFundId, presetAmount, onDone) {
  var funds = Store.state.funds;
  if (!funds.length) { UI.toast('先创建一个基金吧'); fundSheet(null); return; }
  var cur = presetFundId || funds[0].id;
  var preset = presetAmount || 0;
  var noteVal = preset ? '本月结余' : '';
  UI.sheet(
   '<h3> 存入梦想基金</h3>' +
   '<div class="field"><label>存入哪个基金</label><div class="chips" data-seg="fund">' +
    funds.map(function (f) { return '<button class="chip' + (f.id === cur ? ' on' : '') + '" data-val="' + f.id + '">' + esc(f.name) + '</button>'; }).join('') +
   '</div></div>' +
   '<div class="field"><label>存入金额（元）</label>' +
    '<input type="number" id="dAmt" min="1" step="50" placeholder="例如 200" value="' + (preset || '') + '"/></div>' +
   '<div class="field"><label>备注（可选）</label>' +
    '<input type="text" id="dNote" placeholder="比如：本月结余 / 兼职收入" maxlength="30" value="' + esc(noteVal) + '"/></div>' +
   '<div class="sheet-actions">' +
    '<button class="btn-ghost" data-act="cancel">取消</button>' +
    '<button class="btn-primary" data-act="ok">确认存入</button></div>',
   function (el) {
    UI.$$('[data-seg=fund] .chip', el).forEach(function (b) {
     b.onclick = function () {
      UI.$$('[data-seg=fund] .chip', el).forEach(function (x) { x.classList.remove('on'); });
      b.classList.add('on'); cur = b.dataset.val;
     };
    });
    var c = el.querySelector('[data-act=cancel]'); if (c) c.onclick = UI.closeSheet;
    el.querySelector('[data-act=ok]').onclick = function () {
     var amt = +el.querySelector('#dAmt').value || 0;
     if (!amt) { UI.toast('请输入存入金额'); return; }
     var note = el.querySelector('#dNote').value.trim();
     Store.depositFund(cur, amt, note);
     var fn = ''; funds.forEach(function (f) { if (f.id === cur) fn = f.name; });
     UI.closeSheet(); refresh();
     UI.toast('已存入 ' + money(amt) + ' 元到「' + fn + '」');
     if (onDone) onDone(amt);
    };
   }
  );
 }

 /* ---------------- 渲染 ---------------- */
 function fundCard(f) {
  var bal = f.balance || 0, tgt = f.target || 0;
  var pct = tgt ? Math.min(100, Math.round(bal / tgt * 100)) : 0;
  var reached = tgt && bal >= tgt;
  return '' +
   '<div class="fund-card' + (reached ? ' reached' : '') + '" data-id="' + f.id + '">' +
    '<div class="fund-top">' +
     '<div class="grow"><b class="fund-name">' + esc(f.name) + '</b>' +
      (reached ? '<span class="tag green">已达成</span>' : '') + '</div>' +
     '<button class="mini-act" data-act="edit" title="编辑">' +
      '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15.2 4.3 19.7 8.8 8.5 20H4v-4.5z"/></svg></button>' +
    '</div>' +
    '<div class="fund-num"><b>' + money(bal) + '</b><span> / ' + money(tgt) + ' 元</span></div>' +
    '<div class="fund-prog"><i style="width:' + pct + '%"></i></div>' +
    '<div class="fund-foot">' +
     '<span class="muted">进度 ' + pct + '%</span>' +
     '<button class="pill-btn plain" data-act="deposit">＋ 存入</button>' +
    '</div>' +
   '</div>';
 }

 function budgetBlock() {
  var b = Store.getBudget();
  var m = Store.curMonth();
  var left = Store.budgetLeft();
  var head = '<div class="sec-title"><h2><span class="bar-mark"></span>本月预算</h2><span class="more">' + m + '</span></div>';
  if (!b.amount) {
    return head + '<div class="card budget-card">' +
      '<div class="muted" style="font-size:13px">设置本月预算，花掉后剩下的钱会自动变成可存入梦想储蓄罐的金额。</div>' +
      '<div class="field" style="margin-top:12px"><label>本月预算（元）</label>' +
        '<input type="number" id="bAmt" min="1" step="100" placeholder="例如 5000"/></div>' +
      '<button class="pill-btn" id="bSet" style="width:100%;justify-content:center">设定本月预算</button>' +
      '</div>';
  }
  var stats = '<div class="bstats">' +
    '<div class="bstat"><span>本月预算</span><b>' + money(b.amount) + '</b></div>' +
    '<div class="bstat"><span>已支出</span><b class="neg">-' + money(b.spent) + '</b></div>' +
    '<div class="bstat"><span>剩余可存</span><b class="pos">' + money(left) + '</b></div>' +
    '</div>';
  var acts = '<div class="budget-acts">' +
    '<button class="pill-btn plain" id="bExp">记一笔支出</button>' +
    '<button class="pill-btn' + (left ? '' : ' disabled') + '" id="bSave"' + (left ? '' : ' disabled') + '>存入储蓄罐' + (left ? ' ' + money(left) + ' 元' : '（已存完）') + '</button>' +
    '</div>';
  var exp = b.expenses.length ? '<div class="exp-list">' + b.expenses.map(function (e) {
    return '<div class="exp-row" data-id="' + e.id + '">' +
      '<span class="exp-cat">' + esc(e.cat) + '</span>' +
      '<span class="exp-note">' + (e.note ? esc(e.note) : '') + '</span>' +
      '<span class="exp-amt">-' + money(e.amount) + '</span>' +
      '<button class="exp-del" data-act="del" aria-label="删除">✕</button></div>';
  }).join('') + '</div>' : '<div class="muted" style="font-size:12px;margin-top:6px">还没有支出记录</div>';
  return head + '<div class="card budget-card">' + stats + acts + exp + '</div>';
 }

 function expenseSheet() {
  var cats = ['餐饮', '交通', '购物', '居住', '娱乐', '其他'];
  var cur = '餐饮';
  UI.sheet(
    '<h3>记一笔支出</h3>' +
    '<div class="field"><label>支出分类</label><div class="chips" data-seg="cat">' +
      cats.map(function (c) { return '<button class="chip' + (c === cur ? ' on' : '') + '" data-val="' + c + '">' + c + '</button>'; }).join('') +
    '</div></div>' +
    '<div class="field"><label>金额（元）</label><input type="number" id="eAmt" min="1" step="10" placeholder="例如 38"/></div>' +
    '<div class="field"><label>备注（可选）</label><input type="text" id="eNote" placeholder="比如：午餐 / 打车" maxlength="30"/></div>' +
    '<div class="sheet-actions"><button class="btn-ghost" data-act="cancel">取消</button><button class="btn-primary" data-act="ok">记录</button></div>',
    function (el) {
      UI.$$('[data-seg=cat] .chip', el).forEach(function (b) {
        b.onclick = function () {
          UI.$$('[data-seg=cat] .chip', el).forEach(function (x) { x.classList.remove('on'); });
          b.classList.add('on'); cur = b.dataset.val;
        };
      });
      var c = el.querySelector('[data-act=cancel]'); if (c) c.onclick = UI.closeSheet;
      el.querySelector('[data-act=ok]').onclick = function () {
        var amt = +el.querySelector('#eAmt').value || 0;
        if (!amt) { UI.toast('请输入金额'); return; }
        Store.addExpense(amt, cur, el.querySelector('#eNote').value.trim());
        UI.closeSheet(); refresh(); UI.toast('已记录支出 ' + money(amt) + ' 元');
      };
    }
  );
 }

 function render() {
  var funds = Store.state.funds || [];
  var totalBal = funds.reduce(function (a, f) { return a + (f.balance || 0); }, 0);
  var totalTgt = funds.reduce(function (a, f) { return a + (f.target || 0); }, 0);
  var overall = totalTgt ? Math.min(100, Math.round(totalBal / totalTgt * 100)) : 0;

  var summary = '<div class="card dream-summary">' +
   '<div class="row" style="gap:12px">' +
    '<div style="width:46px;height:46px;border-radius:14px;overflow:hidden;flex:none">' + Icons.cat('dream') + '</div>' +
    '<div class="grow"><b style="font-size:16px">梦想储蓄罐</b>' +
     '<div class="muted" style="font-size:12px">已存 ' + money(totalBal) + ' / 目标 ' + money(totalTgt) + ' 元</div></div>' +
    '<div class="dream-overall"><b>' + overall + '%</b></div>' +
   '</div>' +
   '<div class="fund-prog" style="margin-top:12px"><i style="width:' + overall + '%"></i></div>' +
   (funds.length ? '<button class="pill-btn" id="depositAny" style="margin-top:13px;width:100%;justify-content:center"> 记一笔存入</button>' : '') +
   '</div>';

  var list = funds.length
   ? '<div class="sec-title"><h2><span class="bar-mark"></span>我的基金</h2><span class="more">' + funds.length + ' 个</span></div>' +
    funds.map(fundCard).join('')
   : UI.emptyBox('还没有基金，点右下角 + 创建第一个梦想目标 ');

  return '<div class="fade-in">' + budgetBlock() + summary + list + '<div style="height:56px"></div></div>' +
   '<button class="fab" id="addFund"><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg></button>';
 }

 function refresh() {
  var view = UI.$('#view'); var st = view.scrollTop;
  view.innerHTML = render(); mount(view); view.scrollTop = st;
 }

 function mount(root) {
  var bSet = root.querySelector('#bSet');
  if (bSet) bSet.onclick = function () {
    var v = +root.querySelector('#bAmt').value || 0;
    if (!v) { UI.toast('请输入预算金额'); return; }
    Store.setBudgetAmount(v); refresh(); UI.toast('本月预算已设为 ' + money(v) + ' 元');
  };
  var bExp = root.querySelector('#bExp');
  if (bExp) bExp.onclick = expenseSheet;
  var bSave = root.querySelector('#bSave');
  if (bSave && !bSave.disabled) bSave.onclick = function () {
    var left = Store.budgetLeft();
    if (!left) { UI.toast('本月结余已存入'); return; }
    depositSheet(null, left, function (amt) {
      Store.addBudgetSaved(amt || left); refresh();
      UI.toast('已把本月结余 ' + money(amt || left) + ' 元存入储蓄罐');
    });
  };
  UI.$$('.exp-row', root).forEach(function (el) {
    var dl = el.querySelector('[data-act=del]');
    if (dl) dl.onclick = function (ev) {
      ev.stopPropagation();
      UI.confirm('删除这笔支出？', '将从「已支出」中扣回相应金额', function () {
        Store.removeExpense(el.dataset.id); refresh();
      }, '删除');
    };
  });

  var add = root.querySelector('#addFund');
  if (add) add.onclick = function () { fundSheet(null); };
  var dep = root.querySelector('#depositAny');
  if (dep) dep.onclick = function () { depositSheet(null); };

  UI.$$('.fund-card', root).forEach(function (el) {
   var id = el.dataset.id;
   var f = null; (Store.state.funds || []).forEach(function (x) { if (x.id === id) f = x; });
   if (!f) return;
   UI.$$('[data-act]', el).forEach(function (b) {
    b.onclick = function (ev) {
     ev.stopPropagation();
     var act = b.dataset.act;
     if (act === 'edit') fundSheet(f);
     else if (act === 'deposit') depositSheet(f.id);
    };
   });
  });
 }

 Pages.dream = {
  key: 'dream', name: '梦想储蓄罐', sub: '理财 · 梦想基金', icon: 'dream',
  render: render, mount: mount
 };
})(window);
