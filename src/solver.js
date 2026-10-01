// solver.js — 次の1手の計算（DESIGN.md §12.3）。画面には触らない。Node でも window でも読める。
// 盤の表し方は puzzle.js と同じ（長さ n*n の配列。board[マス] = ピース番号、空きは -1。完成は board[i]=i で右下が空き）。
// 3×3: A*（マンハッタン距離＋linear conflict）で最短手順。
// 4×4〜6×6: 上の行→左の列と1段ずつそろえ、残りが 3×3 になったら A*。完成までの手順をまるごと作って覚える。
// 手順の「1手」は、空きマスにすべりこむピースのいるマス番号（puzzle.applyMove にそのまま渡せる）。
(function (root) {
  var P = (typeof module !== 'undefined' && module.exports) ? require('./puzzle.js') : root.SP.puzzle;
  var EMPTY = P.EMPTY;

  // ---------- 3×3 の A* ----------
  // local: 長さ 9 の配列。値は「行き先のマス（0〜7）」、空きは -1。完成は local[i]=i、右下が空き。
  function h3(b) {
    var h = 0, i, j, r, c;
    for (i = 0; i < 9; i++) {
      var v = b[i];
      if (v === EMPTY) continue;
      h += Math.abs(Math.floor(i / 3) - Math.floor(v / 3)) + Math.abs(i % 3 - v % 3);
    }
    // linear conflict: 同じ行（列）に行き先がある2枚が逆順なら、どちらかが一度どいて戻る分 +2
    for (r = 0; r < 3; r++) {
      h += conflicts(b, r * 3, 1, function (v) { return Math.floor(v / 3) === r; }, function (v) { return v % 3; });
    }
    for (c = 0; c < 3; c++) {
      h += conflicts(b, c, 3, function (v) { return v % 3 === c; }, function (v) { return Math.floor(v / 3); });
    }
    return h;
  }
  // 1本の行/列の中の linear conflict の増分（最少で何枚どければ並ぶかを2倍）
  function conflicts(b, start, step, inLine, order) {
    var vals = [], k;
    for (k = 0; k < 3; k++) {
      var v = b[start + k * step];
      if (v !== EMPTY && inLine(v)) vals.push(order(v)); else vals.push(-1);
    }
    var removed = 0;
    for (;;) {
      // 各ピースが何枚と逆順か。いちばん多いものを外す（3枚までなら最少）
      var worst = -1, worstCnt = 0;
      for (var i = 0; i < 3; i++) {
        if (vals[i] < 0) continue;
        var cnt = 0;
        for (var j = 0; j < 3; j++) {
          if (j === i || vals[j] < 0) continue;
          if ((i < j && vals[i] > vals[j]) || (i > j && vals[i] < vals[j])) cnt++;
        }
        if (cnt > worstCnt) { worstCnt = cnt; worst = i; }
      }
      if (worst < 0) break;
      vals[worst] = -1;
      removed++;
    }
    return removed * 2;
  }

  var NB3 = [[1, 3], [0, 2, 4], [1, 5], [0, 4, 6], [1, 3, 5, 7], [2, 4, 8], [3, 7], [4, 6, 8], [5, 7]];

  function key3(b) {
    var k = 0;
    for (var i = 0; i < 9; i++) k = k * 9 + (b[i] + 1);
    return k;
  }

  // 2分ヒープ（f の小さい順。同じ f なら g の大きい順）
  function Heap() { this.a = []; }
  Heap.prototype.less = function (x, y) { return x.f < y.f || (x.f === y.f && x.g > y.g); };
  Heap.prototype.push = function (x) {
    var a = this.a, i = a.length;
    a.push(x);
    while (i > 0) {
      var p = (i - 1) >> 1;
      if (!this.less(a[i], a[p])) break;
      var t = a[i]; a[i] = a[p]; a[p] = t;
      i = p;
    }
  };
  Heap.prototype.pop = function () {
    var a = this.a, top = a[0], last = a.pop();
    if (a.length) {
      a[0] = last;
      var i = 0, n = a.length;
      for (;;) {
        var l = i * 2 + 1, r = l + 1, m = i;
        if (l < n && this.less(a[l], a[m])) m = l;
        if (r < n && this.less(a[r], a[m])) m = r;
        if (m === i) break;
        var t = a[i]; a[i] = a[m]; a[m] = t;
        i = m;
      }
    }
    return top;
  };

  // 戻り値: 空きにすべりこむピースのいるマス（local 0〜8）の並び。最短。
  function astar3(local) {
    var start = { b: local.slice(), g: 0, f: 0, blank: local.indexOf(EMPTY), parent: null, cell: -1 };
    start.f = h3(start.b);
    var heap = new Heap(), best = {};
    heap.push(start);
    best[key3(start.b)] = 0;
    while (heap.a.length) {
      var cur = heap.pop();
      var k = key3(cur.b);
      if (best[k] !== cur.g) continue;   // もっと良い道で見つかっている
      if (cur.f === cur.g) {             // h = 0 → 完成
        var path = [];
        for (var x = cur; x.parent; x = x.parent) path.push(x.cell);
        return path.reverse();
      }
      var nbs = NB3[cur.blank];
      for (var i = 0; i < nbs.length; i++) {
        var c = nbs[i];
        var nb = cur.b.slice();
        nb[cur.blank] = nb[c];
        nb[c] = EMPTY;
        var g = cur.g + 1, nk = key3(nb);
        if (best[nk] !== undefined && best[nk] <= g) continue;
        best[nk] = g;
        heap.push({ b: nb, g: g, f: g + h3(nb), blank: c, parent: cur, cell: c });
      }
    }
    return null;
  }

  // ---------- 全体の手順づくり ----------
  // 戻り値: { moves: [マス...], keys: [手を打つ前の盤の文字列...] }。解けなければ null。
  function solve(n, board0) {
    var N = n * n;
    var board = board0.slice();
    var blank = board.indexOf(EMPTY);
    var fixed = [];   // そろえ済み（動かさない）のマス
    var moves = [], keys = [];
    for (var i = 0; i < N; i++) fixed.push(false);
    var nbs = [];
    for (i = 0; i < N; i++) nbs.push(P.neighbors(n, i));

    // 空きを cell へ1マス動かす（cell にいるピースが空きへすべる）
    function step(cell) {
      keys.push(board.join(','));
      moves.push(cell);
      board[blank] = board[cell];
      board[cell] = EMPTY;
      blank = cell;
    }

    // 空きマスを target まで、そろえ済みと avoid を通らずに運ぶ（幅優先）
    function moveBlankTo(target, avoid) {
      if (blank === target) return true;
      var prev = {}, queue = [blank], qi = 0;
      prev[blank] = -1;
      while (qi < queue.length) {
        var c = queue[qi++];
        if (c === target) break;
        for (var k = 0; k < nbs[c].length; k++) {
          var d = nbs[c][k];
          if (prev[d] !== undefined || fixed[d] || d === avoid) continue;
          prev[d] = c;
          queue.push(d);
        }
      }
      if (prev[target] === undefined) return false;
      var path = [];
      for (var x = target; x !== blank; x = prev[x]) path.push(x);
      for (var j = path.length - 1; j >= 0; j--) step(path[j]);
      return true;
    }

    // ピース tile を target まで運ぶ。そろえ済みのマスは通らない
    function placeTile(tile, target) {
      var guard = 0;
      while (board.indexOf(tile) !== target) {
        if (guard++ > 200) return false;
        var pos = board.indexOf(tile);
        // ピースの通り道（そろえ済みを通らない最短）
        var prev = {}, queue = [pos], qi = 0;
        prev[pos] = -1;
        while (qi < queue.length) {
          var c = queue[qi++];
          if (c === target) break;
          for (var k = 0; k < nbs[c].length; k++) {
            var d = nbs[c][k];
            if (prev[d] !== undefined || fixed[d]) continue;
            prev[d] = c;
            queue.push(d);
          }
        }
        if (prev[target] === undefined) return false;
        var nextCell = target;
        while (prev[nextCell] !== pos) nextCell = prev[nextCell];
        // 空きをピースの行き先へ回し、ピースをすべらせる
        if (!moveBlankTo(nextCell, pos)) return false;
        step(pos);   // ピースが空き（=nextCell）へすべる
      }
      return true;
    }


    // 最後の2枚（ピース a, b をそれぞれ自分のマスへ）。(空き, a, b) の位置だけを数えて幅優先で探す。
    // 手順どおりの「端の2枚」でも空きが角に閉じ込められる場合があり、これなら必ず届く（そろえ済みは通らない）。
    function placePair(tileA, tileB) {
      var pa = board.indexOf(tileA), pb = board.indexOf(tileB);
      if (pa === tileA && pb === tileB) return true;
      var total = N * N * N;
      var from = new Int32Array(total).fill(-2);
      var queue = new Int32Array(total), qh = 0, qt = 0;
      var s0 = (blank * N + pa) * N + pb;
      from[s0] = -1;
      queue[qt++] = s0;
      var goal = -1;
      while (qh < qt) {
        var cur = queue[qh++];
        var cb = Math.floor(cur / (N * N)), ca = Math.floor(cur / N) % N, cc = cur % N;
        if (ca === tileA && cc === tileB) { goal = cur; break; }
        var list = nbs[cb];
        for (var q = 0; q < list.length; q++) {
          var d = list[q];
          if (fixed[d]) continue;
          var na = d === ca ? cb : ca, nc = d === cc ? cb : cc;
          var ns = (d * N + na) * N + nc;
          if (from[ns] !== -2) continue;
          from[ns] = cur;
          queue[qt++] = ns;
        }
      }
      if (goal < 0) return false;
      var path = [];
      for (var x = goal; from[x] !== -1; x = from[x]) path.push(Math.floor(x / (N * N)));   // 空きが着いたマス = すべったピースのいたマス
      for (var j = path.length - 1; j >= 0; j--) step(path[j]);
      return true;
    }

    var k = 0, ok = true;
    while (ok && n - k > 3) {
      var c, r, a, b;
      // 上の行: k 行目の k 列〜n-3 列を1枚ずつ
      for (c = k; c < n - 2 && ok; c++) {
        ok = placeTile(k * n + c, k * n + c);
        fixed[k * n + c] = true;
      }
      // 行の最後の2枚（a=左、b=右）。端のすき間に空きが閉じ込められやすいので、2枚だけ小さな探索で運ぶ
      a = k * n + n - 2; b = k * n + n - 1;
      ok = ok && placePair(a, b);
      fixed[a] = true; fixed[b] = true;
      // 左の列: k+1 行目〜n-3 行目の k 列を1枚ずつ
      for (r = k + 1; r < n - 2 && ok; r++) {
        ok = placeTile(r * n + k, r * n + k);
        fixed[r * n + k] = true;
      }
      // 列の最後の2枚（a=上、b=下）。行と同じ
      a = (n - 2) * n + k; b = (n - 1) * n + k;
      ok = ok && placePair(a, b);
      fixed[a] = true; fixed[b] = true;
      k++;
    }
    if (!ok) return null;

    // 残りの 3×3（k 行・k 列より右下）を A* で
    var local = [], cells = [];
    for (var lr = 0; lr < 3; lr++) {
      for (var lc = 0; lc < 3; lc++) {
        var g = (k + lr) * n + k + lc;
        cells.push(g);
        var v = board[g];
        local.push(v === EMPTY ? EMPTY : (Math.floor(v / n) - k) * 3 + (v % n - k));
      }
    }
    var path = astar3(local);
    if (!path) return null;
    for (i = 0; i < path.length; i++) step(cells[path[i]]);
    return { moves: moves, keys: keys };
  }

  // ---------- ヒント（手順の使い回し付き。§12.3） ----------
  var cache = null;   // { n, map: 盤の文字列 → 手順の何手目か, moves }

  function nextMove(n, board) {
    if (P.solved(board)) return null;
    var key = board.join(',');
    if (cache && cache.n === n) {
      var idx = cache.map[key];
      if (idx !== undefined) return cache.moves[idx];   // ヒントどおりに動かしてきた
    }
    var res = solve(n, board);
    if (!res || !res.moves.length) { cache = null; return null; }
    var map = {};
    for (var i = res.keys.length - 1; i >= 0; i--) map[res.keys[i]] = i;   // 同じ盤が2度出るときは早いほう
    cache = { n: n, map: map, moves: res.moves };
    return res.moves[0];
  }

  function reset() { cache = null; }

  var api = { solve: solve, nextMove: nextMove, reset: reset, astar3: astar3 };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) { root.SP = root.SP || {}; root.SP.solver = api; }
})(typeof window !== 'undefined' ? window : null);
