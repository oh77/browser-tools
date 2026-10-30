import type { SourceCell, SourceRow, SourceTable } from '../model';
import { TABLE_SELECTOR } from '../detect';
import { cellText } from './cell-text';
import { sanitizeChildren } from './sanitize';

const CELL_SELECTOR = '[role="cell"], [role="gridcell"], [role="columnheader"], [role="rowheader"]';

function intAttr(el: Element, name: string): number {
  const n = Number.parseInt(el.getAttribute(name) ?? '', 10);
  return Number.isNaN(n) || n < 1 ? 1 : Math.min(n, 1000);
}

function readCell(el: Element, baseUrl: string): SourceCell {
  const role = el.getAttribute('role');
  return {
    text: cellText(el),
    html: sanitizeChildren(el, baseUrl),
    isHeader: role === 'columnheader' || role === 'rowheader',
    colspan: intAttr(el, 'aria-colspan'),
    rowspan: intAttr(el, 'aria-rowspan'),
  };
}

function labelOf(root: Element): string | undefined {
  const label = root.getAttribute('aria-label');
  if (label) return label;
  const ids = root.getAttribute('aria-labelledby')?.split(/\s+/).filter(Boolean) ?? [];
  const text = ids
    .map((id) => root.ownerDocument.getElementById(id))
    .map((el) => (el ? cellText(el) : ''))
    .filter(Boolean)
    .join(' ');
  return text || undefined;
}

/** Read an ARIA `role=table|grid|treegrid` structure built from non-table elements. */
export function extractAriaGrid(root: Element, baseUrl = root.ownerDocument.baseURI): SourceTable {
  const ownedBy = (el: Element) => el.parentElement?.closest(TABLE_SELECTOR) === root;
  const rows: SourceRow[] = [];
  for (const row of Array.from(root.querySelectorAll('[role="row"]'))) {
    if (!ownedBy(row)) continue;
    const cells = Array.from(row.querySelectorAll(CELL_SELECTOR))
      .filter((c) => c.parentElement?.closest('[role="row"]') === row)
      .map((c) => readCell(c, baseUrl));
    if (cells.length > 0) rows.push({ section: 'body', group: 0, cells });
  }
  return { kind: 'aria', caption: labelOf(root), rows };
}
