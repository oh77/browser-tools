import { describe, expect, it } from 'vitest';
import { extractTable } from '../lib/extract';
import { buildModel } from '../lib/grid';
import { applyExclusions, filterColumns, filterRows } from '../lib/exclude';
import { resolveHeaders } from '../lib/headers';
import { toCsv } from '../lib/convert/delimited';
import { toHtml } from '../lib/convert/html';
import { html } from './helpers';

const model = (markup: string, headerMode: 'auto' | 'none' = 'auto') => buildModel(extractTable(html(markup)), headerMode);
const off = { excludeUntitled: false, excludeEmpty: false, excludeEmptyRows: false, fillMerged: true };
const csv = (m: ReturnType<typeof model>) =>
  toCsv(m, { fillMerged: true, singleLine: false, delimiter: ',', includeHeader: true, bom: false });

const table = `<table>
  <thead><tr><th>Name</th><th></th><th>Notes</th><th> </th></tr></thead>
  <tbody>
    <tr><td>Ann</td><td>edit</td><td></td><td></td></tr>
    <tr><td>Bo</td><td>edit</td><td> </td><td></td></tr>
  </tbody></table>`;

describe('filterColumns', () => {
  it('is a no-op when both options are off', () => {
    const m = model(table);
    expect(filterColumns(m, off)).toEqual({ model: m, excluded: 0 });
  });

  it('excludes columns without a title', () => {
    const { model: m, excluded } = filterColumns(model(table), { ...off, excludeUntitled: true });
    expect(excluded).toBe(2);
    expect(resolveHeaders(m)).toEqual(['Name', 'Notes']);
    expect(csv(m)).toBe('Name,Notes\r\nAnn,\r\nBo,\r\n');
  });

  it('excludes columns with no data', () => {
    const { model: m, excluded } = filterColumns(model(table), { ...off, excludeEmpty: true });
    expect(excluded).toBe(2);
    expect(csv(m)).toBe('Name,column_2\r\nAnn,edit\r\nBo,edit\r\n');
  });

  it('applies both together', () => {
    const { model: m } = filterColumns(model(table), { ...off, excludeUntitled: true, excludeEmpty: true });
    expect(csv(m)).toBe('Name\r\nAnn\r\nBo\r\n');
  });

  it('treats a header spanning a column as its title', () => {
    const m = model(`<table><thead><tr><th colspan="2">Q1</th><th></th></tr><tr><th>Jan</th><th></th><th></th></tr></thead>
      <tbody><tr><td>1</td><td>2</td><td>3</td></tr></tbody></table>`);
    const out = filterColumns(m, { ...off, excludeUntitled: true });
    expect(resolveHeaders(out.model)).toEqual(['Q1 / Jan', 'Q1']);
  });

  it('counts a merged cell as data only in the column it starts in', () => {
    const markup = `<table><thead><tr><th>A</th><th>B</th></tr></thead>
      <tbody><tr><td colspan="2">wide</td></tr><tr><td>x</td><td></td></tr></tbody></table>`;
    expect(filterColumns(model(markup), { ...off, excludeEmpty: true }).excluded).toBe(1);
    expect(filterColumns(model(markup), { ...off, excludeEmpty: true, fillMerged: false }).excluded).toBe(1);
  });

  it('excludes a titled empty column even when section title rows span it', () => {
    const m = model(`<table><thead><tr><th>Item</th><th>Comment</th><th>Price</th></tr></thead><tbody>
      <tr><th colspan="3">Fruit</th></tr>
      <tr><td>Apple</td><td></td><td>1.20</td></tr>
      <tr><th colspan="3">Vegetables</th></tr>
      <tr><td>Leek</td><td></td><td>2.10</td></tr></tbody></table>`);
    const out = filterColumns(m, { ...off, excludeEmpty: true });
    expect(out.excluded).toBe(1);
    expect(resolveHeaders(out.model)).toEqual(['Item', 'Price']);
    expect(csv(out.model)).toBe('Item,Price\r\nFruit,Fruit\r\nApple,1.20\r\nVegetables,Vegetables\r\nLeek,2.10\r\n');
    expect(toHtml(out.model, { plainText: true, standalone: false, singleLine: false })).toContain(
      '<th scope="row" colspan="2">Fruit</th>',
    );
  });

  it('treats invisible characters as blank', () => {
    const m = model('<table><thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr><td>1</td><td>\u200b\u00ad</td></tr></tbody></table>');
    expect(filterColumns(m, { ...off, excludeEmpty: true }).excluded).toBe(1);
  });

  it('does nothing without header rows or data rows', () => {
    const noHead = model('<table><tr><td>1</td><td></td></tr><tr><td>2</td><td></td></tr></table>', 'none');
    expect(filterColumns(noHead, { ...off, excludeUntitled: true }).excluded).toBe(0);
    const noData = model('<table><thead><tr><th>A</th><th>B</th></tr></thead></table>');
    expect(filterColumns(noData, { ...off, excludeEmpty: true }).excluded).toBe(0);
  });

  it('shrinks spans and moves the origin when a spanned column is removed', () => {
    const m = model(`<table>
      <thead><tr><th></th><th>B</th><th>C</th></tr></thead>
      <tbody>
        <tr><td colspan="3">all</td></tr>
        <tr><td rowspan="2">left</td><td>1</td><td>2</td></tr>
        <tr><td>3</td><td>4</td></tr>
      </tbody></table>`);
    const out = filterColumns(m, { ...off, excludeUntitled: true });
    expect(out.excluded).toBe(1);
    expect(toHtml(out.model, { plainText: true, standalone: false, singleLine: false })).toContain(
      ['    <tr>', '      <td colspan="2">all</td>', '    </tr>', '    <tr>', '      <td>1</td>', '      <td>2</td>'].join('\n'),
    );
    const [row0] = out.model.body;
    expect(row0.map((c) => [c.spanned, c.colspan])).toEqual([[false, 2], [true, 2]]);
  });

  it('keeps rowspans intact on remaining columns', () => {
    const m = model(`<table><thead><tr><th>A</th><th></th></tr></thead>
      <tbody><tr><td rowspan="2">r</td><td>1</td></tr><tr><td>2</td></tr></tbody></table>`);
    const out = filterColumns(m, { ...off, excludeUntitled: true });
    expect(out.model.body.map((row) => row.map((c) => [c.text, c.spanned, c.rowspan]))).toEqual([
      [['r', false, 2]],
      [['r', true, 2]],
    ]);
  });
});

describe('filterRows', () => {
  const sparse = `<table>
    <thead><tr><th>Order</th><th></th><th>Total</th></tr><tr><th></th><th></th><th></th></tr></thead>
    <tbody>
      <tr><td>1</td><td>Edit</td><td>10</td></tr>
      <tr><td> </td><td></td><td>&nbsp;</td></tr>
      <tr><td></td><td>Edit</td><td></td></tr>
      <tr><td>2</td><td></td><td>20</td></tr>
    </tbody>
    <tfoot><tr><td></td><td></td><td></td></tr></tfoot></table>`;

  it('is a no-op when the option is off', () => {
    const m = model(sparse);
    expect(filterRows(m, off)).toEqual({ model: m, excluded: 0 });
  });

  it('drops blank body and footer rows but keeps header rows', () => {
    const { model: m, excluded } = filterRows(model(sparse), { ...off, excludeEmptyRows: true });
    expect(excluded).toBe(2);
    expect(m.head).toHaveLength(2);
    expect(m.foot).toHaveLength(0);
    expect(csv(m)).toBe('Order,column_2,Total\r\n1,Edit,10\r\n,Edit,\r\n2,,20\r\n');
  });

  it('excludes columns first, so rows left blank by that are dropped too', () => {
    const out = applyExclusions(model(sparse), { ...off, excludeUntitled: true, excludeEmptyRows: true });
    expect(out.excludedColumns).toBe(1);
    expect(out.excludedRows).toBe(3);
    expect(csv(out.model)).toBe('Order,Total\r\n1,10\r\n2,20\r\n');
  });

  it('moves a rowspan to the next remaining row', () => {
    const m = model(`<table><thead><tr><th>A</th><th>B</th></tr></thead><tbody>
      <tr><td></td><td rowspan="3"></td></tr>
      <tr><td>x</td></tr>
      <tr><td>y</td></tr></tbody></table>`);
    // With merged values repeated, the blank merged cell can't make rows 2–3 non-empty either way.
    const { model: out, excluded } = filterRows(m, { ...off, excludeEmptyRows: true });
    expect(excluded).toBe(1);
    expect(out.body.map((row) => row.map((c) => [c.text, c.spanned, c.rowspan]))).toEqual([
      [['x', false, 1], ['', false, 2]],
      [['y', false, 1], ['', true, 2]],
    ]);
  });

  it('counts a merged value as content only when merged values are repeated', () => {
    const markup = `<table><thead><tr><th>A</th><th>B</th></tr></thead><tbody>
      <tr><td rowspan="2">r</td><td>1</td></tr>
      <tr><td></td></tr></tbody></table>`;
    expect(filterRows(model(markup), { ...off, excludeEmptyRows: true }).excluded).toBe(0);
    expect(filterRows(model(markup), { ...off, excludeEmptyRows: true, fillMerged: false }).excluded).toBe(1);
  });
});
