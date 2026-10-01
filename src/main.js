// main.js — 画面の切り替え。トップとパズル画面を行き来する。
(function () {
  function $(id) { return document.getElementById(id); }

  function showTop(fresh) {
    $('screen-game').hidden = true;
    $('screen-settings').hidden = true;
    $('screen-top').hidden = false;
    SP.wake.release();
    SP.top.show(fresh === true);   // 設定画面から戻ったときだけ、9枚も選び直す
  }

  function showSettings() {
    $('screen-top').hidden = true;
    $('screen-settings').hidden = false;
    SP.settings.show();
  }

  function showGame(image) {
    var n = SP.storage.getSize();
    $('screen-top').hidden = true;
    $('screen-game').hidden = false;
    SP.wake.hold();   // パズル画面のあいだ画面を消さない
    SP.game.start(image, n);
  }

  // 長押しメニュー・選択開始・ドラッグを止める（DESIGN.md §9）
  document.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  document.addEventListener('selectstart', function (e) { e.preventDefault(); });
  document.addEventListener('dragstart', function (e) { e.preventDefault(); });
  // 2本指の拡大（ピンチ）を止める
  document.addEventListener('touchmove', function (e) {
    if (e.touches.length > 1) e.preventDefault();
  }, { passive: false });
  ['gesturestart', 'gesturechange', 'gestureend'].forEach(function (t) {
    document.addEventListener(t, function (e) { e.preventDefault(); });
  });

  // Service Worker（sw.js）: ホーム画面に追加できる条件を満たすための最小のもの。何も保存しない。file:// では何もしない
  if (SP.config.SERVICE_WORKER && /^https?:$/.test(location.protocol) && navigator.serviceWorker && navigator.serviceWorker.register) {
    try { navigator.serviceWorker.register('sw.js').then(null, function () {}); } catch (e) {}
  }

  SP.game.init(function () { showTop(false); });
  SP.settings.init(function () { showTop(true); });
  SP.top.init(showGame, showSettings);
})();
