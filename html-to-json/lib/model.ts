/** A cell as read from the page, before rowspan/colspan expansion. */
export interface SourceCell {
  /** Normalized text; may contain newlines. */
  text: string;
  /** Sanitized inner HTML (allow-listed inline tags only). */
  html: string;
  isHeader: boolean;
  colspan: number;
  /** 0 means "span to the end of the section", as in HTML. */
  rowspan: number;
}

export type Section = 'head' | 'body' | 'foot';

export interface SourceRow {
  section: Section;
  /** Row group (thead/tbody/tfoot element); spans never cross groups. */
  group: number;
  cells: SourceCell[];
}

export interface SourceTable {
  kind: 'html' | 'aria';
  caption?: string;
  rows: SourceRow[];
}

/** A cell in the expanded, rectangular grid. */
export interface GridCell {
  /** Identifies the source cell; every position a span covers shares it. */
  id: number;
  text: string;
  html: string;
  isHeader: boolean;
  /** Spans after clipping to the section; only meaningful when `spanned` is false. */
  colspan: number;
  rowspan: number;
  /** True when this position is covered by a span from another cell (or is padding). */
  spanned: boolean;
  /** True when this position is padding added to square off a ragged row. */
  padding?: boolean;
}

export interface TableModel {
  kind: 'html' | 'aria';
  caption?: string;
  head: GridCell[][];
  body: GridCell[][];
  foot: GridCell[][];
  columnCount: number;
}

export type HeaderMode = 'auto' | 'first-row' | 'none';
