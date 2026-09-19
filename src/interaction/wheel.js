// 滚轮缩放：以鼠标位置为不动点
export class WheelController {
  constructor(canvas, viewport, onChange) {
    this.canvas = canvas;
    this.viewport = viewport;
    this.onChange = onChange;
    canvas.addEventListener(
      'wheel',
      (event) => {
        event.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const anchor = { x: event.clientX - rect.left, y: event.clientY - rect.top };
        const factor = Math.exp(-event.deltaY * 0.0015);
        this.viewport.zoomAt(anchor, factor);
        this.onChange();
      },
      { passive: false },
    );
  }
}
