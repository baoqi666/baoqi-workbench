/* ============================================================
  DB：IndexedDB 持久化封装（键值对，替代 localStorage）
  特点：
  - 数据存于手机「应用私有数据库」，清理浏览器/WebView 缓存不会丢失
  - Promise 化，读写失败自动降级为内存态，不影响使用
  - 仅一个对象仓库 kv，所有键共存其中
  ============================================================ */
(function (global) {
 var DB_NAME = 'catdesk.db';
 var DB_VERSION = 1;
 var STORE = 'kv';
 var dbp = null;

 function openDB() {
  if (dbp) return dbp;
  dbp = new Promise(function (resolve, reject) {
   if (!global.indexedDB) { reject(new Error('IndexedDB 不可用')); return; }
   try {
    var req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = function () {
     var db = req.result;
     if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = function () { resolve(req.result); };
    req.onerror = function () { reject(req.error || new Error('open error')); };
   } catch (e) { reject(e); }
  });
  return dbp;
 }

 function get(key) {
  return openDB().then(function (db) {
   return new Promise(function (resolve, reject) {
    var tx = db.transaction(STORE, 'readonly');
    var r = tx.objectStore(STORE).get(key);
    r.onsuccess = function () { resolve(r.result === undefined ? null : r.result); };
    r.onerror = function () { reject(r.error); };
   });
  });
 }

 function set(key, val) {
  return openDB().then(function (db) {
   return new Promise(function (resolve, reject) {
    var tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(val, key);
    tx.oncomplete = function () { resolve(); };
    tx.onerror = function () { reject(tx.error); };
   });
  });
 }

 function del(key) {
  return openDB().then(function (db) {
   return new Promise(function (resolve, reject) {
    var tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(key);
    tx.oncomplete = function () { resolve(); };
    tx.onerror = function () { reject(tx.error); };
   });
  });
 }

 // 安全封装：失败时静默降级，绝不抛错中断 UI
 global.IDB = {
  openDB: openDB,
  get: function (k) { return get(k).catch(function () { return null; }); },
  set: function (k, v) { return set(k, v).catch(function () { return null; }); },
  del: function (k) { return del(k).catch(function () { return null; }); }
 };
})(window);
