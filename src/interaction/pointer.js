// 画布指针交互状态机：
// - 空白拖拽：平移（平移模式 / 空格 / 中键）或框选（框选模式 / Shift）
// - 节点拖拽：整体移动 + 对齐吸附，松手记一次移动命令
// - 输出端口拖拽：拉连线，松手在输入端口落下时校验建边
// - 单击：节点单选/加选、连线选中、空白清空
import { DRAG_THRESHOLD, SNAP_THRESHOLD } from '../core/constants.js';
import {
  screenToWorld,
  boundsFromPoints,
  boundsIntersect,
  nodeBounds,
  portPosition,
  computeSnap,
} from '../core/geometry.js';
import { createEdge, EDGE_ERROR } from '../core/graph.js';
import { addEdgeCommand, moveNodesCommand } from '../core/commands.js';
import { uid } from '../core/utils.js';
import { toastError } from '../render/panels/toast.js';

const EDGE_ERROR_TEXT = {
  [EDGE_ERROR.SELF_LOOP]: '不能连接节点自身（自环）',
  [EDGE_ERROR.DUPLICATE]: '这条连线已经存在了',
  [EDGE_ERROR.CYCLE]: '不能连成环路',
  [EDGE_ERROR.PORT_OCCUPIED]: '该输入口已有连线，先删除原有连线',
  [EDGE_ERROR.INVALID_PORT]: '端口不合法',
  [EDGE_ERROR.MISSING_NODE]: '节点不存在',
};

export class PointerController {
  constructor(deps) {
    this.canvas = deps.canvas; // 容器（定位参照）
    this.viewport = deps.viewport;
    this.graph = deps.graph;
    this.selection = deps.selection;
    this.renderer = deps.renderer;
    this.marquee = deps.marquee;
    this.history = deps.history;
    this.onSelectionChange = deps.onSelectionChange;
    this.onAfterCommand = deps.onAfterCommand;

    this.mode = 'pan'; // pan | select
    this.spacePressed = false;
    this.session = null;

    this._bind();
  }

  setMode(mode) {
    this.mode = mode;
  }

  setSpace(pressed) {
    this.spacePressed = pressed;
    this.canvas.classList.toggle('nfe-space', pressed);
  }

  _toLocal(event) {
    const rect = this.canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  _bind() {
    this.canvas.addEventListener('pointerdown', (event) => this._onDown(event));
    window.addEventListener('pointermove', (event) => this._onMove(event));
    window.addEventListener('pointerup', (event) => this._onUp(event));
  }

  _onDown(event) {
    if (event.button === 2) return;
    const local = this._toLocal(event);
    const world = this.viewport.toWorld(local);

    const portEl = event.target.closest('.nfe-port');
    if (portEl) {
      this._beginConnect(event, local, world, portEl);
      return;
    }

    const edgeGroup = event.target.closest('.nfe-edge-group');
    if (edgeGroup) {
      this._beginEdgeSelect(event, edgeGroup.dataset.edgeId);
      return;
    }

    const nodeEl = event.target.closest('.nfe-node');
    if (nodeEl) {
      this._beginNodeDrag(event, local, world, nodeEl);
      return;
    }

    this._beginCanvasGesture(event, local, world);
  }

  // ---------- 连线 ----------
  _beginConnect(event, local, world, portEl) {
    const nodeEl = portEl.closest('.nfe-node');
    const nodeId = nodeEl.dataset.nodeId;
    const kind = portEl.dataset.portKind;
    if (kind !== 'out') {
      toastError('请从节点右侧的输出口拖出连线');
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const portId = portEl.dataset.portId;
    const node = this.graph.getNode(nodeId);
    const start = portPosition(node, 'out', portId);
    this.session = {
      type: 'connect',
      pointerId: event.pointerId,
      nodeId,
      portId,
      start,
      current: start,
    };
    this.renderer.showTempEdge(start, start);
    this.canvas.classList.add('nfe-connecting');
  }

  _connectTargetAt(event) {
    // 优先用事件实际落点（合成/捕获场景），再退回坐标命中
    const candidates = [event.target, document.elementFromPoint(event.clientX, event.clientY)];
    for (const el of candidates) {
      const portEl = el?.closest?.('.nfe-port');
      if (portEl && portEl.dataset.portKind === 'in') {
        const nodeEl = portEl.closest('.nfe-node');
        return { nodeId: nodeEl.dataset.nodeId, portId: portEl.dataset.portId };
      }
    }
    return null;
  }

  _finishConnect(event) {
    const target = this._connectTargetAt(event);
    this.renderer.hideTempEdge();
    this.canvas.classList.remove('nfe-connecting');
    if (!target) return;

    const result = this.graph.validateConnection(
      { nodeId: this.session.nodeId, portId: this.session.portId },
      target,
    );
    if (!result.ok) {
      toastError(EDGE_ERROR_TEXT[result.code] || '无法连接');
      return;
    }
    const edge = createEdge(
      { nodeId: this.session.nodeId, portId: this.session.portId },
      target,
      { id: uid('edge') },
    );
    this.history.execute(addEdgeCommand(edge), this.graph);
    this.selection.selectEdge(edge.id);
    this.onAfterCommand();
  }

  // ---------- 连线单击选中 ----------
  _beginEdgeSelect(event, edgeId) {
    event.stopPropagation();
    if (event.shiftKey && this.selection.kind === 'nodes') {
      // 节点选区与边互斥，shift 点边直接切为边选中
    }
    this.selection.selectEdge(edgeId);
    this.onSelectionChange();
    this.session = { type: 'edge-click', pointerId: event.pointerId };
  }

  // ---------- 节点拖拽 ----------
  _beginNodeDrag(event, local, world, nodeEl) {
    event.stopPropagation();
    const nodeId = nodeEl.dataset.nodeId;

    if (!this.selection.hasNode(nodeId)) {
      if (event.shiftKey) {
        this.selection.toggleNode(nodeId);
      } else {
        this.selection.selectNodes([nodeId], false);
      }
      this.onSelectionChange();
    }

    const selectedIds = Array.from(this.selection.nodeIds);
    const startPositions = new Map();
    for (const id of selectedIds) {
      const node = this.graph.getNode(id);
      if (node) startPositions.set(id, { x: node.x, y: node.y });
    }

    this.session = {
      type: 'node-drag',
      pointerId: event.pointerId,
      startLocal: local,
      startWorld: world,
      selectedIds,
      startPositions,
      moved: false,
      dragging: false,
      currentDx: 0,
      currentDy: 0,
      snapDx: 0,
      snapDy: 0,
    };
    this.canvas.classList.add('nfe-grabbing');
  }

  // ---------- 画布空白：平移 / 框选 ----------
  _beginCanvasGesture(event, local) {
    // 空格 / 中键 / 平移模式下拖空白 → 平移；框选模式（或 Shift）→ 框选
    const wantPan =
      this.spacePressed ||
      event.button === 1 ||
      (this.mode === 'pan' && !event.shiftKey);

    this.selection.clear();
    this.onSelectionChange();

    this.session = wantPan
      ? { type: 'pan', pointerId: event.pointerId, startX: event.clientX, startY: event.clientY }
      : { type: 'marquee', pointerId: event.pointerId, start: local };

    if (!wantPan) this.marquee.show(local);
    this.canvas.classList.add(wantPan ? 'nfe-panning' : 'nfe-marqueeing');
  }

  // ---------- move ----------
  _onMove(event) {
    const session = this.session;
    if (!session || event.pointerId !== session.pointerId) return;
    const local = this._toLocal(event);

    if (session.type === 'pan') {
      this.viewport.panBy(event.clientX - session.startX, event.clientY - session.startY);
      session.startX = event.clientX;
      session.startY = event.clientY;
      return;
    }

    if (session.type === 'marquee') {
      this.marquee.update(local);
      this._updateMarqueeSelection(local, session.additive);
      return;
    }

    if (session.type === 'connect') {
      const world = this.viewport.toWorld(local);
      session.current = world;
      this.renderer.showTempEdge(session.start, world);
      return;
    }

    if (session.type === 'node-drag') {
      this._moveNodes(event, local);
    }
  }

  _moveNodes(event, local) {
    const session = this.session;
    const dxScreen = local.x - session.startLocal.x;
    const dyScreen = local.y - session.startLocal.y;
    if (
      !session.dragging &&
      Math.hypot(dxScreen, dyScreen) < DRAG_THRESHOLD
    ) {
      return;
    }
    session.dragging = true;

    const scale = this.viewport.scale;
    const dxWorld = dxScreen / scale;
    const dyWorld = dyScreen / scale;

    // 候选位置
    const candidates = new Map();
    for (const [id, start] of session.startPositions) {
      candidates.set(id, {
        ...this.graph.getNode(id),
        x: start.x + dxWorld,
        y: start.y + dyWorld,
      });
    }
    const others = new Map();
    for (const node of this.graph.nodes.values()) {
      if (!session.selectedIds.includes(node.id)) others.set(node.id, node);
    }

    const snap = computeSnap(
      Array.from(candidates.values()),
      others,
      SNAP_THRESHOLD / scale,
    );

    for (const [id, candidate] of candidates) {
      const node = this.graph.getNode(id);
      node.x = Math.round(candidate.x + snap.dx);
      node.y = Math.round(candidate.y + snap.dy);
    }
    this.renderer.updatePositionsFor(session.selectedIds);
    this.renderer.showGuides(snap.guides);
    session.snapDx = snap.dx;
    session.snapDy = snap.dy;
  }

  _updateMarqueeSelection(local, additive) {
    const session = this.session;
    const startWorld = this.viewport.toWorld(session.start);
    const currentWorld = this.viewport.toWorld(local);
    const rect = boundsFromPoints(startWorld, currentWorld);
    const ids = [];
    for (const node of this.graph.nodes.values()) {
      if (boundsIntersect(rect, nodeBounds(node))) ids.push(node.id);
    }
    this.selection.selectNodes(ids, false);
    this.onSelectionChange();
  }

  // ---------- up ----------
  _onUp(event) {
    const session = this.session;
    if (!session || event.pointerId !== session.pointerId) return;

    if (session.type === 'connect') this._finishConnect(event);
    if (session.type === 'marquee') {
      this.marquee.hide();
      // 纯点击空白：清空（已在 down 时处理）
    }
    if (session.type === 'node-drag') this._finishNodeDrag();

    this.renderer.clearGuides();
    this.canvas.classList.remove('nfe-panning', 'nfe-marqueeing', 'nfe-grabbing');
    this.session = null;
  }

  _finishNodeDrag() {
    const session = this.session;
    if (!session.dragging) return;
    const moves = [];
    for (const [id, from] of session.startPositions) {
      const node = this.graph.getNode(id);
      if (node.x !== from.x || node.y !== from.y) {
        moves.push({ id, from: { ...from }, to: { x: node.x, y: node.y } });
      }
    }
    if (moves.length) {
      this.history.execute(moveNodesCommand(moves), this.graph);
      this.onAfterCommand();
    }
  }
}
