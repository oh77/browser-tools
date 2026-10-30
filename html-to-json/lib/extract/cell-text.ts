import { DROP, isHidden } from './sanitize';

/** Remove invisible characters, collapse horizontal whitespace, trim each line, and drop blank lines. */
export function normalizeText(raw: string): string {
  return raw
    .replace(/[\u200b-\u200d\u2060\ufeff\u00ad]/g, '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[\s ]+/g, ' ').trim())
    .filter((line) => line !== '')
    .join('\n');
}

export function toSingleLine(text: string): string {
  return text.replace(/\s*\n\s*/g, ' ');
}

const BLOCK = new Set([
  'ADDRESS', 'ARTICLE', 'ASIDE', 'BLOCKQUOTE', 'DD', 'DIV', 'DL', 'DT', 'FIGCAPTION', 'FIGURE', 'FOOTER',
  'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'HEADER', 'HR', 'LI', 'MAIN', 'NAV', 'OL', 'P', 'PRE', 'SECTION',
  'TABLE', 'TR', 'UL',
]);

/**
 * Visible text of an element: hidden and non-content elements are skipped,
 * `<br>` and block boundaries become newlines, image alt text is kept.
 * A DOM walk (rather than `innerText`) keeps results identical across
 * browsers and avoids forcing layout for every cell.
 */
export function cellText(root: Element): string {
  let out = '';
  const walk = (node: Node) => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === 3) {
        out += child.nodeValue ?? '';
        continue;
      }
      if (child.nodeType !== 1) continue;
      const el = child as Element;
      const tag = el.tagName.toUpperCase();
      if (DROP.has(tag) || isHidden(el)) continue;
      if (tag === 'BR') out += '\n';
      else if (tag === 'IMG') out += el.getAttribute('alt') ?? '';
      else if (tag === 'TD' || tag === 'TH') {
        walk(el);
        out += ' ';
      } else if (BLOCK.has(tag)) {
        out += '\n';
        walk(el);
        out += '\n';
      } else walk(el);
    }
  };
  walk(root);
  return normalizeText(out);
}
