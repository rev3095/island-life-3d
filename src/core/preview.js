// 8차 D85-A: 날짜 흉내 — 게임 주소 끝 #date=2027-04-02 (또는 ?date=…) 면 그 날짜로 연다.
// 시각은 지금 시각 그대로, 날짜만 옮긴다 (sky 가 시계를 옮긴다). 진짜 섬과 안 섞이게 저장 칸을 따로 쓴다 (data 가 saveKey 를 쓴다).
// 사양 #low 와 같이 쓸 때는 #low&date=2027-04-02 처럼 & 로 잇는다. DOM 없이 돈다 (node 테스트).
// 저장 칸 이름 = data/save.js SAVE_KEY + '-preview' (sky·스타일 편집기가 이 파일을 불러서 save.js 는 끌어오지 않는다 — tests/events.test.mjs 가 맞는지 본다)
export const PREVIEW_SAVE_KEY = 'island-life-save-v1-preview';
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** 'YYYY-MM-DD' 가 실제 있는 날이면 그대로, 아니면 null */
export function validDate(s) {
  const m = DATE.exec(String(s ?? ''));
  if (!m) return null;
  const [y, mo, d] = m.slice(1).map(Number);
  const t = new Date(y, mo - 1, d);
  return t.getFullYear() === y && t.getMonth() === mo - 1 && t.getDate() === d && y >= 2000 && y <= 2999 ? m[0] : null;
}

/** location 모양 { search, hash } → 'YYYY-MM-DD' | null */
export function urlDate({ search = '', hash = '' } = {}) {
  const q = new URLSearchParams(search).get('date');
  if (q != null) return validDate(q);
  const h = /(?:^#|[&?])date=([\d-]+)/.exec(hash);
  return h ? validDate(h[1]) : null;
}

/** 지금 시각(ms) 의 시·분·초는 두고 날짜만 date 로 옮긴 시각(ms) */
export function shiftedMs(date, nowMs = Date.now()) {
  const [y, mo, d] = date.split('-').map(Number);
  const n = new Date(nowMs);
  return new Date(y, mo - 1, d, n.getHours(), n.getMinutes(), n.getSeconds(), n.getMilliseconds()).getTime();
}

/** ctx.preview 에 넣을 것 — 날짜 흉내가 아니면 null */
export function previewOf(loc) {
  const date = urlDate(loc);
  return date ? { date, saveKey: PREVIEW_SAVE_KEY } : null;
}
