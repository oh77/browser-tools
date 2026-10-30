import { findTable, firstChildTable, isHtmlTable, parentTable } from '@/lib/detect';
import type { Highlight } from './highlight';

interface PickOptions {
  host: Element;
  shadow: ShadowRoot;
  highlight: Highlight;
  /** Show the instructions banner (top frame only). */
  banner: boolean;
  /** Embedded-frame origins we can't read yet; shown with an "Allow" button. */
  missingOrigins: string[];
  onRequestAccess(): void;
  onPick(table: Element): void;
  onCancel(): void;
}

function hostList(origins: string[]): string {
  const hosts = origins.map((o) => new URL(o).host);
  return hosts.length > 2 ? `${hosts.slice(0, 2).join(', ')} and ${hosts.length - 2} more` : hosts.join(' and ');
}

/** Cheap size estimate for the hover label (full extraction can be slow on big tables). */
function describe(table: Element): string {
  if (isHtmlTable(table)) {
    const rows = Array.from((table as HTMLTableElement).rows);
    const cols = Math.max(0, ...rows.slice(0, 20).map((r) => Array.from(r.cells).reduce((n, c) => n + c.colSpan, 0)));
    return `table · ${rows.length} × ${cols}`;
  }
  const rows = table.querySelectorAll('[role="row"]').length;
  return `${table.getAttribute('role')} · ${rows} rows`;
}

/** Hover-to-highlight, click (or Enter) to pick, ↑/↓ for parent/child tables, Esc to cancel. */
export function startPicking(options: PickOptions): () => void {
  const { host, shadow, highlight, onPick, onCancel } = options;
  const banner = document.createElement('div');
  banner.className = 'banner';
  const kbd = (key: string) => Object.assign(document.createElement('kbd'), { textContent: key });
  banner.append(
    Object.assign(document.createElement('strong'), { textContent: 'Table Export' }),
    'Hover a table and click to select · ',
    kbd('↑'),
    kbd('↓'),
    ' outer/inner table · ',
    kbd('Esc'),
    ' cancel',
  );
  if (options.missingOrigins.length > 0) {
    const hint = document.createElement('div');
    hint.className = 'banner-hint';
    const allow = document.createElement('button');
    allow.textContent = 'Allow access';
    allow.addEventListener('click', options.onRequestAccess);
    hint.append(`Tables in embedded frames from ${hostList(options.missingOrigins)} can’t be read yet.`, allow);
    banner.append(hint);
  }
  if (options.banner) shadow.append(banner);

  let current: Element | null = null;
  const setCurrent = (table: Element | null) => {
    current = table;
    highlight.show(table, 'hover', table ? describe(table) : '');
  };

  const ours = (e: Event) => e.composedPath().includes(host);

  const onMove = (e: MouseEvent) => {
    if (ours(e)) return;
    const table = findTable(e.target as Element);
    // Keep a table chosen with ↑/↓ while the pointer stays inside it.
    if (current && table && current.contains(table)) return;
    if (table !== current) setCurrent(table);
    // Inside an iframe, take focus so ↑/↓/Enter/Esc reach this frame.
    if (table && !document.hasFocus()) window.focus();
  };

  const swallow = (e: Event) => {
    if (ours(e)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
  };

  const onClick = (e: MouseEvent) => {
    if (ours(e)) return;
    swallow(e);
    const table = current && current.contains(e.target as Node) ? current : findTable(e.target as Element);
    if (table) onPick(table);
  };

  const onKey = (e: KeyboardEvent) => {
    let handled = true;
    if (e.key === 'Escape') onCancel();
    else if (e.key === 'Enter' && current) onPick(current);
    else if (e.key === 'ArrowUp' && current) setCurrent(parentTable(current) ?? current);
    else if (e.key === 'ArrowDown' && current) setCurrent(firstChildTable(current) ?? current);
    else handled = false;
    if (handled) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  };

  const opts = { capture: true };
  window.addEventListener('mousemove', onMove, opts);
  window.addEventListener('click', onClick, opts);
  for (const type of ['mousedown', 'mouseup', 'pointerdown', 'pointerup', 'auxclick', 'dblclick'] as const) {
    window.addEventListener(type, swallow, opts);
  }
  window.addEventListener('keydown', onKey, opts);

  return () => {
    window.removeEventListener('mousemove', onMove, opts);
    window.removeEventListener('click', onClick, opts);
    for (const type of ['mousedown', 'mouseup', 'pointerdown', 'pointerup', 'auxclick', 'dblclick'] as const) {
      window.removeEventListener(type, swallow, opts);
    }
    window.removeEventListener('keydown', onKey, opts);
    banner.remove();
    highlight.show(null, 'hover');
  };
}
