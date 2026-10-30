import type { TableModel } from '../model';
import { resolveHeaders } from '../headers';
import { type CommonOptions, dataRows } from './common';

export interface XmlOptions extends CommonOptions {
  /** Use header names as element names instead of `<cell column="…">`. */
  elementNames: boolean;
}

// Characters not allowed in XML 1.0 documents.
// eslint-disable-next-line no-control-regex
const INVALID_XML_CHARS = /[^\t\n\r -퟿-�\u{10000}-\u{10FFFF}]/gu;

export function escapeXml(text: string, attr = false): string {
  const s = text.replace(INVALID_XML_CHARS, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return attr ? s.replace(/"/g, '&quot;').replace(/\n/g, '&#10;').replace(/\r/g, '&#13;').replace(/\t/g, '&#9;') : s;
}

/** Turn arbitrary header text into a valid XML element name. */
export function xmlName(text: string, fallback: string): string {
  let name = text
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^\p{L}\p{N}_.-]/gu, '');
  if (!name) return fallback;
  if (!/^[\p{L}_]/u.test(name) || /^xml/i.test(name)) name = `_${name}`;
  return name;
}

function uniqueNames(headers: string[]): string[] {
  const used = new Set<string>();
  return headers.map((h, i) => {
    let name = xmlName(h, `column_${i + 1}`);
    if (used.has(name)) {
      let n = 2;
      while (used.has(`${name}_${n}`)) n++;
      name = `${name}_${n}`;
    }
    used.add(name);
    return name;
  });
}

export function toXml(model: TableModel, opts: XmlOptions): string {
  const headers = resolveHeaders(model);
  const names = uniqueNames(headers);
  const lines = ['<?xml version="1.0" encoding="UTF-8"?>'];
  lines.push(model.caption ? `<table caption="${escapeXml(model.caption, true)}">` : '<table>');
  for (const row of dataRows(model, opts)) {
    lines.push('  <row>');
    row.forEach((value, i) => {
      const body = escapeXml(value);
      lines.push(
        opts.elementNames
          ? `    <${names[i]}>${body}</${names[i]}>`
          : `    <cell column="${escapeXml(headers[i], true)}">${body}</cell>`,
      );
    });
    lines.push('  </row>');
  }
  lines.push('</table>');
  return lines.join('\n') + '\n';
}
