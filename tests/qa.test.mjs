// QA 세션에서 고친 작은 버그들의 되풀이 막기 (자동 플레이 점검 docs/qa/ 에서 찾은 것)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createEmoteSet } from '../src/gameplay/festival/emotes.js';
import { partToast } from '../src/gameplay/festival/fest.js';

const json = p => JSON.parse(readFileSync(new URL(`../${p}`, import.meta.url), 'utf8'));

test('이모티콘 말풍선의 아이템 그림: 게시본 blob 주소를 쓰고, 아직 없으면 경로 대신 이모지', () => {
  const set = json('assets/emotes/emotes.json');
  const items = { get: id => ({ 'mat.wood': { id, name: '나무', icon: 'assets/items/renders/item-wood_thumb.png', emoji: '🪵' }, 'fruit.x': { id, name: '열매', icon: '🍎' } })[id] ?? null };
  // 게시본: 묶음에서 만든 blob 주소
  const packed = createEmoteSet(set, {}, { imgUrl: p => `blob:x/${p.length}`, prefetch: () => {} });
  assert.match(packed.token('item:mat.wood', items), /<img [^>]*src="blob:x\/\d+"/);
  // 아직 주소가 없을 때: 원래 경로를 src 로 넣지 않고(게시본에선 404) 이모지, 그리고 주소를 받아 둔다
  const asked = [];
  const cold = createEmoteSet(set, {}, { imgUrl: () => null, prefetch: p => asked.push(p) });
  const html = cold.token('item:mat.wood', items);
  assert.doesNotMatch(html, /assets\/items/);
  assert.match(html, /🪵/);
  assert.deepEqual(asked, ['assets/items/renders/item-wood_thumb.png']);
  // 이모지 아이콘 아이템은 그대로
  assert.match(cold.token('item:fruit.x', items), /🍎/);
});

test('축제 부품 알림: 받침에 맞는 을/를 (예전엔 늘 「…」를)', () => {
  const cfg = json('assets/festival/config.json');
  const want = { '반딧불 등불': '을', '응원 북': '을', '꽃 가랜드': '를', '과일 솥': '을', '낚시 대회 깃발': '을' };
  for (const p of cfg.parts.list) {
    const t = partToast(p.name, 1, 5);
    assert.ok(t.startsWith(`축제 부품 「${p.name}」`), t);
    if (want[p.name]) assert.equal(t, `축제 부품 「${p.name}」${want[p.name]} 받았어요 (1/5)`);
  }
});
