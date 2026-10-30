import type { TableModel } from './model';
import { toSingleLine } from './extract/cell-text';

/**
 * One unique, non-empty name per column. Multi-row headers are joined with
 * " / " (skipping repeats caused by rowspan), blanks become `column_N`, and
 * duplicates get a numeric suffix.
 */
export function resolveHeaders(model: TableModel): string[] {
  const raw = Array.from({ length: model.columnCount }, (_, c) => {
    const parts: string[] = [];
    for (const row of model.head) {
      const text = toSingleLine(row[c]?.text ?? '');
      if (text && parts[parts.length - 1] !== text) parts.push(text);
    }
    return parts.join(' / ') || `column_${c + 1}`;
  });
  const seen = new Map<string, number>();
  const taken = new Set(raw);
  return raw.map((name) => {
    const count = (seen.get(name) ?? 0) + 1;
    seen.set(name, count);
    if (count === 1) return name;
    let n = count;
    while (taken.has(`${name}_${n}`)) n++;
    const unique = `${name}_${n}`;
    taken.add(unique);
    return unique;
  });
}
