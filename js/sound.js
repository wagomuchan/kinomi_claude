// 効果音（音声ファイルは使わず、その場で合成する）
// 木琴のようなやわらかい音を基本にしている。

import { load, save } from './storage.js';

// ペンタトニック（ド レ ミ ソ ラ …）なので、どの順で鳴っても気持ちよく聞こえる
const SCALE = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.51, 1567.98, 1760.0];

export class Sound {
  constructor() {
    this.ctx = null;
    this.enabled = load('kinomi.sound', '1') !== '0';
  }

  // スマホでは画面に触れたタイミングでないと音を出せないので、最初のタップで呼ぶ
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.55;
      this.master.connect(this.ctx.destination);
      // ふんわり響かせるためのやまびこ
      const delay = this.ctx.createDelay();
      delay.delayTime.value = 0.16;
      const fb = this.ctx.createGain();
      fb.gain.value = 0.22;
      const wet = this.ctx.createGain();
      wet.gain.value = 0.22;
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 2400;
      this.master.connect(delay);
      delay.connect(lp);
      lp.connect(fb);
      fb.connect(delay);
      lp.connect(wet);
      wet.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  toggle() {
    this.enabled = !this.enabled;
    save('kinomi.sound', this.enabled ? '1' : '0');
    return this.enabled;
  }

  get ready() {
    return this.enabled && this.ctx && this.ctx.state === 'running';
  }

  // 木琴っぽい音：基音＋すぐ消える高い倍音
  mallet(freq, at = 0, vol = 0.3, dur = 0.6) {
    const c = this.ctx, t = c.currentTime + at;
    const partials = [[1, vol, dur], [4, vol * 0.18, dur * 0.25], [2.01, vol * 0.12, dur * 0.5]];
    for (const [mul, v, d] of partials) {
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = 'sine';
      o.frequency.value = freq * mul;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(v, t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g);
      g.connect(this.master);
      o.start(t);
      o.stop(t + d + 0.05);
    }
  }

  // もぐ：ぷちっ
  pick() {
    if (!this.ready) return;
    const c = this.ctx, t = c.currentTime;
    const o = c.createOscillator(), g = c.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(1300, t);
    o.frequency.exponentialRampToValueAtTime(420, t + 0.07);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.28, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + 0.12);
  }

  // 正解：ぽろん♪（続けて正解すると音が上がっていく）
  correct(combo) {
    if (!this.ready) return;
    const i = Math.min(combo - 1, SCALE.length - 3);
    this.mallet(SCALE[i], 0, 0.3);
    this.mallet(SCALE[i + 2], 0.08, 0.26);
  }

  // ちがう：こつん
  wrong() {
    if (!this.ready) return;
    const c = this.ctx, t = c.currentTime;
    for (const [f, v] of [[210, 0.35], [420, 0.08]]) {
      const o = c.createOscillator(), g = c.createGain();
      o.type = 'triangle';
      o.frequency.setValueAtTime(f, t);
      o.frequency.exponentialRampToValueAtTime(f * 0.8, t + 0.12);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(v, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      o.connect(g);
      g.connect(this.master);
      o.start(t);
      o.stop(t + 0.2);
    }
  }

  // 待たせすぎ：しょんぼり
  miss() {
    if (!this.ready) return;
    this.mallet(392.0, 0, 0.26, 0.5);
    this.mallet(311.13, 0.16, 0.26, 0.8);
  }

  start() {
    if (!this.ready) return;
    [0, 2, 4, 5].forEach((n, k) => this.mallet(SCALE[n], k * 0.09, 0.22));
  }

  gameOver(best) {
    if (!this.ready) return;
    if (best) {
      [0, 2, 4, 5, 7].forEach((n, k) => this.mallet(SCALE[n], k * 0.1, 0.24));
      this.mallet(SCALE[9], 0.55, 0.22, 1.0);
    } else {
      [523.25, 440.0, 349.23, 261.63].forEach((f, k) => this.mallet(f, k * 0.18, 0.24, 0.8));
    }
  }
}
