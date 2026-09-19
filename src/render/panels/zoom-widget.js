// 左下角缩放显示与复位
export class ZoomWidget {
  constructor(element, viewport, onReset) {
    this.el = element;
    this.viewport = viewport;
    this.onReset = onReset;
    this.el.innerHTML = `
      <button class="nfe-zoom-btn" data-zoom="out" title="缩小">−</button>
      <span class="nfe-zoom-value" title="当前缩放比例">100%</span>
      <button class="nfe-zoom-btn" data-zoom="in" title="放大">+</button>
      <button class="nfe-zoom-reset" data-zoom="reset" title="复位视图 (100%)">复位</button>
    `;
    this.valueEl = this.el.querySelector('.nfe-zoom-value');
    this.el.addEventListener('click', (event) => {
      const action = event.target.closest('[data-zoom]')?.dataset.zoom;
      if (action === 'in') this.viewport.zoomAt(this._center(), 1.2);
      if (action === 'out') this.viewport.zoomAt(this._center(), 1 / 1.2);
      if (action === 'reset') this.onReset();
      this.update();
    });
  }

  _center() {
    const rect = this.viewport.world.parentElement.getBoundingClientRect();
    return { x: rect.width / 2, y: rect.height / 2 };
  }

  update() {
    this.valueEl.textContent = `${Math.round(this.viewport.scale * 100)}%`;
  }
}
