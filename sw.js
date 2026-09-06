/* 喵の工作台 Service Worker —— 离线缓存应用外壳 */
const CACHE = 'catdesk-v1';
const SHELL = [
 './',
 './index.html',
 './manifest.webmanifest',
 './assets/css/style.css',
 './assets/js/quotes.js',
 './assets/js/icons.js',
 './assets/js/store.js',
 './assets/js/ui.js',
 './assets/js/timer.js',
 './assets/js/pages/home.js',
 './assets/js/pages/plan.js',
 './assets/js/pages/ideas.js',
 './assets/js/pages/health.js',
 './assets/js/pages/fitness.js',
 './assets/js/pages/review.js',
 './assets/js/pages/express.js',
 './assets/js/pages/dream.js',
 './assets/js/pages/reward.js',
 './assets/icons/icon.svg',
 './assets/icons/icon-maskable.svg'
];

self.addEventListener('install', function (e) {
 e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () {
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

 // 页面导航：缓存优先，回退到首页
 if (req.mode === 'navigate') {
  e.respondWith(fetch(req).then(function (r) { return r; }).catch(function () {
   return caches.match('./index.html');
  }));
  return;
 }

 // 静态资源：缓存优先，同时后台更新
 e.respondWith(caches.match(req).then(function (hit) {
  var net = fetch(req).then(function (r) {
   if (r && r.status === 200) {
    var copy = r.clone();
    caches.open(CACHE).then(function (c) { c.put(req, copy); });
   }
   return r;
  }).catch(function () { return hit; });
  return hit || net;
 }));
});
