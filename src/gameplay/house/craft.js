// 작업대 제작: 레시피 목록(5개씩 쪽 넘김) → 고른 것의 재료 확인 → 만들기.
// ui 에 제작 창이 없어서 ui.dialog 선택지 + ui.confirm 으로 만든다 (제안: docs/notes/house.md).
// 만들기는 data.recipes.craft(id) — 재료를 빼고 결과물을 가방에 넣는 것까지 한 번에(실패하면 그대로) 한다.

const PER_PAGE = 5;

export const josa = (word, pair) => {
  const w = String(word ?? '');
  const [withB, withoutB] = pair.split('/');
  const c = w.charCodeAt(w.length - 1) - 0xac00;
  if (c < 0 || c > 11171) return w + withB;
  return w + (c % 28 ? withB : withoutB);
};

/** 레시피 재료 줄 → [{ name, n, have }] (data 의 needs 모양과 ui 계약의 materials 모양 둘 다 읽는다) */
export function needsOf(data, r) {
  const raw = r.needs ?? (r.materials ?? r.ingredients ?? []).map(m => (Array.isArray(m) ? { id: m[0], n: m[1] } : { id: m.id, category: m.category, n: m.n ?? m.count }));
  return raw.map(nd => ({
    name: nd.id ? (data.items.get(nd.id)?.name ?? nd.id) : `${data.items.categoryName?.(nd.category) ?? nd.category} 아무거나`,
    n: nd.n,
    have: nd.id ? data.inventory.count(nd.id) : data.inventory.countCategory(nd.category),
  }));
}

/** 글자 안에 넣을 아이콘: 그림 경로면 이모지(item.emoji)로 */
const textIcon = it => it?.emoji ?? (/\.(svg|png|webp|jpe?g)$/i.test(it?.icon ?? '') ? '🔨' : it?.icon ?? '🔨');

function choiceLabel(data, r) {
  const it = data.items.get(r.result ?? r.id);
  const short = needsOf(data, r).filter(x => x.have < x.n).map(x => `${x.name} ${x.n - x.have}`);
  const note = r.season ? SEASON_MARK[r.season] ?? '📜' : r.unlock ? '📜' : '';   // M13 D146-A: 레시피 쪽지로 연 레시피 · M18-P4 계절 레시피는 계절 표시
  return short.length ? `${note}${textIcon(it)} ${it?.name ?? r.id} · ${short.join(', ')} 모자람` : `${note}${textIcon(it)} ${it?.name ?? r.id}  ✔`;
}

/** M18-P4 (D196-A) 계절 레시피 표시 */
const SEASON_MARK = { spring: '🌸', summer: '🐚', autumn: '🍁', winter: '❄️' };

/** 작업대를 연다. 무언가 만들었으면 true */
export async function openWorkbench(ctx) {
  const { data, ui } = ctx.services;
  if (!data?.recipes || !ui?.dialog) return false;
  const list = data.recipes.list();
  if (!list.length) { ui.toast?.('아직 아는 레시피가 없어요', '🔨'); return false; }
  const pages = Math.ceil(list.length / PER_PAGE);
  const locked = data.recipes.locked?.().length ?? 0;   // M13 D146-A: 아직 모르는 새 레시피 수
  let page = 0, first = true;
  for (;;) {
    const slice = list.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE);
    const labels = slice.map(r => choiceLabel(data, r));
    const nav = pages > 1 ? labels.push(page + 1 < pages ? '다음 목록 ▶' : '처음 목록 ◀') - 1 : -1;
    const quit = labels.push('그만두기') - 1;
    const pick = await ui.dialog.open({
      speaker: '작업대', color: '#C99B68',
      lines: [first ? `무엇을 만들까요? (${page + 1}/${pages})${locked ? ` — 레시피 쪽지를 모으면 새 레시피가 ${locked}개 더 열려요` : ''}` : `다른 레시피예요. (${page + 1}/${pages})`],
      choices: labels,
    });
    first = false;
    if (pick == null || pick === quit) return false;
    if (pick === nav) { page = (page + 1) % pages; continue; }
    if (await craftOne(ctx, slice[pick])) return true;
  }
}

async function craftOne(ctx, r) {
  const { data, ui } = ctx.services;
  const it = data.items.get(r.result ?? r.id);
  const name = it?.name ?? r.id, icon = it?.icon ?? '🔨';
  const needs = needsOf(data, r);
  const mats = needs.map(x => `${x.name} ${Math.min(x.have, x.n)}/${x.n}`).join(' · ');
  const short = needs.filter(x => x.have < x.n);
  if (short.length) {
    await ui.confirm({ title: name, icon, text: `재료가 모자라요 — ${short.map(x => `${x.name} ${x.n - x.have}개`).join(', ')} 더 있어야 해요. (${mats})`,
      buttons: [{ label: '돌아가기', value: false, primary: true }], cancelValue: false });
    return false;
  }
  if (!data.recipes.canCraft(r.id)) {
    await ui.confirm({ title: name, icon, text: '가방이 가득 차서 만든 것을 넣을 자리가 없어요.', buttons: [{ label: '돌아가기', value: false, primary: true }], cancelValue: false });
    return false;
  }
  const ok = await ui.confirm({ title: `${name} 만들기`, icon, text: `재료: ${mats}`,
    buttons: [{ label: '만들기', value: true, primary: true }, { label: '그만두기', value: false }], cancelValue: false });
  if (!ok) return false;
  if (!data.recipes.craft(r.id)) { ui.toast?.('만들지 못했어요', '🔨'); return false; }
  for (let i = 0; i < 3; i++) ctx.events.emit('sfx', { name: 'axe-wood', volume: 0.7, pitch: 1.1 + i * 0.05, delay: i * 0.22 });
  ctx.services.player?.play?.('happy');
  ui.toast?.(`${josa(name, '을/를')} 만들었어요!`, icon);
  ctx.events.emit('house:craft', { id: r.id, result: r.result ?? r.id });
  return true;
}
