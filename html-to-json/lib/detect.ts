export const TABLE_SELECTOR =
  'table:not([role="presentation"]):not([role="none"]), [role="table"], [role="grid"], [role="treegrid"]';

export function findTable(target: Element | null): Element | null {
  return target?.closest(TABLE_SELECTOR) ?? null;
}

export function parentTable(table: Element): Element | null {
  return table.parentElement?.closest(TABLE_SELECTOR) ?? null;
}

export function firstChildTable(table: Element): Element | null {
  return table.querySelector(TABLE_SELECTOR);
}

export function isHtmlTable(el: Element): boolean {
  return el.tagName === 'TABLE';
}
