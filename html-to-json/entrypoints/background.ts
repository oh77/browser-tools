import { relay, togglePicker } from '@/lib/inject';
import type { BackgroundMessage, DownloadMessage } from '@/lib/messages';

function base64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

async function download({ filename, text, mime }: DownloadMessage): Promise<void> {
  // Firefox's event page has createObjectURL (and refuses data: URLs);
  // Chrome's service worker has no createObjectURL, so use a data: URL there.
  if (typeof URL.createObjectURL === 'function') {
    const url = URL.createObjectURL(new Blob([text], { type: `${mime};charset=utf-8` }));
    try {
      await browser.downloads.download({ url, filename, saveAs: false, conflictAction: 'uniquify' });
    } finally {
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    }
    return;
  }
  const url = `data:${mime};charset=utf-8;base64,${base64(text)}`;
  await browser.downloads.download({ url, filename, saveAs: false, conflictAction: 'uniquify' });
}

async function showError(tabId: number, err: unknown): Promise<void> {
  // Browser-internal pages and extension stores can't be scripted.
  console.warn('Table Export: cannot run on this page', err);
  await browser.action.setBadgeBackgroundColor({ tabId, color: '#b3261e' });
  await browser.action.setBadgeText({ tabId, text: '!' });
  await browser.action.setTitle({ tabId, title: 'Table Export can’t run on this page' });
  setTimeout(() => {
    browser.action.setBadgeText({ tabId, text: '' }).catch(() => {});
    browser.action.setTitle({ tabId, title: 'Pick a table to export' }).catch(() => {});
  }, 3000);
}

/** permissions.request needs a user gesture in an extension page, so ask from a small popup window. */
async function requestAccess(tabId: number, origins: string[]): Promise<void> {
  const params = new URLSearchParams({ tab: String(tabId), origins: origins.join(' ') });
  await browser.windows.create({
    url: `${browser.runtime.getURL('/grant.html')}?${params}`,
    type: 'popup',
    width: 460,
    height: 320,
  });
}

async function handle(message: BackgroundMessage, tabId: number | undefined): Promise<void> {
  switch (message.type) {
    case 'download':
      return download(message);
    case 'relay':
      if (tabId !== undefined) await relay(tabId, message.payload);
      return;
    case 'request-access':
      if (tabId !== undefined) await requestAccess(tabId, message.origins);
      return;
  }
}

export default defineBackground(() => {
  // The toolbar button and the _execute_action shortcut both land here.
  browser.action.onClicked.addListener((tab) => {
    if (tab.id === undefined) return;
    const tabId = tab.id;
    togglePicker(tabId).catch((err) => showError(tabId, err));
  });

  browser.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
    const msg = message as BackgroundMessage;
    if (!msg?.type) return;
    handle(msg, sender.tab?.id).then(
      () => sendResponse({ ok: true }),
      (err: unknown) => sendResponse({ ok: false, error: String(err) }),
    );
    return true;
  });
});
