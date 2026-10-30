import type { TableModel } from '../model';
import { resolveHeaders } from '../headers';
import { type CommonOptions, dataRows } from './common';

export interface CsvOptions extends CommonOptions {
  delimiter: ',' | ';';
  includeHeader: boolean;
  bom: boolean;
}

export interface TsvOptions extends CommonOptions {
  includeHeader: boolean;
}

function headerAndRows(model: TableModel, opts: CommonOptions & { includeHeader: boolean }): string[][] {
  const rows = dataRows(model, opts);
  return opts.includeHeader && model.head.length > 0 ? [resolveHeaders(model), ...rows] : rows;
}

/** RFC 4180: quote fields containing the delimiter, quotes, or line breaks; CRLF line endings. */
export function toCsv(model: TableModel, opts: CsvOptions): string {
  const needsQuotes = new RegExp(`[${opts.delimiter}"\\r\\n]|^\\s|\\s$`);
  const field = (v: string) => (needsQuotes.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const body = headerAndRows(model, opts)
    .map((row) => row.map(field).join(opts.delimiter))
    .join('\r\n');
  return (opts.bom ? '﻿' : '') + body + '\r\n';
}

/** Tab-separated; tabs and line breaks inside values are replaced by spaces. */
export function toTsv(model: TableModel, opts: TsvOptions): string {
  const field = (v: string) => v.replace(/[\t\r\n]+/g, ' ');
  return (
    headerAndRows(model, opts)
      .map((row) => row.map(field).join('\t'))
      .join('\n') + '\n'
  );
}
