/** Outline drawn over the hovered/selected table, tracking scroll and resize. */
export class Highlight {
  private box: HTMLDivElement;
  private label: HTMLDivElement;
  private target: Element | null = null;
  private frame = 0;
  private readonly onChange = () => this.schedule();

  constructor(shadow: ShadowRoot) {
    this.box = document.createElement('div');
    this.box.className = 'highlight';
    this.box.hidden = true;
    this.label = document.createElement('div');
    this.label.className = 'highlight-label';
    this.box.append(this.label);
    shadow.append(this.box);
    window.addEventListener('scroll', this.onChange, { capture: true, passive: true });
    window.addEventListener('resize', this.onChange, { passive: true });
  }

  show(target: Element | null, mode: 'hover' | 'selected', label = '') {
    this.target = target;
    this.box.dataset.mode = mode;
    this.label.textContent = label;
    this.label.hidden = !label;
    this.schedule();
  }

  private schedule() {
    cancelAnimationFrame(this.frame);
    this.frame = requestAnimationFrame(() => this.draw());
  }

  private draw() {
    if (!this.target?.isConnected) {
      this.box.hidden = true;
      return;
    }
    const r = this.target.getBoundingClientRect();
    this.box.hidden = false;
    Object.assign(this.box.style, {
      top: `${r.top}px`,
      left: `${r.left}px`,
      width: `${r.width}px`,
      height: `${r.height}px`,
    });
    this.label.classList.toggle('below', r.top < 28);
  }

  destroy() {
    cancelAnimationFrame(this.frame);
    window.removeEventListener('scroll', this.onChange, { capture: true });
    window.removeEventListener('resize', this.onChange);
    this.box.remove();
  }
}
