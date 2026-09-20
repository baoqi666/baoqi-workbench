/* 喵の工作台 Service Worker —— 离线缓存应用外壳 */
const CACHE = 'catdesk-v31';
const SHELL = [
 './',
 './index.html',
 './manifest.webmanifest',
 './assets/css/style.css',
 './assets/js/quotes.js',
 './assets/js/icons.js',
 './assets/js/store.js',
 './assets/js/content/pushes.js',
 './assets/js/content/reward-suggestions.js',
 './assets/js/push.js',
 './assets/js/ui.js',
 './assets/js/timer.js',
 './assets/js/fooddb.js',
 './assets/js/pages/home.js',
 './assets/js/pages/plan.js',
 './assets/js/pages/ideas.js',
 './assets/js/pages/health.js',
 './assets/js/pages/fitness.js',
 './assets/js/pages/review.js',
 './assets/js/pages/weeksum.js',
 './assets/js/pages/express.js',
 './assets/js/pages/dream.js',
 './assets/js/pages/reward.js',
 './assets/icons/icon.svg',
 './assets/icons/icon-maskable.svg'
];

/* 关键：安装时逐个 Request 用 cache:'reload' 绕过 HTTP 缓存与 CDN 中间缓存。
  用默认的 c.addAll(SHELL) 会吃到 GitHub Pages 的旧副本（CDN 传播有 ~30-60s 延迟），
  一旦旧内容被装进新版本缓存，后续缓存优先策略会让用户永远看不到更新。
  逐项 .catch 也避免单个资源 404 导致整个安装失败（原 addAll 是原子的）。 */
self.addEventListener('install', function (e) {
 e.waitUntil(caches.open(CACHE).then(function (c) {
  return Promise.all(SHELL.map(function (u) {
   return c.add(new Request(u, { cache: 'reload' })).catch(function () { return null; });
  }));
 }).then(function () {
  return self.skipWaiting();
 }));
});

self.addEventListener('activate', function (e) {
 e.waitUntil(caches.keys().then(function (keys) {
  return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
 }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
 var req = e.request;
 if (req.method !== 'GET') return;
 var url = new URL(req.url);
 // 跨域资源走网络，失败也不阻塞
 if (url.origin !== location.origin) return;

 // 页面导航：强制绕过 HTTP 缓存拿最新首页（解决 GitHub Pages 10 分钟缓存导致的不更新）
 if (req.mode === 'navigate') {
  e.respondWith(fetch(req, { cache: 'no-store' }).then(function (r) { return r; }).catch(function () {
   return caches.match('./index.html');
  }));
  return;
 }

 /* 静态资源：网络优先，离线/失败回退缓存。
  原来是「缓存优先 + 后台更新」，一旦缓存在 CDN 传播窗口被旧内容污染就永久吐旧版本、
  必须再跳一个版本号才能救回来（v26 真实踩坑）。网络优先保证在线时永远拿到最新代码，
  断网时仍有缓存兜底，离线可用不受影响。 */
 e.respondWith(fetch(req).then(function (r) {
  if (r && r.status === 200) {
   var copy = r.clone();
   caches.open(CACHE).then(function (c) { c.put(req, copy); });
  }
  return r;
 }).catch(function () { return caches.match(req); }));
});
