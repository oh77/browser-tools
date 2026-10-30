import type { TableModel } from '../model';
import { resolveHeaders } from '../headers';
import { type CommonOptions, dataRows } from './common';

export interface JsonOptions extends CommonOptions {
  shape: 'objects' | 'arrays' | 'keyed' | 'table';
  pretty: boolean;
}

export function toJson(model: TableModel, opts: JsonOptions): string {
  const headers = resolveHeaders(model);
  const rows = dataRows(model, opts);
  let value: unknown;
  switch (opts.shape) {
    case 'objects':
      value = rows.map((row) => Object.fromEntries(headers.map((h, i) => [h, row[i]])));
      break;
    case 'arrays':
      value = model.head.length > 0 ? [headers, ...rows] : rows;
      break;
    case 'keyed': {
      // { "<first column>": { "<other header>": value, … } }; repeated keys get a suffix.
      const out: Record<string, Record<string, string>> = {};
      for (const row of rows) {
        let key = row[0] ?? '';
        for (let n = 2; Object.hasOwn(out, key); n++) key = `${row[0]}_${n}`;
        out[key] = Object.fromEntries(headers.slice(1).map((h, i) => [h, row[i + 1]]));
      }
      value = out;
      break;
    }
    case 'table':
      value = { caption: model.caption ?? null, headers, rows };
      break;
  }
  return JSON.stringify(value, null, opts.pretty ? 2 : undefined);
}
