// sound.js — 効果音と BGM（DESIGN.md §7）。
// se/move* se/clear* があればそれをランダムに鳴らし、無ければ Web Audio の合成音を鳴らす。
// BGM は最初のタップで始め、画面が隠れたら止め、完成の音のあいだは音量を下げる。
// SP.sound.last に「最後に鳴らしたもの」（ファイルのパス、または 'synth-move' / 'synth-clear'）が入る（確認用）。
window.SP = window.SP || {};

SP.sound = (function () {
  var cfg = SP.config;
  var assets = window.SP_ASSETS || {};
  var ctx = null;          // Web Audio
  var bgm = null;          // BGM の Audio 要素
  var bgmStarted = false;  // 一度でも鳴らし始められたか
  var duckTimer = 0;       // 音量を戻すタイマー
  var api = { last: '' };

  function pick(list) { return list[Math.floor(Math.random() * list.length)]; }
  function list(name) { return assets[name] || []; }

  // ---------- Web Audio（合成音） ----------
  function audioCtx() {
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try { ctx = new AC(); } catch (e) { return null; }
    }
    if (ctx.state === 'suspended' && ctx.resume) ctx.resume();
    return ctx;
  }

  // 1つの音（周波数 f0 → f1、長さ ms、type は波形）を t 秒後に鳴らす
  function tone(c, f0, f1, ms, type, vol, delay) {
    var t0 = c.currentTime + (delay || 0), t1 = t0 + ms / 1000;
    var o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t0);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t1);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t1);
    o.connect(g); g.connect(c.destination);
    o.start(t0); o.stop(t1 + 0.02);
  }

  function synthMove() {
    api.last = 'synth-move';
    var c = audioCtx(); if (!c) return;
    var s = cfg.SYNTH_MOVE;
    tone(c, s.FREQ_START, s.FREQ_END, s.MS, 'sine', cfg.SE_VOLUME * s.GAIN, 0);
  }

  function synthClear() {
    api.last = 'synth-clear';
    var c = audioCtx();
    duck(cfg.SYNTH_CLEAR_MS);
    if (!c) return;
    var s = cfg.SYNTH_CLEAR;
    s.NOTES.forEach(function (f, i) {
      tone(c, f, f, s.NOTE_MS * (i === s.NOTES.length - 1 ? 3 : 1.4), 'triangle', cfg.SE_VOLUME * s.GAIN, i * s.NOTE_MS / 1000);
    });
  }

  // ---------- ファイルの効果音 ----------
  function playFile(src, onFail, onEnd) {
    var a = new Audio(src);   // 鳴らすたびに作るので、続けて鳴らしても切れない
    a.volume = Math.min(1, cfg.SE_VOLUME);
    if (onEnd) { a.addEventListener('ended', onEnd); a.addEventListener('error', onEnd); }
    var p;
    try { p = a.play(); } catch (e) { onFail(); return; }
    if (p && p.catch) p.catch(onFail);
  }

  api.move = function () {
    if (!SP.storage.getSound()) return;
    var l = list('move');
    if (!l.length) { synthMove(); return; }
    var f = pick(l);
    api.last = f;
    playFile(f, synthMove);
  };

  api.clear = function () {
    if (!SP.storage.getSound()) return;
    var l = list('clear');
    if (!l.length) { synthClear(); return; }
    var f = pick(l);
    api.last = f;
    duck(10000);   // ended で戻す。戻らなかったときの保険の長さ
    playFile(f, synthClear, unduck);
  };

  // ---------- BGM ----------
  function bgmVolume(duck) { return Math.min(1, cfg.BGM_VOLUME * (duck ? cfg.BGM_DUCK : 1)); }

  // 完成の音のあいだ BGM を下げる。ms 後に戻す
  function duck(ms) {
    if (bgm) bgm.volume = bgmVolume(true);
    clearTimeout(duckTimer);
    duckTimer = setTimeout(unduck, ms);
  }
  function unduck() {
    clearTimeout(duckTimer);
    if (bgm) bgm.volume = bgmVolume(false);
  }

  function bgmWanted() {
    return list('bgm').length > 0 && SP.storage.getBgm() && document.visibilityState !== 'hidden';
  }

  // BGM をオン/オフの設定と画面の見え方に合わせて、鳴らす・止める
  function applyBgm() {
    if (!list('bgm').length) return;
    if (!bgmWanted()) { if (bgm) bgm.pause(); return; }
    if (!bgm) {
      var f = pick(list('bgm'));
      bgm = new Audio(f);
      bgm.loop = true;
      bgm.volume = bgmVolume(false);
      api.bgmFile = f;
    }
    if (bgm.paused) {
      var p = bgm.play();
      if (p && p.then) p.then(function () { bgmStarted = true; }, function () { /* 最初のタップまで待つ */ });
      else bgmStarted = true;
    }
  }
  api.applyBgm = applyBgm;

  // 最初のタップで BGM を始める（ブラウザの自動再生の制限）。合成音のための AudioContext もここで起こす
  function onFirstTap() {
    audioCtx();
    if (!bgmStarted) applyBgm();
    else document.removeEventListener('pointerdown', onFirstTap, true);
  }
  document.addEventListener('pointerdown', onFirstTap, true);

  // 画面が隠れたら一時停止、戻ったら再開
  document.addEventListener('visibilitychange', function () {
    if (!bgmStarted && !bgm) return;
    applyBgm();
  });

  // 確認用: BGM の状態
  api.bgmState = function () {
    return bgm ? { file: api.bgmFile, paused: bgm.paused, volume: bgm.volume, loop: bgm.loop } : null;
  };
  return api;
})();
