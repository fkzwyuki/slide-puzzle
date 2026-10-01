// storage.js — localStorage の読み書き（DESIGN.md §6）。使えない・壊れているときは初期値を返す。
(function () {
  var P = 'slidepuzzle.';

  function read(key, fallback) {
    try {
      var raw = localStorage.getItem(P + key);
      if (raw === null) return fallback;
      return JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  }

  function write(key, value) {
    try {
      localStorage.setItem(P + key, JSON.stringify(value));
    } catch (e) { /* 使えないときは保存しないだけ */ }
  }

  function isObj(v) { return v && typeof v === 'object' && !Array.isArray(v); }

  SP.storage = {
    // 最後に選んだマス数。SIZES にない値は初期値
    getSize: function () {
      var v = read('size', SP.config.DEFAULT_SIZE);
      return SP.config.SIZES.indexOf(v) >= 0 ? v : SP.config.DEFAULT_SIZE;
    },
    setSize: function (n) { write('size', n); },

    // 効果音・BGM のオン/オフ（初期値オン）
    getSound: function () { return read('sound', true) !== false; },
    setSound: function (on) { write('sound', !!on); },
    getBgm: function () { return read('bgm', true) !== false; },
    setBgm: function (on) { write('bgm', !!on); },

    // マス数ごとの「すうじ」表示
    getNumbers: function (n) {
      var o = read('numbers', {});
      if (isObj(o) && typeof o[n] === 'boolean') return o[n];
      return !!SP.config.NUMBERS_DEFAULT[n];
    },
    setNumbers: function (n, on) {
      var o = read('numbers', {});
      if (!isObj(o)) o = {};
      o[n] = !!on;
      write('numbers', o);
    },

    // 画像×マス数ごとの記録 { moves, ms }
    getBest: function (id, n) {
      var o = read('best', {});
      var b = isObj(o) ? o[id + '|' + n] : null;
      if (isObj(b) && typeof b.moves === 'number' && typeof b.ms === 'number') return b;
      return null;
    },
    getAllBest: function () {
      var o = read('best', {});
      return isObj(o) ? o : {};
    },
    setBest: function (id, n, rec) {
      var o = read('best', {});
      if (!isObj(o)) o = {};
      o[id + '|' + n] = { moves: rec.moves, ms: rec.ms };
      write('best', o);
    },
    // 絵を削除したとき、その id の記録（全マス数ぶん）を消す（DESIGN.md §11.7）
    deleteBest: function (id) {
      var prefix = id + '|';
      ['best', 'cleared'].forEach(function (key) {
        var o = read(key, {});
        if (!isObj(o)) return;
        Object.keys(o).forEach(function (k) { if (k.indexOf(prefix) === 0) delete o[k]; });
        write(key, o);
      });
    },

    // ひんとを使ってクリアしたしるし（記録 best は更新しないが ⭐ は付ける。DESIGN.md §12.2）
    setCleared: function (id, n) {
      var o = read('cleared', {});
      if (!isObj(o)) o = {};
      o[id + '|' + n] = true;
      write('cleared', o);
    },
    // その絵をそのマス数でクリアしたことがあるか（記録があるか、ひんとありのクリアがあるか）
    isCleared: function (id, n) {
      if (SP.storage.getBest(id, n)) return true;
      var o = read('cleared', {});
      return isObj(o) && o[id + '|' + n] === true;
    },

    // 「はじめからの絵も使う」（初期値オフ。DESIGN.md §11.3）
    getUseBuiltin: function () { return read('useBuiltin', false) === true; },
    setUseBuiltin: function (on) { write('useBuiltin', !!on); }
  };
})();
