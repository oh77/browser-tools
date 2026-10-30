import { frameInfo, installFrame } from './frame';

// Injected into every frame on each toolbar click / shortcut press. The first
// injection installs the message listener; the background then drives all
// frames with broadcasts. The return value tells it which frames were reached.
export default defineUnlistedScript(() => {
  installFrame();
  return frameInfo();
});
