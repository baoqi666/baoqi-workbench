/* ============================================================
  页面：奖励兑换 · 积分商城
  - 积分规则：累计专注每 60 分钟得 1 分（含口语输出时长）
  - 奖励由用户自定义（名称 + 每次消耗积分），可重复兑换
  - 兑换后从首页大屏积分中扣除对应分数，并记录兑换历史
  ============================================================ */
(function (global) {
 var Pages = global.Pages = global.Pages || {};
 var esc = UI.esc;
 function pad(n) { return n < 10 ? '0' + n : '' + n; }
 function fmtTs(ts) {
  var d = new Date(ts);
  return (d.getMonth() + 1) + '-' + d.getDate() + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
 }
 function redeemCount(id) {
  var n = 0; (Store.state.redeemLog || []).forEach(function (h) { if (h.rewardId === id) n++; });
  return n;
 }

 /* ---------------- 新增 / 编辑奖励 ---------------- */
 function rewardSheet(r) {
  var isEdit = !!r;
  var v = r || { name: '', cost: '' };
  UI.sheet(
   '<h3>' + (isEdit ? '编辑奖励' : '新增奖励') + '</h3>' +
   '<div class="field"><label>奖励名称</label>' +
    '<input type="text" id="rName" placeholder="例如：一杯奶茶 / 一集剧 / 周末出游" maxlength="20" value="' + esc(v.name) + '"/></div>' +
   '<div class="field"><label>每次兑换消耗积分</label>' +
    '<input type="number" id="rCost" min="1" step="1" placeholder="例如 30" value="' + (v.cost || '') + '"/></div>' +
   (isEdit ? '<div class="field"><label>已兑换次数</label><div class="muted">已兑换 ' + redeemCount(v.id) + ' 次</div></div>' : '') +
   '<div class="sheet-actions">' +
    (isEdit ? '<button class="btn-danger" data-act="del">删除</button>' : '<button class="btn-ghost" data-act="cancel">取消</button>') +
    '<button class="btn-primary" data-act="ok">' + (isEdit ? '保存' : '添加奖励') + '</button></div>',
   function (el) {
    var c = el.querySelector('[data-act=cancel]'); if (c) c.onclick = UI.closeSheet;
    var dl = el.querySelector('[data-act=del]');
    if (dl) dl.onclick = function () {
     UI.closeSheet();
     setTimeout(function () {
      UI.confirm('删除这个奖励？', v.name + ' 的兑换记录仍会保留', function () {
       Store.removeReward(v.id); refresh(); UI.toast('已删除');
      }, '删除');
     }, 260);
    };
    el.querySelector('[data-act=ok]').onclick = function () {
     var name = el.querySelector('#rName').value.trim();
     if (!name) { UI.toast('给奖励起个名字吧 '); return; }
     var cost = Math.round(+el.querySelector('#rCost').value || 0);
     if (!cost || cost < 1) { UI.toast('请填写消耗积分'); return; }
     if (isEdit) Store.updateReward(v.id, { name: name, cost: cost });
     else Store.addReward({ name: name, cost: cost });
     UI.closeSheet(); refresh();
     UI.toast(isEdit ? '已保存' : '奖励已添加 ');
    };
   }
  );
 }

 /* ---------------- 兑换确认 ---------------- */
 function doRedeem(r) {
  var ap = Store.availablePoints();
  if (ap < (r.cost || 0)) { UI.toast('积分不足，再专注一会儿 '); return; }
  UI.confirm('确认兑换「' + r.name + '」？', '将消耗 ' + r.cost + ' 积分（当前可用 ' + ap + ' 分）', function () {
   var res = Store.redeem(r.id);
   if (res.ok) { refresh(); UI.toast('兑换成功，好好享受『' + r.name + '』 '); }
   else UI.toast(res.err || '兑换失败');
  }, '确认兑换');
 }

 /* ---------------- 渲染 ---------------- */
 function rewardRow(r) {
  var ap = Store.availablePoints();
  var enough = ap >= (r.cost || 0);
  return '' +
   '<div class="reward-row" data-id="' + r.id + '">' +
    '<div class="grow">' +
     '<div class="rr-name">' + esc(r.name) + '</div>' +
     '<div class="rr-cost">' + (r.cost || 0) + ' 分 / 次</div>' +
    '</div>' +
    '<button class="pill-btn' + (enough ? '' : ' disabled') + '" data-act="redeem">' + (enough ? '兑换' : '积分不足') + '</button>' +
    '<button class="mini-act" data-act="edit" title="编辑">' +
     '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15.2 4.3 19.7 8.8 8.5 20H4v-4.5z"/></svg></button>' +
   '</div>';
 }

 function histRow(h) {
  return '<div class="hist-row">' +
   '<span class="grow">兑换「' + esc(h.name) + '」</span>' +
   '<span class="muted">' + fmtTs(h.ts) + '</span>' +
   '<b class="hist-cost">-' + (h.cost || 0) + '</b></div>';
 }

 function render() {
  var ap = Store.availablePoints();
  var mins = Store.totalFocusMinutes();
  var rewards = Store.state.rewards || [];
  var log = (Store.state.redeemLog || []).slice(0, 30);

  var head = '<div class="card reward-head">' +
   '<div class="rr-ic">' + Icons.cat('reward') + '</div>' +
   '<div class="grow"><b class="rr-name">奖励兑换</b>' +
    '<div class="muted" style="font-size:12px">专注赚积分，用积分兑换你想要的奖励</div></div>' +
   '<div class="rr-points"><b>' + ap + '</b><span>可用分</span></div>' +
  '</div>';

  var list = rewards.length
   ? '<div class="sec-title"><h2><span class="bar-mark"></span>我的奖励</h2><span class="more">' + rewards.length + ' 项</span></div>' +
     rewards.map(rewardRow).join('')
   : UI.emptyBox('还没有奖励，点右下角 + 添加你想兑换的奖励 ');

  var hist = log.length
   ? '<div class="sec-title"><h2><span class="bar-mark"></span>兑换记录</h2></div>' +
     '<div class="card">' + log.map(histRow).join('') + '</div>'
   : '';

  return '<div class="fade-in">' + head + list + hist + '<div style="height:56px"></div></div>' +
   '<button class="fab" id="addReward"><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg></button>';
 }

 function refresh() {
  var view = UI.$('#view'); var st = view.scrollTop;
  view.innerHTML = render(); mount(view); view.scrollTop = st;
 }

 function mount(root) {
  var add = root.querySelector('#addReward');
  if (add) add.onclick = function () { rewardSheet(null); };
  UI.$$('.reward-row', root).forEach(function (el) {
   var id = el.dataset.id;
   var r = null; (Store.state.rewards || []).forEach(function (x) { if (x.id === id) r = x; });
   if (!r) return;
   UI.$$('[data-act]', el).forEach(function (b) {
    b.onclick = function (ev) {
     ev.stopPropagation();
     var act = b.dataset.act;
     if (act === 'edit') rewardSheet(r);
     else if (act === 'redeem') doRedeem(r);
    };
   });
  });
 }

 Pages.reward = {
  key: 'reward', name: '奖励兑换', sub: '积分 · 奖励商城', icon: 'reward',
  render: render, mount: mount
 };
})(window);
