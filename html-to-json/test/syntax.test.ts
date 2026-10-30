import { describe, expect, it } from 'vitest';
import { tokenize } from '../lib/syntax';

const kinds = (text: string, format: string) =>
  tokenize(text, format)
    .filter((t) => t.kind)
    .map((t) => `${t.kind}:${t.text}`);

describe('tokenize', () => {
  it('colours JSON keys, strings, numbers and punctuation', () => {
    expect(kinds('{"a": "x:y", "b": [1, true]}', 'json')).toEqual([
      'punc:{', 'key:"a"', 'punc::', 'str:"x:y"', 'punc:,', 'key:"b"', 'punc::', 'punc:[', 'num:1', 'punc:,', 'num:true', 'punc:]', 'punc:}',
    ]);
  });

  it('colours tags, attributes and values in markup', () => {
    expect(kinds('<cell column="A &amp; B">1 &lt; 2</cell>', 'xml')).toEqual([
      'punc:<', 'tag:cell', 'attr:column', 'punc:=', 'str:"A &amp; B"', 'punc:>', 'punc:</', 'tag:cell', 'punc:>',
    ]);
    expect(kinds('<?xml version="1.0"?><!-- c -->', 'xml')).toEqual(['comment:<?xml version="1.0"?>', 'comment:<!-- c -->']);
  });

  it('keeps every character, in order', () => {
    const text = '<table>\n  <tr><td colspan="2">a</td></tr>\n</table>\n';
    expect(tokenize(text, 'html').map((t) => t.text).join('')).toBe(text);
    const json = '[\n  {"k": "v\\"q", "n": -1.5e3}\n]';
    expect(tokenize(json, 'json').map((t) => t.text).join('')).toBe(json);
    expect(tokenize('a,b\r\n', 'csv')).toEqual([{ text: 'a,b\r\n' }]);
  });
});
