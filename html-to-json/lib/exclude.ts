import type { GridCell, TableModel } from './model';
import { cellValue } from './convert/common';

export interface ExcludeOptions {
  /** Drop columns whose header cells are all blank (only when the table has header rows). */
  excludeUntitled: boolean;
  /**
   * Drop columns where no body/footer cell starting in that column has content,
   * whatever their title (only when the table has data rows). Cells merged in
   * from another column, like a section title spanning the row, don't count.
   */
  excludeEmpty: boolean;
  /** Drop body/footer rows where every cell is blank; header rows are always kept. */
  excludeEmptyRows: boolean;
  /** Whether a merged cell counts as content in every row it spans, as in the export. */
  fillMerged: boolean;
}

/**
 * Recompute spans after rows or columns were removed: the first remaining
 * position of each source cell becomes its origin, and colspan/rowspan shrink
 * to what's left.
 */
function respan(rows: GridCell[][]): GridCell[][] {
  const spans = new Map<number, { colspan: number; rowspan: number }>();
  rows.forEach((row, r) =>
    row.forEach((cell, c) => {
      if (cell.padding || spans.has(cell.id)) return;
      let colspan = 1;
      while (row[c + colspan]?.id === cell.id) colspan++;
      let rowspan = 1;
      while (rows[r + rowspan]?.[c]?.id === cell.id) rowspan++;
      spans.set(cell.id, { colspan, rowspan });
    }),
  );
  const seen = new Set<number>();
  return rows.map((row) =>
    row.map((cell) => {
      if (cell.padding) return cell;
      const spanned = seen.has(cell.id);
      seen.add(cell.id);
      return { ...cell, ...spans.get(cell.id), spanned };
    }),
  );
}

const isBlank = (cell: GridCell, opts: ExcludeOptions) => !cellValue(cell, { ...opts, singleLine: false }).trim();

export function filterColumns(model: TableModel, opts: ExcludeOptions): { model: TableModel; excluded: number } {
  const data = [...model.body, ...model.foot];
  const untitled = (c: number) => model.head.length > 0 && model.head.every((row) => !row[c].text.trim());
  const empty = (c: number) => data.length > 0 && data.every((row) => row[c].spanned || !row[c].text.trim());

  const keep: number[] = [];
  for (let c = 0; c < model.columnCount; c++) {
    if ((opts.excludeUntitled && untitled(c)) || (opts.excludeEmpty && empty(c))) continue;
    keep.push(c);
  }
  if (keep.length === model.columnCount) return { model, excluded: 0 };

  const pick = (rows: GridCell[][]) => respan(rows.map((row) => keep.map((c) => row[c])));
  return {
    model: { ...model, head: pick(model.head), body: pick(model.body), foot: pick(model.foot), columnCount: keep.length },
    excluded: model.columnCount - keep.length,
  };
}

export function filterRows(model: TableModel, opts: ExcludeOptions): { model: TableModel; excluded: number } {
  if (!opts.excludeEmptyRows) return { model, excluded: 0 };
  const keep = (rows: GridCell[][]) => rows.filter((row) => !row.every((cell) => isBlank(cell, opts)));
  const body = keep(model.body);
  const foot = keep(model.foot);
  const excluded = model.body.length - body.length + model.foot.length - foot.length;
  if (!excluded) return { model, excluded: 0 };
  return { model: { ...model, body: respan(body), foot: respan(foot) }, excluded };
}

/**
 * Apply the "Exclude" options. Columns go first, so a row whose only content
 * was in an excluded column counts as empty.
 */
export function applyExclusions(
  model: TableModel,
  opts: ExcludeOptions,
): { model: TableModel; excludedColumns: number; excludedRows: number } {
  const columns = filterColumns(model, opts);
  const rows = filterRows(columns.model, opts);
  return { model: rows.model, excludedColumns: columns.excluded, excludedRows: rows.excluded };
}
