// 오늘의 행운 (M12 밤·새벽 D112-A 타로 카드). 값·출현을 정하는 data 함수가 여기서 그날 보너스를 묻는다.
// 보너스를 주는 쪽(gameplay/night 의 타로)은 ctx.services.data.luck.set(fn) 으로 「지금 보너스 표를 돌려주는 함수」를 건다 — fn() → { key: 값 } | null.
// 열쇠: sell (모든 파는 값 비율) · sell:<분류> · buy:<분류> (사는 값 비율, 음수 = 싸게) · bigFish (큰 물고기 가중치 +배) · rareFossil (귀한 화석 가중치 +배) · shakeBug (흔들기 곤충 확률 +) · rockHits (바위 횟수 +)
let source = () => null;

export function setLuck(fn) { source = typeof fn === 'function' ? fn : () => null; }

/** 열쇠 하나 → 숫자 (없으면 0) */
export function luck(key) {
  try { const v = source()?.[key]; return Number.isFinite(v) ? v : 0; } catch { return 0; }
}

/** 파는 값 배율 (분류 하나): 1 + sell + sell:<분류> */
export const sellMult = category => 1 + luck('sell') + (category ? luck(`sell:${category}`) : 0);
/** 사는 값 배율 (분류 하나): 1 + buy:<분류> (0.5 아래로는 안 내려감) */
export const buyMult = category => Math.max(0.5, 1 + (category ? luck(`buy:${category}`) : 0));
