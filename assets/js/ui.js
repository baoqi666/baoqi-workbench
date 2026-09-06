/* ============================================================
  UI：通用交互（Toast / 底部弹层 / 表单控件 / 小图表）
  ============================================================ */
(function (global) {
 function $(sel, root) { return (root || document).querySelector(sel); }
 function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
 function esc(s) {
  return String(s == null ? '' : s)
   .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
   .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
 }

 /* ---------- Toast ---------- */
 var toastTimer = null;
 function toast(msg) {
  var el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { el.classList.remove('show'); }, 1900);
 }

 /* ---------- 底部弹层 ---------- */
 var sheetCloseCb = null;
 function sheet(html, onMount) {
  var root = $('#modalRoot');
  root.innerHTML = '<div class="mask" data-close="1"></div><div class="sheet">' +
   '<div class="sheet-grip"></div>' + html + '</div>';
  // 触发过渡
  requestAnimationFrame(function () { root.classList.add('show'); });
  root.querySelector('.mask').addEventListener('click', closeSheet);
  if (onMount) onMount(root.querySelector('.sheet'));
 }
 function closeSheet() {
  var root = $('#modalRoot');
  root.classList.remove('show');
  setTimeout(function () { if (!root.classList.contains('show')) root.innerHTML = ''; }, 320);
  if (sheetCloseCb) { var cb = sheetCloseCb; sheetCloseCb = null; cb(); }
 }
 function confirmSheet(title, desc, onOk, okText) {
  sheet(
   '<h3>' + esc(title) + '</h3>' +
   '<p class="muted" style="text-align:center;margin-bottom:18px">' + esc(desc || '') + '</p>' +
   '<div class="sheet-actions">' +
   '<button class="btn-ghost" data-act="cancel">取消</button>' +
   '<button class="btn-danger" data-act="ok">' + esc(okText || '确定') + '</button></div>',
   function (el) {
    el.querySelector('[data-act=cancel]').onclick = closeSheet;
    el.querySelector('[data-act=ok]').onclick = function () { closeSheet(); onOk && onOk(); };
   }
  );
 }

 /* ---------- 分段选择器（单选） ---------- */
 function segGroup(el, onPick) {
  $$('button', el).forEach(function (b) {
   b.addEventListener('click', function () {
    $$('button', el).forEach(function (x) { x.classList.remove('on'); });
    b.classList.add('on');
    onPick && onPick(b.dataset.val, b);
   });
  });
 }

 /* ---------- 小图表：柱状 ---------- */
 function barChart(data, opt) {
  opt = opt || {};
  var W = 320, H = opt.height || 108, pad = 16, bw = 18;
  var n = data.length;
  var max = Math.max.apply(null, data.map(function (d) { return d.value; }).concat([opt.min || 1]));
  var gap = (W - pad * 2 - bw * n) / Math.max(1, n - 1);
  var bars = data.map(function (d, i) {
   var x = pad + i * (bw + gap);
   var h = Math.max(3, Math.round((d.value / max) * (H - 38)));
   var y = H - 22 - h;
   var c = d.hi ? 'url(#bcHi)' : 'url(#bcN)';
   return '<rect x="' + x + '" y="' + y + '" width="' + bw + '" height="' + h + '" rx="6" fill="' + c + '"/>' +
    '<text x="' + (x + bw / 2) + '" y="' + (H - 7) + '" font-size="10" fill="#93a3bd" text-anchor="middle">' + esc(d.label) + '</text>' +
    (d.value ? '<text x="' + (x + bw / 2) + '" y="' + (y - 5) + '" font-size="10" font-weight="700" fill="#5b6b85" text-anchor="middle">' + d.value + '</text>' : '');
  }).join('');
  return '<div class="chart-wrap"><svg viewBox="0 0 ' + W + ' ' + H + '">' +
   '<defs>' +
   '<linearGradient id="bcN" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9ed3fb"/><stop offset="1" stop-color="#cfe9ff"/></linearGradient>' +
   '<linearGradient id="bcHi" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#63b0fb"/><stop offset="1" stop-color="#7fd3f2"/></linearGradient>' +
   '</defs>' + bars + '</svg></div>';
 }

 /* ---------- 小图表：环形进度 ---------- */
 function donut(pct, opt) {
  opt = opt || {};
  var size = opt.size || 96, sw = opt.stroke || 10, r = (size - sw) / 2, c = 2 * Math.PI * r;
  var off = c * (1 - Math.min(1, Math.max(0, pct / 100)));
  var id = 'dn' + Math.random().toString(36).slice(2, 7);
  return '<svg viewBox="0 0 ' + size + ' ' + size + '" width="' + size + '" height="' + size + '">' +
   '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="1" y2="1">' +
   '<stop offset="0" stop-color="' + (opt.c1 || '#63b0fb') + '"/><stop offset="1" stop-color="' + (opt.c2 || '#7fd3f2') + '"/></linearGradient></defs>' +
   '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="rgba(150,185,225,.22)" stroke-width="' + sw + '"/>' +
   '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="url(#' + id + ')" stroke-width="' + sw + '" stroke-linecap="round"' +
   ' stroke-dasharray="' + c.toFixed(1) + '" stroke-dashoffset="' + off.toFixed(1) + '" transform="rotate(-90 ' + size / 2 + ' ' + size / 2 + ')"/>' +
   (opt.text ? '<text x="50%" y="50%" text-anchor="middle" dy="0.35em" font-size="' + (opt.fontSize || 18) + '" font-weight="800" fill="#20293a">' + esc(opt.text) + '</text>' : '') +
   '</svg>';
 }

 function fmtMin(m) {
  m = Math.round(m || 0);
  if (m < 60) return m + ' 分';
  var h = Math.floor(m / 60), mm = m % 60;
  return h + ' 时' + (mm ? ' ' + mm + ' 分' : '');
 }
 function fmtMinShort(m) {
  m = Math.round(m || 0);
  if (m < 60) return m + '<small>分</small>';
  return (m / 60).toFixed(1) + '<small>小时</small>';
 }

 function emptyBox(text) {
  return '<div class="empty">' + Icons.emptyArt() + '<div>' + esc(text) + '</div></div>';
 }

 global.UI = {
  $: $, $$: $$, esc: esc, toast: toast,
  sheet: sheet, closeSheet: closeSheet, confirm: confirmSheet,
  segGroup: segGroup, barChart: barChart, donut: donut,
  fmtMin: fmtMin, fmtMinShort: fmtMinShort, emptyBox: emptyBox
 };
})(window);
