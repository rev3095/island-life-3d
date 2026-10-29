// 검수 보드 공용 도구 (모든 차수의 검수 보드가 같이 쓴다).
// 선택·의견을 아티팩트 저장소(db)에 두고, Claude 가 반영한 버전과 비교해 바뀐 것을 표시하고, 지난 반영으로 되돌린다.
//
// 페이지가 준비할 것 (이 파일보다 먼저):
//   window.BOARD = { id: 'wave5', decisions: [{ id: 'D8', q, opts: [[key, 제목, 설명, 추천?], …] }, …] }
//   결정 라디오: <input type="radio" name="<결정 id>" value="<key>">
//   의견 칸:     <input class="note" data-id="<ID>" data-label="<이름>">
//   상태 자리:   <div id="boardPanel"></div>
//
// 저장소 (컬렉션/문서):
//   boards/<보드 id>   지금 선택   { board, picks: {D8: 'A'}, notes: {ID: 글}, status: 'editing'|'requested', updatedAt, updatedBy }
//   applied/<보드 id>  마지막 반영 { board, version, picks, notes, appliedAt, summary }        ← Claude 가 씀
//   history/<보드 id>-v<n>  반영 기록 (applied 와 같은 모양)                                  ← Claude 가 씀
// 채팅에 "검수 보드 반영" → Claude 가 boards 를 읽고 applied 와 다른 것만 게임에 반영(되돌리기 포함) → applied·history 기록.
//
// window.BOARD 가 없는 페이지(편집기·편집기 홈)도 이 파일을 실으면 반영 기록 공용 도구 window.ApplyLog 를 쓸 수 있다 (ET-11).

/* ---------- 반영 기록 공용 (ET-11) ---------- */
// 검수 보드·편집기가 모두 같은 모양으로 남긴다 (모양·되돌리기 순서는 concept/README.md 「반영 기록 공용 모양」):
//   applied/<id>       마지막 반영 { board: <id>, version, appliedAt, summary, commit, … }   ← Claude 가 씀
//   history/<id>-v<n>  반영 기록 (applied 와 같은 모양)                                     ← Claude 가 씀
//   보드는 picks·notes, 편집기는 changed (바뀐 요소 목록) 를 더 둔다.
window.ApplyLog = (function () {
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const when = t => t ? new Date(t).toLocaleString('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
  const sort = rows => [...rows].sort((a, b) => b.version - a.version);
  // 머리 줄: 마지막 반영 v<n> · 때 · 요약
  function head(applied, { label = '마지막 반영', empty = '아직 반영 기록이 없어요.' } = {}) {
    return applied
      ? `<p><b>${esc(label)} v${applied.version}</b> · ${esc(when(applied.appliedAt))}${applied.summary ? ` · <span class="muted">${esc(applied.summary)}</span>` : ''}</p>`
      : `<p><b>${esc(empty)}</b></p>`;
  }
  // 반영 기록 목록 (새 것부터). action(h) = 줄 끝에 붙일 단추·링크 HTML
  function list(history, { action = () => '', title = n => `반영 기록 ${n}개 · 되돌리기` } = {}) {
    if (!history?.length) return '';
    return `<details><summary>${esc(title(history.length))}</summary><ol class="hist">${history.map(h => `
        <li><span><b>v${h.version}</b> · ${esc(when(h.appliedAt))} · ${esc(h.summary ?? '')}</span>
          ${action(h)}</li>`).join('')}</ol></details>`;
  }
  // 저장소 구독: applied/<id> 와 history (board == id)
  function watch(db, id, { onApplied, onHistory } = {}) {
    if (onApplied) db.doc(`applied/${id}`).onSnapshot(snap => onApplied(snap.exists ? snap.data() : null), () => {});
    if (onHistory) db.collection('history').where('board', '==', id).onSnapshot(qs => onHistory(sort(qs.docs.map(d => d.data()))), () => {});
  }
  return { esc, when, sort, head, list, watch };
})();

/* ---------- 검수 보드 ---------- */
(function () {
  const B = window.BOARD;
  const panel = document.getElementById('boardPanel');
  if (!B || !panel) return;
  const LOCAL = `board-${B.id}-local`;
  const OLD_LOCAL = { wave5: 'wave5-board-notes' }[B.id];       // 저장소를 쓰기 전 v0.5 가 쓰던 자리
  const notes = () => [...document.querySelectorAll('.note[data-id]')];
  const { esc, head: headHtml, list: listHtml, watch } = window.ApplyLog;

  let db = null, current = null, applied = null, history = [], status = 'editing';
  let saveTimer = null, lastSaved = '', saveMsg = '저장소에 연결하는 중…', note = '';

  /* ---------- 화면 ↔ 선택 ---------- */
  function readDom() {
    const picks = {}, nt = {};
    for (const d of B.decisions) { const r = document.querySelector(`input[name="${d.id}"]:checked`); if (r) picks[d.id] = r.value; }
    for (const n of notes()) if (n.value.trim()) nt[n.dataset.id] = n.value.trim();
    return { picks, notes: nt };
  }
  function writeDom(s) {
    for (const d of B.decisions) {
      const key = s.picks?.[d.id];
      if (key) { const r = document.getElementById(d.id + key) ?? document.querySelector(`input[name="${d.id}"][value="${key}"]`); if (r) r.checked = true; }
    }
    for (const n of notes()) { n.value = s.notes?.[n.dataset.id] ?? ''; n.classList.toggle('filled', !!n.value.trim()); }
  }
  const sig = s => JSON.stringify([s.picks, s.notes, status]);

  /* ---------- 반영 뒤 바뀐 것 ---------- */
  function changed() {
    if (!applied) return [];
    const s = readDom(), out = [];
    for (const d of B.decisions) if ((s.picks[d.id] ?? '') !== (applied.picks?.[d.id] ?? '')) out.push(d.id);
    const ids = new Set([...Object.keys(s.notes), ...Object.keys(applied.notes ?? {})]);
    for (const id of ids) if ((s.notes[id] ?? '') !== (applied.notes?.[id] ?? '')) out.push(id);
    return out;
  }
  function markChanged() {
    const ch = new Set(changed());
    document.querySelectorAll('.changed').forEach(el => el.classList.remove('changed'));
    for (const d of B.decisions) if (ch.has(d.id)) document.querySelector(`input[name="${d.id}"]`)?.closest('.card')?.classList.add('changed');
    for (const n of notes()) if (ch.has(n.dataset.id)) (n.closest('.card, .sw, tr') ?? n).classList.add('changed');
  }

  /* ---------- 저장 ---------- */
  function localSave(s) { try { localStorage.setItem(LOCAL, JSON.stringify(s)); } catch {} }
  async function save() {
    clearTimeout(saveTimer); saveTimer = null;
    const s = readDom();
    if (sig(s) === lastSaved) return;
    if (!current) { localSave(s); lastSaved = sig(s); saveMsg = '이 창에서는 보드 저장소를 쓸 수 없어서 이 브라우저에만 남겨 뒀어요.'; render(); return; }
    try {
      await current.set({ board: B.id, picks: s.picks, notes: s.notes, status, updatedAt: Date.now(), updatedBy: 'page' });
      lastSaved = sig(s); saveMsg = '저장됨 — 어느 기기에서 열어도 같은 선택이 보여요.';
    } catch (e) {
      localSave(s); saveMsg = `저장하지 못했어요 (${e?.code ?? '오류'}). 이 브라우저에만 남겨 뒀어요. 잠시 뒤 다시 바꿔 보세요.`;
    }
    render();
  }
  function scheduleSave() { clearTimeout(saveTimer); saveTimer = setTimeout(save, 700); markChanged(); render(); }
  document.addEventListener('input', e => { if (e.target.matches?.('.note')) { e.target.classList.toggle('filled', !!e.target.value.trim()); status = 'editing'; scheduleSave(); } });
  document.addEventListener('change', e => { if (e.target.matches?.('input[type=radio]')) { status = 'editing'; scheduleSave(); } });

  /* ---------- 상태 칸 ---------- */
  function render() {
    const ch = changed();
    const head = headHtml(applied);
    const diff = applied
      ? (ch.length ? `<p>반영 뒤 바뀐 것 <b>${ch.length}개</b>: ${ch.map(id => `<span class="tag changedTag">${esc(id)}</span>`).join(' ')}</p>`
                   : '<p class="muted small">반영한 뒤로 바뀐 선택·의견이 없어요.</p>')
      : '';
    const req = status === 'requested'
      ? '<p class="small"><b>반영 요청을 표시했어요.</b> 채팅에 <b>"검수 보드 반영"</b>이라고 보내 주세요 (보드가 Claude 를 직접 부르지는 못해요).</p>'
      : '';
    const hist = listHtml(history, { action: h =>
      `<button type="button" class="ghost" data-rollback="${h.version}" ${applied && h.version === applied.version && !ch.length ? 'disabled' : ''}>이 선택으로 되돌리기</button>` });
    panel.innerHTML = `${head}${diff}${req}
      <div class="btns"><button type="button" id="markRequest" ${ch.length || !applied ? '' : 'class="ghost"'}>반영 요청 표시</button><span class="small muted">${esc(saveMsg)}</span></div>
      ${note ? `<p class="small" role="status">${esc(note)}</p>` : ''}${hist}`;
  }
  panel.addEventListener('click', async e => {
    const rb = e.target.closest('[data-rollback]');
    if (rb) {
      const h = history.find(x => String(x.version) === rb.dataset.rollback);
      if (!h) return;
      writeDom(h); status = 'requested';
      note = `v${h.version} 선택으로 되돌렸어요. 채팅에 "검수 보드 반영"이라고 보내면 게임에도 되돌려요.`;
      markChanged(); await save(); return;
    }
    if (e.target.id === 'markRequest') { status = 'requested'; note = ''; await save(); }
  });

  /* ---------- 저장소 연결 ---------- */
  function readLocal() {
    try {
      const s = JSON.parse(localStorage.getItem(LOCAL) || 'null');
      if (s) return s;
      const old = OLD_LOCAL && JSON.parse(localStorage.getItem(OLD_LOCAL) || 'null');
      if (!old) return null;
      const picks = {}, nt = {};
      for (const [k, v] of Object.entries(old)) { if (k.startsWith('pick-')) picks[k.slice(5)] = v; else nt[k] = v; }
      return { picks, notes: nt };
    } catch { return null; }
  }
  function clearLocal() { try { localStorage.removeItem(LOCAL); if (OLD_LOCAL) localStorage.removeItem(OLD_LOCAL); } catch {} }

  render();
  const local = readLocal();
  if (local) { writeDom(local); markChanged(); }
  (async () => {
    db = await window.claude?.use?.('db').catch(() => null) ?? null;
    if (!db) { saveMsg = '이 창에서는 보드 저장소를 쓸 수 없어요. 선택은 이 브라우저에만 남아요.'; render(); return; }
    current = db.doc(`boards/${B.id}`);
    try {
      const snap = await current.get();
      const data = snap.exists ? snap.data() : null;
      // 저장소를 쓰기 전에 이 브라우저에 남긴 선택이 있으면 한 번 옮긴다 (Claude 가 넣어 둔 처음 값일 때만)
      if (local && (!data || data.updatedBy === 'seed')) { writeDom(local); status = 'editing'; await save(); clearLocal(); }
      else if (data) { status = data.status ?? 'editing'; writeDom(data); lastSaved = sig(readDom()); saveMsg = '저장소와 맞춰 놨어요.'; if (local) clearLocal(); }
      else saveMsg = '아직 저장된 선택이 없어요. 고르면 바로 저장돼요.';
    } catch (e) { saveMsg = `저장소를 읽지 못했어요 (${e?.code ?? '오류'}).`; }
    markChanged(); render();
    // 다른 창·기기에서 바꾼 것 (입력 중인 칸은 건드리지 않는다)
    current.onSnapshot(snap => {
      if (!snap.exists || snap.metadata.hasPendingWrites || saveTimer) return;
      const d = snap.data();
      if (JSON.stringify([d.picks, d.notes, d.status]) === lastSaved) return;
      if (document.activeElement?.matches?.('.note')) return;
      status = d.status ?? 'editing'; writeDom(d); lastSaved = sig(readDom()); markChanged(); render();
    }, () => {});
    watch(db, B.id, {
      onApplied: d => { applied = d; markChanged(); render(); },
      onHistory: rows => { history = rows; render(); },
    });
  })();

  window.boardKit = { changed, saveNow: save, applied: () => applied };
})();
