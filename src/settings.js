// settings.js — 「え の せってい」画面（DESIGN.md §11.3・§11.4）。おとな用なので漢字まじり。
// 追加・一覧・「はじめからの絵も使う」・すべて削除。サムネイルをタップしたときは削除だけ（切り抜きの調整は Step 6）。
(function () {
  var onBack = null;
  var thumbUrls = [];    // 一覧のサムネイルのために作った Blob URL（描き直すとき・閉じるときに解放）
  var busy = false;      // 追加中・削除中
  var asked = false;     // storage.persist() をお願いしたか（1回だけ）
  var usable = false;
  var list = [];         // いまの一覧（保存された順）

  function $(id) { return document.getElementById(id); }

  function revokeThumbs() {
    thumbUrls.forEach(function (u) { URL.revokeObjectURL(u); });
    thumbUrls = [];
  }

  function setBusy(b) {
    busy = b;
    $('s-add').disabled = b || !usable;
    $('s-back').disabled = b;
    $('s-clear').disabled = b || !list.length;
  }

  // ---------- 一覧 ----------
  function render() {
    revokeThumbs();
    var grid = $('s-grid');
    grid.innerHTML = '';
    list.forEach(function (rec) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 's-thumb';
      b.setAttribute('aria-label', rec.name || rec.id);
      var img = document.createElement('img');
      var url = URL.createObjectURL(rec.thumb);
      thumbUrls.push(url);
      img.src = url;
      img.alt = '';
      img.draggable = false;
      b.appendChild(img);
      if (SP.myimage.isSmall(rec)) {
        var sm = document.createElement('span');
        sm.className = 's-small';
        sm.textContent = '小';
        b.appendChild(sm);
      }
      b.addEventListener('click', function () { if (!busy) openCrop(rec); });
      grid.appendChild(b);
    });
    $('s-count').textContent = 'じぶんの え（' + list.length + '枚）';
    // 「はじめからの絵も使う」は、じぶんの え が1枚以上あるときだけ有効
    $('s-builtin').checked = SP.storage.getUseBuiltin();
    $('s-builtin').disabled = !list.length;
    $('s-clear').disabled = busy || !list.length;
    $('s-add').disabled = busy || !usable;
  }

  function reload() {
    return SP.mydb.getAll().then(function (l) { list = l; }, function () { list = []; }).then(render);
  }

  // ---------- 確認 ----------
  function ask(text, okLabel, onOk) {
    $('s-confirm-text').textContent = text;
    $('s-confirm-ok').textContent = okLabel;
    $('s-confirm-ok').onclick = function () { $('s-confirm').hidden = true; onOk(); };
    $('s-confirm').hidden = false;
  }

  // 1枚の削除（記録も消す。§11.7）
  function askDelete(rec) {
    ask('この絵を削除しますか？', '削除', function () {
      closeCrop();
      setBusy(true);
      SP.mydb.remove(rec.id).then(function () { SP.storage.deleteBest(rec.id); }, function () {})
        .then(reload).then(function () { setBusy(false); });
    });
  }

  // ---------- 位置の調整（§11.5） ----------
  var cr = null;   // { rec, crop, fit, srcUrl, wholeUrl, token, drag, working }

  function openCrop(rec) {
    cr = { rec: rec, crop: typeof rec.crop === 'number' ? rec.crop : 0.5, fit: rec.fit === 'whole' ? 'whole' : 'crop',
           srcUrl: URL.createObjectURL(rec.src), wholeUrl: null, token: 0, drag: null, working: false };
    $('c-wait').textContent = 'つくっています…';
    $('s-crop').hidden = false;
    paintCrop();
  }

  function closeCrop() {
    if (!cr) return;
    URL.revokeObjectURL(cr.srcUrl);
    if (cr.wholeUrl) URL.revokeObjectURL(cr.wholeUrl);
    cr.token++;
    cr = null;
    $('c-img').removeAttribute('src');
    $('c-wait').hidden = true;
    $('s-crop').hidden = true;
  }

  // 枠・切り替え・見せる絵を、いまの状態に合わせる
  function paintCrop() {
    var rec = cr.rec, whole = cr.fit === 'whole', stage = $('c-stage');
    $('c-m-crop').classList.toggle('on', !whole);
    $('c-m-whole').classList.toggle('on', whole);
    $('c-m-crop').setAttribute('aria-pressed', whole ? 'false' : 'true');
    $('c-m-whole').setAttribute('aria-pressed', whole ? 'true' : 'false');
    stage.classList.toggle('whole', whole);
    if (whole) {
      // 全体を入れる: 出来上がり（正方形）をそのまま見せる。枠は動かない
      stage.style.setProperty('--ar', '1');
      $('c-hint').textContent = 'ぜんたいを入れて、あまりはぼかした絵でうめます';
      showWhole();
    } else {
      cr.token++;
      $('c-wait').hidden = true;
      if ($('c-img').getAttribute('src') !== cr.srcUrl) $('c-img').src = cr.srcUrl;
      stage.style.setProperty('--ar', rec.w + ' / ' + rec.h);
      var landscape = rec.w > rec.h, portrait = rec.h > rec.w;
      $('c-hint').textContent = (landscape || portrait)
        ? '指でドラッグして、切り抜く位置を選びます'
        : 'この絵は正方形なので、位置は動きません';
      // 枠は短辺いっぱいの正方形。長い方向にだけ動く
      var side = Math.min(rec.w, rec.h);
      var w = landscape ? side / rec.w : 1, h = portrait ? side / rec.h : 1;
      var f = $('c-frame');
      f.style.width = (w * 100) + '%';
      f.style.height = (h * 100) + '%';
      f.style.left = (landscape ? cr.crop * (1 - w) * 100 : 0) + '%';
      f.style.top = (portrait ? cr.crop * (1 - h) * 100 : 0) + '%';
    }
    $('c-ok').disabled = cr.working;
  }

  // 「全体を入れる」の見本（出来上がりの正方形）を作って見せる。1回作ったら使い回す
  function showWhole() {
    if (cr.wholeUrl) { $('c-img').src = cr.wholeUrl; $('c-wait').hidden = true; return; }
    var my = cr, tk = ++cr.token;
    $('c-img').removeAttribute('src');
    $('c-wait').textContent = 'つくっています…';
    $('c-wait').hidden = false;
    SP.myimage.makeBlobs(cr.rec.src, 0.5, 'whole').then(function (b) {
      if (cr !== my || tk !== my.token) return;
      my.wholeUrl = URL.createObjectURL(b.full);
      $('c-img').src = my.wholeUrl;
      $('c-wait').hidden = true;
    }, function () {
      if (cr === my && tk === my.token) $('c-wait').textContent = 'つくれませんでした';
    });
  }

  function setFit(fit) {
    if (!cr || cr.working || cr.fit === fit) return;
    cr.fit = fit;
    paintCrop();
  }

  // 枠のドラッグ（指でもマウスでも）。長い方向にだけ動き、絵の外には出ない
  function bindCropDrag() {
    var stage = $('c-stage');
    stage.addEventListener('pointerdown', function (e) {
      if (!cr || cr.working || cr.fit !== 'crop') return;
      cr.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, crop: cr.crop };
      try { stage.setPointerCapture(e.pointerId); } catch (x) { /* 無視 */ }
    });
    stage.addEventListener('pointermove', function (e) {
      var d = cr && cr.drag;
      if (!d || e.pointerId !== d.id) return;
      var rec = cr.rec, r = stage.getBoundingClientRect();
      var landscape = rec.w > rec.h, portrait = rec.h > rec.w;
      if (!landscape && !portrait) return;
      // 枠が動ける長さ（px）= 絵の長い辺 - 枠の辺
      var range = landscape ? r.width * (1 - rec.h / rec.w) : r.height * (1 - rec.w / rec.h);
      if (range <= 0) return;
      var delta = landscape ? e.clientX - d.x : e.clientY - d.y;
      cr.crop = Math.max(0, Math.min(1, d.crop + delta / range));   // 端で止まる
      paintCrop();
    });
    function end(e) { if (cr && cr.drag && e.pointerId === cr.drag.id) cr.drag = null; }
    stage.addEventListener('pointerup', end);
    stage.addEventListener('pointercancel', end);
  }

  // 決定: 位置と向きで full と thumb を作り直して保存する
  function applyCrop() {
    if (!cr || cr.working) return;
    var my = cr, rec = cr.rec;
    my.working = true;
    $('c-ok').disabled = true;
    $('c-wait').textContent = 'つくっています…';
    $('c-wait').hidden = false;
    setBusy(true);
    SP.myimage.makeBlobs(rec.src, my.crop, my.fit).then(function (b) {
      rec.crop = my.crop;
      rec.fit = my.fit;
      rec.full = b.full;
      rec.thumb = b.thumb;
      return SP.mydb.put(rec);
    }).then(function () {
      closeCrop();
      return reload();
    }, function () {
      // 保存に失敗したら画面は残して、もう一度できるようにする
      if (cr === my) { my.working = false; $('c-wait').textContent = '保存できませんでした'; paintCrop(); }
    }).then(function () { setBusy(false); });
  }

  // すべて削除（確認2回）
  function askClearAll() {
    if (!list.length) return;
    ask('じぶんの絵 ' + list.length + '枚を すべて削除しますか？', '削除', function () {
      ask('本当に すべて削除しますか？ もとに戻せません。', 'すべて削除', function () {
        setBusy(true);
        var ids = list.map(function (r) { return r.id; });
        SP.mydb.clear().then(function () { ids.forEach(SP.storage.deleteBest); }, function () {})
          .then(reload).then(function () { setBusy(false); });
      });
    });
  }

  // ---------- 追加 ----------
  function progress(text) {
    var p = $('s-progress');
    p.textContent = text;
    p.hidden = !text;
  }

  // ファイルの配列（File[]）を1枚ずつ読み込んで保存する。→ Promise<{ added, unread, unsaved }>
  // 画面からは <input type=file> の選択結果を渡す。確認では File を直接渡して試せる
  function addFiles(files) {
    files = Array.prototype.slice.call(files || []);
    var total = files.length, res = { added: 0, unread: 0, unsaved: 0 };
    if (!total) return Promise.resolve(res);
    setBusy(true);
    progress('追加中 0/' + total);
    var chain = Promise.resolve();
    files.forEach(function (file, i) {
      chain = chain.then(function () {
        return SP.myimage.fromFile(file).then(function (rec) {
          rec.id = SP.myimage.newId();
          rec.added = Date.now() + i;   // 同じ時刻でも選んだ順に並ぶ
          return SP.mydb.put(rec).then(function () { res.added++; }, function () { res.unsaved++; });
        }, function () { res.unread++; }).then(function () {
          progress('追加中 ' + (i + 1) + '/' + total);
        });
      });
    });
    return chain.then(function () {
      var msg = res.added + '枚 追加しました';
      if (res.unread) msg += '　' + res.unread + '枚は読めませんでした';
      if (res.unsaved) msg += '　' + res.unsaved + '枚は保存できませんでした';
      progress(msg);
      // 追加の直後に、ブラウザが勝手に消しにくくなるようお願いする（1回だけ。断られても何もしない）
      if (res.added && !asked) {
        asked = true;
        try {
          if (navigator.storage && navigator.storage.persist) navigator.storage.persist().then(null, function () {});
        } catch (e) { /* 何もしない */ }
      }
      return reload();
    }).then(function () { setBusy(false); return res; });
  }

  // ---------- 画面 ----------
  function show() {
    progress('');
    closeCrop();
    $('s-confirm').hidden = true;
    $('s-body').scrollTop = 0;
    list = [];
    render();
    return SP.mydb.ready().then(function (ok) {
      usable = ok;
      $('s-unavail').hidden = ok;
      if (!ok) { render(); return; }
      return reload();
    });
  }

  SP.settings = {
    init: function (back) {
      onBack = back;
      $('s-back').onclick = function () {
        if (busy) return;
        revokeThumbs();
        if (onBack) onBack();
      };
      $('s-add').onclick = function () { if (!busy && usable) $('s-file').click(); };
      $('s-file').onchange = function () {
        var files = Array.prototype.slice.call(this.files || []);
        this.value = '';   // 同じファイルをもう一度選んでも反応するように
        addFiles(files);
      };
      $('s-builtin').onchange = function () { SP.storage.setUseBuiltin(this.checked); };
      $('s-clear').onclick = function () { if (!busy) askClearAll(); };
      bindCropDrag();
      $('c-m-crop').onclick = function () { setFit('crop'); };
      $('c-m-whole').onclick = function () { setFit('whole'); };
      $('c-ok').onclick = applyCrop;
      $('c-cancel').onclick = function () { if (cr && !cr.working) closeCrop(); };
      $('c-del').onclick = function () { if (cr && !cr.working) askDelete(cr.rec); };
      $('s-confirm-cancel').onclick = function () { $('s-confirm').hidden = true; };
    },
    show: show,
    addFiles: addFiles
  };
})();
