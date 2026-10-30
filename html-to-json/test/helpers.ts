import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export function loadFixture(name: string): Document {
  document.body.innerHTML = readFileSync(resolve(__dirname, 'fixtures', name), 'utf8');
  return document;
}

export function html(markup: string): Element {
  document.body.innerHTML = markup;
  return document.body.firstElementChild!;
}
