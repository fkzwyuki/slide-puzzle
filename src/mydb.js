// mydb.js — 「じぶんの え」を IndexedDB に保存する（DESIGN.md §11.6）。
// データベース slidepuzzle、ストア images（キー id）。
// 使えない環境（file:// の一部・プライベートモード）では ready() が false になり、他の関数は失敗（reject）する。
(function () {
  var DB_NAME = 'slidepuzzle', STORE = 'images';
  var dbPromise = null;   // 開いた結果（成功なら DB、失敗なら reject）
  var usable = null;      // null=まだ分からない / true / false

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      var idb;
      try { idb = window.indexedDB; } catch (e) { idb = null; }
      if (!idb) { reject(new Error('IndexedDB なし')); return; }
      var req;
      try { req = idb.open(DB_NAME, 1); } catch (e) { reject(e); return; }
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
      };
      // 開くのが返ってこない環境（一部のプライベートモード）では「使えない」とみなす
      var timer = setTimeout(function () { reject(new Error('IndexedDB が開きません')); }, SP.config.MY_DB_TIMEOUT_MS);
      req.onsuccess = function () {
        clearTimeout(timer);
        var db = req.result;
        // 別のタブが版を上げようとしたら閉じる
        db.onversionchange = function () { db.close(); dbPromise = null; };
        resolve(db);
      };
      req.onerror = function () { clearTimeout(timer); reject(req.error || new Error('IndexedDB を開けません')); };
      req.onblocked = function () { clearTimeout(timer); reject(new Error('IndexedDB がふさがっています')); };
    });
    dbPromise.then(function () { usable = true; }, function () { usable = false; });
    return dbPromise;
  }

  // 1つの処理を実行して結果を返す。fn(store) が IDBRequest を返す
  function run(mode, fn) {
    return open().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx, req, result;
        try {
          tx = db.transaction(STORE, mode);
          req = fn(tx.objectStore(STORE));
        } catch (e) { reject(e); return; }
        if (req) req.onsuccess = function () { result = req.result; };
        tx.oncomplete = function () { resolve(result); };
        tx.onerror = function () { reject(tx.error || (req && req.error) || new Error('IndexedDB エラー')); };
        tx.onabort = function () { reject(tx.error || new Error('IndexedDB 中止')); };
      });
    });
  }

  SP.mydb = {
    // 使えるか。true/false で解決する（壊れていても例外にはしない）
    ready: function () {
      return open().then(function () { return true; }, function () { return false; });
    },
    // 同期で見る用（ready() を一度呼んだあと）。まだ分からないときは null
    isUsable: function () { return usable; },

    // 全件（added の古い順）。Blob は中身をまだ読まない参照なので、src が付いていても軽い
    getAll: function () {
      return run('readonly', function (s) { return s.getAll(); }).then(function (list) {
        list = list || [];
        list.sort(function (a, b) { return a.added - b.added; });
        return list;
      });
    },
    get: function (id) { return run('readonly', function (s) { return s.get(id); }); },
    put: function (rec) { return run('readwrite', function (s) { return s.put(rec); }); },
    remove: function (id) { return run('readwrite', function (s) { return s['delete'](id); }); },
    clear: function () { return run('readwrite', function (s) { return s.clear(); }); }
  };
})();
