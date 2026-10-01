// game.js — パズル画面（DESIGN.md §4.2・§4.3・§5.3）。盤の表示・入力・アニメーション・「できた！」。
// ロジックは SP.puzzle、保存は SP.storage、音は SP.sound。
(function () {
  var cfg = SP.config, P = SP.puzzle;
  var callbacks = { home: null, more: null };
  var st = null;   // いまのゲームの状態（start のたびに作り直す）
  var gen = 0;     // start のたびに増える。古いタイマーを無効にする
  var timers = [];
  var hintEl = null;   // おてほんの重ね絵（盤を作り直すたびに付け直す）
  var tipOn = false;   // ひんとのオン/オフ（盤を作り直しても、画面を行き来しても そのまま。保存はしない。§12.1）
  var tipEl = null;    // ひんとの目印（光るふち＋矢印）。次に動かすピースの中に入れる

  function $(id) { return document.getElementById(id); }

  function later(fn, ms) {
    var g = gen;
    var id = setTimeout(function () { if (g === gen) fn(); }, ms);
    timers.push(id);
  }
  function clearTimers() {
    timers.forEach(clearTimeout);
    timers = [];
    if (st && st.tickId) clearInterval(st.tickId);
  }

  function fmt(ms) {
    var s = Math.floor(ms / 1000), m = Math.floor(s / 60);
    s = s % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  // ---------- 開始 ----------
  function start(image, n) {
    gen++;
    clearTimers();
    st = {
      image: image, n: n, board: null, tiles: {}, moves: 0, startT: 0, tickId: 0,
      busy: false, pending: null, locked: true, ptr: null,
      usedHint: false,   // ひんとを1回でもオンにした回か（§12.2）
      cheat: location.hash === '#cheat'
    };
    SP.solver.reset();
    removeTip();
    $('g-result').hidden = true;
    $('g-ctrl').hidden = false;
    $('confirm').hidden = true;
    $('confetti').innerHTML = '';
    hintEl.classList.remove('on');
    $('btn-hint').disabled = false;
    $('btn-tip').disabled = true;   // 盤ができるまで押せない
    $('btn-num').disabled = false;
    $('btn-shuffle').disabled = false;
    paintStats();

    var bd = $('board');
    bd.className = 'board';
    bd.innerHTML = '';
    bd.style.setProperty('--n', n);
    var loading = document.createElement('div');
    loading.className = 'loading';
    loading.textContent = 'よみこみちゅう';
    bd.appendChild(loading);

    var myGen = gen;
    var img = new Image();
    img.onload = function () { if (myGen === gen) build(img); };
    img.onerror = function () { if (myGen === gen) loading.textContent = 'よみこめません'; };
    img.src = image.src;
  }

  function build() {
    var n = st.n, bd = $('board'), src = st.image.src;
    var moves = st.cheat ? 2 : cfg.SHUFFLE_MOVES[n];
    var ratio = st.cheat ? 1 : cfg.SHUFFLE_MAX_CORRECT_RATIO;
    st.board = P.shuffle(n, moves, ratio).board;

    bd.innerHTML = '';
    bd.style.setProperty('--n', n);
    bd.style.setProperty('--gap', cfg.TILE_GAP + 'px');
    bd.style.setProperty('--slide', cfg.SLIDE_MS + 'ms');
    bd.style.setProperty('--tip-ms', cfg.HINT_PULSE_MS + 'ms');
    bd.style.setProperty('--tip-arrow-opacity', cfg.HINT_ARROW_OPACITY);
    bd.classList.toggle('show-num', SP.storage.getNumbers(n));

    // ピースは 0 〜 n*n-1（最後の1枚は空きの分。完成のときだけ現れる）
    for (var id = 0; id < n * n; id++) {
      var tile = document.createElement('div');
      tile.className = 'tile' + (id === n * n - 1 ? ' last' : '');
      var inner = document.createElement('div');
      inner.className = 'tile-in';
      inner.style.backgroundImage = 'url("' + src + '")';
      inner.style.backgroundSize = (n * 100) + '% ' + (n * 100) + '%';
      inner.style.backgroundPosition =
        ((id % n) / (n - 1) * 100) + '% ' + (Math.floor(id / n) / (n - 1) * 100) + '%';
      var num = document.createElement('span');
      num.className = 'badge';
      num.textContent = id + 1;
      inner.appendChild(num);
      tile.appendChild(inner);
      bd.appendChild(tile);
      st.tiles[id] = tile;
    }
    hintEl.style.backgroundImage = 'url("' + src + '")';
    bd.appendChild(hintEl);
    for (var cell = 0; cell < n * n; cell++) {
      if (st.board[cell] !== P.EMPTY) place(st.tiles[st.board[cell]], cell);
    }
    place(st.tiles[n * n - 1], n * n - 1);   // 最後の1枚は右下で待つ（完成のときだけ現れる）
    paintNumBtn();
    $('btn-tip').disabled = false;
    st.locked = false;
    if (tipOn) st.usedHint = true;   // 引きついだ ひんと も「ひんとあり」
    paintTipBtn();
    updateTip();
  }

  function place(tileEl, cell) {
    var n = st.n;
    tileEl.style.setProperty('--x', cell % n);
    tileEl.style.setProperty('--y', Math.floor(cell / n));
    tileEl.setAttribute('data-cell', cell);   // いまのマス（確認用・ひんとの見分け用）
  }

  // ---------- ひんと（§12.1）: 次に動かすピースに、光るふちと矢印を付ける ----------
  function removeTip() {
    if (tipEl && tipEl.parentNode) {
      tipEl.parentNode.classList.remove('hinted');
      tipEl.parentNode.removeChild(tipEl);
    }
  }

  // 盤が変わるたびに呼ぶ。オフ・完成・読み込み中は何も示さない
  function updateTip() {
    removeTip();
    if (!tipOn || !st || !st.board || st.locked) return;
    var t0 = performance.now();
    var cell = SP.solver.nextMove(st.n, st.board);
    var ms = performance.now() - t0;
    if (ms > cfg.SOLVER_BUDGET_MS && window.console) console.warn('ひんとの計算に ' + Math.round(ms) + 'ms かかりました');
    if (cell === null || cell < 0) return;
    var n = st.n, e = st.board.indexOf(P.EMPTY);
    var dx = (e % n) - (cell % n), dy = Math.floor(e / n) - Math.floor(cell / n);   // 空きマスの方向（となりなので -1/0/1）
    var angle = dx > 0 ? 0 : dy > 0 ? 90 : dx < 0 ? 180 : 270;
    var el = st.tiles[st.board[cell]];
    if (!tipEl) {
      tipEl = document.createElement('div');
      tipEl.className = 'tip';
      tipEl.innerHTML = '<span class="tip-ring"></span>' +
        '<svg class="tip-arrow" viewBox="0 0 100 100" aria-hidden="true">' +
        '<path d="M14 38 H52 V16 L90 50 L52 84 V62 H14 Z" fill="#fff" stroke="#5a3d2b" stroke-width="7" stroke-linejoin="round"/></svg>';
    }
    tipEl.querySelector('.tip-arrow').style.transform = 'rotate(' + angle + 'deg)';
    el.appendChild(tipEl);
    el.classList.add('hinted');
  }

  function paintTipBtn() {
    $('btn-tip').classList.toggle('on', tipOn);
    $('btn-tip').setAttribute('aria-pressed', tipOn ? 'true' : 'false');
  }

  // ---------- 入力 ----------
  function cellAt(e) {
    var r = $('board').getBoundingClientRect(), n = st.n;
    var x = e.clientX - r.left, y = e.clientY - r.top;
    if (x < 0 || y < 0 || x >= r.width || y >= r.height) return -1;
    return Math.floor(y / (r.height / n)) * n + Math.floor(x / (r.width / n));
  }

  function onDown(e) {
    if (!st || st.locked || !st.board) return;
    if (!$('confirm').hidden) return;
    var cell = cellAt(e);
    if (cell < 0) return;
    st.ptr = { id: e.pointerId, x: e.clientX, y: e.clientY, cell: cell, handled: false };
    try { $('board').setPointerCapture(e.pointerId); } catch (x) { /* 無視 */ }
  }

  function onMove(e) {
    var p = st && st.ptr;
    if (!p || p.handled || e.pointerId !== p.id) return;
    var dx = e.clientX - p.x, dy = e.clientY - p.y;
    if (Math.sqrt(dx * dx + dy * dy) < cfg.SWIPE_MIN_PX) return;
    p.handled = true;   // スワイプとして1回だけ扱う
    var dir = Math.abs(dx) > Math.abs(dy) ? { x: dx > 0 ? 1 : -1, y: 0 } : { x: 0, y: dy > 0 ? 1 : -1 };
    handleInput(p.cell, dir);
  }

  function onUp(e) {
    var p = st && st.ptr;
    if (!p || e.pointerId !== p.id) return;
    st.ptr = null;
    if (!p.handled && e.type === 'pointerup') handleInput(p.cell, null);
  }

  // 入力を受ける。アニメ中なら1つだけためておく（§5.3）
  function handleInput(cell, dir) {
    if (st.locked) return;
    if (st.busy) {
      if (!st.pending) st.pending = { cell: cell, dir: dir };
      return;
    }
    if (dir && !P.swipeOk(st.n, st.board, cell, dir.x, dir.y)) return;   // 向きが違えば何もしない
    doMove(cell);
  }

  function doMove(cell) {
    var plan = P.applyMove(st.n, st.board, cell);
    if (!plan) { wiggle(cell); return; }
    plan.forEach(function (m) { place(st.tiles[m.tile], m.to); });
    if (!st.startT) {   // 時間は最初の1手から
      st.startT = performance.now();
      st.tickId = setInterval(paintStats, 250);
    }
    st.moves++;
    paintStats();
    SP.sound.move();
    var done = P.solved(st.board);
    if (done) st.locked = true;   // そろったら入力を止める
    updateTip();                  // 動かした後の盤から、次のひんとを出す（完成なら消える）
    st.busy = true;
    later(function () {
      st.busy = false;
      if (done) { clear(); return; }
      var pd = st.pending;
      st.pending = null;
      if (pd) handleInput(pd.cell, pd.dir);
    }, cfg.SLIDE_MS);
  }

  // 動かせないピースを「ぷるっ」と揺らす
  function wiggle(cell) {
    var t = st.board[cell];
    if (t === P.EMPTY) return;
    var el = st.tiles[t].firstChild;
    el.classList.remove('wiggle');
    void el.offsetWidth;
    el.classList.add('wiggle');
  }

  // ---------- 表示 ----------
  function paintStats() {
    $('g-moves').textContent = 'てかず ' + (st ? st.moves : 0);
    var ms = st && st.startT && !st.endMs ? performance.now() - st.startT : (st && st.endMs) || 0;
    $('g-time').textContent = '⏱ ' + fmt(ms);
  }

  function paintNumBtn() {
    var on = SP.storage.getNumbers(st.n);
    $('btn-num').classList.toggle('on', on);
    $('btn-num').setAttribute('aria-pressed', on ? 'true' : 'false');
  }

  // ---------- できた！ ----------
  function clear() {
    clearInterval(st.tickId);
    st.endMs = performance.now() - st.startT;
    paintStats();
    $('btn-hint').disabled = true;
    $('btn-num').disabled = true;
    $('btn-tip').disabled = true;
    $('btn-shuffle').disabled = true;
    hintEl.classList.remove('on');
    removeTip();
    var n = st.n;
    later(function () {
      // 1. 空いていた右下のピースがふわっと現れる
      st.tiles[n * n - 1].classList.add('show');
      $('board').classList.remove('show-num');
      later(function () {
        // 2. すき間が消えて1枚の絵になる
        $('board').classList.add('joined');
        later(function () {
          // 3. 「できた！」と紙ふぶき、記録
          SP.sound.clear();
          showResult();
          confetti();
        }, 500);
      }, 450);
    }, cfg.CLEAR_DELAY_MS);
  }

  function showResult() {
    var prev = SP.storage.getBest(st.image.id, st.n);
    var bestMoves, bestMs, record = false;
    if (st.usedHint) {
      // ひんとを使った回: 記録は更新しない・「さいこう きろく！」も出さない。⭐ のしるしだけ付ける（§12.2）
      bestMoves = prev ? prev.moves : null;
      bestMs = prev ? prev.ms : null;
      SP.storage.setCleared(st.image.id, st.n);
    } else {
      bestMoves = prev ? Math.min(prev.moves, st.moves) : st.moves;
      bestMs = prev ? Math.min(prev.ms, st.endMs) : st.endMs;
      record = !!prev && (st.moves < prev.moves || st.endMs < prev.ms);
      SP.storage.setBest(st.image.id, st.n, { moves: bestMoves, ms: bestMs });
    }
    $('r-moves').textContent = 'てかず ' + st.moves + (bestMoves === null ? '' : '（いちばん ' + bestMoves + '）');
    $('r-time').textContent = 'じかん ' + fmt(st.endMs) + (bestMs === null ? '' : '（いちばん ' + fmt(bestMs) + '）');
    $('r-record').hidden = !record;
    $('r-tip').hidden = !st.usedHint;
    $('g-ctrl').hidden = true;
    $('g-result').hidden = false;
  }

  function confetti() {
    var box = $('confetti');
    var colors = ['#ff7a59', '#ffd23f', '#4aa8ff', '#6fcf97', '#ff6bb5', '#b57aff'];
    for (var i = 0; i < cfg.CONFETTI_COUNT; i++) {
      var d = document.createElement('i');
      d.style.left = (Math.random() * 100) + '%';
      d.style.background = colors[i % colors.length];
      d.style.animationDuration = (2 + Math.random() * 2) + 's';
      d.style.animationDelay = (Math.random() * 0.8) + 's';
      d.style.setProperty('--sway', (Math.random() * 120 - 60) + 'px');
      d.style.transform = 'rotate(' + Math.floor(Math.random() * 360) + 'deg)';
      box.appendChild(d);
    }
    later(function () { box.innerHTML = ''; }, 5000);
  }

  // ---------- 確認ダイアログ ----------
  function ask(text, okLabel, onOk) {
    $('confirm-text').textContent = text;
    $('confirm-ok').textContent = okLabel;
    $('confirm-ok').onclick = function () { $('confirm').hidden = true; onOk(); };
    $('confirm').hidden = false;
  }
  function playing() { return st && st.moves > 0 && !st.locked; }

  // ---------- ボタン ----------
  function bind() {
    hintEl = $('hint');
    hintEl.parentNode.removeChild(hintEl);
    var bd = $('board');
    bd.addEventListener('pointerdown', onDown);
    bd.addEventListener('pointermove', onMove);
    bd.addEventListener('pointerup', onUp);
    bd.addEventListener('pointercancel', onUp);

    $('btn-home').onclick = function () {
      if (playing()) ask('やめる？', 'やめる', leave);
      else leave();
    };
    $('confirm-cancel').onclick = function () { $('confirm').hidden = true; };

    $('btn-shuffle').onclick = function () {
      if (!st.board) return;
      if (playing()) ask('まぜなおす？', 'まぜなおす', again);
      else again();
    };

    // ひんと: 押すたびにオン/オフ。1回でもオンにした回は記録を更新しない（§12.2）
    $('btn-tip').onclick = function () {
      if (!st.board || st.locked) return;
      tipOn = !tipOn;
      if (tipOn) st.usedHint = true;
      paintTipBtn();
      updateTip();
    };

    $('btn-num').onclick = function () {
      if (!st.board) return;
      var on = !SP.storage.getNumbers(st.n);
      SP.storage.setNumbers(st.n, on);
      $('board').classList.toggle('show-num', on);
      paintNumBtn();
    };

    // おてほん: 'hold' は押しているあいだ、'toggle' はタップで切り替え
    var hb = $('btn-hint'), hint = hintEl;
    if (cfg.HINT_MODE === 'toggle') {
      hb.onclick = function () { if (st.board) hint.classList.toggle('on'); };
    } else {
      hb.onpointerdown = function (e) { e.preventDefault(); if (st.board && !hb.disabled) hint.classList.add('on'); };
      hb.onpointerup = hb.onpointercancel = hb.onpointerleave = function () { hint.classList.remove('on'); };
    }

    $('r-again').onclick = again;
    $('r-more').onclick = leave;
  }

  function again() { start(st.image, st.n); }
  function leave() {
    gen++;
    clearTimers();
    if (callbacks.more) callbacks.more();
  }

  var bound = false;
  SP.game = {
    // home: トップへ戻る
    init: function (onHome) { callbacks.more = onHome; if (!bound) { bound = true; bind(); } },
    start: start,
    stop: function () { gen++; clearTimers(); }
  };
})();
