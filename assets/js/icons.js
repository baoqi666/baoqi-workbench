/* ============================================================
  Icons：统一的「极简线条图标」矢量系统
  - 中性浅方块底（暖白 / 极浅，无高饱和）
  - 字形以 currentColor 描边线条呈现，不填充颜色
  - 图标色与文字色一致，整体低调克制（Notion 风）
  - 按功能绘制对应元素，不再使用猫咪造型
  用法：Icons.cat('home') → 返回 svg 字符串
  ============================================================ */
(function (global) {
 var uid = 0;
 var INK = 'currentColor';

 // 各模块的浅中性底（暖白 / 极浅，无高饱和，呼应画布）
 var PALETTE = {
  home:      '#f5f2ea', plan: '#f5f2ea', idea: '#f5f2ea', health: '#f5f2ea',
  fitness:   '#f5f2ea', review: '#f5f2ea', sleep: '#f5f2ea', water: '#f5f2ea',
  food:      '#f5f2ea', energy: '#f5f2ea', english: '#f5f2ea', knowledge: '#f5f2ea',
  account:   '#f5f2ea', streak: '#fbf0e6', timer: '#f5f2ea', eye: '#f5f2ea',
  leg:       '#f5f2ea', back: '#f5f2ea', arm: '#f5f2ea', shoulder: '#f5f2ea',
  hip:       '#f5f2ea', posture: '#f5f2ea', calm: '#f5f2ea', express: '#f5f2ea',
  dream:     '#f5f2ea', output: '#f5f2ea', other: '#f5f2ea', reward: '#f5f2ea'
 };

 // 每个功能对应的线条字形（24x24 局部坐标，currentColor 描边、不填充）
 var GLYPH = {
  home:     '<path d="M4 11 12 4l8 7"/><path d="M6 10v9h12v-9"/><path d="M10 19v-5h4v5"/>',
  plan:     '<rect x="3.5" y="5" width="3.4" height="3.4" rx="1"/><path d="M4.4 6.7l.9.9 1.3-1.6"/><rect x="3.5" y="14" width="3.4" height="3.4" rx="1"/><path d="M4.4 15.7l.9.9 1.3-1.6"/><path d="M9.7 6.7h10.8"/><path d="M9.7 15.7h10.8"/>',
  idea:     '<path d="M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1.1 2.2h5c.1-1 .5-1.7 1.1-2.2A6 6 0 0 0 12 3Z"/><path d="M9.5 19h5"/><path d="M10.2 21h3.6"/>',
  health:   '<path d="M12 20S4 14.5 4 9.2A4.2 4.2 0 0 1 12 7a4.2 4.2 0 0 1 8 2.2C20 14.5 12 20 12 20Z"/>',
  fitness:  '<path d="M4 10v4M6.5 8.5v7M17.5 8.5v7M20 10v4M6.5 12h11"/>',
  review:   '<path d="M12 5C9.5 3.6 6.5 3.6 4 5v14c2.5-1.4 5.5-1.4 8 0 2.5-1.4 5.5-1.4 8 0V5c-2.5-1.4-5.5-1.4-8 0Z"/><path d="M12 5v14"/>',
  sleep:    '<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z"/>',
  water:    '<path d="M12 3.5S6 9.5 6 14a6 6 0 0 0 12 0c0-4.5-6-10.5-6-10.5Z"/>',
  food:     '<path d="M8 3v7a2 2 0 0 0 4 0V3"/><path d="M10 10v11"/><path d="M16 3c-1.5 0-2.5 1.5-2.5 4s1 3 2.5 3v11"/>',
  energy:   '<path d="M13 3 5 13h5l-1 8 8-11h-5z"/>',
  english:  '<path d="M5 13v-1a7 7 0 0 1 14 0v1"/><rect x="3" y="12.5" width="4" height="6" rx="2"/><rect x="17" y="12.5" width="4" height="6" rx="2"/>',
  knowledge:'<path d="M12 4 2 9l10 5 10-5-10-5Z"/><path d="M6 11v4.5c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5V11"/><path d="M22 9v4.5"/>',
  account:  '<path d="M15 4l5 5-9.5 9.5-5 1 1-5L15 4Z"/><path d="M13.5 6.5l4 4"/>',
  streak:   '<path d="M12 3c2.4 2.6 4 4.8 4 7.6a4 4 0 1 1-8 0c0-1.6.8-2.8.8-2.8.6 1 1.5 1.6 2.4 1.6 1.4 0 2.4-1.1 2.4-2.4C13.6 6.8 12 3 12 3Z"/>',
  timer:    '<circle cx="12" cy="13" r="7"/><path d="M12 9.5V13l2.5 1.8"/><path d="M9.5 4h5"/>',
  eye:      '<path d="M2.5 12S6 6 12 6s9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.8"/>',
  leg:      '<path d="M9 3v6l-2 8a2 2 0 0 0 2 2.5h3.5a2 2 0 0 0 2-2.5l-1-8V3"/><path d="M9 9h6"/>',
  back:     '<path d="M12 3v15"/><path d="M8 5.5h8M8 9h8M8 12.5h8M8 16h8"/><path d="M12 18v3"/>',
  arm:      '<path d="M5 15c3-3 5-4.5 9-4.5"/><path d="M14 10.5a3 3 0 1 0 3 3"/>',
  shoulder: '<path d="M4 16c0-4 3.5-7 7.5-7H16c3 0 4.5 2 4.5 4.5 0 2.5-2 4-2 4"/><path d="M12 9V4"/>',
  hip:      '<path d="M6 5v5c0 4 2.7 7 6 7s6-3 6-7V5"/>',
  posture:  '<circle cx="12" cy="5" r="2.2"/><path d="M12 7.5v8"/><path d="M7 10h10"/><path d="M9.5 20 12 15.5 14.5 20"/>',
  calm:     '<path d="M3 13c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/><path d="M3 17c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/>',
  express:  '<path d="M5 5h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H10l-4 3v-3H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"/>',
  dream:    '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/>',
  output:   '<path d="M12 16V5"/><path d="M8 9l4-4 4 4"/><path d="M5 15v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3"/>',
  other:    '<circle cx="6" cy="6" r="1.5"/><circle cx="12" cy="6" r="1.5"/><circle cx="18" cy="6" r="1.5"/><circle cx="6" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="18" cy="12" r="1.5"/><circle cx="6" cy="18" r="1.5"/><circle cx="12" cy="18" r="1.5"/><circle cx="18" cy="18" r="1.5"/>',
  reward:   '<path d="M7 4h10v5a5 5 0 0 1-10 0V4Z"/><path d="M7 6H4v2a3 3 0 0 0 3 3"/><path d="M17 6h3v2a3 3 0 0 1-3 3"/><path d="M12 14v4"/><path d="M9 21h6"/>'
 };

 /** 主图标：浅中性方块底 + currentColor 描边线条字形 */
 function cat(key, opt) {
  opt = opt || {};
  var bg = PALETTE[key] || PALETTE.home;
  var glyph = GLYPH[key] || GLYPH.other;
  var r = opt.radius == null ? 12 : opt.radius;
  var inkColor = '#5f5c54';
  return '' +
   '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="true" style="color:' + inkColor + '">' +
   '<rect x="0.5" y="0.5" width="23" height="23" rx="' + (r / 2) + '" fill="' + bg + '"/>' +
   '<g fill="none" stroke="' + INK + '" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' +
   glyph +
   '</g>' +
   '</svg>';
 }

 /** 开屏插画：暖色日出（替代猫咪） */
 function splash(opt) {
  opt = opt || {};
  return '' +
   '<svg viewBox="0 0 240 190" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="true">' +
   '<circle cx="120" cy="84" r="32" fill="#fdebcf" stroke="#e7b873" stroke-width="3"/>' +
   '<g stroke="#e7b873" stroke-width="3.2" stroke-linecap="round" fill="none">' +
   '<path d="M120 38v-12"/><path d="M80 50l-8-8"/><path d="M160 50l8-8"/>' +
   '<path d="M52 84h-12"/><path d="M200 84h12"/>' +
   '</g>' +
   '<path d="M44 146c14-12 26-12 38 0s26 12 38 0 26-12 38 0" fill="none" stroke="#cdb89a" stroke-width="4.4" stroke-linecap="round"/>' +
   '<path d="M62 166c12-9 20-9 30 0s20 9 30 0 20-9 30 0" fill="none" stroke="#e0d6c5" stroke-width="4.4" stroke-linecap="round"/>' +
   '</svg>';
 }

 /** 连续打卡插画：暖色火苗（替代猫咪） */
 function streakArt(opt) {
  opt = opt || {};
  return '' +
   '<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="true">' +
   '<path d="M60 14c22 24 36 44 36 64a36 36 0 1 1-72 0c0-14 8-24 8-24 6 10 14 15 22 15 12 0 22-10 22-22 0-15-16-33-16-33Z" fill="#fde3c4" stroke="#e89b54" stroke-width="4" stroke-linejoin="round"/>' +
   '<path d="M60 58c8 9 14 16 14 26a14 14 0 1 1-28 0c0-6 4-10 4-10 3 4 8 6 10 6 5 0 8-4 8-8 0-7-8-14-8-14Z" fill="#f7b67a" stroke="#e89b54" stroke-width="2.6" stroke-linejoin="round"/>' +
   '</svg>';
 }

 /** 空状态插画：中性空盒（替代猫咪） */
 function emptyArt(opt) {
  opt = opt || {};
  return '' +
   '<svg viewBox="0 0 96 96" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="true">' +
   '<g fill="none" stroke="#c2c6cd" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round">' +
   '<path d="M20 38 48 22l28 16v34a4 4 0 0 1-4 4H24a4 4 0 0 1-4-4Z"/>' +
   '<path d="M20 38h28v22H24a4 4 0 0 1-4-4Z"/><path d="M48 38v22h24V38"/>' +
   '</g></svg>';
 }

 global.Icons = { cat: cat, splash: splash, streakArt: streakArt, emptyArt: emptyArt, palette: PALETTE };
})(window);
