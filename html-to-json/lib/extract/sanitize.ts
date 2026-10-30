/** Tags kept as-is in cleaned HTML. */
const KEEP = new Set(['A', 'B', 'STRONG', 'I', 'EM', 'CODE', 'BR', 'SUB', 'SUP', 'UL', 'OL', 'LI', 'P']);
/** Tags removed together with their content. */
export const DROP = new Set([
  'SCRIPT', 'STYLE', 'TEMPLATE', 'NOSCRIPT', 'IFRAME', 'OBJECT', 'EMBED', 'SVG', 'MATH', 'CANVAS',
  'VIDEO', 'AUDIO', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'LINK', 'META',
]);
const VOID = new Set(['BR']);
const SAFE_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:', 'ftp:']);

export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function isHidden(el: Element): boolean {
  if ((el as HTMLElement).hidden || el.getAttribute('aria-hidden') === 'true') return true;
  const style = el.getAttribute('style') ?? '';
  if (/display\s*:\s*none|visibility\s*:\s*hidden/i.test(style)) return true;
  const check = (el as HTMLElement).checkVisibility;
  return el.isConnected && typeof check === 'function' && !check.call(el);
}

function safeHref(el: Element, baseUrl: string): string | undefined {
  const raw = el.getAttribute('href');
  if (!raw || raw.startsWith('#')) return undefined;
  try {
    const url = new URL(raw, baseUrl);
    return SAFE_PROTOCOLS.has(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Serialize an element's children keeping only allow-listed inline markup.
 * Attributes are stripped, except an absolute, safe `href` on links. Unknown
 * tags are unwrapped; images become their alt text.
 */
export function sanitizeChildren(root: Element, baseUrl: string): string {
  let out = '';
  const walk = (node: Node) => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === 3) {
        out += escapeHtml((child.nodeValue ?? '').replace(/[\s ]+/g, ' '));
        continue;
      }
      if (child.nodeType !== 1) continue;
      const el = child as Element;
      const tag = el.tagName.toUpperCase();
      if (DROP.has(tag) || isHidden(el)) continue;
      if (tag === 'IMG') {
        const alt = el.getAttribute('alt');
        if (alt) out += escapeHtml(alt);
        continue;
      }
      if (!KEEP.has(tag)) {
        walk(el);
        continue;
      }
      const name = tag.toLowerCase();
      if (VOID.has(tag)) {
        out += `<${name}>`;
        continue;
      }
      if (tag === 'A') {
        const href = safeHref(el, baseUrl);
        if (!href) {
          walk(el);
          continue;
        }
        out += `<a href="${escapeHtml(href)}">`;
      } else {
        out += `<${name}>`;
      }
      walk(el);
      out += `</${name}>`;
    }
  };
  walk(root);
  return out.replace(/\s*(<br>)\s*/g, '$1').trim();
}
