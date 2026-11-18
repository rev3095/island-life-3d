// M21-P3 친구 섬 구경 가기 — 순수 규칙 (three·DOM 없음, 테스트가 같이 쓴다).
// 보드 wave17 D282-A (배 타고 친구 섬에 가서 읽기만으로 걸어 다니기) · D285-A (「오늘의 섬」 셋 + 섬 코드).
// 노트 docs/notes/m21-p3-visit.md.
import { SNAP_VERSION, isCode } from './rules.js';

/** 구경 못 하는 이유 → 화면 글 */
export const TRIP_WHY = {
  missing: '그 코드의 섬을 찾지 못했어요.',
  version: '이 섬은 지금 구경할 수 없어요.',
  mine: '내 섬이에요! 친구 섬 코드를 넣어 보세요.',
  'no-store': '이 창에서는 친구 섬을 찾을 수 없어요.',
  busy: '지금은 배를 탈 수 없어요.',
};
export const tripWhy = why => TRIP_WHY[why] ?? TRIP_WHY.version;

/**
 * 섬 문서를 구경할 수 있나 → { ok, why }
 * doc = islands/<uid> 문서 { code, user, v, snap }. snap.v 를 모르는 판이면 'version' (「이 섬은 지금 구경할 수 없어요」)
 */
export function visitable(doc, { uid = null, mine = null } = {}) {
  if (!doc || typeof doc !== 'object' || !doc.snap) return { ok: false, why: 'missing' };
  const s = doc.snap;
  if (s.v !== SNAP_VERSION || !s.island || typeof s.island !== 'object') return { ok: false, why: 'version' };
  if (!Number.isFinite(Number(s.island.seed)) || s.island.seed === null) return { ok: false, why: 'version' };
  if ((uid && doc.user === uid) || (mine && doc.code === mine)) return { ok: false, why: 'mine' };
  return { ok: true, why: null };
}

/** 섬 문서 → 화면에 쓸 이름들 */
export function tripOf(doc) {
  const s = doc?.snap ?? {};
  return {
    code: isCode(doc?.code) ? doc.code : null,
    user: typeof doc?.user === 'string' ? doc.user : null,
    island: String(s.island?.name || '이름 없는 섬').slice(0, 20),
    owner: String(s.player?.name || '섬 주인').slice(0, 20),
  };
}

/** 주민 인사 두 줄 (부탁·선물·친밀도 없음). table = visit.json greet, k = 고르기 번호 */
export function greetLines(table, k, vars) {
  const list = Array.isArray(table) && table.length ? table : [['안녕! 구경 왔구나.']];
  const pick = list[((k % list.length) + list.length) % list.length];
  return [pick].flat().map(l => String(l).replace(/\{(\w+)\}/g, (_, n) => vars?.[n] ?? ''));
}

/** 섬 사진의 놓은 것(added)을 구경 섬 월드 자리로: data.at 이 있는 것은 x 에 ox 를 더한다 (칸 자리 tx·tz 는 그대로) */
export function shiftAdded(added, ox) {
  return (Array.isArray(added) ? added : []).filter(a => a && typeof a.kind === 'string' && a.id != null).map(a => {
    const data = { ...(a.data ?? {}) };
    if (data.at && Number.isFinite(data.at.x)) data.at = { ...data.at, x: data.at.x + ox };
    return { ...a, data };
  });
}
