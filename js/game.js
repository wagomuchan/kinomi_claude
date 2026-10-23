// 木の実をあげよう — ゲーム本体
import { Crayon, applyGrain, grainPattern, INK } from './crayon.js';
import * as Art from './art.js';
import { Sound } from './sound.js';
import { load, save } from './storage.js';

/* ================= 難しさの調整はここ ================= */
const DIFFICULTY = {
  // 待てる時間は、1個あげるごとに少しずつ短くなる（下限なし）。
  // 縮む割合は最初 shrinkRate で、あげた数が easeAfter に届くころ半分になり、だんだんゆるやかになる。
  // lateFrom をこえると、縮み方がさらにゆるやかになっていく（つなぎ目でガクッと変わらないようにしてある）。
  // 0個:6.0秒 → 60個:2.6秒 → 100個:1.6秒 → 130個:1.1秒 → 200個:0.64秒 → 300個:0.41秒 → 400個:0.31秒
  startPatience: 6.0,   // 最初のどうぶつが待ってくれる秒数
  shrinkRate: 0.0156,   // 最初のころ、1個ごとに縮む割合（大きいほど早く難しくなる）
  easeAfter: 300,       // 縮む割合が半分になる個数（大きいほど後半もきびしいまま）
  lateFrom: 130,        // ここから先は、縮み方をさらにゆるめる
  lateEaseAfter: 80,    // lateFrom からこの個数あげると、縮む割合が半分になる（小さいほどゆるやか）
  randomness: 0.1,      // 待てる時間のばらつき（±10%）
  // あげた数がこの数をこえると、同時に来るどうぶつが増える
  crowd: [[0, 1], [5, 2], [15, 3]],
  spawnDelay: [0.5, 1.3], // つぎのどうぶつが来るまでの秒数
};
const LIVES = 3;
const SKIP_AT = 100;   // 一度この数までいくと、つぎからこの数から始められる
/* ===================================================== */

// URLに ?debug を付けたときだけ、好きな個数から始められる（タイトル画面に入力欄が出る）
const DEBUG = new URLSearchParams(location.search).has('debug');

const W = 400;
const SLOT_X = [72, 200, 328];
const ARRIVE_TIME = 0.35;
const HAPPY_TIME = 0.9;
const SAD_TIME = 1.1;
const FONT = '"Yomogi", "Hiragino Maru Gothic ProN", "BIZ UDPGothic", sans-serif';

const stage = document.getElementById('stage');
const canvas = document.getElementById('cv');
const ctx = canvas.getContext('2d');
const sound = new Sound();

let H = 700;       // 画面の縦の長さ（論理座標）。スマホの縦横比に合わせて変わる
let scale = 1;     // 論理座標 → CSSピクセル
let L = null;      // レイアウト
let sprites = null;
let bg = null;
let pattern = null;

const S = {
  mode: 'title', // title | play | over
  paused: false,
  time: 0,
  score: 0,
  lives: LIVES,
  combo: 0,
  best: Number(load('kinomi.best', '0')) || 0,
  skipUnlocked: false,
  justUnlocked: false,
  slots: [null, null, null],
  spawnTimer: 0,
  overTimer: 0,
  held: null,
  flying: [],
  particles: [],
  texts: [],
  spots: [],
};

/* ---------------- レイアウトと絵の準備 ---------------- */

function computeLayout() {
  const cy = 190 + Math.max(0, H - 660) * 0.5;
  const feetY = H - 22;
  return {
    cy,
    groundY: H - 128,
    feetY,
    animalY: feetY - 60,          // どうぶつ画像の中心
    bubbleY: feetY - 120 - 40,    // 吹き出しの中心
    gaugeY: feetY - 120 - 92,     // ゲージの上端
  };
}

function makeSprite(w, h, k, seed, draw) {
  const c = document.createElement('canvas');
  c.width = Math.ceil(w * k);
  c.height = Math.ceil(h * k);
  const g = c.getContext('2d');
  g.scale(k, k);
  draw(new Crayon(g, seed));
  applyGrain(g, w, h, seed);
  return { canvas: c, w, h };
}

// 3パターンずつ描いておき、順番に切り替えて線がゆらゆら動いて見えるようにする
function variants(w, h, k, seed, draw) {
  return [0, 1, 2].map(i => makeSprite(w, h, k, seed * 10 + i, draw));
}

function buildArt() {
  const k = Math.min(3, scale * (window.devicePixelRatio || 1));
  const [aw, ah] = Art.SIZE.animal;
  const [fw, fh] = Art.SIZE.fruit;
  sprites = { animal: {}, fruit: {} };
  Art.ANIMALS.forEach((a, ai) => {
    sprites.animal[a] = {};
    ['normal', 'happy', 'sad'].forEach((expr, ei) => {
      sprites.animal[a][expr] = variants(aw, ah, k, 100 + ai * 7 + ei, cr => Art.drawAnimal(cr, a, expr));
    });
  });
  Art.FRUITS.forEach((f, fi) => {
    sprites.fruit[f] = variants(fw, fh, k, 300 + fi, cr => Art.drawFruit(cr, f));
  });
  sprites.bubble = variants(...Art.SIZE.bubble, k, 400, cr => Art.drawBubble(cr));
  sprites.heart = makeSprite(...Art.SIZE.heart, k, 500, cr => Art.drawHeart(cr));
  sprites.heartEmpty = makeSprite(...Art.SIZE.heart, k, 501, cr => Art.drawHeart(cr, true));
  sprites.cross = makeSprite(...Art.SIZE.cross, k, 502, cr => Art.drawCross(cr));
  sprites.tear = makeSprite(...Art.SIZE.tear, k, 503, cr => Art.drawTear(cr));
  sprites.sparkle = makeSprite(...Art.SIZE.sparkle, k, 504, cr => Art.drawSparkle(cr));

  bg = makeSprite(W, H, Math.min(3, scale * (window.devicePixelRatio || 1)), 1, cr => Art.drawBackground(cr, W, H, L));

  S.spots = Art.FRUIT_SPOTS.map(([type, x, dy], i) => ({
    type, x, y: L.cy + dy, i, grow: S.spots[i]?.grow ?? 1,
  }));

  drawTitleArt();
}

function resize() {
  const vw = Math.min(window.innerWidth, 480);
  const vh = window.innerHeight;
  H = Math.round(Math.min(900, Math.max(660, (W * vh) / vw)));
  scale = Math.min(vw / W, vh / H);
  const cssW = W * scale, cssH = H * scale;
  stage.style.width = `${cssW}px`;
  stage.style.height = `${cssH}px`;
  stage.style.setProperty('--u', `${scale}px`);
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  L = computeLayout();
  buildArt();
  pattern = grainPattern(ctx);
}

/* ---------------- ゲームの進行 ---------------- */

function basePatience(score) {
  const d = DIFFICULTY;
  const early = n => d.startPatience * Math.pow(1 + n / d.easeAfter, -d.shrinkRate * d.easeAfter);
  if (score <= d.lateFrom) return early(score);
  // lateFrom での縮む割合から始めて、そこから先はより早く割合が下がっていく
  const rate = (d.shrinkRate * d.easeAfter) / (d.easeAfter + d.lateFrom);
  return early(d.lateFrom) * Math.pow(1 + (score - d.lateFrom) / d.lateEaseAfter, -rate * d.lateEaseAfter);
}

function patienceFor(score) {
  return basePatience(score) * (1 + (Math.random() * 2 - 1) * DIFFICULTY.randomness);
}

function crowdFor(score) {
  let n = 1;
  for (const [s, c] of DIFFICULTY.crowd) if (score >= s) n = c;
  return n;
}

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function spawn() {
  const empty = S.slots.map((c, i) => (c ? -1 : i)).filter(i => i >= 0);
  if (!empty.length) return;
  const slot = pick(empty);
  const present = S.slots.filter(Boolean).map(c => c.animal);
  const animals = Art.ANIMALS.filter(a => !present.includes(a));
  const patience = patienceFor(S.score);
  S.slots[slot] = {
    slot,
    animal: pick(animals),
    want: pick(Art.FRUITS),
    state: 'in',
    t: 0,
    patience,
    left: patience,
    shake: 0,
    flash: 0,
    phase: Math.random() * 10,
  };
}

function debugStartScore() {
  if (!DEBUG) return 0;
  const n = parseInt(document.getElementById('debugStartInput').value, 10);
  return Number.isFinite(n) ? Math.max(0, Math.min(9999, n)) : 0;
}

// from: 何個から始めるか（「100こから はじめる」ボタンのとき）。省略するとデバッグ入力か0
function startGame(from = null) {
  sound.unlock();
  const startScore = from ?? debugStartScore();
  Object.assign(S, {
    mode: 'play', paused: false, score: startScore, lives: LIVES, combo: 0,
    debugRun: from === null && startScore > 0,
    justUnlocked: false,
    slots: [null, null, null], spawnTimer: 0.6, overTimer: 0,
    held: null, flying: [], particles: [], texts: [],
  });
  for (const sp of S.spots) sp.grow = 1;
  show(null);
  sound.start();
}

function endGame() {
  S.mode = 'over';
  const isBest = !S.debugRun && S.score > S.best;
  if (isBest) {
    S.best = S.score;
    save('kinomi.best', String(S.best));
  }
  sound.gameOver(isBest && S.score > 0);
  document.getElementById('resultScore').textContent = S.score;
  document.getElementById('resultBest').textContent = S.best;
  document.getElementById('newBest').hidden = !(isBest && S.score > 0);
  document.getElementById('unlockMsg').hidden = !S.justUnlocked;
  updateTitleBest();
  show('result');
}

function feed(c, type, x, y) {
  if (c.want === type) {
    c.state = 'happy';
    c.t = 0;
    S.score++;
    S.combo++;
    if (!S.debugRun && !S.skipUnlocked && S.score >= SKIP_AT) {
      S.skipUnlocked = true;
      S.justUnlocked = true;
      save('kinomi.skip100', '1');
      S.texts.push({ text: `${SKIP_AT}こ たっせい！`, x: W / 2, y: L.cy + 160, t: 0, dur: 2.2, color: '#d98a1a', size: 34 });
    }
    sound.correct(S.combo);
    S.flying.push({ type, x0: x, y0: y, x1: SLOT_X[c.slot], y1: L.animalY, t: 0, dur: 0.14, kind: 'eat' });
    for (let i = 0; i < 6; i++) {
      S.particles.push({
        sprite: i % 2 ? sprites.heart : sprites.sparkle,
        x: SLOT_X[c.slot] + (Math.random() * 60 - 30), y: L.animalY - 20,
        vx: Math.random() * 60 - 30, vy: -60 - Math.random() * 60,
        life: 0, max: 0.9, size: 0.55 + Math.random() * 0.3,
      });
    }
    S.texts.push({ text: '+1', x: SLOT_X[c.slot], y: L.animalY - 70, t: 0, dur: 0.8, color: '#e0603c', size: 30 });
  } else {
    // 違う木の実：受け取らない。気づけるように、首をふって吹き出しを光らせる
    c.shake = 0.45;
    c.flash = 0.9;
    sound.wrong();
    S.texts.push({ text: 'ちがうよ', x: SLOT_X[c.slot], y: L.gaugeY - 16, t: 0, dur: 0.9, color: '#c24a3a', size: 22 });
    S.texts.push({ sprite: sprites.cross, x, y: y - 6, t: 0, dur: 0.5 });
    returnFruit(type, x, y);
  }
}

function returnFruit(type, x, y) {
  const spot = S.spots.find(s => s.type === type && s.grow >= 1) || S.spots.find(s => s.type === type);
  S.flying.push({ type, x0: x, y0: y, x1: spot.x, y1: spot.y, t: 0, dur: 0.35, kind: 'return' });
}

function miss(c) {
  c.state = 'sad';
  c.t = 0;
  S.lives--;
  S.combo = 0;
  sound.miss();
  if (navigator.vibrate) {
    try { navigator.vibrate(60); } catch { /* 振動できない端末は無視 */ }
  }
  if (S.lives <= 0) S.overTimer = 1.1;
}

function update(dt) {
  S.time += dt;

  if (S.mode === 'play' && !S.paused) {
    // どうぶつを呼ぶ
    const count = S.slots.filter(Boolean).length;
    if (S.lives > 0) {
      S.spawnTimer -= dt;
      if (count < crowdFor(S.score) && S.spawnTimer <= 0) {
        spawn();
        const [a, b] = DIFFICULTY.spawnDelay;
        S.spawnTimer = a + Math.random() * (b - a);
      }
      // だれもいないときは待たせない
      if (count === 0 && S.spawnTimer > 0.4) S.spawnTimer = 0.4;
    }

    for (const c of S.slots) {
      if (!c) continue;
      c.t += dt;
      c.shake = Math.max(0, c.shake - dt);
      c.flash = Math.max(0, c.flash - dt);
      if (c.state === 'in' && c.t >= ARRIVE_TIME) { c.state = 'wait'; c.t = 0; }
      if (c.state === 'wait' && S.lives > 0) {
        c.left -= dt;
        if (c.left <= 0) { c.left = 0; miss(c); }
      }
      if ((c.state === 'happy' && c.t >= HAPPY_TIME) || (c.state === 'sad' && c.t >= SAD_TIME)) {
        S.slots[c.slot] = null;
      }
    }

    if (S.overTimer > 0) {
      S.overTimer -= dt;
      if (S.overTimer <= 0) endGame();
    }
  }

  if (S.paused) return;

  for (const sp of S.spots) sp.grow = Math.min(1, sp.grow + dt / 0.3);
  for (const f of S.flying) f.t += dt;
  S.flying = S.flying.filter(f => f.t < f.dur);
  for (const p of S.particles) {
    p.life += dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 40 * dt;
  }
  S.particles = S.particles.filter(p => p.life < p.max);
  for (const t of S.texts) t.t += dt;
  S.texts = S.texts.filter(t => t.t < t.dur);

  if (S.held) S.held.lift += (S.held.liftTo - S.held.lift) * Math.min(1, dt * 18);
}

/* ---------------- 操作 ---------------- */

function toLogical(e) {
  const r = canvas.getBoundingClientRect();
  return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
}

function heldPos() {
  return { x: S.held.x, y: S.held.y + S.held.lift };
}

function findTarget(x, y) {
  let best = null, bd = Infinity;
  for (const c of S.slots) {
    if (!c || (c.state !== 'in' && c.state !== 'wait')) continue;
    const dx = Math.abs(x - SLOT_X[c.slot]);
    if (dx < 64 && y > L.gaugeY - 24 && dx < bd) { best = c; bd = dx; }
  }
  return best;
}

canvas.addEventListener('pointerdown', e => {
  if (S.mode !== 'play' || S.paused || S.held) return;
  sound.unlock();
  const p = toLogical(e);
  let best = null, bd = 38;
  for (const sp of S.spots) {
    const d = Math.hypot(p.x - sp.x, p.y - (sp.y + 4));
    if (d < bd && sp.grow > 0.6) { best = sp; bd = d; }
  }
  if (!best) return;
  e.preventDefault();
  canvas.setPointerCapture(e.pointerId);
  // 指で隠れないように、タッチのときは木の実を指の少し上に持つ
  S.held = { type: best.type, x: p.x, y: p.y, id: e.pointerId, lift: 0, liftTo: e.pointerType === 'mouse' ? 0 : -46 };
  best.grow = 0;
  sound.pick();
});

canvas.addEventListener('pointermove', e => {
  if (!S.held || e.pointerId !== S.held.id) return;
  const p = toLogical(e);
  S.held.x = p.x;
  S.held.y = p.y;
});

function release(e, cancel) {
  if (!S.held || e.pointerId !== S.held.id) return;
  const { x, y } = heldPos();
  const type = S.held.type;
  S.held = null;
  const target = cancel || S.mode !== 'play' ? null : findTarget(x, y);
  if (target) feed(target, type, x, y);
  else returnFruit(type, x, y);
}

canvas.addEventListener('pointerup', e => release(e, false));
canvas.addEventListener('pointercancel', e => release(e, true));

/* ---------------- 描画 ---------------- */

function drawSprite(s, x, y, k = 1, rot = 0, alpha = 1) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  if (rot) ctx.rotate(rot);
  ctx.drawImage(s.canvas, (-s.w / 2) * k, (-s.h / 2) * k, s.w * k, s.h * k);
  ctx.restore();
}

function frame(list, offset = 0) {
  const i = Math.floor(S.time * 5 + offset) % list.length;
  return list[i < 0 ? i + list.length : i];
}

const easeOutBack = t => 1 + 2.7 * Math.pow(t - 1, 3) + 1.7 * Math.pow(t - 1, 2);

function drawCustomer(c, target) {
  const x0 = SLOT_X[c.slot];
  let x = x0, y = L.animalY, k = 1, alpha = 1, expr = 'normal';

  if (c.state === 'in') {
    const p = Math.min(1, c.t / ARRIVE_TIME);
    k = 0.4 + 0.6 * easeOutBack(p);
    y += (1 - p) * 30;
    alpha = p;
  } else if (c.state === 'wait') {
    y += Math.sin(S.time * 3 + c.phase) * 1.5;
    if (c.left / c.patience < 0.3) x += Math.sin(S.time * 42) * 1.3;
  } else if (c.state === 'happy') {
    expr = 'happy';
    const p = c.t / HAPPY_TIME;
    y -= Math.abs(Math.sin(c.t * 10)) * 14 * (1 - p);
    if (p > 0.6) { y -= (p - 0.6) * 80; alpha = 1 - (p - 0.6) / 0.4; }
  } else if (c.state === 'sad') {
    expr = 'sad';
    const p = c.t / SAD_TIME;
    y += p * 14;
    if (p > 0.5) alpha = 1 - (p - 0.5) / 0.5;
  }
  if (c.shake > 0) x += Math.sin(c.shake * 55) * 7 * (c.shake / 0.45);

  // 持っている木の実が上に来たら、足もとを光らせる
  if (target === c) {
    ctx.save();
    ctx.globalAlpha = 0.45 + Math.sin(S.time * 10) * 0.15;
    ctx.fillStyle = '#fff3a0';
    ctx.beginPath();
    ctx.ellipse(x0, L.feetY - 4, 54, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  const spr = frame(sprites.animal[c.animal][expr], c.phase);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y + 60);
  ctx.scale(1, k);
  ctx.drawImage(spr.canvas, -60, -120, 120, 120);
  ctx.restore();

  if (c.state === 'in' || c.state === 'wait') drawWant(c, alpha, target === c);
}

function drawWant(c, alpha, hover) {
  const bx = SLOT_X[c.slot];
  const by = L.bubbleY;
  let k = hover ? 1.08 : 1;
  const frac = c.left / c.patience;
  const hurry = c.state === 'wait' && frac < 0.3;
  if (hurry) k *= 1 + Math.sin(S.time * 14) * 0.04;
  if (c.flash > 0) k *= 1 + Math.sin(c.flash * 22) * 0.12 * (c.flash / 0.9);

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(bx, by);
  ctx.scale(k, k);
  const b = frame(sprites.bubble, c.phase);
  ctx.drawImage(b.canvas, -48, -38, 96, 86);
  // 違う木の実をあげたときは、ほしい木の実を赤い丸でかこんで目立たせる
  if (c.flash > 0) {
    ctx.save();
    ctx.globalAlpha = alpha * Math.min(1, c.flash * 3) * (0.8 + 0.2 * Math.sin(S.time * 20));
    ctx.strokeStyle = '#e0473c';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.ellipse(0, 0, 30, 28, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  const f = frame(sprites.fruit[c.want], c.phase);
  ctx.drawImage(f.canvas, -24, -26, 48, 48);
  ctx.restore();

  // まてる時間ゲージ
  if (c.state === 'wait' || c.state === 'in') {
    const gw = 70, gh = 11, gx = bx - gw / 2, gy = L.gaugeY;
    const color = frac > 0.5 ? '#7cc35a' : frac > 0.25 ? '#f2c14e' : '#e85d4a';
    ctx.save();
    ctx.globalAlpha = alpha;
    roundRect(gx, gy, gw, gh, 5);
    ctx.fillStyle = '#fffaf0';
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = color;
    ctx.fillRect(gx, gy, gw * frac, gh);
    ctx.fillStyle = pattern;
    ctx.globalAlpha = alpha * 0.6;
    ctx.fillRect(gx, gy, gw * frac, gh);
    ctx.restore();
    roundRect(gx, gy, gw, gh, 5);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.4;
    ctx.stroke();
    ctx.restore();
  }
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawHud() {
  for (let i = 0; i < LIVES; i++) {
    drawSprite(i < S.lives ? sprites.heart : sprites.heartEmpty, 26 + i * 32, 30, 1);
  }
  ctx.save();
  ctx.font = `34px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#fffaf0';
  ctx.lineJoin = 'round';
  ctx.strokeText(String(S.score), W / 2, 32);
  ctx.fillStyle = INK;
  ctx.fillText(String(S.score), W / 2, 32);
  if (DEBUG) {
    const text = `まてる ${basePatience(S.score).toFixed(2)}秒`;
    ctx.font = `16px ${FONT}`;
    ctx.lineWidth = 4;
    ctx.strokeText(text, W / 2, 62);
    ctx.fillStyle = '#c24a3a';
    ctx.fillText(text, W / 2, 62);
  }
  ctx.restore();
}

function render() {
  const dpr = window.devicePixelRatio || 1;
  ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
  ctx.drawImage(bg.canvas, 0, 0, W, H);

  // 木の実（ゆらゆら）
  for (const sp of S.spots) {
    const g = sp.grow;
    const k = g < 1 ? easeOutBack(g) : 1;
    const f = frame(sprites.fruit[sp.type], sp.i * 0.7);
    ctx.save();
    ctx.translate(sp.x, sp.y - 22);
    ctx.rotate(Math.sin(S.time * 1.6 + sp.i) * 0.06);
    ctx.scale(k, k);
    ctx.drawImage(f.canvas, -28, -6, 56, 56);
    ctx.restore();
  }

  const hp = S.held ? heldPos() : null;
  const target = hp && S.mode === 'play' ? findTarget(hp.x, hp.y) : null;

  for (const c of S.slots) if (c) drawCustomer(c, target);

  for (const f of S.flying) {
    const p = Math.min(1, f.t / f.dur);
    const e = 1 - Math.pow(1 - p, 3);
    const x = f.x0 + (f.x1 - f.x0) * e;
    const y = f.y0 + (f.y1 - f.y0) * e - (f.kind === 'return' ? Math.sin(p * Math.PI) * 30 : 0);
    const k = f.kind === 'eat' ? 1 - p * 0.8 : 1 - p * 0.2;
    drawSprite(sprites.fruit[f.type][0], x, y, k, 0, f.kind === 'return' ? 1 - p * 0.3 : 1);
  }

  for (const p of S.particles) {
    drawSprite(p.sprite, p.x, p.y, p.size, 0, 1 - p.life / p.max);
  }

  for (const t of S.texts) {
    const p = t.t / t.dur;
    if (t.sprite) {
      drawSprite(t.sprite, t.x, t.y, 0.8 + 0.3 * Math.min(1, p * 4), 0, 1 - Math.max(0, p - 0.5) * 2);
      continue;
    }
    ctx.save();
    ctx.globalAlpha = 1 - Math.max(0, p - 0.6) / 0.4;
    ctx.font = `${t.size}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#fffaf0';
    const y = t.y - p * 26;
    ctx.strokeText(t.text, t.x, y);
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, t.x, y);
    ctx.restore();
  }

  if (hp) {
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.ellipse(hp.x + 4, hp.y + 26, 18, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    drawSprite(frame(sprites.fruit[S.held.type]), hp.x, hp.y, 1.18);
  }

  if (S.mode !== 'title') drawHud();
}

let last = performance.now();
function loop(now) {
  // 最初のフレームは now が last より少し前になることがあるので、マイナスにしない
  const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
  last = now;
  update(dt);
  render();
  requestAnimationFrame(loop);
}

/* ---------------- 画面（タイトル・結果・一時停止） ---------------- */

const screens = {
  title: document.getElementById('titleScreen'),
  result: document.getElementById('resultScreen'),
  pause: document.getElementById('pauseScreen'),
};

function show(name) {
  for (const [k, el] of Object.entries(screens)) el.hidden = k !== name;
}

function updateTitleBest() {
  document.getElementById('titleBest').textContent = S.best;
  document.getElementById('skipBtn').hidden = !S.skipUnlocked;
  document.getElementById('retrySkipBtn').hidden = !S.skipUnlocked;
}

function drawTitleArt() {
  const c = document.getElementById('titleArt');
  const dpr = window.devicePixelRatio || 1;
  const w = 270, h = 96;
  c.width = Math.round(w * dpr);
  c.height = Math.round(h * dpr);
  const g = c.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, w, h);
  const items = [['rabbit', 'happy'], ['squirrel', 'normal'], ['bear', 'happy']];
  items.forEach(([a, e], i) => g.drawImage(sprites.animal[a][e][0].canvas, 10 + i * 88, 6, 84, 84));
  g.drawImage(sprites.fruit.apple[0].canvas, 66, 4, 34, 34);
  g.drawImage(sprites.fruit.grape[0].canvas, 160, 0, 34, 34);
}

const soundBtn = document.getElementById('soundBtn');
function updateSoundBtn() {
  soundBtn.classList.toggle('off', !sound.enabled);
  soundBtn.setAttribute('aria-label', sound.enabled ? '音を消す' : '音を出す');
}
soundBtn.addEventListener('click', () => {
  sound.unlock();
  sound.toggle();
  updateSoundBtn();
});

document.getElementById('startBtn').addEventListener('click', () => startGame());
document.getElementById('retryBtn').addEventListener('click', () => startGame());
document.getElementById('skipBtn').addEventListener('click', () => startGame(SKIP_AT));
document.getElementById('retrySkipBtn').addEventListener('click', () => startGame(SKIP_AT));
document.getElementById('toTitleBtn').addEventListener('click', () => {
  S.mode = 'title';
  S.slots = [null, null, null];
  show('title');
});
document.getElementById('resumeBtn').addEventListener('click', () => {
  sound.unlock();
  S.paused = false;
  show(null);
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden && S.mode === 'play' && !S.paused && S.lives > 0) {
    S.paused = true;
    if (S.held) {
      returnFruit(S.held.type, S.held.x, S.held.y);
      S.held = null;
    }
    show('pause');
  }
});

let resizeTimer = 0;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(resize, 150);
});

async function init() {
  // 手書き風フォントの読み込みを少しだけ待つ（遅ければ待たずに始める）
  try {
    await Promise.race([
      document.fonts.load(`20px "Yomogi"`),
      new Promise(r => setTimeout(r, 1500)),
    ]);
  } catch { /* フォントが使えなくても遊べる */ }
  S.skipUnlocked = load('kinomi.skip100', '0') === '1' || S.best >= SKIP_AT;
  resize();
  updateTitleBest();
  updateSoundBtn();
  document.getElementById('debugStart').hidden = !DEBUG;
  show('title');
  document.body.classList.add('ready');
  requestAnimationFrame(loop);
}

// 動作確認用（URLに ?debug を付けたときだけ）
if (DEBUG) window.__kinomi = { S, L: () => L, SLOT_X, H: () => H };

init();
