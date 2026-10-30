import type { TableModel } from '../model';
import { toCsv, toTsv } from './delimited';
import { toHtml } from './html';
import { toJson } from './json';
import { toXml } from './xml';

export type OptionValues = Record<string, string | boolean>;

export type OptionDef =
  | { key: string; label: string; type: 'boolean' }
  | { key: string; label: string; type: 'select'; choices: { value: string; label: string }[] };

export interface Format {
  id: FormatId;
  label: string;
  ext: string;
  mime: string;
  options: OptionDef[];
  defaults: OptionValues;
  convert(model: TableModel, opts: OptionValues): string;
}

export type FormatId = 'json' | 'xml' | 'csv' | 'tsv' | 'html';

/**
 * Options that apply to every format. `headerMode` and the `exclude…` options
 * are applied to the model before conversion (see lib/exclude.ts).
 */
export const COMMON_OPTIONS: OptionDef[] = [
  {
    key: 'headerMode',
    label: 'Header',
    type: 'select',
    choices: [
      { value: 'auto', label: 'Auto-detect' },
      { value: 'first-row', label: 'First row' },
      { value: 'none', label: 'None' },
    ],
  },
  { key: 'fillMerged', label: 'Repeat merged cells', type: 'boolean' },
  { key: 'singleLine', label: 'Single-line cells', type: 'boolean' },
];

/** Row/column filters, shown on their own "Exclude" row; they share the common option values. */
export const EXCLUDE_OPTIONS: OptionDef[] = [
  { key: 'excludeUntitled', label: 'Columns without title', type: 'boolean' },
  { key: 'excludeEmpty', label: 'Columns with no data', type: 'boolean' },
  { key: 'excludeEmptyRows', label: 'Rows with no data', type: 'boolean' },
];

export const COMMON_DEFAULTS: OptionValues = {
  headerMode: 'auto',
  fillMerged: true,
  singleLine: false,
  excludeUntitled: false,
  excludeEmpty: false,
  excludeEmptyRows: false,
};

// Each converter declares its own option interface; the registry stores them as
// plain values that always include the matching defaults.
type AnyConvert = (model: TableModel, opts: never) => string;
const run = (fn: AnyConvert) => (model: TableModel, opts: OptionValues) => fn(model, opts as never);

export const FORMATS: Format[] = [
  {
    id: 'json',
    label: 'JSON',
    ext: 'json',
    mime: 'application/json',
    options: [
      {
        key: 'shape',
        label: 'Shape',
        type: 'select',
        choices: [
          { value: 'objects', label: 'Array of objects' },
          { value: 'arrays', label: 'Array of arrays' },
          { value: 'keyed', label: 'Keyed by first column' },
          { value: 'table', label: '{ caption, headers, rows }' },
        ],
      },
      { key: 'pretty', label: 'Pretty-print', type: 'boolean' },
    ],
    defaults: { shape: 'objects', pretty: true },
    convert: run(toJson),
  },
  {
    id: 'xml',
    label: 'XML',
    ext: 'xml',
    mime: 'application/xml',
    options: [{ key: 'elementNames', label: 'Headers as element names', type: 'boolean' }],
    defaults: { elementNames: false },
    convert: run(toXml),
  },
  {
    id: 'csv',
    label: 'CSV',
    ext: 'csv',
    mime: 'text/csv',
    options: [
      {
        key: 'delimiter',
        label: 'Delimiter',
        type: 'select',
        choices: [
          { value: ',', label: 'Comma (,)' },
          { value: ';', label: 'Semicolon (;)' },
        ],
      },
      { key: 'includeHeader', label: 'Header row', type: 'boolean' },
      { key: 'bom', label: 'UTF-8 BOM (Excel)', type: 'boolean' },
    ],
    defaults: { delimiter: ',', includeHeader: true, bom: false },
    convert: run(toCsv),
  },
  {
    id: 'tsv',
    label: 'TSV',
    ext: 'tsv',
    mime: 'text/tab-separated-values',
    options: [{ key: 'includeHeader', label: 'Header row', type: 'boolean' }],
    defaults: { includeHeader: true },
    convert: run(toTsv),
  },
  {
    id: 'html',
    label: 'HTML',
    ext: 'html',
    mime: 'text/html',
    options: [
      { key: 'plainText', label: 'Plain text cells', type: 'boolean' },
      { key: 'standalone', label: 'Standalone document', type: 'boolean' },
    ],
    defaults: { plainText: false, standalone: false },
    convert: run(toHtml),
  },
];

export function getFormat(id: string): Format {
  return FORMATS.find((f) => f.id === id) ?? FORMATS[0];
}
