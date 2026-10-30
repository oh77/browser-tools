import { describe, expect, it } from 'vitest';
import { extractTable } from '../lib/extract';
import { buildModel } from '../lib/grid';
import { COMMON_DEFAULTS, FORMATS, getFormat } from '../lib/convert';
import { toJson } from '../lib/convert/json';
import { toXml, xmlName } from '../lib/convert/xml';
import { toCsv, toTsv } from '../lib/convert/delimited';
import { toHtml } from '../lib/convert/html';
import { exportFilename } from '../lib/filename';
import { html } from './helpers';

const common = { fillMerged: true, singleLine: false };

function model(markup: string) {
  return buildModel(extractTable(html(markup)));
}

const tricky = () =>
  model(`<table><caption>Q&amp;A "list"</caption>
    <thead><tr><th>Name</th><th>Note, with comma</th><th>1st</th></tr></thead>
    <tbody>
      <tr><td>Ann</td><td>said "hi"</td><td>a<br>b</td></tr>
      <tr><td colspan="2">&lt;merged&gt; &amp;</td><td>\ttab</td></tr>
    </tbody></table>`);

/** Minimal RFC 4180 parser for round-trip checks. */
function parseCsv(text: string, d = ','): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') (field += '"'), i++;
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === d) row.push(field), (field = '');
    else if (ch === '\r' && text[i + 1] === '\n') {
      row.push(field), rows.push(row), (row = []), (field = ''), i++;
    } else field += ch;
  }
  return rows;
}

describe('JSON', () => {
  it('produces objects keyed by headers', () => {
    const out = JSON.parse(toJson(tricky(), { ...common, shape: 'objects', pretty: false }));
    expect(out).toEqual([
      { Name: 'Ann', 'Note, with comma': 'said "hi"', '1st': 'a\nb' },
      { Name: '<merged> &', 'Note, with comma': '<merged> &', '1st': 'tab' },
    ]);
  });

  it('supports arrays and table shapes, and empty merged cells', () => {
    const m = tricky();
    const arrays = JSON.parse(toJson(m, { fillMerged: false, singleLine: true, shape: 'arrays', pretty: false }));
    expect(arrays[0]).toEqual(['Name', 'Note, with comma', '1st']);
    expect(arrays[1][2]).toBe('a b');
    expect(arrays[2]).toEqual(['<merged> &', '', 'tab']);
    const keyed = JSON.parse(toJson(m, { ...common, shape: 'keyed', pretty: false }));
    expect(keyed).toEqual({
      Ann: { 'Note, with comma': 'said "hi"', '1st': 'a\nb' },
      '<merged> &': { 'Note, with comma': '<merged> &', '1st': 'tab' },
    });
    const dupes = model('<table><tr><th>K</th><th>V</th></tr><tr><td>a</td><td>1</td></tr><tr><td>a</td><td>2</td></tr></table>');
    expect(JSON.parse(toJson(dupes, { ...common, shape: 'keyed', pretty: false }))).toEqual({ a: { V: '1' }, a_2: { V: '2' } });
    const table = JSON.parse(toJson(m, { ...common, shape: 'table', pretty: true }));
    expect(table.caption).toBe('Q&A "list"');
    expect(table.rows).toHaveLength(2);
  });
});

describe('XML', () => {
  it('escapes values and attributes', () => {
    const out = toXml(tricky(), { ...common, elementNames: false });
    expect(out).toContain('<table caption="Q&amp;A &quot;list&quot;">');
    expect(out).toContain('<cell column="Note, with comma">said "hi"</cell>');
    expect(out).toContain('<cell column="Name">&lt;merged&gt; &amp;</cell>');
    const doc = new DOMParser().parseFromString(out, 'application/xml');
    expect(doc.querySelectorAll('row')).toHaveLength(2);
  });

  it('sanitizes header names when used as element names', () => {
    const out = toXml(tricky(), { ...common, elementNames: true });
    expect(out).toContain('<Name>Ann</Name>');
    expect(out).toContain('<Note_with_comma>');
    expect(out).toContain('<_1st>a\nb</_1st>');
    expect(xmlName('xmlData', 'c')).toBe('_xmlData');
    expect(xmlName('!!!', 'column_4')).toBe('column_4');
    expect(xmlName('Größe (cm)', 'c')).toBe('Größe_cm');
  });

  it('strips characters that are invalid in XML', () => {
    const out = toXml(model('<table><tr><th>A</th></tr><tr><td>x\u0001y</td></tr></table>'), { ...common, elementNames: false });
    expect(out).toContain('>xy<');
  });
});

describe('CSV / TSV', () => {
  it('round-trips through an RFC 4180 parser', () => {
    const out = toCsv(tricky(), { ...common, delimiter: ',', includeHeader: true, bom: false });
    expect(parseCsv(out)).toEqual([
      ['Name', 'Note, with comma', '1st'],
      ['Ann', 'said "hi"', 'a\nb'],
      ['<merged> &', '<merged> &', 'tab'],
    ]);
  });

  it('supports semicolons, BOM, and no header', () => {
    const out = toCsv(tricky(), { ...common, delimiter: ';', includeHeader: false, bom: true });
    expect(out.startsWith('﻿Ann;said ""hi"";"a\nb"\r\n')).toBe(false);
    expect(out.startsWith('﻿Ann;"said ""hi""";"a\nb"\r\n')).toBe(true);
  });

  it('flattens tabs and newlines in TSV', () => {
    const out = toTsv(tricky(), { ...common, includeHeader: true });
    expect(out.split('\n')).toEqual(['Name\tNote, with comma\t1st', 'Ann\tsaid "hi"\ta b', '<merged> &\t<merged> &\ttab', '']);
  });
});

describe('HTML', () => {
  it('rebuilds a clean table with spans and scope', () => {
    const m = model(`<table class="big" style="x"><thead><tr><th class="h">A</th><th>B</th></tr></thead>
      <tbody><tr><td colspan="2" onclick="x()"><a href="https://e.com/" class="l">link</a> <span>t</span></td></tr>
      <tr><th>R</th><td>1</td></tr></tbody></table>`);
    expect(toHtml(m, { plainText: false, standalone: false, singleLine: false })).toBe(
      [
        '<table>',
        '  <thead>',
        '    <tr>',
        '      <th scope="col">A</th>',
        '      <th scope="col">B</th>',
        '    </tr>',
        '  </thead>',
        '  <tbody>',
        '    <tr>',
        '      <td colspan="2"><a href="https://e.com/">link</a> t</td>',
        '    </tr>',
        '    <tr>',
        '      <th scope="row">R</th>',
        '      <td>1</td>',
        '    </tr>',
        '  </tbody>',
        '</table>',
        '',
      ].join('\n'),
    );
  });

  it('emits plain text and standalone documents', () => {
    const out = toHtml(tricky(), { plainText: true, standalone: true, singleLine: false });
    expect(out.startsWith('<!doctype html>')).toBe(true);
    expect(out).toContain('<caption>Q&amp;A &quot;list&quot;</caption>');
    expect(out).toContain('<td>a<br>b</td>');
    expect(out).toContain('<td colspan="2">&lt;merged&gt; &amp;</td>');
  });

  it('turns ARIA grids into real tables', () => {
    const m = model('<div role="table"><div role="row"><div role="columnheader">H</div></div><div role="row"><div role="cell">v</div></div></div>');
    const out = toHtml(m, { plainText: false, standalone: false, singleLine: false });
    expect(out).toContain('<th scope="col">H</th>');
    expect(out).toContain('<td>v</td>');
  });
});

describe('registry', () => {
  it('runs every format with its defaults', () => {
    for (const format of FORMATS) {
      const out = format.convert(tricky(), { ...COMMON_DEFAULTS, ...format.defaults });
      expect(out.length).toBeGreaterThan(0);
    }
    expect(getFormat('nope').id).toBe('json');
  });

  it('builds safe filenames', () => {
    expect(exportFilename('Ünïcode: Table / 2025!', 'csv', new Date(2025, 0, 2, 3, 4, 5))).toBe(
      'unicode-table-2025-20250102-030405.csv',
    );
    expect(exportFilename('', 'json', new Date(2025, 0, 2, 3, 4, 5))).toBe('table-20250102-030405.json');
  });
});
