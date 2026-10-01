// top.js — トップ画面（DESIGN.md §4.1）。ますの かず・ランダム9枚・ほかの え・🎵🔊。
(function () {
  var cfg = SP.config;
  var shown = [];   // いま並べている画像（{ id, src, thumb } の要素）
  var onPick = null;
  var onSettings = null;
  var pool = [];         // 「使う絵」の集まり（DESIGN.md §11.7）
  var mineUrls = [];     // じぶんの え のために作った Blob URL（作り直すときに解放する）
  var poolGen = 0;       // 集まりを作り直すたびに増える（古い結果を捨てる）
  var toastTimer = 0;

  function $(id) { return document.getElementById(id); }

  function shuffle(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  // 次の9枚。いま出ていない画像を先に使い、足りなければ出ていたものから足す
  function pickNext() {
    var all = pool;
    var n = Math.min(cfg.TOP_COUNT, all.length);
    var shownIds = {};
    shown.forEach(function (im) { shownIds[im.id] = true; });
    var fresh = shuffle(all.filter(function (im) { return !shownIds[im.id]; }));
    var old = shuffle(all.filter(function (im) { return shownIds[im.id]; }));
    return fresh.concat(old).slice(0, n);
  }

  // 使う絵の集まりを作る（§11.3・§11.7）。じぶんの え があればそれだけ。「はじめからの絵も使う」がオンなら混ぜる。
  // じぶんの え が0枚、または保存場所が使えないときは はじめからの え。→ Promise<配列>
  function buildPool() {
    mineUrls.forEach(function (u) { URL.revokeObjectURL(u); });
    mineUrls = [];
    var builtin = (window.SP_ASSETS && SP_ASSETS.images) || [];
    return SP.mydb.ready().then(function (ok) {
      if (!ok) return [];
      return SP.mydb.getAll().then(null, function () { return []; });
    }).then(function (list) {
      var mine = list.map(function (rec) {
        var full = URL.createObjectURL(rec.full), thumb = URL.createObjectURL(rec.thumb);
        mineUrls.push(full, thumb);
        return { id: rec.id, src: full, thumb: thumb };
      });
      if (!mine.length) return builtin.slice();
      return SP.storage.getUseBuiltin() ? mine.concat(builtin) : mine;
    });
  }

  // 集まりを作り直して9枚を並べる。fresh=true なら選び直す。false なら、いま出ている絵を（まだ集まりにあれば）そのまま残す
  function refresh(fresh) {
    var g = ++poolGen;
    return buildPool().then(function (p) {
      if (g !== poolGen) return;
      pool = p;
      var keep = [];
      if (!fresh) {
        shown.forEach(function (im) {
          for (var i = 0; i < pool.length; i++) if (pool[i].id === im.id) { keep.push(pool[i]); return; }
        });
      }
      if (fresh || keep.length !== shown.length || keep.length === 0) { shown = []; shown = pickNext(); }  // 空にしてから選ぶので、重なりを気にせず選び直せる
      else shown = keep;
      renderPics();
    });
  }

  function toast(text) {
    var t = $('toast');
    t.textContent = text;
    t.hidden = false;
    // ⚙ のすぐ下に出す（画面の外にはみ出さないように寄せる）
    var g = $('btn-adult').getBoundingClientRect(), app = $('screen-top').getBoundingClientRect();
    t.style.top = (g.bottom - app.top + 6) + 'px';
    t.style.left = Math.max(8, Math.min(g.left - app.left, app.width - t.offsetWidth - 8)) + 'px';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 1600);
  }

  // ⚙: 長押しで「え の せってい」を開く（おとな用。子どもが押してしまいにくくする。§11.2）
  function bindAdult() {
    var b = $('btn-adult'), timer = 0, fired = false;
    b.style.setProperty('--hold', cfg.ADULT_HOLD_MS + 'ms');
    function cancel() { clearTimeout(timer); b.classList.remove('holding'); }
    b.addEventListener('pointerdown', function () {
      fired = false;
      cancel();
      b.classList.add('holding');
      timer = setTimeout(function () {
        fired = true;
        b.classList.remove('holding');
        if (onSettings) onSettings();
      }, cfg.ADULT_HOLD_MS);
    });
    b.addEventListener('pointerup', function () {
      var wasShort = !fired;
      cancel();
      if (wasShort) toast('ながおし してね');
    });
    b.addEventListener('pointerleave', cancel);
    b.addEventListener('pointercancel', cancel);
  }

  function renderPics() {
    var box = $('pics');
    box.innerHTML = '';
    for (var i = 0; i < cfg.TOP_COUNT; i++) {
      var im = shown[i];
      if (!im) {
        var empty = document.createElement('div');
        empty.className = 'pic empty';
        box.appendChild(empty);
        continue;
      }
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'pic';
      b.setAttribute('aria-label', im.id);
      var img = document.createElement('img');
      img.src = im.thumb;
      img.alt = '';
      img.draggable = false;
      b.appendChild(img);
      // そのマス数でクリア済みなら右下に ⭐
      if (SP.storage.isCleared(im.id, SP.storage.getSize())) {
        var star = document.createElement('span');
        star.className = 'star';
        star.textContent = '⭐';
        b.appendChild(star);
      }
      b.addEventListener('click', (function (x) {
        return function () { if (onPick) onPick(x); };
      })(im));
      box.appendChild(b);
    }
  }

  function renderSizes() {
    var box = $('sizes');
    var cur = SP.storage.getSize();
    box.innerHTML = '';
    cfg.SIZES.forEach(function (n) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'size-btn' + (n === cur ? ' on' : '');
      b.setAttribute('aria-pressed', n === cur ? 'true' : 'false');
      // 小さなマス目の図
      var g = document.createElement('span');
      g.className = 'mini';
      g.style.gridTemplateColumns = 'repeat(' + n + ', 1fr)';
      for (var i = 0; i < n * n; i++) g.appendChild(document.createElement('i'));
      var t = document.createElement('span');
      t.className = 'num';
      t.textContent = n;
      b.appendChild(g);
      b.appendChild(t);
      b.addEventListener('click', function () {
        SP.storage.setSize(n);
        renderSizes();
        renderPics();   // ⭐ はマス数ごと
      });
      box.appendChild(b);
    });
  }

  function renderToggles() {
    var hasBgm = !!(window.SP_ASSETS && SP_ASSETS.bgm && SP_ASSETS.bgm.length);
    var bgm = $('btn-bgm'), se = $('btn-se');
    bgm.hidden = !hasBgm;   // BGM が無いときは 🎵 を出さない
    function paint() {
      bgm.classList.toggle('off', !SP.storage.getBgm());
      se.classList.toggle('off', !SP.storage.getSound());
      se.textContent = SP.storage.getSound() ? '🔊' : '🔇';
    }
    bgm.onclick = function () { SP.storage.setBgm(!SP.storage.getBgm()); paint(); SP.sound.applyBgm(); };
    se.onclick = function () { SP.storage.setSound(!SP.storage.getSound()); paint(); };
    paint();
  }

  SP.top = {
    // pick: 画像が選ばれたときに呼ぶ関数 (image) => void / openSettings: ⚙ を長押ししたとき
    init: function (pick, openSettings) {
      onPick = pick;
      onSettings = openSettings;
      $('btn-more').onclick = function () { shown = pickNext(); renderPics(); };
      renderToggles();
      renderSizes();
      bindAdult();
      refresh(true);
    },
    // トップに戻ったとき。集まりを作り直す。fresh=true（設定画面から戻ったとき）は9枚も選び直す
    show: function (fresh) { $('toast').hidden = true; renderSizes(); return refresh(!!fresh); }
  };
})();
