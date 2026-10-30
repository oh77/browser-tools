import type { Section, SourceCell, SourceRow, SourceTable } from '../model';
import { cellText } from './cell-text';
import { sanitizeChildren } from './sanitize';

const MAX_COLSPAN = 1000;
const MAX_ROWSPAN = 65534;

function intAttr(el: Element, name: string, fallback: number, min: number, max: number): number {
  const n = Number.parseInt(el.getAttribute(name) ?? '', 10);
  return Number.isNaN(n) ? fallback : Math.min(Math.max(n, min), max);
}

function readCell(el: Element, baseUrl: string): SourceCell {
  return {
    text: cellText(el),
    html: sanitizeChildren(el, baseUrl),
    isHeader: el.tagName === 'TH',
    colspan: intAttr(el, 'colspan', 1, 1, MAX_COLSPAN),
    rowspan: intAttr(el, 'rowspan', 1, 0, MAX_ROWSPAN),
  };
}

function readRow(tr: Element, section: Section, group: number, baseUrl: string): SourceRow {
  const cells = Array.from(tr.children)
    .filter((c) => c.tagName === 'TD' || c.tagName === 'TH')
    .map((c) => readCell(c, baseUrl));
  return { section, group, cells };
}

/** Read a `<table>` element's own rows (nested tables are not descended into). */
export function extractHtmlTable(table: Element, baseUrl = table.ownerDocument.baseURI): SourceTable {
  const rows: SourceRow[] = [];
  let caption: string | undefined;
  let group = 0;
  for (const child of Array.from(table.children)) {
    switch (child.tagName) {
      case 'CAPTION':
        caption = cellText(child) || undefined;
        break;
      case 'THEAD':
      case 'TBODY':
      case 'TFOOT': {
        const section: Section = child.tagName === 'THEAD' ? 'head' : child.tagName === 'TFOOT' ? 'foot' : 'body';
        group++;
        for (const tr of Array.from(child.children)) {
          if (tr.tagName === 'TR') rows.push(readRow(tr, section, group, baseUrl));
        }
        group++;
        break;
      }
      case 'TR':
        rows.push(readRow(child, 'body', group, baseUrl));
        break;
    }
  }
  caption ??= table.getAttribute('aria-label') || undefined;
  return { kind: 'html', caption, rows: rows.filter((r) => r.cells.length > 0) };
}
