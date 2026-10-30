import type { GridCell, HeaderMode, SourceRow, SourceTable, TableModel } from './model';

let nextId = 0;

/** Expand rowspan/colspan for one row group (spans are clipped to the group). */
function expandGroup(rows: SourceRow[]): GridCell[][] {
  const grid: GridCell[][] = rows.map(() => []);
  rows.forEach((row, r) => {
    let c = 0;
    for (const cell of row.cells) {
      while (grid[r][c]) c++;
      const rowspan = cell.rowspan === 0 ? rows.length - r : Math.min(cell.rowspan, rows.length - r);
      const origin: GridCell = { ...cell, id: nextId++, rowspan, spanned: false };
      for (let dr = 0; dr < rowspan; dr++) {
        for (let dc = 0; dc < cell.colspan; dc++) {
          grid[r + dr][c + dc] ??= dr === 0 && dc === 0 ? origin : { ...origin, spanned: true };
        }
      }
      c += cell.colspan;
    }
  });
  return grid;
}

function expand(rows: SourceRow[]): GridCell[][] {
  const out: GridCell[][] = [];
  for (let start = 0; start < rows.length; ) {
    let end = start + 1;
    while (end < rows.length && rows[end].group === rows[start].group) end++;
    out.push(...expandGroup(rows.slice(start, end)));
    start = end;
  }
  return out;
}

function pad(rows: GridCell[][], width: number): GridCell[][] {
  return rows.map((row) => {
    const out = Array.from({ length: width }, (_, i) => row[i]);
    return out.map(
      (cell) =>
        cell ?? { id: nextId++, text: '', html: '', isHeader: false, colspan: 1, rowspan: 1, spanned: true, padding: true },
    );
  });
}

function pickHeadRows(rows: SourceRow[], mode: HeaderMode): number {
  if (mode === 'none' || rows.length === 0) return 0;
  if (mode === 'first-row') return 1;
  let n = 0;
  while (n < rows.length && rows[n].section === 'head') n++;
  if (n > 0) return n;
  // Leading rows made only of header cells, but never the whole table.
  while (n < rows.length - 1 && rows[n].cells.every((cell) => cell.isHeader)) n++;
  if (n > 0) return n;
  // No markup tells us; the first row is almost always the header in data tables.
  return rows.length > 1 ? 1 : 0;
}

export function buildModel(source: SourceTable, headerMode: HeaderMode = 'auto'): TableModel {
  const headCount = pickHeadRows(source.rows, headerMode);
  const headRows = source.rows.slice(0, headCount);
  const rest = source.rows.slice(headCount);
  const footRows = rest.filter((r) => r.section === 'foot');
  const bodyRows = rest.filter((r) => r.section !== 'foot');

  const head = expand(headRows);
  const body = expand(bodyRows);
  const foot = expand(footRows);
  const columnCount = Math.max(0, ...[...head, ...body, ...foot].map((row) => row.length));
  return {
    kind: source.kind,
    caption: source.caption,
    head: pad(head, columnCount),
    body: pad(body, columnCount),
    foot: pad(foot, columnCount),
    columnCount,
  };
}
