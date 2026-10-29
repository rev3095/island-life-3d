// 편집기가 남기는 "바뀐 칸 목록"(changes)을 JSON 표에 얹는 규칙 — 섬 지도 편집기(map-editor.html)·게임 숫자 표(data-editor.html)·
// 반영 도구(tools/apply-edits.mjs)·테스트가 같이 쓴다. node 모듈 없이 도는 순수 함수라 브라우저에서도 그대로 불러온다.
//
// changes = { "<경로>": 값 }. 경로는 '/' 로 나눈 칸 이름:
//   지도  "shop" · "villagers/coco" · "density/trees" · "bridges/1"              (assets/island/layout.json 안)
//   숫자  "items/fish/crucian/price" · "rules/gather/shake/bees" · "rules/day/shellsPerDay/0" · "rules/recipes/tool.rod/needs"
//         (첫 칸 = 파일 items | rules)
// 배열 칸: 줄마다 이름표(slug · kind · result)가 있는 표는 그 이름으로, 아니면 번호로 찾는다.
// 값 { "$delete": true } = 그 칸 지우기 (줄마다 덧붙인 weight 같은 것). 줄 경로에 null = 그 줄 빼기, 줄 객체 = 새 줄 더하기·바꾸기.

export const DELETE = Object.freeze({ $delete: true });
const ROW_KEYS = ['slug', 'kind', 'result'];
export const rowKeyOf = row => (row && typeof row === 'object' && !Array.isArray(row) ? ROW_KEYS.find(k => typeof row[k] === 'string') ?? null : null);
const isRows = arr => Array.isArray(arr) && arr.length > 0 && arr.every(r => rowKeyOf(r) === rowKeyOf(arr[0]) && rowKeyOf(r));
export const isDelete = v => !!v && typeof v === 'object' && v.$delete === true;
const clone = v => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));

export const splitPath = path => String(path).split('/').filter(Boolean);

/** 칸 하나 찾기: { parent, key, value, exists } (배열 줄은 이름표로) */
function locate(root, segs) {
  let parent = null, key = null, cur = root;
  for (const s of segs) {
    if (cur == null || typeof cur !== 'object') return { parent: null, key: s, value: undefined, exists: false, broken: true };
    parent = cur;
    if (Array.isArray(cur)) {
      const k = rowKeyOf(cur[0]) && isRows(cur) ? rowKeyOf(cur[0]) : null;
      key = k ? cur.findIndex(r => r[k] === s) : /^\d+$/.test(s) ? Number(s) : -1;
      if (k && key < 0) return { parent, key: s, rowKey: k, value: undefined, exists: false };
      if (key < 0) return { parent, key: s, value: undefined, exists: false, broken: true };
    } else key = s;
    cur = parent[key];
  }
  return { parent, key, value: cur, exists: cur !== undefined };
}

/** 경로의 값 (없으면 undefined) */
export const getAt = (root, path) => locate(root, splitPath(path)).value;

/** 칸 순서와 상관없는 JSON 글자 (편집기 저장소는 객체 칸을 이름 순으로 돌려준다) */
export const canon = v => (v === undefined ? 'undefined' : v === null || typeof v !== 'object' ? JSON.stringify(v)
  : Array.isArray(v) ? `[${v.map(canon).join(',')}]` : `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${canon(v[k])}`).join(',')}}`);
/** 값 비교 (칸 순서는 보지 않는다) */
export const same = (a, b) => canon(a) === canon(b);

/**
 * root 에 changes 를 얹는다 (root 는 그대로, 새 객체를 돌려준다).
 * → { out, applied: [{ path, from, to }], unchanged: [path], errors: [{ path, why }] }
 */
export function applyChanges(root, changes) {
  const out = clone(root);
  const applied = [], unchanged = [], errors = [];
  for (const [path, raw] of Object.entries(changes ?? {})) {
    const segs = splitPath(path);
    if (!segs.length) { errors.push({ path, why: '빈 경로' }); continue; }
    const loc = locate(out, segs);
    if (loc.broken || !loc.parent) { errors.push({ path, why: '표에 없는 칸' }); continue; }
    const from = clone(loc.value);
    if (Array.isArray(loc.parent) && loc.rowKey) {          // 없는 줄: 더하기
      if (raw === null || isDelete(raw)) { unchanged.push(path); continue; }
      if (!raw || typeof raw !== 'object' || raw[loc.rowKey] !== loc.key) { errors.push({ path, why: `새 줄에는 ${loc.rowKey}: '${loc.key}' 가 있어야 한다` }); continue; }
      loc.parent.push(clone(raw));
      applied.push({ path, from: undefined, to: clone(raw) });
      continue;
    }
    if (Array.isArray(loc.parent) && rowKeyOf(loc.value) && (raw === null || isDelete(raw))) {   // 있는 줄 빼기
      loc.parent.splice(loc.key, 1);
      applied.push({ path, from, to: null });
      continue;
    }
    if (isDelete(raw)) {
      if (!loc.exists) { unchanged.push(path); continue; }
      if (Array.isArray(loc.parent)) { errors.push({ path, why: '배열 칸은 지울 수 없다' }); continue; }
      delete loc.parent[loc.key];
      applied.push({ path, from, to: undefined });
      continue;
    }
    if (same(from, raw)) { unchanged.push(path); continue; }
    loc.parent[loc.key] = clone(raw);
    applied.push({ path, from, to: clone(raw) });
  }
  return { out, applied, unchanged, errors };
}

/** 두 표의 다른 칸 → changes (편집기 되돌리기: history 의 사본과 지금 파일을 비교). 줄 표는 줄 이름표로 칸마다, 줄이 늘거나 줄거나 순서가 바뀌면 표 통째로 */
export function diffTables(from, to, prefix = '') {
  const out = {};
  const walk = (a, b, p) => {
    if (same(a, b)) return;
    if (isRows(a) && isRows(b) && rowKeyOf(a[0]) === rowKeyOf(b[0])) {
      const k = rowKeyOf(a[0]);
      if (!same(a.map(r => r[k]), b.map(r => r[k]))) { out[p] = clone(b); return; }
      a.forEach((r, i) => walk(r, b[i], `${p}/${r[k]}`));
      return;
    }
    if (a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a) && !Array.isArray(b)) {
      for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
        if (!(k in b)) out[`${p}/${k}`] = { ...DELETE };
        else walk(a[k], b[k], `${p}/${k}`);
      }
      return;
    }
    out[p] = clone(b);
  };
  walk(from, to, prefix);
  return Object.fromEntries(Object.entries(out).map(([k, v]) => [k.replace(/^\//, ''), v]));
}

/** 사람이 읽기 좋은 JSON: 맨 위 칸은 줄마다, 표의 줄·짧은 값은 한 줄로 (반영 diff 가 작게) */
const inline = v => (v === null || typeof v !== 'object' ? JSON.stringify(v)
  : Array.isArray(v) ? `[${v.map(inline).join(', ')}]` : `{ ${Object.entries(v).map(([k, x]) => `${JSON.stringify(k)}: ${inline(x)}`).join(', ')} }`);
export function pretty(v, ind = '') {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  const one = inline(v);
  if (ind.length >= 4 || one.length <= 120) return one;
  const ni = ind + '  ';
  if (Array.isArray(v)) return `[\n${v.map(x => ni + pretty(x, ni)).join(',\n')}\n${ind}]`;
  return `{\n${Object.entries(v).map(([k, x]) => `${ni}${JSON.stringify(k)}: ${pretty(x, ni)}`).join(',\n')}\n${ind}}`;
}
