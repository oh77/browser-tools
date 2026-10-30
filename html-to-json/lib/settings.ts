import { browser } from 'wxt/browser';
import { COMMON_DEFAULTS, FORMATS, type FormatId, type OptionValues, getFormat } from './convert';

export interface Settings {
  format: FormatId;
  common: OptionValues;
  perFormat: Record<FormatId, OptionValues>;
}

const KEY = 'settings';

export function defaultSettings(): Settings {
  return {
    format: 'json',
    common: { ...COMMON_DEFAULTS },
    perFormat: Object.fromEntries(FORMATS.map((f) => [f.id, { ...f.defaults }])) as Settings['perFormat'],
  };
}

export async function loadSettings(): Promise<Settings> {
  const settings = defaultSettings();
  try {
    const stored = (await browser.storage.local.get(KEY))[KEY] as Partial<Settings> | undefined;
    if (!stored) return settings;
    settings.format = getFormat(stored.format ?? '').id;
    Object.assign(settings.common, stored.common);
    for (const f of FORMATS) Object.assign(settings.perFormat[f.id], stored.perFormat?.[f.id]);
  } catch {
    // Fall back to defaults if storage is unavailable.
  }
  return settings;
}

export async function saveSettings(settings: Settings): Promise<void> {
  try {
    await browser.storage.local.set({ [KEY]: settings });
  } catch {
    // Not fatal; the export itself still works.
  }
}
