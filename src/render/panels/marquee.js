// 框选矩形：屏幕坐标的覆盖 div
export class Marquee {
  constructor(element) {
    this.el = element;
    this.hide();
  }

  show(start) {
    this.start = start;
    this.el.style.display = 'block';
    this.update(start);
  }

  update(current) {
    const x = Math.min(this.start.x, current.x);
    const y = Math.min(this.start.y, current.y);
    const width = Math.abs(current.x - this.start.x);
    const height = Math.abs(current.y - this.start.y);
    this.el.style.left = `${x}px`;
    this.el.style.top = `${y}px`;
    this.el.style.width = `${width}px`;
    this.el.style.height = `${height}px`;
  }

  hide() {
    this.el.style.display = 'none';
  }
}
