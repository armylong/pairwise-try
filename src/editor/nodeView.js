import { NODE_TYPES } from '../core/model.js';
import { computeSnap } from '../core/geometry.js';

const NODE_W = 176;
const SNAP_SCREEN_PX = 6;

export function initNodes(ctx) {
  const { nodeLayer, guideLayer } = ctx.els;

  function summaryHtml(node) {
    const p = node.params;
    switch (node.type) {
      case 'trigger':
        return `<span class="expr">${esc(p.mode)}${p.mode === '定时触发' ? ' · ' + esc(p.cron) : ''}</span>`;
      case 'action':
        return `<span class="expr">${esc(p.actionType)}${p.target ? ' · ' + esc(p.target) : ''}</span>`;
      case 'condition':
        return `<span class="expr">是: ${esc(p.exprTrue) || '（未配置）'}</span><span class="expr">否: ${esc(p.exprFalse) || '（未配置）'}</span>`;
      case 'merge':
        return `<span class="expr">${esc(p.strategy)}</span>`;
      case 'end':
        return p.note ? `<span class="expr">${esc(p.note)}</span>` : '';
      default:
        return '';
    }
  }

  function buildNodeEl(node) {
    const def = NODE_TYPES[node.type];
    const el = document.createElement('div');
    el.className = `node node-${node.type}`;
    el.dataset.id = node.id;
    el.style.left = `${node.x}px`;
    el.style.top = `${node.y}px`;
    el.style.setProperty('--node-color', def.color);

    const header = document.createElement('div');
    header.className = 'node-header';
    header.innerHTML = `<span class="node-icon">${def.icon}</span><span class="node-name"></span>`;
    header.querySelector('.node-name').textContent = node.name;
    el.appendChild(header);

    const body = document.createElement('div');
    body.className = 'node-type-tag';
    body.innerHTML = `${def.label}${summaryHtml(node)}`;
    el.appendChild(body);

    // 端口
    for (let i = 0; i < def.inputs; i++) {
      el.appendChild(makePort(node, 'in', i, def.inputs));
      appendPortLabel(el, def.inputLabels, 'in', i, def.inputs);
    }
    for (let i = 0; i < def.outputs; i++) {
      el.appendChild(makePort(node, 'out', i, def.outputs));
      appendPortLabel(el, def.outputLabels, 'out', i, def.outputs);
    }
    return el;
  }

  function appendPortLabel(el, labels, side, index, count) {
    if (count <= 1 || !labels || labels[index] === undefined) return;
    const tag = document.createElement('span');
    tag.className = `port-label ${side}`;
    tag.textContent = labels[index];
    tag.style.top = `${((index + 1) / (count + 1)) * 100}%`;
    el.appendChild(tag);
  }

  function makePort(node, side, index, count) {
    const port = document.createElement('div');
    port.className = `port port-${side}`;
    port.dataset.node = node.id;
    port.dataset.port = String(index);
    port.dataset.side = side;
    const pct = ((index + 1) / (count + 1)) * 100;
    port.style.top = `${pct}%`;
    port.style.left = side === 'in' ? '0' : '100%';
    port.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      if (e.button !== 0) return;
      ctx.startConnect(e, node.id, index, side);
    });
    return port;
  }

  function renderNodes() {
    nodeLayer.innerHTML = '';
    ctx.nodeEls.clear();
    for (const node of ctx.flow.nodes) {
      const el = buildNodeEl(node);
      nodeLayer.appendChild(el);
      ctx.nodeEls.set(node.id, el);
    }
    measureNodes();
    ctx.renderSelection();
  }

  function measureNodes() {
    ctx.nodeSizes.clear();
    for (const [id, el] of ctx.nodeEls) {
      ctx.nodeSizes.set(id, { w: el.offsetWidth || NODE_W, h: el.offsetHeight || 64 });
    }
  }
  ctx.measureNodes = measureNodes;

  /** 属性面板实时编辑时只刷新摘要，不重建 DOM。 */
  ctx.updateNodeSummary = (node) => {
    const el = ctx.nodeEls.get(node.id);
    if (!el) return;
    el.querySelector('.node-name').textContent = node.name;
    const def = NODE_TYPES[node.type];
    el.querySelector('.node-type-tag').innerHTML = `${def.label}${summaryHtml(node)}`;
    ctx.nodeSizes.set(node.id, { w: el.offsetWidth, h: el.offsetHeight });
    ctx.updateEdgesForNodes(new Set([node.id]));
  };

  ctx.renderNodes = renderNodes;

  // ---------- 节点拖拽（含多选整体拖动、对齐吸附） ----------
  nodeLayer.addEventListener('pointerdown', (e) => {
    const nodeEl = e.target.closest('.node');
    if (!nodeEl || e.button !== 0) return;
    e.stopPropagation();
    const id = nodeEl.dataset.id;

    if (e.shiftKey) {
      ctx.toggleNodeSelected(id);
    } else if (!ctx.selection.nodes.has(id)) {
      ctx.selectOnlyNode(id);
    }
    if (!ctx.selection.nodes.has(id)) return; // shift 点击取消选中后不拖动

    beginDrag(e);
  });

  function beginDrag(e) {
    const { canvasWrap } = ctx.els;
    const ids = [...ctx.selection.nodes];
    const startPositions = new Map();
    for (const nid of ids) {
      const n = ctx.flow.nodes.find((x) => x.id === nid);
      if (n) startPositions.set(nid, { x: n.x, y: n.y });
    }
    const startWorld = ctx.worldFromEvent(e);
    const threshold = SNAP_SCREEN_PX / ctx.flow.viewport.zoom;
    let lastDelta = { x: 0, y: 0 };
    let moved = false;

    for (const nid of ids) ctx.nodeEls.get(nid)?.classList.add('dragging');
    canvasWrap.setPointerCapture(e.pointerId);

    const onMove = (ev) => {
      const w = ctx.worldFromEvent(ev);
      let dx = w.x - startWorld.x;
      let dy = w.y - startWorld.y;
      if (!moved && Math.hypot(dx, dy) * ctx.flow.viewport.zoom < 2) return;
      moved = true;

      // 吸附：用拖动集合的包围盒边/中线对齐其他节点
      const movingRects = ids.map((nid) => {
        const s = startPositions.get(nid);
        const size = ctx.nodeSizes.get(nid) || { w: NODE_W, h: 64 };
        return { x: s.x + dx, y: s.y + dy, w: size.w, h: size.h };
      });
      const movingSet = new Set(ids);
      const others = ctx.flow.nodes
        .filter((n) => !movingSet.has(n.id))
        .map((n) => ({ ...n, ...(ctx.nodeSizes.get(n.id) || { w: NODE_W, h: 64 }) }));
      const snap = computeSnap(movingRects, others, threshold);
      dx += snap.dx;
      dy += snap.dy;
      lastDelta = { x: dx, y: dy };

      for (const nid of ids) {
        const el = ctx.nodeEls.get(nid);
        if (el) el.style.transform = `translate(${dx}px, ${dy}px)`;
      }
      // 拖动期间实时更新连线：dragPositions 供 portAnchor 读取
      ctx.dragPositions = new Map();
      for (const nid of ids) {
        const s = startPositions.get(nid);
        ctx.dragPositions.set(nid, { x: s.x + dx, y: s.y + dy });
      }
      ctx.updateEdgesForNodes(new Set(ids));
      showGuides(snap);
    };

    const onUp = () => {
      canvasWrap.removeEventListener('pointermove', onMove);
      canvasWrap.removeEventListener('pointerup', onUp);
      canvasWrap.removeEventListener('pointercancel', onUp);
      hideGuides();
      ctx.dragPositions = null;
      for (const nid of ids) {
        const el = ctx.nodeEls.get(nid);
        if (el) {
          el.classList.remove('dragging');
          el.style.transform = '';
        }
      }
      if (!moved) return;
      const before = new Map();
      const after = new Map();
      for (const nid of ids) {
        const s = startPositions.get(nid);
        before.set(nid, { ...s });
        after.set(nid, { x: Math.round(s.x + lastDelta.x), y: Math.round(s.y + lastDelta.y) });
      }
      // 提交模型
      for (const n of ctx.flow.nodes) {
        const p = after.get(n.id);
        if (p) {
          n.x = p.x;
          n.y = p.y;
        }
      }
      for (const nid of ids) {
        const n = ctx.flow.nodes.find((x) => x.id === nid);
        const el = ctx.nodeEls.get(nid);
        if (n && el) {
          el.style.left = `${n.x}px`;
          el.style.top = `${n.y}px`;
        }
      }
      ctx.updateEdgesForNodes(new Set(ids));
      ctx.history.pushApplied(ctx.commands.moveNodesCmd(ctx, before, after));
      ctx.applyViewport();
      ctx.saveSoon();
    };

    canvasWrap.addEventListener('pointermove', onMove);
    canvasWrap.addEventListener('pointerup', onUp);
    canvasWrap.addEventListener('pointercancel', onUp);
  }

  function showGuides(snap) {
    guideLayer.innerHTML = '';
    for (const x of snap.vGuides) {
      const g = document.createElement('div');
      g.className = 'guide v';
      g.style.left = `${x}px`;
      g.style.top = '-100000px';
      g.style.height = '200000px';
      guideLayer.appendChild(g);
    }
    for (const y of snap.hGuides) {
      const g = document.createElement('div');
      g.className = 'guide h';
      g.style.top = `${y}px`;
      g.style.left = '-100000px';
      g.style.width = '200000px';
      guideLayer.appendChild(g);
    }
  }

  function hideGuides() {
    guideLayer.innerHTML = '';
  }
}

function esc(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}
