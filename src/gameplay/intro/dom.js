// 작은 DOM 도우미 (ui 모듈에 기대지 않으려고 따로 둔다)

/** el('div', { class, text, onclick, style:{} , ...속성 }, ...자식) */
export function el(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs ?? {})) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of kids.flat()) if (c != null && c !== false) e.append(c instanceof Node ? c : String(c));
  return e;
}

/** 이 폴더의 intro.css 를 한 번만 붙인다 */
export function loadCss() {
  if (document.querySelector('link[data-fd-css]')) return Promise.resolve();
  const link = el('link', { rel: 'stylesheet', href: new URL('./intro.css', import.meta.url).href, 'data-fd-css': true });
  const done = new Promise(res => { link.onload = link.onerror = res; setTimeout(res, 4000); });
  document.head.append(link);
  return done;
}
