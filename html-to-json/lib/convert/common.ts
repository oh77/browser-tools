import type { GridCell, TableModel } from '../model';
import { toSingleLine } from '../extract/cell-text';

export interface CommonOptions {
  /** Repeat a merged cell's value in every position it spans. */
  fillMerged: boolean;
  /** Replace line breaks inside cells with spaces. */
  singleLine: boolean;
}

export function cellValue(cell: GridCell, opts: CommonOptions): string {
  if (cell.padding || (cell.spanned && !opts.fillMerged)) return '';
  return opts.singleLine ? toSingleLine(cell.text) : cell.text;
}

/** Body and footer rows as plain values; header rows are handled separately. */
export function dataRows(model: TableModel, opts: CommonOptions): string[][] {
  return [...model.body, ...model.foot].map((row) => row.map((cell) => cellValue(cell, opts)));
}
