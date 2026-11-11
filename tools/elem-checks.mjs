// 요소 편집기(elem-editor.html) 「확인」 칸과 tests/elem.test.mjs 가 같이 쓰는 값 검사 — 순수 함수, 브라우저에서도 그대로 불러온다.
// W = { items, rules, events, night, tour } (편집기의 "지금 값" = 파일 + 바뀐 칸). 섬 지도·방 배치 검사는 게임 코드(island.js · interior.js
// checkRoom · placedata.js checkPlace)를 직접 부르는 그 탭이 맡는다.
// → [{ ok, tab, label, why? }]  (tab = 편집기 탭 id — 걸린 줄을 누르면 그 탭으로)

export const CAT_KO = { fish: '물고기', bug: '곤충', fossil: '화석', fruit: '과일', shell: '조개', flower: '꽃', mat: '재료', tool: '도구', furn: '가구', seed: '씨앗·묘목' };

/** 아이템 표 → [{ cat, id, name, emoji }] (레시피 재료 고르기·없는 아이템 검사) */
export function itemList(T) {
  const out = [];
  const add = (cat, id, name, emoji) => out.push({ cat, id, name, emoji });
  for (const r of T.fish ?? []) add('fish', `fish.${r.slug}`, r.name, r.emoji);
  for (const r of T.bugs ?? []) add('bug', `bug.${r.slug}`, r.name, r.emoji);
  for (const r of T.fossils ?? []) add('fossil', `fossil.${r.slug}`, r.name, r.emoji);
  for (const r of T.fruits ?? []) add('fruit', `fruit.${r.slug}`, r.name, r.emoji);
  for (const r of T.shells ?? []) add('shell', `shell.${r.slug}`, r.name, r.emoji);
  for (const f of T.flowers ?? []) for (const [v, c] of f.colors) add('flower', `flower.${f.kind}-${v}`, `${c} ${f.name}`, f.emoji);
  for (const r of T.mats ?? []) add('mat', `mat.${r.slug}`, r.name, r.emoji);
  if (T.acornBag) add('mat', 'mat.acorn-bag', T.acornBag.name, T.acornBag.emoji);
  for (const r of T.tools ?? []) add('tool', `tool.${r.slug}`, r.name, r.emoji);
  for (const r of T.furniture ?? []) add('furn', `furn.${r.slug}`, r.name, r.emoji);
  for (const r of T.seeds ?? []) add('seed', `seed.${r.slug}`, r.name, r.emoji);
  return out;
}

/** 게임 하루 시각(5~29) → 사람 말 (27 → 새벽 3시, 24 → 자정) */
export function hourKo(h) {
  if (!Number.isFinite(h)) return String(h);
  const m = Math.round((h % 1) * 60), H = Math.floor(h) % 24;
  const t = H === 0 && !m ? '자정' : `${H < 5 ? '새벽 ' : H < 12 ? '오전 ' : H === 12 ? '낮 ' : H < 18 ? '오후 ' : '저녁 '}${H > 12 ? H - 12 : H || 12}시${m ? ` ${m}분` : ''}`;
  return t;
}
const span = ([a, b]) => `${hourKo(a)} ~ ${hourKo(b)}`;
const okHours = (h, lo = 5, hi = 29) => Array.isArray(h) && h.length === 2 && h.every(Number.isFinite) && h[0] >= lo && h[1] <= hi && h[0] < h[1];
const DAYS_IN = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
/** 투어 섬 모양 틀 (src/gameplay/tour/islet.js SHAPES 의 이름 — tests/elem.test.mjs 가 같은지 본다) */
export const TOUR_SHAPES = { 'TO-01': '둥근 섬', 'TO-02': '초승달 섬', 'TO-03': '쌍둥이 섬', 'TO-04': '언덕 섬' };
export const WEEKDAY_KO =['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];

export function checkElements(W) {
  const out = [];
  const add = (tab, ok, label, why = '') => out.push({ tab, ok: !!ok, label, why: ok ? '' : why });
  const T = W.items, R = W.rules;
  const ids = new Set(itemList(T ?? {}).map(i => i.id));

  /* ---- 상점 ---- */
  if (R?.shop) {
    const S = R.shop;
    add('shop', S.open < S.close, `상점 ${S.open}시 ~ ${S.close}시`, '여는 시각이 닫는 시각보다 앞이어야 해요');
    add('shop', S.outdoorPerDay <= S.furniturePerDay, `하루 가구 ${S.furniturePerDay} (야외 ${S.outdoorPerDay})`, '야외 가구 수는 하루 가구 수 안이어야 해요');
  }
  /* ---- 숫자 표 (예전 숫자 표 편집기 확인 그대로) ---- */
  if (R?.gather && T) {
    const G = R.gather;
    const shake = Math.max(G.shake.bees, G.shake.beesOrchard) + G.shakeBugChance + G.shake.furniture + G.shake.acornBag;
    add('rules', shake <= 1, `나무 흔들기 확률 합 ${Math.round(shake * 100)}% ≤ 100%`, '줄여 주세요');
    const rock = G.rock.acornBag + G.rock.iron + G.rock.clay;
    add('rules', rock <= 1, `바위 치기 확률 합 ${Math.round(rock * 100)}% ≤ 100%`, '줄여 주세요');
    const badShop = (T.furniture ?? []).filter(f => f.source === 'shop' && !(f.buy > 0)).map(f => f.name);
    add('furniture', !badShop.length, '상점 가구는 모두 사는 값이 있어요', `사는 값이 없어요: ${badShop.join(', ')}`);
    const badRec = R.recipes.filter(r => !ids.has(r.result) || r.needs.some(n => (n.id ? !ids.has(n.id) : !CAT_KO[n.category]))).map(r => r.result);
    const dup = R.recipes.length !== new Set(R.recipes.map(r => r.result)).size;
    add('recipes', !badRec.length && !dup, `레시피 ${R.recipes.length}개 — 재료가 모두 있는 아이템`, dup ? '같은 것을 만드는 레시피가 둘이에요' : `없는 아이템을 쓰는 레시피: ${badRec.join(', ')}`);
    add('rules', R.day.weedsStart <= R.day.weedsMax, '처음 잡초 ≤ 잡초 최대', '처음 잡초가 최대보다 많아요');
    if (R.time) {
      const S = R.time.speeds ?? {};
      add('rules', S.real === 1 && Number.isFinite(S.fast) && Number.isFinite(S.faster) && S.fast > 1 && S.faster >= S.fast && ['real', 'fast', 'faster'].includes(R.time.speed),
        `시간 빠르기: 빠르게 ×${S.fast} · 아주 빠르게 ×${S.faster} (게임 하루 = 실제 ${Math.round(1440 / (S.fast || 1))}분 · ${Math.round(1440 / (S.faster || 1))}분)`, '빠르게 > 1, 아주 빠르게 ≥ 빠르게');
    }
    const tiers = R.town.tiers.map(t => t[1]);
    add('town', tiers.every((v, i) => i === 0 || v > tiers[i - 1]) && tiers.at(-1) <= R.town.friendMax, '친밀도 단계가 차례대로, 최대 안에', '단계 값을 차례대로 늘려 주세요');
  }
  /* ---- 이사 ---- */
  if (R?.moving) {
    const M = R.moving;
    add('moving', M.max >= 9 && M.max <= 12, `섬 최대 주민 ${M.max}명 (가게 주인 포함)`, '9~12명 — 지금 섬에 9명이 살아요 (집터는 새 주민 셋까지)');
    add('moving', M.chanceStep <= M.chanceMax, '묻기 확률이 하루 오름 ≤ 최대', '하루에 오르는 값이 최대보다 커요');
    add('moving', M.boxesAfter < M.goneAfter, `허락 뒤 ${M.boxesAfter}일 이삿짐 → ${M.goneAfter}일 떠남`, '이삿짐이 떠나는 날보다 먼저여야 해요');
  }
  /* ---- 행사 ---- */
  if (W.events) {
    for (const e of W.events.list ?? []) {
      const s = e.start ?? {};
      const dayOk = Number.isInteger(s.month) && s.month >= 1 && s.month <= 12 && Number.isInteger(s.day) && s.day >= 1 && s.day <= DAYS_IN[s.month - 1];
      add('events', dayOk && okHours(e.hours), `${e.emoji ?? ''} ${e.name}: ${s.month}월 ${s.day}일부터, ${okHours(e.hours) ? span(e.hours) : '?'}`, !dayOk ? '없는 날짜예요' : '시간은 5(오전 5시)~29(새벽 5시), 시작 < 끝');
      if (e.showAt != null) add('events', e.showAt >= e.hours[0] && e.showAt < e.hours[1], `${e.name}: 쇼 ${hourKo(e.showAt)}`, '쇼 시각이 행사 시간 안에 있어야 해요');
      const badGoal = (e.todo ?? []).filter(t => !(Number.isInteger(t.goal) && t.goal >= 1 && t.goal <= 99));
      if (badGoal.length) add('events', false, `${e.name}: 할 것 목표`, '목표는 1~99');
    }
    const starts = (W.events.list ?? []).map(e => (e.start.month - 1) * 31 + e.start.day).sort((a, b) => a - b);
    const days = W.events.dates?.days ?? 7;
    const overlap = starts.some((v, i) => i && v - starts[i - 1] < days);
    add('events', !overlap, `행사 기간 ${days}일 — 서로 겹치지 않아요`, '두 행사 기간이 겹쳐요 (시작 날짜를 떼어 주세요)');
  }
  /* ---- 밤·새벽 ---- */
  if (W.night) {
    const N = W.night, mk = N.market;
    add('night', Number.isInteger(mk.weekday) && mk.weekday >= 0 && mk.weekday <= 6 && okHours(mk.hours, 17, 29), `야시장 ${WEEKDAY_KO[mk.weekday] ?? '?'} ${okHours(mk.hours, 17, 29) ? span(mk.hours) : '?'}`, '야시장 시간은 저녁 5시(17)~새벽 5시(29)');
    add('night', mk.ringHit >= 0 && mk.ringHit <= 1 && mk.ringThrows >= 1, `고리 던지기 ${mk.ringThrows}번 · 맞을 확률 ${Math.round(mk.ringHit * 100)}%`, '던지는 수 1 이상, 확률 0~1');
    const maxPrize = Math.max(...mk.ringPrizes.map(p => p.hits));
    add('night', maxPrize <= mk.ringThrows, `고리 상품 (최대 ${maxPrize}번 맞히기)`, `던지는 수 ${mk.ringThrows}번으로는 ${maxPrize}번 맞힐 수 없어요`);
    const badPrice = mk.stalls.flatMap(s => Object.entries(s.prices ?? {})).filter(([, v]) => !(Number.isInteger(v) && v > 0));
    add('night', !badPrice.length, '노점 값은 모두 1 이상', `값이 틀린 것: ${badPrice.map(([k]) => k).join(', ')}`);
    add('night', okHours(N.shop.hours, 17, 29), `달빛 가게 ${span(N.shop.hours)}`, '저녁 5시(17)~새벽 5시(29), 시작 < 끝');
    add('night', okHours(N.tent.hours, 17, 29), `새벽 천막 ${span(N.tent.hours)}`, '저녁 5시(17)~새벽 5시(29), 시작 < 끝');
    add('night', N.tarot.pick >= 1 && N.tarot.pick <= N.tarot.cards.length, `타로 ${N.tarot.cards.length}장 중 ${N.tarot.pick}장 고르기`, '고르는 수는 1~카드 수');
  }
  /* ---- 투어 ---- */
  if (W.tour) {
    const U = W.tour;
    const sum = U.ore.table.reduce((n, [, p]) => n + p, 0);
    add('tour', sum <= 1, `광석 바위 확률 합 ${Math.round(sum * 100)}% ≤ 100% (나머지 ${Math.round((1 - sum) * 100)}% 돌)`, '줄여 주세요');
    add('tour', U.ticket.perDay >= 1 && U.ticket.price >= 1, `표 ${U.ticket.price} 도토리 · 하루 ${U.ticket.perDay}번`, '값·횟수는 1 이상');
    add('tour', U.guest.firstTrip >= 1 && U.guest.every >= 1, `손님 주민: ${U.guest.firstTrip}번째 투어부터 ${U.guest.every}번마다`, '1 이상');
    const shapes = (U.shapes ?? []).filter(id => TOUR_SHAPES[id]);
    add('tour', shapes.length >= 1, `나오는 섬 모양 ${shapes.map(id => TOUR_SHAPES[id]).join(' · ') || '없음'}`, '모양을 하나 이상 골라 주세요');
  }
  return out;
}
