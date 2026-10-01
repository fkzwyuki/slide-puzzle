// config.js — 調整用の数字をここに集める（DESIGN.md §8）。名前空間は window.SP ひとつ。
window.SP = window.SP || {};
SP.config = {
  SIZES: [3, 4, 5, 6],                              // 選べるマス数
  DEFAULT_SIZE: 3,                                  // 初めて開いたときのマス数
  TOP_COUNT: 9,                                     // トップに並べる枚数
  SHUFFLE_MOVES: { 3: 30, 4: 80, 5: 150, 6: 250 },  // まぜる手数
  SHUFFLE_MAX_CORRECT_RATIO: 0.34,                  // まぜた後に正しい位置にあってよいピースの割合の上限
  SLIDE_MS: 120,                                    // ピースがすべる時間（ミリ秒）
  SWIPE_MIN_PX: 16,                                 // これ以上指が動いたらスワイプ（px）
  TILE_GAP: 3,                                      // ピースのすき間（px）
  HINT_MODE: 'hold',                                // おてほん: 'hold'=押しているあいだ / 'toggle'=タップで切り替え
  NUMBERS_DEFAULT: { 3: false, 4: false, 5: true, 6: true }, // すうじ表示の初期値
  SE_VOLUME: 0.8,                                   // 効果音の音量
  BGM_VOLUME: 0.35,                                 // BGM の音量
  BGM_DUCK: 0.3,                                    // 完成の音のあいだの BGM の音量（倍）
  SYNTH_MOVE: { FREQ_START: 620, FREQ_END: 330, MS: 90, GAIN: 0.6 }, // 音のファイルが無いときの移動音「ポッ」（周波数Hz・長さms・大きさ）
  SYNTH_CLEAR: { NOTES: [523, 659, 784, 1047], NOTE_MS: 150, GAIN: 0.5 }, // 音のファイルが無いときの完成の音（ドミソド・1音の間隔ms）
  SYNTH_CLEAR_MS: 1100,                             // 合成の完成の音の長さ（この間だけ BGM を下げる。ミリ秒）
  CLEAR_DELAY_MS: 300,                              // そろってから「できた！」の演出を始めるまで（ミリ秒）
  CONFETTI_COUNT: 60,                               // 紙ふぶきの数
  WAKE_LOCK: true,                                  // 遊んでいるあいだ画面を消さない
  SERVICE_WORKER: true,                             // ホーム画面に追加できるようにする
  ADULT_HOLD_MS: 800,                               // ⚙（え の せってい）を開く長押しの長さ（ミリ秒）
  MY_SRC_MAX: 1600,                                 // じぶんの え の元の絵の長辺（px）。切り抜き位置をあとで変えるために保存する
  MY_FULL: 1024,                                    // パズル用の正方形の大きさ（px）
  MY_THUMB: 320,                                    // サムネイルの大きさ（px）
  MY_JPEG_QUALITY: 0.88,                            // じぶんの え を保存するときの JPEG 品質（0〜1）
  MY_SMALL_WARN: 400,                               // 短辺がこれより小さい絵には「小」を付ける（px）
  FIT_BLUR_PX: 24,                                  // 「全体を入れる」の余白のぼかしの強さ（1024px の絵のとき。大きさに合わせて増減）
  FIT_BRIGHTNESS: 1.15,                             // 「全体を入れる」の余白の明るさ（1 = そのまま。少し明るくして見分けやすくする）
  HINT_PULSE_MS: 900,                               // ひんと: 光るふちがふくらむ・しぼむ周期（ミリ秒）
  HINT_ARROW_OPACITY: 0.85,                         // ひんと: 矢印の濃さ（0〜1）
  SOLVER_BUDGET_MS: 50,                             // 次の1手の計算にかけてよい時間の目安（ミリ秒。確認用。超えたらコンソールに警告）
  MY_DB_TIMEOUT_MS: 3000                            // 絵の保存場所（IndexedDB）が開くのを待つ長さ。超えたら「使えない」とみなす（ミリ秒）
};
