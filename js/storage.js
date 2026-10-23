// スマホのブラウザ内に保存する（プライベートモードなどで使えなくても動くようにする）

export function load(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : v;
  } catch {
    return fallback;
  }
}

export function save(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // 保存できなくてもゲームは続ける
  }
}
