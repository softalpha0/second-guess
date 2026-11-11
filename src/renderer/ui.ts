// Tiny DOM helpers so screens can be written without a framework.

type Attrs = Record<string, string | number | boolean | EventListener | undefined>;
type Child = Node | string | null | undefined | false;

/** h('div.card', { onclick: fn }, 'text', otherNode) */
export function h(tag: string, attrs: Attrs = {}, ...children: Child[]): HTMLElement {
  const [name, ...classes] = tag.split('.');
  const el = document.createElement(name || 'div');
  if (classes.length) el.className = classes.join(' ');
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v as EventListener);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, String(v));
  }
  for (const c of children) if (c !== null && c !== undefined && c !== false) el.append(c);
  return el;
}

export function kbd(key: string): HTMLElement {
  return h('kbd', {}, key);
}

/** Text with line breaks preserved (card content may be multi-line). */
export function multiline(text: string): DocumentFragment {
  const f = document.createDocumentFragment();
  text.split('\n').forEach((line, i) => {
    if (i) f.append(document.createElement('br'));
    f.append(line);
  });
  return f;
}
