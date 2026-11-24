export function esc(t: string): string {
  return t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);
}

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className = '',
  html = '',
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (html) e.innerHTML = html;
  return e;
}

export function button(label: string, className = 'btn', onClick?: () => void): HTMLButtonElement {
  const b = el('button', className);
  b.type = 'button';
  b.textContent = label;
  if (onClick) b.addEventListener('click', onClick);
  return b;
}
