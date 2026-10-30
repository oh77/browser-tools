import { describe, expect, it } from 'vitest';
import { extractTable } from '../lib/extract';
import { buildModel } from '../lib/grid';
import { resolveHeaders } from '../lib/headers';
import { findTable, firstChildTable, parentTable } from '../lib/detect';
import { html } from './helpers';

const texts = (rows: { text: string; spanned: boolean }[][]) => rows.map((r) => r.map((c) => c.text));

describe('HTML table extraction', () => {
  it('reads thead/tbody/tfoot and caption', () => {
    const el = html(`<table><caption> Sales  2025 </caption>
      <thead><tr><th>Name</th><th>Total</th></tr></thead>
      <tbody><tr><td>Ann</td><td>3</td></tr><tr><td>Bo</td><td>4</td></tr></tbody>
      <tfoot><tr><td>Sum</td><td>7</td></tr></tfoot></table>`);
    const model = buildModel(extractTable(el));
    expect(model.caption).toBe('Sales 2025');
    expect(texts(model.head)).toEqual([['Name', 'Total']]);
    expect(texts(model.body)).toEqual([['Ann', '3'], ['Bo', '4']]);
    expect(texts(model.foot)).toEqual([['Sum', '7']]);
  });

  it('expands colspan and rowspan into a rectangular grid', () => {
    const el = html(`<table>
      <tr><th rowspan="2">Region</th><th colspan="2">Q1</th></tr>
      <tr><th>Jan</th><th>Feb</th></tr>
      <tr><td rowspan="2">North</td><td>1</td><td>2</td></tr>
      <tr><td>3</td><td>4</td></tr></table>`);
    const model = buildModel(extractTable(el));
    expect(model.columnCount).toBe(3);
    expect(model.head).toHaveLength(2);
    expect(texts(model.body)).toEqual([['North', '1', '2'], ['North', '3', '4']]);
    expect(model.body[1][0].spanned).toBe(true);
    expect(resolveHeaders(model)).toEqual(['Region', 'Q1 / Jan', 'Q1 / Feb']);
  });

  it('clips rowspan=0 and oversized spans to the section and pads ragged rows', () => {
    const el = html(`<table><tbody>
      <tr><td rowspan="0">A</td><td>1</td><td>x</td></tr>
      <tr><td>2</td></tr></tbody>
      <tbody><tr><td rowspan="9">B</td><td>3</td></tr></tbody></table>`);
    const model = buildModel(extractTable(el), 'none');
    expect(texts(model.body)).toEqual([['A', '1', 'x'], ['A', '2', ''], ['B', '3', '']]);
    expect(model.body[0][0].rowspan).toBe(2);
    expect(model.body[2][0].rowspan).toBe(1);
    expect(model.body[1][2].padding).toBe(true);
  });

  it('detects header rows from th cells, or falls back to the first row', () => {
    const withTh = html('<table><tr><th>A</th><th>B</th></tr><tr><td>1</td><td>2</td></tr></table>');
    expect(buildModel(extractTable(withTh)).head).toHaveLength(1);
    const rowHeaders = html('<table><tr><th>A</th><td>1</td></tr><tr><th>B</th><td>2</td></tr></table>');
    const m = buildModel(extractTable(rowHeaders));
    expect(texts(m.head)).toEqual([['A', '1']]);
    expect(buildModel(extractTable(rowHeaders), 'none').head).toHaveLength(0);
  });

  it('does not descend into nested tables', () => {
    const el = html(`<table id="outer"><tr><td>a</td><td><table id="inner"><tr><td>x</td><td>y</td></tr></table></td></tr></table>`);
    const source = extractTable(el);
    expect(source.rows).toHaveLength(1);
    expect(source.rows[0].cells).toHaveLength(2);
    const inner = document.getElementById('inner')!;
    expect(findTable(inner.querySelector('td'))).toBe(inner);
    expect(parentTable(inner)).toBe(el);
    expect(firstChildTable(el)).toBe(inner);
  });

  it('ignores layout tables with role=presentation', () => {
    const el = html('<table role="presentation"><tr><td>x</td></tr></table>');
    expect(findTable(el.querySelector('td'))).toBeNull();
  });

  it('sanitizes cell HTML', () => {
    document.head.innerHTML = '<base href="https://example.com/dir/">';
    const el = html(`<table><tr><td>
      <span class="x" style="color:red" onclick="evil()"><b>Bold</b> and <a href="page" target="_blank" onmouseover="x()">link</a></span>
      <script>alert(1)</script><style>td{}</style><a href="javascript:alert(1)">js</a>
      <img src="x.png" alt="pic"><span hidden>secret</span><br>next</td></tr></table>`);
    const cell = extractTable(el).rows[0].cells[0];
    expect(cell.html).toBe('<b>Bold</b> and <a href="https://example.com/dir/page">link</a> js pic<br>next');
    document.head.innerHTML = '';
  });
});

describe('ARIA grid extraction', () => {
  it('reads roles, aria spans, and labels; skips nested grids', () => {
    const el = html(`<div role="grid" aria-labelledby="lbl">
      <div role="rowgroup">
        <div role="row"><span role="columnheader">Name</span><span role="columnheader">Info</span></div>
      </div>
      <div role="rowgroup">
        <div role="row"><span role="gridcell" aria-colspan="2">Wide</span></div>
        <div role="row"><span role="rowheader">Ann</span><span role="gridcell">
          <div role="table"><div role="row"><div role="cell">nested</div></div></div>
        </span></div>
      </div></div><h2 id="lbl">People</h2>`);
    const source = extractTable(el);
    expect(source.kind).toBe('aria');
    expect(source.caption).toBe('People');
    expect(source.rows).toHaveLength(3);
    const model = buildModel(source);
    expect(texts(model.head)).toEqual([['Name', 'Info']]);
    expect(texts(model.body)).toEqual([['Wide', 'Wide'], ['Ann', 'nested']]);
    expect(model.body[0][0].colspan).toBe(2);
  });
});

describe('resolveHeaders', () => {
  it('fills blanks and deduplicates', () => {
    const el = html('<table><thead><tr><th>A</th><th></th><th>A</th><th>A_2</th></tr></thead><tr><td>1</td><td>2</td><td>3</td><td>4</td></tr></table>');
    expect(resolveHeaders(buildModel(extractTable(el)))).toEqual(['A', 'column_2', 'A_3', 'A_2']);
  });
});
