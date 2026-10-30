import type { SourceTable } from '../model';
import { isHtmlTable } from '../detect';
import { extractAriaGrid } from './aria-grid';
import { extractHtmlTable } from './html-table';

export function extractTable(el: Element): SourceTable {
  return isHtmlTable(el) ? extractHtmlTable(el) : extractAriaGrid(el);
}
