/* ============================================================
  Theme：全局底图 + 智能取色引擎
  - 从相册图片中提取主色 / 辅助色 / 亮度，生成低饱和协调配色
  - 把配色写入 :root 的 CSS 变量，全站自动跟随
  - 底图层做适度模糊 + 压暗/提亮遮罩，保证内容可读
  不依赖任何第三方库；不改动业务逻辑，只影响外观变量
  ============================================================ */
(function (global) {
 var doc = global.document;

 /* ---------- 工具 ---------- */
 function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
 function rgb2hsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  var mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  var h = 0, s = 0, l = (mx + mn) / 2, d = mx - mn;
  if (d > 0) {
   s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
   if (mx === r) h = ((g - b) / d + (g < b ? 6 : 0));
   else if (mx === g) h = (b - r) / d + 2;
   else h = (r - g) / d + 4;
   h *= 60;
  }
  return { h: h, s: s, l: l };
 }
 function hsl(h, s, l, a) {
  h = ((h % 360) + 360) % 360;
  s = clamp(s, 0, 1); l = clamp(l, 0, 1);
  if (a == null) return 'hsl(' + h.toFixed(1) + ',' + (s * 100).toFixed(1) + '%,' + (l * 100).toFixed(1) + '%)';
  return 'hsla(' + h.toFixed(1) + ',' + (s * 100).toFixed(1) + '%,' + (l * 100).toFixed(1) + '%,' + a + ')';
 }
 function rgba(r, g, b, a) { return 'rgba(' + Math.round(r) + ',' + Math.round(g) + ',' + Math.round(b) + ',' + a + ')'; }

 /* ---------- 1. 取色：把图片缩到 72px 后做色彩直方图 ---------- */
 function analyze(dataUrl, cb) {
  var img = new global.Image();
  img.onload = function () {
   var W = 72;
   var H = Math.max(1, Math.round(W * (img.naturalHeight || img.height) / (img.naturalWidth || img.width || 1)));
   var cv = doc.createElement('canvas');
   cv.width = W; cv.height = H;
   var ctx = cv.getContext('2d');
   try { ctx.drawImage(img, 0, 0, W, H); } catch (e) { cb(null); return; }
   var data;
   try { data = ctx.getImageData(0, 0, W, H).data; } catch (e) { cb(null); return; }

   var buckets = {}, total = 0, sr = 0, sg = 0, sb = 0, slum = 0;
   for (var i = 0; i < data.length; i += 4) {
    var a = data[i + 3];
    if (a < 125) continue;
    var r = data[i], g = data[i + 1], b = data[i + 2];
    total++; sr += r; sg += g; sb += b;
    slum += (0.2126 * r + 0.7152 * g + 0.0722 * b);
    var key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    var bk = buckets[key];
    if (!bk) bk = buckets[key] = { n: 0, r: 0, g: 0, b: 0 };
    bk.n++; bk.r += r; bk.g += g; bk.b += b;
   }
   if (!total) { cb(null); return; }

   var avg = { r: sr / total, g: sg / total, b: sb / total };
   var lum = slum / total / 255;              // 0..1，底图整体亮度

   // 挑一个「有色但不过曝/不过暗」的主色桶
   var best = null, bestScore = -1;
   for (var k in buckets) {
    var t = buckets[k];
    var cr = t.r / t.n, cg = t.g / t.n, cb2 = t.b / t.n;
    var hh = rgb2hsl(cr, cg, cb2);
    if (hh.s < 0.10) continue;                 // 太灰，跳过
    if (hh.l < 0.18 || hh.l > 0.86) continue;  // 太暗/太亮，跳过
    var score = t.n * (0.35 + hh.s) * (1 - Math.abs(hh.l - 0.55));
    if (score > bestScore) { bestScore = score; best = { r: cr, g: cg, b: cb2 }; }
   }
   // —— 复杂度（busyness）：用于「底图越复杂，承载底板越不透明」的自适应 ——
   var sumL = 0, sumL2 = 0, sumS = 0, cnt = 0, distinct = 0;
   for (var k in buckets) {
    var t = buckets[k];
    var cr = t.r / t.n, cg = t.g / t.n, cb2 = t.b / t.n;
    var hh = rgb2hsl(cr, cg, cb2);
    var ll = 0.2126 * cr + 0.7152 * cg + 0.0722 * cb2;
    sumL += ll; sumL2 += ll * ll; sumS += hh.s * t.n; cnt++;
    if (t.n >= total * 0.008) distinct++;
   }
   var meanL = sumL / cnt, varL = sumL2 / cnt - meanL * meanL;
   var stdL = Math.sqrt(Math.max(0, varL));
   var avgSat = sumS / total;
   var stdNorm = clamp(stdL * 2.3, 0, 1);
   var distinctNorm = clamp((distinct - 3) / 9, 0, 1);
   var satNorm = clamp(avgSat * 1.3, 0, 1);
   var busy = clamp(0.55 * stdNorm + 0.25 * distinctNorm + 0.20 * satNorm, 0, 1);

   var main = best || avg;
   cb({ main: main, avg: avg, lum: lum, busy: busy });
  };
  img.onerror = function () { cb(null); };
  img.src = dataUrl;
 }

 /* ---------- 2. 由取色结果生成配色方案 ---------- */
 function buildVars(res) {
  var m = res.main;
  var c = rgb2hsl(m.r, m.g, m.b);
  var h = c.h;
  var s = clamp(c.s, 0.18, 0.40);   // 强制低饱和，避免高饱和撞色
  var lum = res.lum;
  var dark = lum < 0.50;            // 底图偏暗 → 深色卡片 + 浅色文字
  var busy = res.busy || 0;         // 底图复杂度：越复杂，承载底板越不透明

  var v = {};
  if (!dark) {
   // —— 亮底图：浅色半透明卡片 + 深色文字 ——
   v['--bg'] = hsl(h, s * 0.45, 0.955);
   v['--scene'] = rgba(255, 255, 255, 0.28 + busy * 0.34);   // 内容承载层：0.28..0.62
   v['--card'] = rgba(255, 255, 255, 0.78 + busy * 0.18);    // 卡片底板：0.78..0.96
   v['--card-2'] = rgba(255, 255, 255, 0.55 + busy * 0.22);
   v['--line'] = rgba(58, 52, 42, 0.12 + busy * 0.06);
   v['--line-2'] = rgba(58, 52, 42, 0.07 + busy * 0.03);
   v['--ink'] = hsl(h, 0.12, 0.16);                          // 标题：近黑，绝不发灰
   v['--ink-2'] = hsl(h, 0.09, 0.30);                         // 正文：中灰
   v['--ink-3'] = hsl(h, 0.07, 0.46);                         // 辅助：浅灰
   v['--brand'] = hsl(h, s, 0.46);                            // 主题色：仅点缀，不碰底图
   v['--brand-ink'] = hsl(h, s, 0.33);
   v['--brand-soft'] = hsl(h, s * 0.6, 0.93);
   v['--on-brand'] = '#ffffff';
   v['--shadow'] = '0 1px 2px rgba(50,40,18,.06), 0 6px 20px rgba(50,40,18,.06)';
   v['--wall-scrim'] = rgba(255, 255, 255, 0.06 + busy * 0.20); // 0.06..0.26 轻度压暗，留氛围
   v['--splash-veil'] = rgba(255, 255, 255, 0.18);
   v['--splash-glow'] = rgba(255, 255, 255, 0.45);
  } else {
   // —— 暗底图：深色半透明卡片 + 浅色文字 ——
   v['--bg'] = hsl(h, s * 0.35, 0.13);
   v['--scene'] = rgba(255, 255, 255, 0.04 + busy * 0.08);
   v['--card'] = rgba(255, 255, 255, 0.10 + busy * 0.12);
   v['--card-2'] = rgba(255, 255, 255, 0.06 + busy * 0.06);
   v['--line'] = rgba(255, 255, 255, 0.14 + busy * 0.05);
   v['--line-2'] = rgba(255, 255, 255, 0.08 + busy * 0.03);
   v['--ink'] = rgba(255, 255, 255, 0.96);                    // 暗底 → 文字自动转浅灰白
   v['--ink-2'] = rgba(255, 255, 255, 0.80);
   v['--ink-3'] = rgba(255, 255, 255, 0.60);
   v['--brand'] = hsl(h, s, 0.64);
   v['--brand-ink'] = hsl(h, s, 0.78);
   v['--brand-soft'] = rgba(255, 255, 255, 0.14);
   v['--on-brand'] = hsl(h, s * 0.6, 0.10);
   v['--shadow'] = '0 1px 2px rgba(0,0,0,.22), 0 8px 26px rgba(0,0,0,.26)';
   v['--wall-scrim'] = rgba(8, 10, 14, 0.22 + busy * 0.22);
   v['--splash-veil'] = rgba(8, 10, 14, 0.30);
   v['--splash-glow'] = rgba(8, 10, 14, 0.42);
  }
  v['--wall-blur'] = '6px';                                  // 仅轻微柔化，保留纹理
  v['--wall-sat'] = '1';                                     // 不脱色，保留原图质感
  v['--wall-bri'] = dark ? '0.98' : '1';
  return v;
 }

 /* ---------- 3. 写入 / 清除 CSS 变量 ---------- */
 var KNOWN = ['--bg', '--scene', '--card', '--card-2', '--line', '--line-2', '--ink', '--ink-2', '--ink-3',
  '--brand', '--brand-ink', '--brand-soft', '--on-brand', '--shadow',
  '--wall-scrim', '--wall-blur', '--wall-sat', '--wall-bri', '--splash-veil', '--splash-glow', '--wall-src'];

 function applyVars(vars) {
  var root = doc.documentElement;
  for (var k in vars) if (vars[k] != null) root.style.setProperty(k, vars[k]);
 }
 function clearVars() {
  var root = doc.documentElement;
  KNOWN.forEach(function (k) { root.style.removeProperty(k); });
 }

 /* ---------- 4. 底图层 ---------- */
 function wallEl() { return doc.getElementById('wallpaper'); }
 function scrimEl() { return doc.getElementById('wallScrim'); }

 function paintImage(src) {
  var root = doc.documentElement;
  var w = wallEl(), s = scrimEl();
  if (src) {
   root.style.setProperty('--wall-src', 'url("' + src + '")');
   if (w) w.classList.add('on');
   if (s) s.classList.add('on');
  } else {
   root.style.removeProperty('--wall-src');
   if (w) w.classList.remove('on');
   if (s) s.classList.remove('on');
  }
 }

 /* ---------- 快照 / 回滚（供预览用） ---------- */
 var snap = null;
 function snapshot() {
  var root = doc.documentElement;
  var v = {};
  KNOWN.forEach(function (k) { v[k] = root.style.getPropertyValue(k); });
  var w = wallEl();
  snap = { vars: v, img: w ? w.style.backgroundImage : '', on: w ? w.classList.contains('on') : false };
  return snap;
 }
 function restore() {
  if (!snap) return;
  clearVars();
  applyVars(snap.vars);
  var w = wallEl(), s = scrimEl();
  if (w) {
   w.style.backgroundImage = snap.img;
   if (snap.on) w.classList.add('on'); else w.classList.remove('on');
   if (s) { if (snap.on) s.classList.add('on'); else s.classList.remove('on'); }
  }
  snap = null;
 }

 /* ---------- 对外接口 ---------- */
 /**
  * 应用底图（含取色）。src 为空则恢复默认主题。
  * cb(paletteVars|null)
  */
 function setWallpaper(src, cb) {
  cb = cb || function () { };
  if (!src) { clearVars(); paintImage(''); cb(null); return; }
  analyze(src, function (res) {
   if (!res) { paintImage(src); cb(null); return; }
   var vars = buildVars(res);
   applyVars(vars);
   paintImage(src);
   cb(vars);
  });
 }

 /** 只把底图铺上（用于瞬时预览） */
 function preview(src, cb) {
  snapshot();
  setWallpaper(src, cb);
 }

 /** 压缩图片：长边限制 max，输出 jpeg dataURL */
 function compress(dataUrl, max, quality, cb) {
  var img = new global.Image();
  img.onload = function () {
   var w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
   var scale = Math.min(1, (max || 1280) / Math.max(w, h));
   var W = Math.max(1, Math.round(w * scale)), H = Math.max(1, Math.round(h * scale));
   var cv = doc.createElement('canvas');
   cv.width = W; cv.height = H;
   var ctx = cv.getContext('2d');
   ctx.drawImage(img, 0, 0, W, H);
   try { cb(cv.toDataURL('image/jpeg', quality || 0.82)); } catch (e) { cb(dataUrl); }
  };
  img.onerror = function () { cb(dataUrl); };
  img.src = dataUrl;
 }

global.Theme = {
 setWallpaper: setWallpaper,
 clearWallpaper: function () { setWallpaper(''); },
 preview: preview,
 restore: restore,
 snapshot: snapshot,
 applyVars: applyVars,
 clearVars: clearVars,
 compress: compress,
 analyze: analyze,
 buildVars: buildVars
};
})(window);
