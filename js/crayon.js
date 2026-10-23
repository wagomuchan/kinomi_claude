// クレヨン風の描画ヘルパー
// 線をすこしガタつかせ、塗りに斜線のムラと紙の粒を足して、手描きっぽく見せる。

export const INK = '#4a3326';

// 乱数を固定するための簡単なシード付き乱数
export function makeRng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 色を明るく(amt > 0)・暗く(amt < 0)する
export function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const target = amt < 0 ? 0 : 255;
  const k = Math.abs(amt);
  r = Math.round(r + (target - r) * k);
  g = Math.round(g + (target - g) * k);
  b = Math.round(b + (target - b) * k);
  return `rgb(${r},${g},${b})`;
}

function bbox(pts) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) {
    if (x < x0) x0 = x;
    if (y < y0) y0 = y;
    if (x > x1) x1 = x;
    if (y > y1) y1 = y;
  }
  return { x0, y0, x1, y1 };
}

export class Crayon {
  constructor(ctx, seed) {
    this.ctx = ctx;
    this.r = makeRng(seed);
  }

  rand(a = 0, b = 1) { return a + (b - a) * this.r(); }
  jit(v) { return (this.r() * 2 - 1) * v; }

  // 楕円の輪郭点（すこし歪ませる）
  ellipsePts(cx, cy, rx, ry, rot = 0, wobble = 0.035) {
    const n = Math.max(10, Math.min(40, Math.round((rx + ry) * 0.4)));
    const pts = [];
    const start = this.rand(0, Math.PI * 2);
    const cos = Math.cos(rot), sin = Math.sin(rot);
    for (let i = 0; i < n; i++) {
      const a = start + (i / n) * Math.PI * 2;
      const k = 1 + this.jit(wobble);
      const x = Math.cos(a) * rx * k, y = Math.sin(a) * ry * k;
      pts.push([cx + x * cos - y * sin, cy + x * sin + y * cos]);
    }
    return pts;
  }

  // 点列をなめらかな曲線でなぞる
  trace(pts, closed = true) {
    const c = this.ctx;
    c.beginPath();
    const n = pts.length;
    if (!closed) {
      c.moveTo(pts[0][0], pts[0][1]);
      if (n === 2) { c.lineTo(pts[1][0], pts[1][1]); return; }
      for (let i = 1; i < n - 1; i++) {
        const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
        c.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
      }
      c.lineTo(pts[n - 1][0], pts[n - 1][1]);
      return;
    }
    const last = pts[n - 1];
    c.moveTo((last[0] + pts[0][0]) / 2, (last[1] + pts[0][1]) / 2);
    for (let i = 0; i < n; i++) {
      const p = pts[i], q = pts[(i + 1) % n];
      c.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
    }
    c.closePath();
  }

  // 塗り＋斜線ムラ＋輪郭
  shape(pts, o = {}) {
    const c = this.ctx;
    if (o.fill) {
      c.save();
      this.trace(pts, true);
      c.fillStyle = o.fill;
      c.globalAlpha = o.alpha ?? 1;
      c.fill();
      if (o.hatch !== false) {
        c.clip();
        c.globalAlpha = 1;
        this.hatchBox(bbox(pts), o.hatchColor || shade(o.fill, -0.2), o.hatchGap || 4.5, o.hatchAlpha ?? 1);
      }
      c.restore();
    }
    if (o.stroke !== null) this.stroke(pts, o.stroke || INK, o.lw || 2.6, o.closed !== false);
  }

  ellipse(cx, cy, rx, ry, o = {}) {
    this.shape(this.ellipsePts(cx, cy, rx, ry, o.rot || 0, o.wobble), o);
  }

  // 塗りだけの小さな丸（ほっぺ・目など）
  dot(x, y, r, color) {
    this.shape(this.ellipsePts(x, y, r, r, 0, 0.06), { fill: color, hatch: false, stroke: null });
  }

  // クレヨンの線（2回重ねてかすれ感を出す）
  stroke(pts, color = INK, lw = 2.6, closed = false) {
    const c = this.ctx;
    c.save();
    c.strokeStyle = color;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    for (let pass = 0; pass < 2; pass++) {
      const j = lw * 0.3;
      const jp = pts.map(p => [p[0] + this.jit(j), p[1] + this.jit(j)]);
      c.globalAlpha = pass ? 0.5 : 0.92;
      c.lineWidth = pass ? lw * 0.55 : lw;
      this.trace(jp, closed);
      c.stroke();
    }
    c.restore();
  }

  // 斜めのぬりムラ
  hatchBox(b, color, gap, alphaScale = 1) {
    const c = this.ctx;
    c.save();
    c.strokeStyle = color;
    c.lineCap = 'round';
    const ang = this.rand(-1.0, -0.6);
    const dx = Math.cos(ang), dy = Math.sin(ang);
    const px = -dy, py = dx;
    const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
    const R = Math.hypot(b.x1 - b.x0, b.y1 - b.y0) / 2 + 4;
    for (let t = -R; t <= R; t += gap * this.rand(0.7, 1.3)) {
      c.globalAlpha = this.rand(0.2, 0.5) * alphaScale;
      c.lineWidth = this.rand(1.2, 2.4);
      const ox = cx + px * t, oy = cy + py * t;
      c.beginPath();
      c.moveTo(ox - dx * R + this.jit(2), oy - dy * R + this.jit(2));
      c.lineTo(ox + dx * R + this.jit(2), oy + dy * R + this.jit(2));
      c.stroke();
    }
    c.restore();
  }
}

// 紙の粒（クレヨンが乗らなかった白い点）
let grainCanvas = null;
function grain() {
  if (grainCanvas) return grainCanvas;
  const size = 128;
  grainCanvas = document.createElement('canvas');
  grainCanvas.width = grainCanvas.height = size;
  const g = grainCanvas.getContext('2d');
  const img = g.createImageData(size, size);
  const rng = makeRng(7);
  for (let i = 0; i < size * size; i++) {
    const v = rng();
    const o = i * 4;
    if (v < 0.2) {
      img.data[o] = 255; img.data[o + 1] = 250; img.data[o + 2] = 238;
      img.data[o + 3] = Math.round(90 + rng() * 140);
    } else if (v < 0.24) {
      img.data[o] = 60; img.data[o + 1] = 40; img.data[o + 2] = 30;
      img.data[o + 3] = 40;
    }
  }
  g.putImageData(img, 0, 0);
  return grainCanvas;
}

// 描いたところにだけ紙の粒をのせる
export function applyGrain(ctx, w, h, seed = 0) {
  const pat = ctx.createPattern(grain(), 'repeat');
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  ctx.translate(-(seed * 37 % 128), -(seed * 53 % 128));
  ctx.fillStyle = pat;
  ctx.fillRect(0, 0, w + 128, h + 128);
  ctx.restore();
}

// ゲーム画面用に紙の粒のパターンを返す（ゲージの塗りなどに使う）
export function grainPattern(ctx) {
  return ctx.createPattern(grain(), 'repeat');
}
