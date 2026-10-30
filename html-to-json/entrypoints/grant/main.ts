import { browser } from 'wxt/browser';
import { restartPicker } from '@/lib/inject';

const params = new URLSearchParams(location.search);
const tabId = Number(params.get('tab'));
const origins = (params.get('origins') ?? '').split(' ').filter((o) => /^https?:\/\//.test(o));

const list = document.getElementById('origins')!;
const status = document.getElementById('status')!;
for (const origin of origins) {
  const li = document.createElement('li');
  li.textContent = new URL(origin).host;
  list.append(li);
}

document.getElementById('cancel')!.addEventListener('click', () => window.close());
document.getElementById('allow')!.addEventListener('click', async () => {
  try {
    // Must run directly in the click handler: the browser requires a user gesture.
    const granted = await browser.permissions.request({ origins: origins.map((o) => `${o}/*`) });
    if (!granted) {
      status.textContent = 'Permission was not granted.';
      return;
    }
    await restartPicker(tabId);
    await browser.tabs.update(tabId, { active: true });
    window.close();
  } catch (err) {
    status.textContent = String(err instanceof Error ? err.message : err);
  }
});
