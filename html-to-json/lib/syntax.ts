/** Token classes used by the preview's syntax colouring. */
export type TokenKind = 'key' | 'str' | 'num' | 'punc' | 'tag' | 'attr' | 'comment';

export interface Token {
  text: string;
  kind?: TokenKind;
}

const JSON_TOKENS = /("(?:[^"\\]|\\.)*")(\s*:)?|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|\b(true|false|null)\b|([{}[\],:])/g;
const MARKUP_TOKENS = /(<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!doctype[^>]*>)|(<\/?)([\w:.-]+)([^<>]*?)(\/?>)/gi;
const ATTR_TOKENS = /([^\s=]+)(=)("[^"]*")?/g;

function scan(text: string, re: RegExp, onMatch: (m: RegExpExecArray, out: Token[]) => void): Token[] {
  const out: Token[] = [];
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (m.index > last) out.push({ text: text.slice(last, m.index) });
    onMatch(m as RegExpExecArray, out);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}

function tokenizeJson(text: string): Token[] {
  return scan(text, JSON_TOKENS, ([, str, colon, num, literal, punc], out) => {
    if (str !== undefined) {
      out.push({ text: str, kind: colon ? 'key' : 'str' });
      if (colon) out.push({ text: colon, kind: 'punc' });
    } else if (num !== undefined || literal !== undefined) out.push({ text: num ?? literal, kind: 'num' });
    else out.push({ text: punc, kind: 'punc' });
  });
}

function tokenizeMarkup(text: string): Token[] {
  return scan(text, MARKUP_TOKENS, ([, special, open, name, attrs, close], out) => {
    if (special !== undefined) {
      out.push({ text: special, kind: 'comment' });
      return;
    }
    out.push({ text: open, kind: 'punc' }, { text: name, kind: 'tag' });
    out.push(
      ...scan(attrs, ATTR_TOKENS, ([, attr, eq, value], o) => {
        o.push({ text: attr, kind: 'attr' }, { text: eq, kind: 'punc' });
        if (value !== undefined) o.push({ text: value, kind: 'str' });
      }),
    );
    out.push({ text: close, kind: 'punc' });
  });
}

/** Split converter output into coloured tokens; CSV/TSV stay plain. */
export function tokenize(text: string, format: string): Token[] {
  if (format === 'json') return tokenizeJson(text);
  if (format === 'xml' || format === 'html') return tokenizeMarkup(text);
  return [{ text }];
}
