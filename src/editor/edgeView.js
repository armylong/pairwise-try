import { NODE_TYPES, getNode, createEdge, edgeExists, wouldCycle } from '../core/model.js';
import { bezierPath } from '../core/geometry.js';
import { toast } from '../ui/toast.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

export function initEdges(ctx) {
  const { edgeLayer, canvasWrap } = ctx.els;

  // 箭头 marker
  const defs = document.createElementNS(SVG_NS, 'defs');
  defs.innerHTML = `
    <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M 0 1.5 L 9 5 L 0 8.5" fill="none" stroke="#5a6478" stroke-width="1.6"/>
    </marker>
    <marker id="arrow-selected" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M 0 1.5 L 9 5 L 0 8.5" fill="none" stroke="#6d8dff" stroke-width="1.6"/>
    </marker>`;
  edgeLayer.appendChild(defs);

  /** 端口锚点（世界坐标）；拖动中优先读 dragPositions。 */
  function portAnchor(nodeId, side, index) {
    const node = getNode(ctx.flow, nodeId);
    if (!node) return { x: 0, y: 0 };
    const def = NODE_TYPES[node.type];
    const size = ctx.nodeSizes.get(nodeId) || { w: 176, h: 64 };
    const pos = ctx.dragPositions?.get(nodeId) || node;
    const count = side === 'in' ? def.inputs : def.outputs;
    return {
      x: side === 'in' ? pos.x : pos.x + size.w,
      y: pos.y + (size.h * (index + 1)) / (count + 1),
    };
  }
  ctx.portAnchor = portAnchor;

  function edgePathD(edge) {
    const a = portAnchor(edge.from.node, 'out', edge.from.port);
    const b = portAnchor(edge.to.node, 'in', edge.to.port);
    return bezierPath(a.x, a.y, b.x, b.y);
  }

  function renderEdges() {
    edgeLayer.querySelectorAll('g.edge').forEach((g) => g.remove());
    ctx.edgeEls.clear();
    for (const edge of ctx.flow.edges) {
      const g = document.createElementNS(SVG_NS, 'g');
      g.setAttribute('class', 'edge');
      g.dataset.id = edge.id;
      const hit = document.createElementNS(SVG_NS, 'path');
      hit.setAttribute('class', 'edge-hit');
      const line = document.createElementNS(SVG_NS, 'path');
      line.setAttribute('class', 'edge-line');
      line.setAttribute('marker-end', 'url(#arrow)');
      const d = edgePathD(edge);
      hit.setAttribute('d', d);
      line.setAttribute('d', d);
      g.append(hit, line);
      g.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        if (e.button !== 0) return;
        ctx.selectOnlyEdge(edge.id, e.shiftKey);
      });
      edgeLayer.appendChild(g);
      ctx.edgeEls.set(edge.id, g);
    }
    ctx.renderSelection();
  }
  ctx.renderEdges = renderEdges;

  /** 拖动节点时只重算相关连线的 d，避免整层重绘。 */
  ctx.updateEdgesForNodes = (idSet) => {
    for (const edge of ctx.flow.edges) {
      if (!idSet.has(edge.from.node) && !idSet.has(edge.to.node)) continue;
      const g = ctx.edgeEls.get(edge.id);
      if (!g) continue;
      const d = edgePathD(edge);
      g.children[0].setAttribute('d', d);
      g.children[1].setAttribute('d', d);
    }
  };

  // ---------- 连线交互 ----------
  ctx.startConnect = (e, nodeId, portIndex, side) => {
    const temp = document.createElementNS(SVG_NS, 'path');
    temp.setAttribute('class', 'edge-temp');
    edgeLayer.appendChild(temp);
    canvasWrap.setPointerCapture(e.pointerId);

    const anchor = portAnchor(nodeId, side, portIndex);
    let hoverPort = null;

    const onMove = (ev) => {
      const w = ctx.worldFromEvent(ev);
      const d =
        side === 'out'
          ? bezierPath(anchor.x, anchor.y, w.x, w.y)
          : bezierPath(w.x, w.y, anchor.x, anchor.y);
      temp.setAttribute('d', d);

      const target = document.elementFromPoint(ev.clientX, ev.clientY)?.closest?.('.port');
      const valid =
        target &&
        target.dataset.side !== side &&
        target.dataset.node &&
        ctx.flow.nodes.some((n) => n.id === target.dataset.node);
      if (hoverPort && hoverPort !== target) hoverPort.classList.remove('hover-target');
      hoverPort = valid ? target : null;
      if (hoverPort) hoverPort.classList.add('hover-target');
    };

    const onUp = (ev) => {
      canvasWrap.removeEventListener('pointermove', onMove);
      canvasWrap.removeEventListener('pointerup', onUp);
      canvasWrap.removeEventListener('pointercancel', onUp);
      temp.remove();
      if (hoverPort) hoverPort.classList.remove('hover-target');

      const target = document.elementFromPoint(ev.clientX, ev.clientY)?.closest?.('.port');
      if (!target || !target.dataset.node || target.dataset.side === side) return;

      const from =
        side === 'out'
          ? { node: nodeId, port: portIndex }
          : { node: target.dataset.node, port: Number(target.dataset.port) };
      const to =
        side === 'out'
          ? { node: target.dataset.node, port: Number(target.dataset.port) }
          : { node: nodeId, port: portIndex };

      if (from.node === to.node) {
        toast('不能连接到节点自身', 'warn');
        return;
      }
      if (edgeExists(ctx.flow, from.node, from.port, to.node, to.port)) {
        toast('该连接已存在', 'warn');
        return;
      }
      if (wouldCycle(ctx.flow, from.node, to.node)) {
        toast('该连接会形成循环，已阻止', 'error');
        return;
      }
      ctx.history.exec(ctx.commands.addEdgeCmd(ctx, createEdge(from.node, from.port, to.node, to.port)));
      ctx.applyViewport();
    };

    canvasWrap.addEventListener('pointermove', onMove);
    canvasWrap.addEventListener('pointerup', onUp);
    canvasWrap.addEventListener('pointercancel', onUp);
  };
}
