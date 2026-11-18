// M21-P2 친구 섬 구경 — 보여 주기 · 섬 코드 · 섬 사진 올리기 · 오늘의 섬 고르기 · 코드로 찾기 (서비스만, 구경 섬 x 1300 은 M21-P3).
// 보드 wave17 반영 v1: D281-A (켠 사람만, 기본 꺼짐) · D284-A (섬 코드 6자리) · D285-A (날마다 바뀌는 「오늘의 섬」 셋).
// 저장 state.visit = { share: false, code: null, lastPut: null(올린 게임 날), error: null }
// 섬폰 설정 「친구 섬 구경」 칸은 ui/phone.js 가 이 서비스를 읽어 그린다 (켜기·끄기 + 내 섬 코드).
// 섬 사진은 하루 한 번(data:newday)·켤 때 올리고, 끌 때 지운다. 저장소가 없으면 조용히 꺼 둔다 (available false).
// 노트 docs/notes/m21-p2-share.md.
import * as R from './rules.js';
import { openStore } from './store.js';
import { attachGuestbook } from './guestbook.js';   // M21-P4 방명록·편지·선물

const WHY_TEXT = {
  'no-store': '이 창에서는 섬을 보여 줄 수 없어요.',
  'read-only': '이 링크로는 섬을 올릴 수 없어요 (구경만 돼요).',
  'not-owner': '다른 사람의 섬 자리라 쓸 수 없어요.',
  'not-own-path': '다른 사람의 섬 자리라 쓸 수 없어요.',
  'code-taken': '섬 코드가 겹쳤어요. 다시 켜 보세요.',
  'too-big': '섬 사진이 너무 커요.',
  'busy': '잠깐만요, 아직 올리는 중이에요.',
};
export const whyText = why => WHY_TEXT[why] ?? '지금은 섬을 올리지 못했어요.';

export default {
  name: 'visit',
  async init(ctx) {
    const S = () => ctx.services;
    const V = () => {
      const v = (ctx.state.visit ||= {});
      if (typeof v.share !== 'boolean') v.share = false;
      if (!R.isCode(v.code)) v.code = null;
      return v;
    };
    V();
    const dayKey = () => S().time?.now?.().dayKey ?? S().data?.day?.key?.() ?? '';
    let store = null, ready = false, busy = false;
    const changed = () => ctx.events.emit('visit:changed', api.status());

    function photo() {
      let residents;
      try { residents = S().town?.residents?.(); } catch { residents = undefined; }
      return R.snapshot(ctx.state, { residents, dayKey: dayKey(), now: Date.now() });
    }

    /** 다른 사람이 쓰지 않는 새 코드 (겹치면 다섯 번까지 다시) */
    async function freshCode() {
      for (let i = 0; i < 5; i++) {
        const code = R.makeCode();
        const other = await store.byCode(code).catch(() => null);
        if (!other || other.user === store.uid) return code;
      }
      return R.makeCode();
    }

    async function upload() {
      const v = V();
      if (!store?.writable || !v.share) return { ok: false, why: store ? 'read-only' : 'no-store' };
      if (busy) return { ok: false, why: 'busy' };
      busy = true;
      try {
        if (!v.code) v.code = await freshCode();
        const doc = R.islandDoc({ code: v.code, user: store.uid, snap: photo(), dayKey: dayKey(), now: Date.now(), hide: v.hide });   // M21-P4 hide = 주인이 숨긴 글
        let res = await store.put(doc);
        if (!res?.ok && res?.why === 'code-taken') {   // 드물게 겹치면 새 코드로 한 번 더
          v.code = await freshCode();
          res = await store.put({ ...doc, code: v.code });
        }
        if (res?.ok) { v.lastPut = dayKey(); v.error = null; }
        else v.error = res?.why ?? 'error';
        return res?.ok ? { ok: true, code: v.code } : { ok: false, why: v.error };
      } catch (e) {
        console.warn('[visit] 섬 사진 올리기 실패', e);
        v.error = 'error';
        return { ok: false, why: 'error' };
      } finally { busy = false; changed(); }
    }

    const api = {
      rules: R,
      /** 거절 이유 → 화면 글 */
      whyText,
      /** 저장소가 준비됐고 이 창에서 쓸 수 있나 */
      get available() { return !!store?.writable; },
      /** 저장소 종류 'db' | 'local' | null */
      get kind() { return store?.kind ?? null; },
      /** 내 쓴 사람 id (저장소가 없으면 null) */
      get uid() { return store?.uid ?? null; },
      /** 섬폰이 그리는 상태 */
      status() {
        const v = V();
        return { ready, available: !!store?.writable, readable: !!store, share: v.share && !!store?.writable, wanted: v.share, code: v.code, lastPut: v.lastPut ?? null, error: v.error ?? null, busy };
      },
      /** 보여 주기 켜기·끄기 → { ok, code? , why? }. 켜면 바로 올리고, 끄면 저장소에서 지운다 (코드는 남겨 다시 켜면 같은 코드) */
      async setShare(on) {
        const v = V();
        if (!store?.writable) { v.share = false; changed(); return { ok: false, why: store ? 'read-only' : 'no-store' }; }
        if (on) {
          v.share = true;
          const r = await upload();
          if (!r.ok) v.share = false;
          ctx.events.emit('visit:share', { on: v.share, code: v.code });
          changed();
          return r;
        }
        v.share = false;
        let r = { ok: true };
        try { r = await store.remove(); } catch (e) { console.warn('[visit] 섬 사진 지우기 실패', e); r = { ok: false, why: 'error' }; }
        v.lastPut = null;
        ctx.events.emit('visit:share', { on: false, code: v.code });
        changed();
        return r;
      },
      /** 지금 섬 사진 다시 올리기 (켜져 있을 때만) */
      upload,
      /** 지금 올릴 섬 사진 (올리지 않음 — 확인·P3 용) */
      photo,
      /** 올라온 섬 문서 목록 (저장소에서, 실패하면 []) */
      async list() { if (!store) return []; try { return await store.list(); } catch { return []; } },
      /** 「오늘의 섬」 셋 (D285-A): 날짜 시드로 고른 남의 섬 문서 3개. list 를 주면 그 목록에서 (순수) */
      async today({ list, day = dayKey(), n = R.TODAY_COUNT } = {}) {
        return R.todayPicks(list ?? await api.list(), day, { n, mine: V().code });
      },
      /** 섬 코드(사람이 친 글)로 찾기 → 섬 문서 | null */
      async find(text) {
        const code = R.normalizeCode(text);
        if (!code || !store) return null;
        try { return await store.byCode(code); } catch { return null; }
      },
    };
    ctx.services.visit = api;
    await attachGuestbook(ctx, api).catch(e => console.warn('[visit] 방명록을 못 붙임', e));   // M21-P4 방명록·편지·선물 (api.guestbook · ui.friends · 행동 키 visit-guestbook)

    // 하루 한 번 올리기
    ctx.events.on('data:newday', () => { if (R.needsUpload(V(), dayKey())) upload(); });

    // 저장소는 기다리지 않는다 (게임 시작을 막지 않게)
    openStore().then(s => {
      store = s; ready = true;
      const v = V();
      // 저장소가 없는 곳에선 조용히 꺼진 것으로 보인다 (status.share false). 저장의 켜짐은 그대로 둬서 저장소가 잠깐 늦은 날에도 풀리지 않는다
      changed();
      if (store?.writable && R.needsUpload(v, dayKey())) upload();
    }, e => { console.warn('[visit] 저장소 열기 실패', e); ready = true; changed(); });
  },
  update() {},
};
