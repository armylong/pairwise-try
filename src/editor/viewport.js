import { clampZoom } from '../core/model.js';
import { zoomAt } from '../core/geometry.js';

/** 视口：滚轮缩放（以鼠标为锚点）、平移、网格同步、缩放控件。 */
export function initViewport(ctx) {
  const { canvasWrap, canvasGrid, viewportEl, zoomLabel } = ctx.els;

  function apply() {
    const v = ctx.flow.viewport;
    viewportEl.style.transform = `translate(${v.x}px, ${v.y}px) scale(${v.zoom})`;
    let grid = 24 * v.zoom;
    while (grid < 18) grid *= 5;
    canvasGrid.style.setProperty('--grid-size', `${grid}px`);
    canvasGrid.style.setProperty('--grid-x', `${v.x}px`);
    canvasGrid.style.setProperty('--grid-y', `${v.y}px`);
    zoomLabel.textContent = `${Math.round(v.zoom * 100)}%`;
    ctx.els.btnUndo.disabled = !ctx.history.canUndo;
    ctx.els.btnRedo.disabled = !ctx.history.canRedo;
  }
  ctx.applyViewport = apply;

  function setZoomAt(nextZoom, sx, sy) {
    const v = ctx.flow.viewport;
    const next = zoomAt(v, sx, sy, clampZoom(nextZoom));
    v.x = next.x;
    v.y = next.y;
    v.zoom = next.zoom;
    apply();
    ctx.saveSoon();
  }

  canvasWrap.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      const rect = canvasWrap.getBoundingClientRect();
      const factor = Math.exp(-e.deltaY * 0.0016);
      setZoomAt(ctx.flow.viewport.zoom * factor, e.clientX - rect.left, e.clientY - rect.top);
    },
    { passive: false },
  );

  ctx.els.btnZoomIn.addEventListener('click', () => {
    const r = canvasWrap.getBoundingClientRect();
    setZoomAt(ctx.flow.viewport.zoom * 1.25, r.width / 2, r.height / 2);
  });
  ctx.els.btnZoomOut.addEventListener('click', () => {
    const r = canvasWrap.getBoundingClientRect();
    setZoomAt(ctx.flow.viewport.zoom / 1.25, r.width / 2, r.height / 2);
  });
  ctx.els.btnZoomReset.addEventListener('click', () => {
    ctx.flow.viewport = { x: 0, y: 0, zoom: 1 };
    apply();
    ctx.saveSoon();
  });

  /** 平移：由 editorPage 在判定为空白拖拽 / 空格 / 中键时调用。 */
  ctx.startPan = (e) => {
    const startX = e.clientX;
    const startY = e.clientY;
    const v = ctx.flow.viewport;
    const origin = { x: v.x, y: v.y };
    canvasWrap.classList.add('panning');
    canvasWrap.setPointerCapture(e.pointerId);

    const onMove = (ev) => {
      v.x = origin.x + (ev.clientX - startX);
      v.y = origin.y + (ev.clientY - startY);
      apply();
    };
    const onUp = () => {
      canvasWrap.classList.remove('panning');
      canvasWrap.removeEventListener('pointermove', onMove);
      canvasWrap.removeEventListener('pointerup', onUp);
      canvasWrap.removeEventListener('pointercancel', onUp);
      ctx.saveSoon();
    };
    canvasWrap.addEventListener('pointermove', onMove);
    canvasWrap.addEventListener('pointerup', onUp);
    canvasWrap.addEventListener('pointercancel', onUp);
  };

  apply();
}
