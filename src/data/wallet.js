// 지갑: 도토리. 0 아래로 내려가지 않고 WALLET_MAX 를 넘지 않는다.
export const WALLET_MAX = 999999;

const amount = n => (Number.isFinite(n) && n > 0 ? Math.floor(n) : 0);

export function createWallet(state, { onChange = () => {} } = {}) {
  if (!state.wallet || typeof state.wallet !== 'object') state.wallet = { acorns: 0 };
  const get = () => {
    const a = state.wallet.acorns;
    return Number.isFinite(a) ? Math.min(WALLET_MAX, Math.max(0, Math.floor(a))) : 0;
  };
  const set = v => {
    const next = Math.min(WALLET_MAX, Math.max(0, Math.floor(v)));
    if (next === state.wallet.acorns) return next;
    state.wallet.acorns = next;
    onChange(next);
    return next;
  };

  return {
    get,
    /** 더하기 → 새 잔액 (음수·NaN 은 무시, 최대치에서 멈춤) */
    add: n => set(get() + amount(n)),
    /** 쓰기 → 성공하면 true. 모자라거나 잘못된 값이면 아무것도 안 빠진다 */
    spend(n) {
      const a = amount(n);
      if (a === 0 && n !== 0) return false;
      if (a > get()) return false;
      set(get() - a);
      return true;
    },
    canAfford: n => amount(n) <= get(),
    max: WALLET_MAX,
  };
}
