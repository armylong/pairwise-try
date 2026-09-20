import { rectsIntersect } from '../core/geometry.js';

/** 选中体系：节点 / 连线 / 空白三态互斥，框选，渲染选中态。 */
export function initSelection(ctx) {
  const { canvasWrap, marquee } = ctx.els;

  function renderSelection() {
    for (const [id, el] of ctx.nodeEls) el.classList.toggle('selected', ctx.selection.nodes.has(id));
    for (const [id, g] of ctx.edgeEls) {
      g.classList.toggle('selected', ctx.selection.edges.has(id));
      const line = g.querySelector('.edge-line');
      if (line) line.setAttribute('marker-end', ctx.selection.edges.has(id) ? 'url(#arrow-selected)' : 'url(#arrow)');
    }
    ctx.renderInspector();
  }
  ctx.renderSelection = renderSelection;

  ctx.clearSelection = () => {
    ctx.selection.nodes.clear();
    ctx.selection.edges.clear();
    renderSelection();
  };

  ctx.selectOnlyNode = (id) => {
    ctx.selection.edges.clear();
    ctx.selection.nodes.clear();
    ctx.selection.nodes.add(id);
    renderSelection();
  };

  ctx.toggleNodeSelected = (id) => {
    ctx.selection.edges.clear();
    if (ctx.selection.nodes.has(id)) ctx.selection.nodes.delete(id);
    else ctx.selection.nodes.add(id);
    renderSelection();
  };

  ctx.selectOnlyEdge = (id, additive = false) => {
    ctx.selection.nodes.clear();
    if (!additive) ctx.selection.edges.clear();
    if (ctx.selection.edges.has(id)) ctx.selection.edges.delete(id);
    else ctx.selection.edges.add(id);
    renderSelection();
  };

  ctx.selectAllNodes = () => {
    ctx.selection.edges.clear();
    ctx.selection.nodes = new Set(ctx.flow.nodes.map((n) => n.id));
    renderSelection();
  };

  // ---------- 框选 ----------
  ctx.startMarquee = (e) => {
    const rect0 = canvasWrap.getBoundingClientRect();
    const start = { x: e.clientX - rect0.left, y: e.clientY - rect0.top };
    canvasWrap.setPointerCapture(e.pointerId);
    marquee.hidden = false;

    const onMove = (ev) => {
      const cur = { x: ev.clientX - rect0.left, y: ev.clientY - rect0.top };
      const sx = Math.min(start.x, cur.x);
      const sy = Math.min(start.y, cur.y);
      const sw = Math.abs(cur.x - start.x);
      const sh = Math.abs(cur.y - start.y);
      Object.assign(marquee.style, { left: `${sx}px`, top: `${sy}px`, width: `${sw}px`, height: `${sh}px` });

      // 屏幕矩形换算到世界坐标
      const v = ctx.flow.viewport;
      const worldRect = {
        x: (sx - v.x) / v.zoom,
        y: (sy - v.y) / v.zoom,
        w: sw / v.zoom,
        h: sh / v.zoom,
      };
      ctx.selection.edges.clear();
      ctx.selection.nodes.clear();
      for (const n of ctx.flow.nodes) {
        const size = ctx.nodeSizes.get(n.id) || { w: 176, h: 64 };
        if (rectsIntersect(worldRect, { x: n.x, y: n.y, w: size.w, h: size.h })) ctx.selection.nodes.add(n.id);
      }
      renderSelection();
    };

    const onUp = () => {
      canvasWrap.removeEventListener('pointermove', onMove);
      canvasWrap.removeEventListener('pointerup', onUp);
      canvasWrap.removeEventListener('pointercancel', onUp);
      marquee.hidden = true;
    };
    canvasWrap.addEventListener('pointermove', onMove);
    canvasWrap.addEventListener('pointerup', onUp);
    canvasWrap.addEventListener('pointercancel', onUp);
  };
}
