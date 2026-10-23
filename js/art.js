// 絵の中身（どうぶつ・木の実・背景など）
import { INK, shade } from './crayon.js';

export const SIZE = {
  animal: [120, 120],
  fruit: [56, 56],
  bubble: [96, 86],
  heart: [30, 28],
  cross: [40, 40],
  tear: [16, 22],
  sparkle: [24, 24],
};

/* ---------- 顔 ---------- */

function face(cr, cx, cy, expr, o = {}) {
  const g = o.gap ?? 12;
  const ink = o.ink ?? INK;
  if (o.cheeks !== false) {
    const cc = expr === 'happy' ? 'rgba(240,110,120,0.6)' : 'rgba(240,140,140,0.35)';
    cr.shape(cr.ellipsePts(cx - g - 6, cy + 7, 6, 4), { fill: cc, hatch: false, stroke: null });
    cr.shape(cr.ellipsePts(cx + g + 6, cy + 7, 6, 4), { fill: cc, hatch: false, stroke: null });
  }
  if (expr === 'happy') {
    for (const s of [-1, 1]) {
      const ex = cx + s * g;
      cr.stroke([[ex - 4.5, cy + 1.5], [ex, cy - 4], [ex + 4.5, cy + 1.5]], ink, 2.6);
    }
    if (o.mouth !== false) {
      const pts = [];
      for (let i = 0; i <= 8; i++) {
        const a = (i / 8) * Math.PI;
        pts.push([cx + Math.cos(a) * 6.5, cy + 7 + Math.sin(a) * 6.5]);
      }
      cr.shape(pts, { fill: '#d9584f', hatch: false, lw: 2 });
    }
  } else if (expr === 'sad') {
    for (const s of [-1, 1]) {
      const ex = cx + s * g;
      cr.dot(ex, cy + 1, 3, ink);
      cr.stroke([[ex + s * 5, cy - 5], [ex - s * 4, cy - 9]], ink, 2.2);
    }
    if (o.mouth !== false) cr.stroke([[cx - 5, cy + 12], [cx, cy + 9], [cx + 5, cy + 12]], ink, 2.2);
    // なみだ
    tearShape(cr, cx + g + 2, cy + 9, 0.8);
  } else {
    for (const s of [-1, 1]) {
      const ex = cx + s * g;
      if (o.whites) cr.dot(ex, cy, 5, '#fff6e6');
      cr.dot(ex, cy, o.whites ? 3 : 3.8, o.whites ? INK : ink);
      cr.dot(ex + 1.2, cy - 1.4, 1.2, '#fffaf0');
    }
    if (o.mouth !== false) {
      cr.stroke([[cx - 5, cy + 8], [cx - 2.5, cy + 11], [cx, cy + 8.5], [cx + 2.5, cy + 11], [cx + 5, cy + 8]], ink, 1.9);
    }
  }
}

function tearShape(cr, x, y, k = 1) {
  const pts = [];
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const r = 5 * k;
    // 上がとがったしずく形
    const yy = Math.sin(a) * r;
    const xx = Math.cos(a) * r * (yy < 0 ? 1 + yy / (r * 1.4) : 1);
    pts.push([x + xx, y + yy + (yy < 0 ? yy * 0.7 : 0)]);
  }
  cr.shape(pts, { fill: '#8cc8f0', hatch: false, lw: 1.6, stroke: '#4f86b0' });
}

function feet(cr, color) {
  cr.ellipse(47, 111, 10, 5.5, { fill: color });
  cr.ellipse(73, 111, 10, 5.5, { fill: color });
}

/* ---------- どうぶつ ---------- */

const ANIMAL_DRAW = {
  squirrel(cr, expr) {
    const body = '#dd8236', cream = '#f6dfb8';
    // しっぽ
    cr.ellipse(92, 62, 20, 38, { fill: '#d98a4a', rot: -0.35 });
    cr.ellipse(94, 58, 9, 26, { fill: '#e8a868', rot: -0.35, stroke: null });
    feet(cr, shade(body, -0.1));
    cr.ellipse(60, 90, 28, 24, { fill: body });
    cr.ellipse(60, 93, 16, 16, { fill: cream });
    // みみ
    cr.shape([[36, 44], [39, 22], [52, 36]], { fill: body });
    cr.shape([[84, 44], [81, 22], [68, 36]], { fill: body });
    cr.ellipse(60, 56, 30, 26, { fill: body });
    cr.ellipse(60, 67, 13, 9, { fill: cream });
    face(cr, 60, 55, expr);
    cr.dot(60, 62, 2.6, '#5a3020');
  },

  rabbit(cr, expr) {
    const body = '#f6f1ea', pink = '#f3b3bd';
    cr.ellipse(47, 22, 8, 23, { fill: body, rot: -0.15, hatchColor: '#d8cfc4' });
    cr.ellipse(47, 24, 4, 15, { fill: pink, rot: -0.15, stroke: null });
    cr.ellipse(73, 22, 8, 23, { fill: body, rot: 0.15, hatchColor: '#d8cfc4' });
    cr.ellipse(73, 24, 4, 15, { fill: pink, rot: 0.15, stroke: null });
    feet(cr, body);
    cr.ellipse(60, 90, 27, 24, { fill: body, hatchColor: '#d8cfc4' });
    cr.ellipse(60, 58, 29, 25, { fill: body, hatchColor: '#d8cfc4' });
    face(cr, 60, 57, expr);
    cr.dot(60, 63, 2.6, '#e07a8a');
  },

  bear(cr, expr) {
    const body = '#9a6640', light = '#e2c29a';
    cr.ellipse(36, 35, 11, 11, { fill: body });
    cr.ellipse(36, 35, 5.5, 5.5, { fill: '#c99a6e', stroke: null });
    cr.ellipse(84, 35, 11, 11, { fill: body });
    cr.ellipse(84, 35, 5.5, 5.5, { fill: '#c99a6e', stroke: null });
    feet(cr, shade(body, -0.1));
    cr.ellipse(60, 90, 30, 25, { fill: body });
    cr.ellipse(60, 94, 16, 15, { fill: light });
    cr.ellipse(60, 57, 31, 27, { fill: body });
    cr.ellipse(60, 67, 14, 10, { fill: light });
    face(cr, 60, 54, expr, { gap: 13 });
    cr.ellipse(60, 61, 4.5, 3.2, { fill: '#3a2418', stroke: null, hatch: false });
  },

  bird(cr, expr) {
    const body = '#7fb2e0', belly = '#f4e8c8', beak = '#f0a040';
    // あし
    cr.stroke([[50, 104], [48, 114]], beak, 3);
    cr.stroke([[70, 104], [72, 114]], beak, 3);
    // あたまの羽
    cr.stroke([[58, 44], [54, 30]], INK, 2.4);
    cr.stroke([[62, 44], [64, 28]], INK, 2.4);
    cr.stroke([[64, 45], [72, 34]], INK, 2.4);
    cr.ellipse(26, 84, 10, 18, { fill: shade(body, -0.15), rot: 0.45 });
    cr.ellipse(94, 84, 10, 18, { fill: shade(body, -0.15), rot: -0.45 });
    cr.ellipse(60, 76, 35, 34, { fill: body });
    cr.ellipse(60, 90, 21, 17, { fill: belly });
    face(cr, 60, 66, expr, { gap: 14, mouth: false });
    if (expr === 'happy') {
      cr.shape([[52, 73], [68, 73], [60, 79]], { fill: beak, hatch: false, lw: 2 });
      cr.shape([[54, 81], [66, 81], [60, 86]], { fill: beak, hatch: false, lw: 2 });
    } else {
      cr.shape([[52, 74], [68, 74], [60, 84]], { fill: beak, hatch: false, lw: 2 });
    }
  },

  tanuki(cr, expr) {
    const body = '#a08b74', dark = '#5e4c3e', light = '#efe0c8';
    // しっぽ
    cr.ellipse(94, 96, 12, 19, { fill: body, rot: 0.7 });
    cr.stroke([[90, 90], [100, 94]], dark, 3);
    cr.stroke([[86, 98], [96, 103]], dark, 3);
    cr.ellipse(37, 36, 10, 10, { fill: dark });
    cr.ellipse(83, 36, 10, 10, { fill: dark });
    feet(cr, dark);
    cr.ellipse(60, 90, 29, 25, { fill: body });
    cr.ellipse(60, 94, 16, 15, { fill: light });
    cr.ellipse(60, 57, 31, 27, { fill: body });
    // めのまわりの模様
    cr.ellipse(47, 56, 10, 8, { fill: dark, rot: 0.35, stroke: null });
    cr.ellipse(73, 56, 10, 8, { fill: dark, rot: -0.35, stroke: null });
    cr.ellipse(60, 67, 12, 9, { fill: light });
    face(cr, 60, 55, expr, { gap: 13, ink: '#fff6e6', cheeks: false, whites: true });
    cr.dot(60, 62, 3, '#2e2018');
  },
};

export const ANIMALS = Object.keys(ANIMAL_DRAW);

export function drawAnimal(cr, kind, expr) {
  ANIMAL_DRAW[kind](cr, expr);
}

/* ---------- 木の実 ---------- */

const FRUIT_DRAW = {
  apple(cr) {
    cr.ellipse(28, 32, 20, 18, { fill: '#e0473c' });
    cr.stroke([[28, 16], [29, 11], [31, 6]], '#6b4428', 3);
    cr.ellipse(37, 11, 7, 3.8, { fill: '#7cc152', rot: -0.5, lw: 1.8 });
    cr.stroke([[17, 28], [19, 23], [23, 20]], '#fff3e8', 2.4);
  },
  banana(cr) {
    const outer = [], inner = [];
    for (let i = 0; i <= 10; i++) {
      const a = 0.18 * Math.PI + (i / 10) * 0.64 * Math.PI;
      outer.push([28 + Math.cos(a) * 26, 8 + Math.sin(a) * 26]);
    }
    for (let i = 10; i >= 0; i--) {
      const a = 0.24 * Math.PI + (i / 10) * 0.52 * Math.PI;
      inner.push([28 + Math.cos(a) * 26, -4 + Math.sin(a) * 26]);
    }
    cr.shape([...outer, ...inner], { fill: '#f5cf3b' });
    cr.stroke([[46, 20], [49, 13], [50, 8]], '#6b8a3a', 3.2);
    cr.dot(8, 21, 2.2, '#5a3a20');
    cr.stroke([[20, 26], [28, 28.5], [36, 27]], '#fff6d0', 2);
  },
  grape(cr) {
    cr.stroke([[28, 13], [29, 6]], '#6b4428', 3);
    cr.ellipse(37, 9, 7, 3.6, { fill: '#7cc152', rot: -0.3, lw: 1.8 });
    const balls = [[16, 20], [28, 18], [40, 20], [22, 30], [34, 30], [28, 41]];
    for (const [x, y] of balls) {
      cr.ellipse(x, y, 7.5, 7.5, { fill: '#8a5bb5', lw: 2 });
      cr.dot(x - 2.5, y - 2.5, 1.6, '#e8d8f6');
    }
  },
};

export const FRUITS = Object.keys(FRUIT_DRAW);

export function drawFruit(cr, kind) {
  FRUIT_DRAW[kind](cr);
}

/* ---------- 小物 ---------- */

export function drawBubble(cr) {
  cr.ellipse(48, 38, 40, 33, { fill: '#fffdf6', hatchColor: '#ece4d4' });
  // しっぽ（下向き）
  const tail = [[40, 66], [48, 82], [58, 65]];
  cr.shape([[38, 62], [48, 82], [60, 61]], { fill: '#fffdf6', hatch: false, stroke: null });
  cr.stroke(tail, INK, 2.6);
}

function heartPts(cx, cy, k) {
  const pts = [];
  for (let i = 0; i < 24; i++) {
    const t = (i / 24) * Math.PI * 2;
    const x = 16 * Math.sin(t) ** 3;
    const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
    pts.push([cx + x * k, cy + y * k]);
  }
  return pts;
}

export function drawHeart(cr, empty = false) {
  if (empty) cr.shape(heartPts(15, 14, 0.78), { fill: '#e6dccb', stroke: '#b8aa96', hatch: false });
  else cr.shape(heartPts(15, 14, 0.78), { fill: '#ec5f6f' });
}

export function drawCross(cr) {
  cr.stroke([[8, 8], [20, 20], [32, 32]], '#d9493e', 6);
  cr.stroke([[32, 8], [20, 20], [8, 32]], '#d9493e', 6);
}

export function drawTear(cr) {
  tearShape(cr, 8, 13, 1.1);
}

export function drawSparkle(cr) {
  const pts = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 ? 4 : 11;
    pts.push([12 + Math.cos(a) * r, 12 + Math.sin(a) * r]);
  }
  cr.shape(pts, { fill: '#ffd84a', lw: 1.8, hatch: false });
}

/* ---------- 背景（森と木） ---------- */

// 木の実がなる場所（キャノピー中心からの相対位置）
export const FRUIT_SPOTS = [
  ['apple', 130, -80], ['grape', 200, -96], ['banana', 270, -80],
  ['banana', 108, 0], ['apple', 200, -6], ['grape', 292, 0],
  ['grape', 132, 78], ['banana', 205, 86], ['apple', 270, 78],
];

export function drawBackground(cr, W, H, L) {
  const c = cr.ctx;
  c.fillStyle = '#f7eedb';
  c.fillRect(0, 0, W, H);

  // 空のぬりムラ
  c.save();
  c.beginPath();
  c.rect(0, 0, W, L.groundY);
  c.clip();
  cr.hatchBox({ x0: 0, y0: -40, x1: W, y1: L.groundY * 0.85 }, '#a9d2ec', 7, 0.8);
  c.restore();

  // 雲
  const cloud = (x, y, s) => {
    for (const [dx, dy, r] of [[-22, 4, 16], [0, -6, 20], [22, 4, 16], [0, 8, 16]]) {
      cr.ellipse(x + dx * s, y + dy * s, r * s, r * s * 0.85, { fill: '#fffaf2', stroke: '#a9c3d4', hatch: false, lw: 2 });
    }
  };
  cloud(48, L.cy + 150, 0.9);
  cloud(360, L.cy + 190, 0.75);

  // 遠くの丘と木
  cr.ellipse(70, L.groundY + 20, 170, 70, { fill: '#cfe4ad', stroke: '#a7c482', lw: 2 });
  cr.ellipse(340, L.groundY + 16, 150, 58, { fill: '#c3dc9e', stroke: '#9fbd79', lw: 2 });
  const smallTree = (x, y, s) => {
    cr.shape([[x - 3 * s, y], [x - 2 * s, y - 22 * s], [x + 2 * s, y - 22 * s], [x + 3 * s, y]], { fill: '#b38a62', stroke: '#8b6a4c', lw: 1.6 });
    cr.ellipse(x, y - 32 * s, 15 * s, 18 * s, { fill: '#93c27a', stroke: '#6f9a58', lw: 1.8 });
  };
  smallTree(30, L.groundY - 22, 1);
  smallTree(375, L.groundY - 12, 0.9);
  smallTree(345, L.groundY - 30, 0.7);

  // 地面
  const top = [];
  for (let x = -10; x <= W + 10; x += 20) top.push([x, L.groundY + Math.sin(x * 0.05) * 4 + cr.jit(2)]);
  cr.shape([...top, [W + 10, H + 10], [-10, H + 10]], { fill: '#a6d27a', hatchColor: '#86b85c', stroke: null });
  cr.stroke(top, '#6e9c48', 2.6);

  // 木の幹
  const gy = L.groundY;
  cr.shape([
    [150, gy + 26], [172, gy + 6], [178, L.cy + 70], [174, L.cy + 30],
    [226, L.cy + 30], [222, L.cy + 70], [228, gy + 6], [252, gy + 26],
  ], { fill: '#a2703f' });
  for (const x of [188, 201, 213]) {
    cr.stroke([[x, gy], [x + cr.jit(3), (gy + L.cy) / 2 + 40], [x + cr.jit(3), L.cy + 90]], '#7a5030', 1.8);
  }

  // 草むら・花
  for (let i = 0; i < 26; i++) {
    const x = cr.rand(5, W - 5), y = cr.rand(L.groundY + 14, H - 6);
    cr.stroke([[x - 7, y - 8], [x - 3, y - 3], [x - 1, y]], '#5e8f3c', 2);
    cr.stroke([[x + 1, y - 12], [x + 0.5, y - 5], [x, y]], '#5e8f3c', 2);
    cr.stroke([[x + 8, y - 7], [x + 4, y - 3], [x + 1, y]], '#5e8f3c', 2);
  }
  const flower = (x, y, col) => {
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      cr.ellipse(x + Math.cos(a) * 5, y + Math.sin(a) * 5, 3.6, 3.6, { fill: col, lw: 1.3, hatch: false });
    }
    cr.dot(x, y, 2.6, '#f2b63c');
  };
  const flowerCols = ['#ffffff', '#f6a6c1', '#fff07a', '#c9b3f0'];
  for (let i = 0; i < 9; i++) {
    flower(cr.rand(12, W - 12), cr.rand(L.groundY + 18, H - 14), flowerCols[i % flowerCols.length]);
  }

  // 葉っぱのかたまり
  const leaves = [
    [200, -98, 82, '#7cbb5c'], [118, -42, 74, '#86c264'], [282, -42, 74, '#86c264'],
    [82, 38, 62, '#72b154'], [318, 38, 62, '#72b154'],
    [148, 84, 70, '#7cbb5c'], [252, 84, 70, '#7cbb5c'], [200, 16, 98, '#8dc86b'],
  ];
  for (const [x, y, r, col] of leaves) {
    cr.ellipse(x, L.cy + y, r, r * 0.9, { fill: col, hatchColor: '#5f9c45', stroke: '#4e7f38' });
  }
  for (let n = 0; n < 22;) {
    const x = cr.rand(60, 340), y = L.cy + cr.rand(-150, 130);
    if (!leaves.some(([lx, ly, r]) => Math.hypot(x - lx, y - (L.cy + ly)) < r - 14)) continue;
    cr.stroke([[x - 6, y], [x, y + 4], [x + 6, y]], '#5a9440', 1.8);
    n++;
  }
}
