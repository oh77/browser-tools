import type { GridCell, TableModel } from '../model';
import { escapeHtml } from '../extract/sanitize';
import { toSingleLine } from '../extract/cell-text';

export interface HtmlOptions {
  /** Emit escaped text only, dropping links and inline formatting. */
  plainText: boolean;
  /** Wrap the table in a minimal standalone HTML document. */
  standalone: boolean;
  singleLine: boolean;
}

function content(cell: GridCell, opts: HtmlOptions): string {
  if (opts.plainText) {
    const text = opts.singleLine ? toSingleLine(cell.text) : cell.text;
    return escapeHtml(text).replace(/\n/g, '<br>');
  }
  return opts.singleLine ? cell.html.replace(/<br>/g, ' ') : cell.html;
}

function renderRows(rows: GridCell[][], section: 'thead' | 'tbody' | 'tfoot', opts: HtmlOptions, indent: string): string[] {
  if (rows.length === 0) return [];
  const lines = [`${indent}<${section}>`];
  for (const row of rows) {
    lines.push(`${indent}  <tr>`);
    for (const cell of row) {
      if (cell.spanned && !cell.padding) continue;
      const header = cell.isHeader || section === 'thead';
      const tag = header ? 'th' : 'td';
      let attrs = '';
      if (header) attrs += section === 'thead' ? ' scope="col"' : ' scope="row"';
      if (cell.colspan > 1) attrs += ` colspan="${cell.colspan}"`;
      if (cell.rowspan > 1) attrs += ` rowspan="${cell.rowspan}"`;
      lines.push(`${indent}    <${tag}${attrs}>${content(cell, opts)}</${tag}>`);
    }
    lines.push(`${indent}  </tr>`);
  }
  lines.push(`${indent}</${section}>`);
  return lines;
}

/** Rebuild a clean, attribute-free `<table>` from the model (works for ARIA grids too). */
export function toHtml(model: TableModel, opts: HtmlOptions): string {
  const indent = opts.standalone ? '  ' : '';
  const table = [
    `${indent}<table>`,
    ...(model.caption ? [`${indent}  <caption>${escapeHtml(model.caption)}</caption>`] : []),
    ...renderRows(model.head, 'thead', opts, `${indent}  `),
    ...renderRows(model.body, 'tbody', opts, `${indent}  `),
    ...renderRows(model.foot, 'tfoot', opts, `${indent}  `),
    `${indent}</table>`,
  ];
  if (!opts.standalone) return table.join('\n') + '\n';
  return [
    '<!doctype html>',
    '<html>',
    '<head>',
    '<meta charset="utf-8">',
    `<title>${escapeHtml(model.caption ?? 'Table')}</title>`,
    '<style>table{border-collapse:collapse}th,td{border:1px solid #999;padding:4px 8px;text-align:left;vertical-align:top}</style>',
    '</head>',
    '<body>',
    ...table,
    '</body>',
    '</html>',
    '',
  ].join('\n');
}
