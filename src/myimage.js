// myimage.js — 端末で読み込んだ絵から、縮小した元の絵・正方形（パズル用）・サムネイルを作る（DESIGN.md §11.4・§11.5）。
// 全部 canvas。外には何も送らない。
(function () {
  var cfg = SP.config;

  // Blob/File を読み込む。{ source（drawImage に渡せるもの）, w, h, close() } で解決。読めなければ reject
  function decode(blob) {
    return new Promise(function (resolve, reject) {
      function viaImage() {
        var url = URL.createObjectURL(blob);
        var img = new Image();
        img.onload = function () {
          if (!img.naturalWidth || !img.naturalHeight) { URL.revokeObjectURL(url); reject(new Error('大きさが分かりません')); return; }
          resolve({ source: img, w: img.naturalWidth, h: img.naturalHeight, close: function () { URL.revokeObjectURL(url); } });
        };
        img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('読めない画像')); };
        img.src = url;
      }
      if (window.createImageBitmap) {
        // 向き情報（EXIF）は既定で反映される。失敗したら Image で読み直す
        createImageBitmap(blob).then(function (bm) {
          if (!bm.width || !bm.height) { if (bm.close) bm.close(); viaImage(); return; }
          resolve({ source: bm, w: bm.width, h: bm.height, close: function () { if (bm.close) bm.close(); } });
        }, viaImage);
      } else {
        viaImage();
      }
    });
  }

  function newCanvas(w, h) {
    var c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    var ctx = c.getContext('2d');
    ctx.fillStyle = '#fff';            // 透明な部分は白で塗る
    ctx.fillRect(0, 0, w, h);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    return { canvas: c, ctx: ctx };
  }

  function toJpeg(canvas) {
    return new Promise(function (resolve, reject) {
      canvas.toBlob(function (b) {
        if (b) resolve(b); else reject(new Error('JPEG を作れません'));
      }, 'image/jpeg', cfg.MY_JPEG_QUALITY);
    });
  }

  // 正方形の canvas を作る。source は w×h の絵。fit は 'crop'（切り抜く）か 'whole'（全体を入れる）
  // crop は 0〜1（長い方向の枠の位置。0.5 が真ん中）
  function drawSquare(source, w, h, crop, fit, size) {
    var cv = newCanvas(size, size), ctx = cv.ctx;
    if (fit === 'whole') {
      drawBlurBackground(ctx, source, w, h, size);
      // 前面: 絵全体を真ん中に収める
      var s = size / Math.max(w, h);
      var dw = w * s, dh = h * s;
      ctx.drawImage(source, 0, 0, w, h, (size - dw) / 2, (size - dh) / 2, dw, dh);
    } else {
      var side = Math.min(w, h);
      var c = Math.max(0, Math.min(1, crop));
      var sx = w > h ? (w - side) * c : 0;
      var sy = h > w ? (h - side) * c : 0;
      ctx.drawImage(source, sx, sy, side, side, 0, 0, size, size);
    }
    return cv.canvas;
  }

  // 「全体を入れる」の余白: 同じ絵を正方形いっぱいに広げ、強くぼかして少し明るくする
  function drawBlurBackground(ctx, source, w, h, size) {
    var blur = cfg.FIT_BLUR_PX * size / 1024;       // 大きさに合わせてぼかしも増減
    var bleed = blur * 3;                            // ぼかしで縁が透けないよう、枠より外まで広げて描く
    var s = (size + bleed * 2) / Math.min(w, h);
    var dw = w * s, dh = h * s;
    var dx = (size - dw) / 2, dy = (size - dh) / 2;
    if (typeof ctx.filter === 'string') {
      ctx.save();
      ctx.filter = 'blur(' + blur.toFixed(2) + 'px) brightness(' + cfg.FIT_BRIGHTNESS + ')';
      ctx.drawImage(source, 0, 0, w, h, dx, dy, dw, dh);
      ctx.restore();
    } else {
      // filter が使えない環境: いったん小さく描いて拡大するとぼけた絵になる
      var tiny = Math.max(4, Math.round(size / 24));
      var t = newCanvas(tiny, tiny);
      var ts = (tiny + 2) / Math.min(w, h);
      t.ctx.drawImage(source, 0, 0, w, h, (tiny - w * ts) / 2, (tiny - h * ts) / 2, w * ts, h * ts);
      ctx.drawImage(t.canvas, 0, 0, tiny, tiny, 0, 0, size, size);
      ctx.fillStyle = 'rgba(255,255,255,' + Math.max(0, (cfg.FIT_BRIGHTNESS - 1)).toFixed(2) + ')';
      ctx.fillRect(0, 0, size, size);
    }
  }

  // 縮小した元の絵（srcBlob）から正方形（full）とサムネイル（thumb）を作る。→ Promise<{ full, thumb }>
  function makeBlobs(srcBlob, crop, fit) {
    return decode(srcBlob).then(function (d) {
      var full, thumb;
      try {
        full = drawSquare(d.source, d.w, d.h, crop, fit, cfg.MY_FULL);
        thumb = drawSquare(d.source, d.w, d.h, crop, fit, cfg.MY_THUMB);
      } finally { d.close(); }
      return Promise.all([toJpeg(full), toJpeg(thumb)]);
    }).then(function (r) { return { full: r[0], thumb: r[1] }; });
  }

  // ファイル1枚 → 保存する1件（id と added 以外）。→ Promise<{ name, w, h, crop, fit, src, full, thumb }>
  function fromFile(file) {
    var w, h;
    return decode(file).then(function (d) {
      var k = Math.min(1, cfg.MY_SRC_MAX / Math.max(d.w, d.h));   // 長辺を MY_SRC_MAX までに縮める（拡大はしない）
      w = Math.max(1, Math.round(d.w * k));
      h = Math.max(1, Math.round(d.h * k));
      var cv = newCanvas(w, h);
      try { cv.ctx.drawImage(d.source, 0, 0, d.w, d.h, 0, 0, w, h); } finally { d.close(); }
      return toJpeg(cv.canvas);
    }).then(function (srcBlob) {
      return makeBlobs(srcBlob, 0.5, 'crop').then(function (b) {
        return { name: file.name || '', w: w, h: h, crop: 0.5, fit: 'crop', src: srcBlob, full: b.full, thumb: b.thumb };
      });
    });
  }

  SP.myimage = {
    fromFile: fromFile,
    // 切り抜き位置・向きを変えて作り直す（Step 6 の画面から使う）。→ Promise<{ full, thumb }>
    makeBlobs: makeBlobs,
    // 一覧で「小」を付ける絵か
    isSmall: function (rec) { return Math.min(rec.w, rec.h) < cfg.MY_SMALL_WARN; },
    newId: function () { return 'my-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8); }
  };
})();
