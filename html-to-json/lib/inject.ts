import { browser } from 'wxt/browser';
import type { FrameInfo, FrameMessage } from './messages';

/**
 * Inject the picker into every frame we have access to. Returns the origins of
 * child iframes that couldn't be injected (cross-origin without permission).
 */
async function injectAll(tabId: number): Promise<string[]> {
  const results = await browser.scripting.executeScript({
    target: { tabId, allFrames: true },
    files: ['/picker.js'],
  });
  const injected = new Set<string>();
  const children = new Set<string>();
  for (const { result } of results) {
    const info = result as FrameInfo | undefined;
    if (!info) continue;
    injected.add(info.origin);
    for (const origin of info.childOrigins) children.add(origin);
  }
  return [...children].filter((origin) => !injected.has(origin));
}

// Frames don't reply to broadcasts, which some browsers report as an error.
const broadcast = (tabId: number, message: FrameMessage) => browser.tabs.sendMessage(tabId, message).catch(() => {});

/** Toolbar click / shortcut: start picking in all frames, or stop if already active. */
export async function togglePicker(tabId: number): Promise<void> {
  const missingOrigins = await injectAll(tabId);
  const active = await browser.tabs.sendMessage(tabId, { type: 'status' } satisfies FrameMessage, { frameId: 0 });
  await broadcast(tabId, active ? { type: 'stop' } : { type: 'start-picking', missingOrigins });
}

/** Re-inject after new frame permissions were granted, then pick again. */
export async function restartPicker(tabId: number): Promise<void> {
  const missingOrigins = await injectAll(tabId);
  await broadcast(tabId, { type: 'stop' });
  await broadcast(tabId, { type: 'start-picking', missingOrigins });
}

export async function relay(tabId: number, message: FrameMessage): Promise<void> {
  await broadcast(tabId, message);
}
