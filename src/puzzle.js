// puzzle.js — 盤の状態・まぜ方・動かし方・そろった判定（DESIGN.md §5）。画面には触らない純粋なロジック。
// 盤は長さ n*n の配列。board[マス] = ピースの番号（元の位置 0〜n*n-2）、空きマスは -1。
// マスは左上が 0、右へ・下へ増える。完成の形は board[i] = i、右下（n*n-1）が空き。
// window が無い環境（Node）でも読める。
(function (root) {
  var EMPTY = -1;

  // 完成の形の盤
  function create(n) {
    var b = [];
    for (var i = 0; i < n * n - 1; i++) b.push(i);
    b.push(EMPTY);
    return b;
  }

  // そろっているか（§5.4）
  function solved(board) {
    for (var i = 0; i < board.length; i++) {
      if (board[i] !== EMPTY && board[i] !== i) return false;
    }
    return true;
  }

  // 正しい位置にあるピースの割合（ピース n*n-1 枚のうち）
  function correctRatio(board) {
    var ok = 0;
    for (var i = 0; i < board.length; i++) if (board[i] === i) ok++;
    return ok / (board.length - 1);
  }

  // マスのとなり（上下左右）の一覧
  function neighbors(n, cell) {
    var r = Math.floor(cell / n), c = cell % n, a = [];
    if (r > 0) a.push(cell - n);
    if (r < n - 1) a.push(cell + n);
    if (c > 0) a.push(cell - 1);
    if (c < n - 1) a.push(cell + 1);
    return a;
  }

  // cell のピースをタップしたときの動き。空きと同じ行/列なら、cell から空きまでのピースが
  // まとめて1マスずつ動く。動かせないとき null。
  // 戻り値: [{tile, from, to}, ...]（空きに近い側から）
  function planMove(n, board, cell) {
    var e = board.indexOf(EMPTY);
    if (cell === e || cell < 0 || cell >= board.length) return null;
    var r = Math.floor(cell / n), c = cell % n, er = Math.floor(e / n), ec = e % n;
    var step;
    if (r === er) step = ec > c ? 1 : -1;
    else if (c === ec) step = er > r ? n : -n;
    else return null;
    var plan = [], to = e;
    while (to !== cell) {
      var from = to - step;
      plan.push({ tile: board[from], from: from, to: to });
      to = from;
    }
    return plan;
  }

  // 動かして盤を書き換える。動かせないとき null
  function applyMove(n, board, cell) {
    var plan = planMove(n, board, cell);
    if (!plan) return null;
    for (var i = 0; i < plan.length; i++) {
      board[plan[i].to] = plan[i].tile;
    }
    board[cell] = EMPTY;
    return plan;
  }

  // スワイプの向き (dx,dy は -1/0/1) が、cell から空きマスへ向かう向きか
  function swipeOk(n, board, cell, dx, dy) {
    var e = board.indexOf(EMPTY);
    if (cell === e) return false;
    var r = Math.floor(cell / n), c = cell % n, er = Math.floor(e / n), ec = e % n;
    if (r === er && dy === 0) return (ec > c ? 1 : -1) === dx;
    if (c === ec && dx === 0) return (er > r ? 1 : -1) === dy;
    return false;
  }

  // まぜる（§5.2）。完成の形から空きをランダムに moves 回動かす（直前に戻る動きは選ばない）。
  // そのあと、正しい位置のピースが maxRatio を超えている間、または完成の形のままなら続けてまぜる。
  // 戻り値: { board, history }  history は空きマスが通ったマスの並び（テスト用。逆にたどると解ける）
  function shuffle(n, moves, maxRatio, rng) {
    rng = rng || Math.random;
    var board = create(n);
    var blank = board.length - 1, prev = -1;
    var history = [blank];
    function stepOnce() {
      var cand = neighbors(n, blank).filter(function (x) { return x !== prev; });
      var next = cand[Math.floor(rng() * cand.length)];
      board[blank] = board[next];
      board[next] = EMPTY;
      prev = blank;
      blank = next;
      history.push(blank);
    }
    for (var i = 0; i < moves; i++) stepOnce();
    var guard = 0;
    while ((solved(board) || correctRatio(board) > maxRatio) && guard++ < 100000) stepOnce();
    return { board: board, history: history };
  }

  // 転倒数（空きを除く）
  function inversions(board) {
    var a = board.filter(function (x) { return x !== EMPTY; }), inv = 0;
    for (var i = 0; i < a.length; i++)
      for (var j = i + 1; j < a.length; j++) if (a[i] > a[j]) inv++;
    return inv;
  }

  // 解ける盤か（転倒数の偶奇。完成の形は右下が空き）
  function isSolvable(n, board) {
    var inv = inversions(board);
    if (n % 2 === 1) return inv % 2 === 0;
    var blankRow = Math.floor(board.indexOf(EMPTY) / n);   // 上から 0 始まり
    return (inv + blankRow) % 2 === (n - 1) % 2;
  }

  var api = {
    EMPTY: EMPTY, create: create, solved: solved, correctRatio: correctRatio,
    neighbors: neighbors, planMove: planMove, applyMove: applyMove, swipeOk: swipeOk,
    shuffle: shuffle, inversions: inversions, isSolvable: isSolvable
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) { root.SP = root.SP || {}; root.SP.puzzle = api; }
})(typeof window !== 'undefined' ? window : null);
