/* ============================================================
  App：开屏 / 路由 / 抽屉导航 / 全局同步
  ============================================================ */
(function (global) {
 var $ = UI.$, $$ = UI.$$;
 var ROUTES = ['home', 'plan', 'ideas', 'express', 'dream', 'reward', 'health', 'fitness', 'review'];
 var current = null;
 var entered = false;

 /* ---------------- 开屏 ---------------- */
 function dayHash(s) {
  var h = 0;
  for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
 }
 function paintQuote(force) {
  var q = Store.state.quote || { date: '', idx: 0 };
  var td = Store.today();
  if (force) {
   q.idx = Math.floor(Math.random() * QUOTES.length);
   q.date = td;
  } else if (q.date !== td) {
   q.idx = dayHash(td) % QUOTES.length;
   q.date = td;
  }
  Store.state.quote = q;
  Store.save();
  var item = QUOTES[q.idx % QUOTES.length];
  var el = $('#quoteText');
  el.style.opacity = 0;
  setTimeout(function () {
   el.textContent = item.t;
   $('#quoteAuthor').textContent = '—— ' + item.a;
   el.style.transition = 'opacity .3s ease';
   el.style.opacity = 1;
  }, force ? 140 : 0);
 }
 function paintSplashTime() {
  var d = new Date();
  $('#splashDate').textContent = d.getFullYear() + ' 年 ' + (d.getMonth() + 1) + ' 月 ' + d.getDate() + ' 日';
  $('#splashWeek').textContent = Store.weekName(Store.today());
  $('#splashTime').textContent = (d.getHours() < 10 ? '0' : '') + d.getHours() + ':' + (d.getMinutes() < 10 ? '0' : '') + d.getMinutes();
 }

 function initSplash() {
  $('#splashCat').innerHTML = Icons.splash();
  paintSplashTime();
  paintQuote(false);
  setInterval(paintSplashTime, 20000);

  $('#quoteRefresh').addEventListener('click', function (e) {
   e.stopPropagation();
   paintQuote(true);
  });
  $('#enterBtn').addEventListener('click', function (e) { e.stopPropagation(); enter(); });
  $('#splash').addEventListener('click', function () { enter(); });
 }

 function enter() {
  if (entered) return;
  entered = true;
  var sp = $('#splash');
  sp.classList.add('hide');
  $('#app').hidden = false;
  setTimeout(function () { sp.style.display = 'none'; }, 480);

  var n = Store.checkin();
  var moved = Store.rollover();
  go('home');
  setTimeout(function () {
   if (moved) UI.toast('有 ' + moved + ' 项未完成任务已留存到今天');
   else UI.toast('连续打卡第 ' + n + ' 天，欢迎回来 ');
  }, 620);
 }

 /* ---------------- PWA：安装到主屏 ---------------- */
 var deferredPrompt = null;
 function setupPWA() {
  // Capacitor 打包的安卓 App 已是原生壳，无需 Service Worker，且离线资源已内置
  if (window.Capacitor) return;
  // 注册离线缓存（仅 http/https 环境，file:// 不支持 Service Worker）
  if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
   window.addEventListener('load', function () {
    navigator.serviceWorker.register('sw.js').catch(function () {});
   });
  }
  // 捕获浏览器原生安装提示
  window.addEventListener('beforeinstallprompt', function (e) {
   e.preventDefault();
   deferredPrompt = e;
   var bar = $('#installBar');
   if (bar) bar.hidden = false;
  });
  window.addEventListener('appinstalled', function () {
   var bar = $('#installBar');
   if (bar) bar.hidden = true;
   deferredPrompt = null;
  });
  var bar = $('#installBar');
  if (bar) {
   $('#installBtn').onclick = function () {
    if (!deferredPrompt) { showInstallGuide(); return; }
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then(function () { deferredPrompt = null; bar.hidden = true; });
   };
   $('#installClose').onclick = function () { bar.hidden = true; };
  }
  var hint = $('#installHintBtn');
  if (hint) hint.onclick = function () { closeDrawer(); showInstallGuide(); };
 }
 function showInstallGuide() {
  var ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  var txt = ios
   ? 'iOS：点开 Safari 底部「分享」按钮 → 选「添加到主屏幕」→ 命名为「喵の工作台」。'
   : '安卓 / 桌面：点浏览器右上角菜单 →「安装应用 / 添加到主屏幕」即可。若没看到该选项，说明当前浏览器不支持，换个 Chrome 试试。';
  UI.confirm('安装到手机主屏', txt, function () {}, '我知道了');
 }

 /* ---------------- 抽屉 ---------------- */
 function buildDrawer() {
  $('#drawerAvatar').innerHTML = Icons.cat('home');
  $('#navList').innerHTML = ROUTES.map(function (k) {
   var p = Pages[k];
   return '<li><button class="nav-item" data-go="' + k + '">' +
    '<span class="ic">' + Icons.cat(p.icon) + '</span>' +
    '<span class="tx"><b>' + UI.esc(p.name) + '</b><span>' + UI.esc(p.sub) + '</span></span>' +
    '</button></li>';
  }).join('');
  $$('[data-go]').forEach(function (b) {
   b.onclick = function () { go(b.dataset.go); closeDrawer(); };
  });
  $('#menuBtn').onclick = openDrawer;
  $('#drawerClose').onclick = closeDrawer;
  $('#drawerMask').onclick = closeDrawer;
  $('#resetBtn').onclick = function () {
   closeDrawer();
   setTimeout(function () {
    UI.confirm('清空全部本地数据？', '所有任务、打卡、复盘记录都会被删除，且无法恢复。', function () {
     Store.reset();
     IDB.del('catdesk.timer');
     location.reload();
    }, '确认清空');
   }, 240);
  };

  // 数据备份：导出 / 导入（防丢兜底）
  $('#exportBtn').onclick = function () { openExportSheet('json'); };
  $('#importBtn').onclick = function () {
   closeDrawer();
   setTimeout(function () { $('#importFile').click(); }, 240);
  };
  $('#importFile').onchange = function () {
   var f = this.files && this.files[0];
   if (!f) return;
   var reader = new FileReader();
   var self = this;
   reader.onload = function () {
    try {
     var obj = JSON.parse(reader.result);
     UI.confirm('导入备份文件？', '将用备份覆盖当前全部数据，且无法撤销。建议先导出当前数据再导入。', function () {
      if (Store.importAll(obj)) { UI.toast('备份已恢复'); location.reload(); }
      else UI.toast('备份文件格式不正确');
     }, '确认导入');
    } catch (e) { UI.toast('备份文件无法解析'); }
    self.value = '';
   };
   reader.readAsText(f);
  };

  // 文本导出：把所有记录生成可读 .txt，方便离线手动备份
  $('#exportTxtBtn').onclick = function () { openExportSheet('txt'); };

  // 复制模板链接：把当前页面地址发给朋友，对方打开即自动生成一份独立副本
  var shareTplBtn = $('#shareTplBtn');
  if (shareTplBtn) shareTplBtn.onclick = function () {
   closeDrawer();
   var url = location.href.split('#')[0];
   var tip = '把这串链接发给朋友 / 评委：\n他们打开后会自动生成一份属于自己、与你互不干扰的独立工作台——这就是「复制模板」。\n\n链接已为你复制好，也可手动长按选择。';
   var html = ''
    + '<div class="sheet-head"><div class="sheet-title">复制模板链接</div>'
    + '<div class="sheet-sub">朋友打开即拥有同款 · 数据各自独立</div></div>'
    + '<textarea class="export-area" id="shareArea" readonly>' + escapeHtml(url) + '</textarea>'
    + '<div class="sheet-actions">'
    +  '<button class="btn primary" id="shareCopyBtn">复制链接</button>'
    + '</div>'
    + '<div class="sheet-hint" id="shareHint"></div>';
   UI.sheet(html, function (el) {
    var area = el.querySelector('#shareArea');
    el.querySelector('#shareCopyBtn').onclick = function () {
     area.removeAttribute('readonly'); area.focus(); area.select();
     var done = function () { UI.toast('已复制，去微信 / 邮件粘贴吧'); area.setAttribute('readonly', ''); };
     if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(done, function () {
       try { document.execCommand('copy'); done(); } catch (e) {}
      });
     } else { try { document.execCommand('copy'); done(); } catch (e) {} }
    };
   });
   setTimeout(function () { UI.toast('把这串链接发出去，朋友打开即拥有同款工作台'); }, 200);
  };
 }

 function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
 }

 function shareFallback(el) {
  var h = el && el.querySelector('#shareHint');
  if (h) h.textContent = '当前环境不支持系统分享，请点「复制全部」后粘贴到备忘录 / 微信 / 云盘保存。';
 }

 // 导出面板：直接展示内容 + 复制 + 系统分享保存（解决 WebView 下载文件找不到的问题）
 function openExportSheet(type) {
  var isJson = type === 'json';
  var title = isJson ? '数据备份（JSON）' : '数据导出（文本）';
  var filename = isJson ? ('catdesk-backup-' + Store.today() + '.json') : ('catdesk-export-' + Store.today() + '.txt');
  var content = isJson ? JSON.stringify(Store.exportAll(), null, 2) : buildTextExport();
  var mime = isJson ? 'application/json' : 'text/plain';
  closeDrawer();
  var html = ''
   + '<div class="sheet-head"><div class="sheet-title">' + title + '</div>'
   + '<div class="sheet-sub">内容已生成，可复制或保存 / 分享到任意位置</div></div>'
   + '<textarea class="export-area" id="exportArea" readonly>' + escapeHtml(content) + '</textarea>'
   + '<div class="sheet-actions">'
   +  '<button class="btn ghost" id="copyBtn"> 复制全部</button>'
   +  '<button class="btn primary" id="shareBtn"> 保存 / 分享</button>'
   + '</div>'
   + '<div class="sheet-hint" id="shareHint"></div>';
  UI.sheet(html, function (el) {
   var area = el.querySelector('#exportArea');
   el.querySelector('#copyBtn').onclick = function () {
    area.removeAttribute('readonly'); area.focus(); area.select();
    var done = function () { UI.toast('已复制，可粘贴保存'); area.setAttribute('readonly', ''); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
     navigator.clipboard.writeText(content).then(done, function () {
      try { document.execCommand('copy'); done(); } catch (e) { shareFallback(el); }
     });
    } else { try { document.execCommand('copy'); done(); } catch (e) { shareFallback(el); } }
   };
   el.querySelector('#shareBtn').onclick = function () {
    var blob = new Blob([content], { type: mime + ';charset=utf-8' });
    var file = new File([blob], filename, { type: mime });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
     navigator.share({ files: [file], title: '喵の工作台' + (isJson ? ' 备份' : ' 导出') })
      .then(function () { UI.toast('已通过系统分享保存'); })
      .catch(function () {});
    } else if (navigator.share) {
     navigator.share({ title: '喵の工作台', text: content }).catch(function () {});
    } else {
     shareFallback(el);
    }
   };
  });
 }

 /* 生成可读文本备份 */
 function buildTextExport() {
  var s = Store.state, td = Store.today();
  var L = [];
  var line = function (t) { L.push(t); };
  line('========================================');
  line(' 喵の工作台 · 全部记录文本备份');
  line(' 导出日期：' + new Date().toLocaleString('zh-CN'));
  line('========================================');
  line('');
  line('【基础信息】');
  line(' 用户名：' + (s.profile && s.profile.name || '喵の工作台'));
  line(' 每日精力上限：' + (s.profile && s.profile.energyMax || 100) + ' 点');
  line(' 连续打卡：' + (s.streak && s.streak.count || 0) + ' 天');
  line('');
  line('【累计统计】');
  line(' 英语听力：' + s.stats.english.min + ' 分钟 / ' + s.stats.english.count + ' 次');
  line(' 知识学习：' + s.stats.knowledge.min + ' 分钟 / ' + s.stats.knowledge.count + ' 次');
  line(' 账号更新：' + s.stats.account.min + ' 分钟 / ' + s.stats.account.count + ' 次');
  line(' 其他：' + s.stats.other.min + ' 分钟 / ' + s.stats.other.count + ' 次');
  line('');
  line('【' + td + ' 当日计划】');
  var d = Store.day(td);
  if (d && d.tasks.length) {
   d.tasks.forEach(function (t, i) {
    var cat = (Store.CATS[t.cat] && Store.CATS[t.cat].name) || t.cat;
    var tag = (Store.TAGS[t.tag] && Store.TAGS[t.tag].name) || t.tag;
    var pri = (Store.PRIOS[t.priority] && Store.PRIOS[t.priority].name) || t.priority;
    var lvl = (Store.LEVEL_LABEL[t.level] || '') + '(L' + t.level + ')';
    line(' ' + (i + 1) + '. ' + (t.done ? '[✓]' : '[ ]') + ' ' + t.title);
    line('    分类:' + cat + ' | 标签:' + tag + ' | 优先级:' + pri + ' | 预计:' + t.estMin + '分钟 | 精力:' + lvl + (t.carried ? ' | 留存' : ''));
   });
  } else { line(' （无）'); }
  line(' 当日番茄数：' + (d ? (d.pomos || 0) : 0) + '  专注时长：' + (d ? (d.focusMin || 0) : 0) + ' 分钟');
  line(' 当日剩余精力：' + Store.energyOf(td).left + ' 点');
  line('');
  line('【灵感 / 学有余力清单】');
  if (s.ideas && s.ideas.length) {
   s.ideas.forEach(function (it, i) {
    line(' ' + (i + 1) + '. ' + (it.done ? '[✓]' : '[ ]') + ' ' + it.title + ' #' + (it.tag || '') + (it.note ? ' (' + it.note + ')' : '') + (it.feel ? ' · 感受：' + it.feel : ''));
   });
  } else { line(' （无）'); }
  line('');
  line('【健康 · 睡眠 / 饮水 / 饮食】');
  var h = Store.health(td);
  line(' 睡眠：' + (h.sleepAt || '--') + ' → ' + (h.wakeAt || '--') + ' 时长 ' + (h.sleepMin || 0) + ' 分钟');
  line(' 饮水：' + (h.water || 0) + ' 杯');
  if (h.meals && h.meals.length) {
   h.meals.forEach(function (m, i) { line('  餐' + (i + 1) + '：' + m.kcal + ' kcal ' + (m.note || '')); });
  }
  line('');
  line('【运动打卡】');
  var fl = Store.fitLogs(td);
  if (fl && fl.length) {
   fl.forEach(function (l, i) { line(' ' + (i + 1) + '. ' + l.name + ' ' + l.minutes + ' 分钟'); });
  } else { line(' （今日无）'); }
  line(' 本周运动打卡总览：');
  (s.fitness.presets || []).forEach(function (p) {
   var c = Store.fitWeekCount(p.id, td);
   var tgt = p.perWeek || 0;
   line('  · ' + p.name + '：' + c + '/' + tgt + ' 次（目标）');
  });
  line('');
  line('【周复盘归档（共 ' + (s.reviews ? s.reviews.length : 0) + ' 篇）】');
  if (s.reviews && s.reviews.length) {
   s.reviews.slice(0, 30).forEach(function (r, i) {
    line(' ' + (i + 1) + '. [' + (r.week || '') + '] ' + (r.title || '未命名') + (r.createdAt ? ' (' + new Date(r.createdAt).toLocaleDateString('zh-CN') + ')' : ''));
    ['summary', 'learn', 'life', 'sport', 'money', 'problem', 'improve', 'goal'].forEach(function (f) {
     if (r[f]) line('   - ' + f + '：' + r[f]);
    });
   });
  } else { line(' （无）'); }
  line('');

  line('【自信表达 · 口语输出】');
  line(' 累计输出时长：' + s.stats.output.min + ' 分钟 / ' + s.stats.output.count + ' 次');
  line('');

  line('【当日充能记录】');
  var ch = (Store.day(td).charges || []);
  if (ch.length) {
   ch.forEach(function (c, i) { line(' ' + (i + 1) + '. +' + c.amount + ' ' + (c.label || '') + (c.ts ? ' (' + new Date(c.ts).toLocaleString('zh-CN') + ')' : '')); });
  } else { line(' （无）'); }
  line('');

  line('【梦想储蓄罐（共 ' + (s.funds ? s.funds.length : 0) + ' 个基金）】');
  if (s.funds && s.funds.length) {
   s.funds.forEach(function (f, i) {
    var pct = f.target ? Math.round((f.balance || 0) / f.target * 100) : 0;
    line(' ' + (i + 1) + '. ' + f.name + '：已存 ' + (f.balance || 0) + ' / 目标 ' + f.target + ' 元（' + pct + '%）');
    (f.deposits || []).slice(-8).reverse().forEach(function (d) {
     line('    · ' + (d.amount > 0 ? '+' : '') + d.amount + ' 元' + (d.note ? ' · ' + d.note : '') + (d.ts ? ' (' + new Date(d.ts).toLocaleDateString('zh-CN') + ')' : ''));
    });
   });
  } else { line(' （无）'); }
  line('');

  line('【当日待办（含具体时间）】');
  var todos = Store.sortedTodos(td);
  if (todos.length) {
   todos.forEach(function (t, i) { line(' ' + (i + 1) + '. ' + (t.time ? t.time + ' ' : '') + (t.done ? '[✓]' : '[ ]') + ' ' + t.title); });
  } else { line(' （无）'); }
  line('');

  line('———— 本文件由「喵の工作台」离线导出，可安全保存到手机或云盘 ————');
  return L.join('\n');
 }
 function openDrawer() { $('#drawer').classList.add('open'); $('#drawerMask').classList.add('show'); }
 function closeDrawer() { $('#drawer').classList.remove('open'); $('#drawerMask').classList.remove('show'); }

 /* ---------------- 路由 ---------------- */
 function go(key) {
  var page = Pages[key];
  if (!page) return;
  if (current && Pages[current] && Pages[current].unmount) Pages[current].unmount();
  current = key;
  if (page.onEnter) page.onEnter();
  $('#pageTitle').textContent = page.name;
  $('#pageSub').textContent = page.sub;
  var view = $('#view');
  view.innerHTML = page.render();
  view.scrollTop = 0;
  page.mount(view);
  $$('[data-go]').forEach(function (b) {
   b.classList.toggle('active', b.dataset.go === key);
  });
  renderTopRight(key);
  syncChrome();
 }

 function renderTopRight(key) {
  var box = $('#topbarRight');
  var td = Store.today();
  if (key === 'plan') {
   var e = Store.energyOf(td);
   box.innerHTML = '<span class="tag blue" style="padding:6px 10px;font-size:11.5px">精力 ' + e.left + '</span>';
  } else if (key === 'home') {
   box.innerHTML = '<span class="tag pink" style="padding:6px 10px;font-size:11.5px">连续 ' + Store.state.streak.count + ' 天</span>';
  } else {
   box.innerHTML = '';
  }
 }

 /* ---------------- 全局同步 ---------------- */
 function syncChrome() {
  var e = Store.energyOf(Store.today());
  $('#drawerEnergy').textContent = e.left;
  $('#drawerEnergyBar').style.width = e.pctLeft + '%';
  $('#drawerStreak').textContent = '连续打卡 ' + Store.state.streak.count + ' 天 · 今日 ' + (Store.day().pomos || 0) + ' 番茄';
  renderTopRight(current);
  syncMini(Timer.get());
 }

 function syncMini(t) {
  var el = $('#miniTimer');
  if (!el) return;
  var show = t.running && current !== 'plan';
  el.hidden = !show;
  if (show) {
   $('#mtText').textContent = t.text;
   var c = 2 * Math.PI * 19;
   $('#mtProgress').setAttribute('stroke-dasharray', c.toFixed(1));
   $('#mtProgress').setAttribute('stroke-dashoffset', (c * (1 - t.pct)).toFixed(1));
  }
 }

 /* ---------------- 启动 ---------------- */
 function boot() {
  Store.seed();
  initSplash();
  buildDrawer();
  setupPWA();
  Timer.init();
  Timer.onChange(function (t) { syncMini(t); });
  $('#miniTimer').onclick = function () { go('plan'); };

  // 首次打开提示：每人自动获得独立副本（数据仅存本地，与分享者互不可见）
  if (!localStorage.getItem('catdesk_tpl_hint')) {
   localStorage.setItem('catdesk_tpl_hint', '1');
   setTimeout(function () {
    UI.toast('你已拥有这份工作台的独立副本 · 数据仅存你本地');
   }, 1300);
  }

  // 跨零点自动切换日期
  setInterval(function () {
   if (!entered) return;
   var td = Store.today();
   if (boot._d && boot._d !== td) {
    boot._d = td;
    Store.checkin();
    Store.rollover();
    go(current || 'home');
   }
  }, 60000);
  boot._d = Store.today();

  // 键盘 Esc 关闭弹层
  document.addEventListener('keydown', function (e) {
   if (e.key === 'Escape') { UI.closeSheet(); closeDrawer(); }
  });
 }

 global.App = {
  go: go, syncChrome: syncChrome, openDrawer: openDrawer, closeDrawer: closeDrawer,
  /* 将一条「学有余力」灵感直接加入指定日期的每日计划。返回 {exists:true} 或 {task:t} */
  addIdeaToPlan: function (idea, date) {
   if (!idea) return { error: true };
   date = date || Store.today();
   var day = Store.day(date);
   for (var i = 0; i < day.tasks.length; i++) {
    if (day.tasks[i].ideaId === idea.id) return { exists: true };
   }
   var t = Store.addTask(date, {
    title: idea.title, cat: 'invest', tag: 'other',
    priority: 'mid', estMin: 25, level: 2, ideaId: idea.id
   });
   return { task: t };
  }
 };
 // 先打开 IndexedDB，再启动应用（确保数据已就绪）
 document.addEventListener('DOMContentLoaded', function () {
  Store.open().then(boot).catch(function () { boot(); });
 });
})(window);
