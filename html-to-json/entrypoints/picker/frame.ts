import { browser } from 'wxt/browser';
import css from './style.css?inline';
import { startPicking } from './picker';
import { openPanel } from './panel';
import { Highlight } from './highlight';
import { extractTable } from '@/lib/extract';
import type { FrameInfo, FrameMessage } from '@/lib/messages';

declare global {
  interface Window {
    __tableExportInstalled?: boolean;
  }
}

const isTop = window === window.top;

export function frameInfo(): FrameInfo {
  const childOrigins = new Set<string>();
  for (const frame of Array.from(document.querySelectorAll<HTMLIFrameElement>('iframe[src], frame[src]'))) {
    try {
      const { origin } = new URL(frame.src, location.href);
      if (origin.startsWith('http')) childOrigins.add(origin);
    } catch {
      // Ignore unparsable src values.
    }
  }
  return { origin: location.origin, childOrigins: [...childOrigins] };
}

/** Send a message to every frame in this tab (including this one) via the background. */
function relay(payload: FrameMessage): void {
  browser.runtime.sendMessage({ type: 'relay', payload }).catch(() => {});
}

interface Mounted {
  host: HTMLElement;
  shadow: ShadowRoot;
  highlight: Highlight;
}

/**
 * Per-frame controller. Every frame can pick; the frame that picks sends the
 * extracted table to all frames, and the top frame shows the panel.
 */
export function installFrame(): void {
  if (window.__tableExportInstalled) return;
  window.__tableExportInstalled = true;

  let ui: Mounted | null = null;
  let teardown: (() => void) | null = null;
  let token: string | null = null;
  let picked: Element | null = null;
  let missingOrigins: string[] = [];

  const mount = (): Mounted => {
    if (ui) return ui;
    const host = document.createElement('table-export-ui');
    host.style.cssText = 'all: initial; position: fixed; inset: 0 auto auto 0; z-index: 2147483647;';
    const shadow = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = css;
    shadow.append(style);
    document.documentElement.append(host);
    ui = { host, shadow, highlight: new Highlight(shadow) };
    return ui;
  };

  const unmount = () => {
    teardown?.();
    teardown = null;
    token = null;
    picked = null;
    ui?.highlight.destroy();
    ui?.host.remove();
    ui = null;
  };

  const startPick = () => {
    const { host, shadow, highlight } = mount();
    teardown?.();
    token = null;
    teardown = startPicking({
      host,
      shadow,
      highlight,
      banner: isTop,
      missingOrigins: isTop ? missingOrigins : [],
      onRequestAccess: () => {
        browser.runtime.sendMessage({ type: 'request-access', origins: missingOrigins }).catch(() => {});
      },
      onPick: (table) => {
        // Not crypto.randomUUID(): it only exists in secure contexts (https).
        token = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        picked = table;
        highlight.show(table, 'selected');
        relay({ type: 'picked', token, source: extractTable(table), frameUrl: location.href });
      },
      onCancel: () => relay({ type: 'stop' }),
    });
  };

  const onPicked = (msg: Extract<FrameMessage, { type: 'picked' }>) => {
    teardown?.();
    teardown = null;
    const pickedHere = msg.token === token;
    // Keep the selection outline in the frame that was picked from.
    if (pickedHere) ui?.highlight.show(picked, 'selected');
    if (!isTop) {
      if (!pickedHere) unmount();
      return;
    }
    const { shadow } = mount();
    teardown = openPanel({
      shadow,
      source: msg.source,
      frameUrl: msg.frameUrl,
      onClose: () => relay({ type: 'stop' }),
      onPickAnother: () => relay({ type: 'start-picking' }),
    });
  };

  browser.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
    const msg = message as FrameMessage;
    switch (msg?.type) {
      case 'status':
        sendResponse(ui !== null);
        return;
      case 'start-picking':
        if (msg.missingOrigins) missingOrigins = msg.missingOrigins;
        startPick();
        return;
      case 'picked':
        onPicked(msg);
        return;
      case 'stop':
        unmount();
        return;
    }
  });
}
