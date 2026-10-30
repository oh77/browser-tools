import { browser } from 'wxt/browser';
import { buildModel } from '@/lib/grid';
import { applyExclusions } from '@/lib/exclude';
import { COMMON_OPTIONS, EXCLUDE_OPTIONS, FORMATS, type OptionDef, type OptionValues, getFormat } from '@/lib/convert';
import { type Settings, defaultSettings, loadSettings, saveSettings } from '@/lib/settings';
import { exportFilename } from '@/lib/filename';
import { copyText } from '@/lib/clipboard';
import { tokenize } from '@/lib/syntax';
import type { HeaderMode, SourceTable, TableModel } from '@/lib/model';
import type { DownloadMessage } from '@/lib/messages';

const PREVIEW_LIMIT = 100_000;

interface PanelOptions {
  shadow: ShadowRoot;
  source: SourceTable;
  /** URL of the frame the table was picked in. */
  frameUrl: string;
  onClose(): void;
  onPickAnother(): void;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const node: HTMLElementTagNameMap[K] = document.createElement(tag);
  Object.assign(node, props);
  (node as HTMLElement).append(...children);
  return node;
}

/** Small stroke icon; paths are drawn in `currentColor`. */
function icon(size: number, shapes: string[][], strokeWidth: number): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
  svg.setAttribute('fill', 'none');
  svg.setAttribute('aria-hidden', 'true');
  for (const [tag, ...attrs] of shapes) {
    const shape = document.createElementNS(ns, tag);
    for (let i = 0; i < attrs.length; i += 2) shape.setAttribute(attrs[i], attrs[i + 1]);
    shape.setAttribute('stroke', 'currentColor');
    shape.setAttribute('stroke-width', String(strokeWidth));
    shape.setAttribute('stroke-linecap', 'round');
    shape.setAttribute('stroke-linejoin', 'round');
    svg.append(shape);
  }
  return svg;
}

const closeIcon = () => icon(14, [['path', 'd', 'M3 3l8 8M11 3l-8 8']], 1.5);
const chevronIcon = () => icon(10, [['path', 'd', 'M2.5 4l2.5 2.5L7.5 4']], 1.4);
const frameIcon = () =>
  icon(12, [['rect', 'x', '1.5', 'y', '2', 'width', '9', 'height', '8', 'rx', '1.5'], ['path', 'd', 'M1.5 4.5h9']], 1.2);

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

function checkbox(def: OptionDef, values: OptionValues, onChange: () => void): HTMLElement {
  const input = el('input', { type: 'checkbox', checked: Boolean(values[def.key]) });
  input.addEventListener('change', () => {
    values[def.key] = input.checked;
    onChange();
  });
  return el('label', { className: 'check' }, input, def.label);
}

/**
 * One options row: [label] [select] [checkboxes]. Rows without a select start
 * the checkboxes in its column, after `rowLabel` if given.
 */
function optionRow(defs: OptionDef[], values: OptionValues, onChange: () => void, rowLabel?: string): HTMLElement[] {
  const selectDef = defs.find((d) => d.type === 'select');
  const checks = el(
    'div',
    { className: 'checks' },
    ...defs.filter((d) => d.type === 'boolean').map((d) => checkbox(d, values, onChange)),
  );
  if (selectDef?.type !== 'select') {
    checks.classList.add('no-select');
    return rowLabel ? [el('span', { className: 'opt-label', textContent: rowLabel }), checks] : [checks];
  }
  const id = `te-opt-${selectDef.key}`;
  const select = el('select', { id });
  for (const choice of selectDef.choices) {
    select.append(el('option', { value: choice.value, textContent: choice.label, selected: values[selectDef.key] === choice.value }));
  }
  select.addEventListener('change', () => {
    values[selectDef.key] = select.value;
    onChange();
  });
  return [
    el('label', { className: 'opt-label', htmlFor: id }, selectDef.label),
    el('div', { className: 'select' }, select, chevronIcon()),
    checks,
  ];
}

/** Confirm/preview panel: choose format and options, then copy or download. */
export function openPanel({ shadow, source, frameUrl, onClose, onPickAnother }: PanelOptions): () => void {
  let settings: Settings = defaultSettings();
  let model: TableModel = buildModel(source, settings.common.headerMode as HeaderMode);
  let output = '';

  const meta = el('span', { className: 'meta' });
  const closeBtn = el('button', { type: 'button', className: 'close', ariaLabel: 'Close', title: 'Close (Esc)' }, closeIcon());
  const tabs = el('div', { className: 'tabs', role: 'tablist', ariaLabel: 'Format' });
  const options = el('div', { className: 'options' });
  const note = el('span', { className: 'preview-note' });
  const preview = el('pre', { className: 'preview', tabIndex: 0, ariaLabel: 'Preview' });
  const status = el('span', { className: 'status', role: 'status' });
  const pickBtn = el('button', { type: 'button', className: 'ghost', textContent: 'Pick another table' });
  const copyBtn = el('button', { type: 'button', className: 'secondary', textContent: 'Copy' });
  const downloadBtn = el('button', { type: 'button', className: 'primary', textContent: 'Download' });

  const panel = el(
    'section',
    { className: 'panel', role: 'dialog', ariaLabel: 'Export table' },
    el('header', {}, el('div', { className: 'title' }, el('h2', { textContent: 'Export table' }), meta), closeBtn),
    el(
      'div',
      { className: 'body' },
      tabs,
      options,
      el(
        'div',
        { className: 'preview-box' },
        el('div', { className: 'preview-bar' }, note, el('span', { textContent: 'Preview' })),
        preview,
      ),
    ),
    el('footer', {}, pickBtn, el('div', { className: 'actions' }, status, copyBtn, downloadBtn)),
  );
  shadow.append(panel);

  const format = () => getFormat(settings.format);
  const formatOptions = () => ({ ...settings.common, ...settings.perFormat[format().id] });

  const setStatus = (text: string, error = false) => {
    status.textContent = text;
    status.classList.toggle('error', error);
  };

  const renderPreview = () => {
    const truncated = output.length > PREVIEW_LIMIT;
    const fragment = document.createDocumentFragment();
    for (const token of tokenize(truncated ? output.slice(0, PREVIEW_LIMIT) : output, format().id)) {
      fragment.append(token.kind ? el('span', { className: `tok-${token.kind}`, textContent: token.text }) : token.text);
    }
    if (truncated) {
      fragment.append(
        el('span', {
          className: 'tok-comment',
          textContent: `\n\n… preview truncated (${output.length.toLocaleString()} characters total; the export is complete)`,
        }),
      );
    }
    preview.replaceChildren(fragment);
    preview.scrollTop = 0;
  };

  const render = () => {
    const filtered = applyExclusions(buildModel(source, settings.common.headerMode as HeaderMode), {
      excludeUntitled: Boolean(settings.common.excludeUntitled),
      excludeEmpty: Boolean(settings.common.excludeEmpty),
      excludeEmptyRows: Boolean(settings.common.excludeEmptyRows),
      fillMerged: Boolean(settings.common.fillMerged),
    });
    model = filtered.model;
    const parts = [plural(model.body.length + model.foot.length, 'row'), plural(model.columnCount, 'column')];
    if (filtered.excludedRows) parts[0] += ` (${filtered.excludedRows} excluded)`;
    if (filtered.excludedColumns) parts[1] += ` (${filtered.excludedColumns} excluded)`;
    if (model.head.length) parts.push(plural(model.head.length, 'header row'));
    meta.textContent = parts.join(' · ');

    for (const button of Array.from(tabs.children) as HTMLButtonElement[]) {
      button.ariaSelected = String(button.value === settings.format);
      button.tabIndex = button.value === settings.format ? 0 : -1;
    }

    options.replaceChildren(
      ...optionRow(COMMON_OPTIONS, settings.common, update),
      ...optionRow(EXCLUDE_OPTIONS, settings.common, update, 'Exclude'),
      ...optionRow(format().options, settings.perFormat[format().id], update),
    );

    const notes: string[] = [];
    if (frameUrl !== location.href) {
      const frame = new URL(frameUrl);
      notes.push(`From an embedded frame${frame.origin === location.origin ? '' : ` (${frame.host})`}`);
    }
    if (source.kind === 'aria') notes.push('ARIA grid: only rendered rows are exported');
    if (source.rows.length === 0) notes.push('This table has no rows');
    note.replaceChildren(...(notes.length ? [frameUrl !== location.href ? frameIcon() : '', notes.join(' · ')] : []));

    output = format().convert(model, formatOptions());
    renderPreview();
    setStatus('');
  };

  function update() {
    render();
    void saveSettings(settings);
  }

  for (const f of FORMATS) {
    const button = el('button', { type: 'button', className: 'tab', role: 'tab', value: f.id, textContent: f.label });
    button.addEventListener('click', () => {
      settings.format = f.id;
      update();
      button.focus();
    });
    tabs.append(button);
  }
  // Arrow keys move between format tabs.
  tabs.addEventListener('keydown', (e) => {
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const i = FORMATS.findIndex((f) => f.id === settings.format);
    (tabs.children[(i + step + FORMATS.length) % FORMATS.length] as HTMLButtonElement).click();
  });

  const filename = () => exportFilename(model.caption || document.title, format().ext);

  copyBtn.addEventListener('click', async () => {
    try {
      await copyText(output);
      setStatus(`Copied ${format().label}`);
    } catch (err) {
      setStatus(String(err instanceof Error ? err.message : err), true);
    }
  });

  downloadBtn.addEventListener('click', async () => {
    const message: DownloadMessage = { type: 'download', filename: filename(), text: output, mime: format().mime };
    try {
      const res = (await browser.runtime.sendMessage(message)) as { ok: boolean; error?: string } | undefined;
      if (!res?.ok) throw new Error(res?.error ?? 'Download failed');
      setStatus(`Saved ${message.filename}`);
    } catch (err) {
      setStatus(String(err instanceof Error ? err.message : err), true);
    }
  });

  closeBtn.addEventListener('click', onClose);
  pickBtn.addEventListener('click', onPickAnother);

  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    e.stopImmediatePropagation();
    onClose();
  };
  window.addEventListener('keydown', onKey, { capture: true });
  // Keep the page's own keyboard shortcuts from reacting to keys pressed in the panel.
  panel.addEventListener('keydown', (e) => e.stopPropagation());

  // Show the panel only once saved settings are in, so the last format doesn't flash in after the default.
  panel.hidden = true;
  loadSettings().then((loaded) => {
    if (!panel.isConnected) return;
    settings = loaded;
    render();
    panel.hidden = false;
    downloadBtn.focus();
  });

  return () => {
    window.removeEventListener('keydown', onKey, { capture: true });
    panel.remove();
  };
}
