// 저장 옮기기 창 (M7-P4 UI-09, 보드 wave7 D43-A): 이 브라우저 저장은 그대로 두고, 다른 기기·브라우저로 옮길 "저장 글"을 만들고 불러온다.
// 아티팩트 안에서는 페이지가 파일을 직접 내려받게 할 수 없어서(sandbox) 내보내기 = 글 복사 + 글 상자,
// 파일로 받기는 downloads 능력이 있을 때(게시본, P6 이 capabilities 에 넣으면)나 로컬에서만.
// 불러오기 = 글 붙여넣기 또는 파일 고르기 → data.save.importText 가 버전·모양·확인 값 검사 → ui.confirm → 써 넣고 페이지 다시 열기.
// 창은 ctx.services.ui.panel 로만 연다 (섬폰 메뉴 줄은 P3 이 ui.transfer.open() 을 부른다). 저장 글 모양은 docs/notes/p11-save.md.
import { h, fmt } from './dom.js';
import { panelShell, button } from './panels.js';
import { gameInfo, injectCss, textFieldKeys, copyText } from './report.js';
import { parseSave } from '../data/save.js';

const MAX_FILE = 4 * 1024 * 1024;   // 저장 글 파일 크기 한도 (지금 저장은 수십 KB)

const CSS = `
.pk-transfer { width: min(460px, 100%); }
.pk-transfer .pk-card-body { display: flex; flex-direction: column; gap: 10px; padding-top: 14px; }
.pk-transfer-text { width: 100%; box-sizing: border-box; min-height: 120px; max-height: 32vh; resize: vertical; padding: 8px 10px; border: 2px solid var(--pk-edge); border-radius: 14px; background: var(--pk-slot); font: 12px/1.45 ui-monospace, Consolas, monospace; color: var(--pk-ink); word-break: break-all; }
.pk-transfer-text[readonly] { border-style: dashed; background: var(--pk-cream); }
.pk-transfer-text:focus-visible { outline: 3px solid var(--pk-focus); outline-offset: 1px; }
.pk-transfer .pk-btn-row { justify-content: flex-start; }
.pk-transfer-file { position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none; }
.pk-transfer-result { min-height: 1.4em; margin: 0; font-size: 15px; line-height: 1.5; word-break: keep-all; white-space: pre-line; }
.pk-transfer-result.is-warn { color: #B4532A; }
`;

const p2 = n => String(n).padStart(2, '0');
const dateText = ms => {
  if (!Number.isFinite(ms)) return '모름';
  const d = new Date(ms);
  return `${d.getFullYear()}.${p2(d.getMonth() + 1)}.${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
};
/** 저장 요약 → 한 줄 (확인 창·결과) */
export function infoText(info) {
  const who = [info.island, info.player && `${info.player}`].filter(Boolean).join(' · ') || '이름 없는 섬';
  return `「${who}」 · 도토리 ${fmt(info.acorns)} · 가방 ${info.items}칸 · 기증 ${info.museum}\n저장한 때 ${dateText(info.savedAt ?? info.exportedAt)}`;
}
const fileName = info => `pogeun-save-${(info.island || 'island').replace(/[^\w가-힣-]+/g, '_').slice(0, 20)}-${dateText(Date.now()).replace(/[.: ]/g, '')}.txt`;

/** 파일로 받기: 게시본은 downloads 능력(있을 때만), 로컬(아티팩트 밖)은 <a download> */
async function downloadsApi() {
  const claude = globalThis.claude;
  if (!claude?.use) return location.protocol === 'http:' || location.protocol === 'https:' ? 'local' : null;
  try { return (await claude.use('downloads')) ?? null; } catch { return null; }
}

export function createTransfer(ctx) {
  let open = null;

  function openTransfer({ tab = 'export' } = {}) {
    const ui = ctx.services.ui;
    const save = ctx.services.data?.save;
    if (!ui?.panel) return Promise.resolve(null);
    if (open) return open.result;
    injectCss('transfer', CSS);

    let p;
    const shell = panelShell({ cls: 'pk-transfer', title: '저장 옮기기', onClose: () => p.close(null), onOutside: () => p.close(null) });
    const result = h('p', { class: 'pk-transfer-result', 'aria-live': 'polite' });
    const say = (msg, warn = false) => { result.textContent = msg; result.classList.toggle('is-warn', warn); };

    // 탭: 내보내기 / 불러오기
    const tabs = h('div', { class: 'pk-seg', role: 'group', 'aria-label': '저장 옮기기' });
    const exportView = h('div', { class: 'pk-transfer-view' });
    const importView = h('div', { class: 'pk-transfer-view' });
    const tabBtns = [['export', '저장 글 받기', exportView], ['import', '불러오기', importView]].map(([id, label, view]) => {
      const b = h('button', { type: 'button', class: 'pk-seg-btn', dataset: { tab: id }, onclick: () => show(id) }, label);
      b.view = view;
      return b;
    });
    tabs.append(...tabBtns);
    function show(id) {
      for (const b of tabBtns) { const on = b.dataset.tab === id; b.setAttribute('aria-pressed', String(on)); b.view.hidden = !on; }
      say('');
    }

    // ----- 내보내기 -----
    const outBox = h('textarea', { class: 'pk-transfer-text', readonly: true, rows: '6', hidden: true, 'aria-label': '저장 글' });
    const makeText = () => {
      const text = save.exportText({ build: gameInfo().build });
      outBox.value = text;
      outBox.hidden = false;
      return text;
    };
    const copyBtn = button('글 복사', { primary: true, 'data-autofocus': '', onclick: async () => {
      const text = makeText();
      const ok = await copyText(text, outBox);
      say(ok ? '저장 글을 복사했어요. 다른 기기의 「불러오기」에 붙여 넣거나, 메모장에 붙여 .txt 로 남겨 두세요.'
        : '복사가 막힌 창이에요. 위 글 상자를 길게 눌러(또는 Ctrl+A, Ctrl+C) 복사해 주세요.', !ok);
    } });
    const fileBtn = button('파일로 받기', { hidden: true, onclick: async () => {
      const text = makeText();
      const info = parseSave(text).info;
      const name = fileName(info ?? {});
      const api = await downloadsApi();
      try {
        if (api === 'local') {
          const a = h('a', { href: URL.createObjectURL(new Blob([text], { type: 'text/plain' })), download: name });
          document.body.append(a); a.click(); a.remove();
          setTimeout(() => URL.revokeObjectURL(a.href), 5000);
          say(`${name} 로 받았어요.`);
        } else if (api) {
          const r = await api.save({ filename: name, data: text });
          say(r?.status === 'delivered' ? '보냈어요.' : `${name} 로 받았어요.`);
        }
      } catch (e) {
        say(e?.code === 'declined' ? '파일 받기를 그만뒀어요.' : '파일로 받지 못했어요. 「글 복사」를 써 주세요.', e?.code !== 'declined');
      }
    } });
    downloadsApi().then(api => { if (api) fileBtn.hidden = false; });
    exportView.append(
      h('p', { class: 'pk-small', text: '이 브라우저 저장은 그대로 두고, 다른 기기·브라우저로 옮길 저장 글을 만들어요.' }),
      h('div', { class: 'pk-btn-row' }, copyBtn, fileBtn),
      outBox,
      h('p', { class: 'pk-muted pk-small', text: '저장 글에는 섬 진행만 들어 있어요. 글 일부가 빠지면 불러올 수 없으니 처음부터 끝까지 통째로 옮겨 주세요.' }));

    // ----- 불러오기 -----
    const inBox = h('textarea', { class: 'pk-transfer-text', rows: '6', spellcheck: 'false', autocomplete: 'off', 'aria-label': '저장 글 붙여 넣기',
      placeholder: 'POGEUN-SAVE 로 시작하는 저장 글을 여기에 붙여 넣으세요.' });
    const fileInput = h('input', { type: 'file', class: 'pk-transfer-file', accept: '.txt,.json,text/plain,application/json', tabindex: '-1', 'aria-hidden': 'true' });
    fileInput.addEventListener('change', async () => {
      const f = fileInput.files?.[0];
      fileInput.value = '';
      if (!f) return;
      if (f.size > MAX_FILE) { say('파일이 너무 커요. 포근섬 저장 글 파일이 맞는지 확인해 주세요.', true); return; }
      try { inBox.value = await f.text(); } catch { say('파일을 읽지 못했어요.', true); return; }
      say(`${f.name} 을 읽었어요. 「검사하고 불러오기」를 눌러 주세요.`);
      loadBtn.focus();
    });
    const pickBtn = button('파일 고르기', { onclick: () => fileInput.click() });
    const loadBtn = button('검사하고 불러오기', { primary: true, onclick: () => doImport() });

    async function doImport() {
      if (!save?.importText) { say('저장 기능이 아직 연결되지 않았어요.', true); return; }
      const parsed = parseSave(inBox.value);
      if (!parsed.ok) { say(`${parsed.reason}\n지금 저장은 그대로예요.`, true); return; }
      const yes = await ui.confirm({
        title: '이 저장으로 바꿀까요?', icon: '📦',
        text: `${infoText(parsed.info)}\n\n지금 이 브라우저의 섬은 이 저장으로 바뀌고, 게임을 다시 열어요.\n(지금 저장은 사본으로 남겨 둬요)`,
        buttons: [{ label: '바꾸고 다시 열기', value: true, primary: true }, { label: '그만두기', value: false }],
        cancelValue: false,
      });
      if (!yes) { say('그만뒀어요. 지금 저장은 그대로예요.'); return; }
      const r = save.importText(inBox.value);
      if (!r.ok) { say(`${r.reason}\n지금 저장은 그대로예요.`, true); return; }
      say('불러왔어요! 게임을 다시 여는 중…');
      ctx.events?.emit('save:imported', { info: r.info });
      ui.toast?.('저장을 불러왔어요. 다시 여는 중…', '📦');
      setTimeout(() => {
        try { location.reload(); } catch { /* 막힘 */ }
        setTimeout(() => say('불러왔어요. 페이지를 새로 고치면 이 저장으로 시작해요.'), 3000);
      }, 700);
    }
    importView.append(
      h('p', { class: 'pk-small', text: '다른 기기에서 받은 저장 글을 붙여 넣거나 파일을 골라요. 불러오면 이 브라우저의 섬이 그 저장으로 바뀌어요.' }),
      inBox, fileInput,
      h('div', { class: 'pk-btn-row' }, pickBtn, loadBtn));

    const canSave = save?.available !== false;
    shell.body.append(tabs, exportView, importView, result);
    if (!save) say('저장 기능이 아직 연결되지 않았어요.', true);
    else if (!canSave) say('이 창에서는 저장할 수 없어서, 불러온 저장도 창을 닫으면 사라져요. 저장 글 받기만 쓸 수 있어요.', true);
    loadBtn.disabled = !canSave || !save;
    copyBtn.disabled = !save;
    show(tab === 'import' ? 'import' : 'export');

    p = ui.panel('transfer', shell.root, {
      initialFocus: () => (tab === 'import' ? inBox : copyBtn),
      onKey: textFieldKeys,
      onClose: () => { open = null; },
    });
    open = p;
    return p.result;
  }

  return { open: openTransfer };
}
