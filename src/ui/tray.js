// 알림 칸 묶음 (M20 D267): 오른쪽 아래에 따로 떠 있던 행사 칩(.ev-chip, events) · 밤 운세 칩(.nt-chip, night) · 등대 진행판(.lh-box, lighthouse)을
// 한 상자(.pk-tray) 안으로 모은다. 각 모듈은 ctx.uiRoot 에 붙이고 자기 요소를 계속 들고 있으니 옮기기만 하면 된다 (숨기기·글자 바꾸기는 그대로).
// 자리·모양은 ui.css 「알림 칸 묶음」: 넓은 화면은 오른쪽 아래 세로 쌓기, 휴대폰 세로·가로는 시계 밑 한 줄 (등대는 머리 줄만, 누르면 펼침).
import { h } from './dom.js';

export const TRAY_ITEMS = '.ev-chip, .nt-chip, .lh-box';

/** → { root, grab(node) } — root 를 .pk-root 안에 붙인다 (창 쌓기 .pk-stack 보다 아래라 창이 열리면 창이 위) */
export function createTray(uiRoot) {
  const root = h('div', { class: 'pk-tray', 'data-pk-tray': '' });
  const grab = n => {
    if (n?.nodeType !== 1 || n.parentNode === root || !n.matches?.(TRAY_ITEMS)) return;
    root.append(n);
  };
  if (uiRoot) {
    uiRoot.querySelectorAll?.(TRAY_ITEMS).forEach(grab);
    if (typeof MutationObserver === 'function') {
      new MutationObserver(list => { for (const m of list) m.addedNodes.forEach(grab); }).observe(uiRoot, { childList: true });
    }
  }
  return { root, grab };
}
