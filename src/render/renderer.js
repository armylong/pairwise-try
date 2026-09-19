// 画布渲染器：维护节点 DOM 与连线 SVG，按 id diff，避免拖拽时全量重建
import { NODE_WIDTH } from '../core/constants.js';
import { getNodeType } from '../core/node-types.js';
import {
  nodeSize,
  portPosition,
  edgePath,
  nodeBounds,
} from '../core/geometry.js';
import { icon } from './icons.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

export class Renderer {
  constructor({ worldEl, edgeLayerEl, nodeLayerEl, guidesEl, graph, selection }) {
    this.worldEl = worldEl;
    this.edgeLayer = edgeLayerEl; // SVG
    this.nodeLayer = nodeLayerEl;
    this.guidesEl = guidesEl;
    this.graph = graph;
    this.selection = selection;

    this.nodeEls = new Map(); // id -> element
    this.edgeEls = new Map(); // id -> path element
    this.hitEls = new Map(); // id -> hit path

    this.tempEdgePath = null;
  }

  // 全量同步结构（增删 / 属性变更后调用）
  syncStructure() {
    this._syncNodes();
    this._syncEdges();
    this.updateAllPositions();
    this.applySelection();
  }

  _syncNodes() {
    const liveIds = new Set(this.graph.nodes.keys());

    for (const [id, el] of this.nodeEls) {
      if (!liveIds.has(id)) {
        el.remove();
        this.nodeEls.delete(id);
      }
    }

    for (const node of this.graph.nodes.values()) {
      let el = this.nodeEls.get(node.id);
      if (!el) {
        el = this._createNodeEl(node);
        this.nodeLayer.appendChild(el);
        this.nodeEls.set(node.id, el);
      }
      this._refreshNodeContent(el, node);
    }
  }

  _createNodeEl(node) {
    const el = document.createElement('div');
    el.className = `nfe-node nfe-node-${node.type}`;
    el.dataset.nodeId = node.id;
    el.style.width = `${NODE_WIDTH}px`;
    return el;
  }

  _refreshNodeContent(el, node) {
    const def = getNodeType(node.type);
    const size = nodeSize(node.type);
    el.style.height = `${size.height}px`;

    const inputPorts = def.inputs
      .map((portId, index) => this._portHtml('in', portId, index, def.inputs.length, node))
      .join('');
    const outputPorts = def.outputs
      .map((portId, index) => this._portHtml('out', portId, index, def.outputs.length, node))
      .join('');

    const summaryText = def.summary(node.params);
    el.innerHTML = `
      <div class="nfe-node-accent" style="background:${def.color}"></div>
      <div class="nfe-node-head">
        <span class="nfe-node-icon" style="color:${def.color}">${icon(def.icon, 15)}</span>
        <span class="nfe-node-title"></span>
      </div>
      <div class="nfe-node-summary"><span class="nfe-node-summary-text"></span></div>
      <div class="nfe-node-ports">${inputPorts}${outputPorts}</div>
    `;
    el.querySelector('.nfe-node-title').textContent = node.name;
    el.querySelector('.nfe-node-summary-text').textContent = summaryText;
  }

  _portHtml(kind, portId, index, total, node) {
    const def = getNodeType(node.type);
    const ratio = total <= 1 ? 50 : ((index + 1) / (total + 1)) * 100;
    const isDouble = total === 2;
    let label = '';
    if (isDouble) {
      if (kind === 'out' && node.type === 'condition') {
        label = node.params.branches[portId]?.label || portId;
      } else if (kind === 'in' && node.type === 'merge') {
        label = portId === 'a' ? 'A' : 'B';
      } else {
        label = portId;
      }
    }
    return `
      <div class="nfe-port nfe-port-${kind}" data-port-kind="${kind}" data-port-id="${portId}"
        style="top:${ratio}%">
        <span class="nfe-port-dot"></span>
        ${isDouble ? `<span class="nfe-port-label">${label}</span>` : ''}
      </div>`;
  }

  _syncEdges() {
    const liveIds = new Set(this.graph.edges.keys());

    for (const [id, pathEl] of this.edgeEls) {
      if (!liveIds.has(id)) {
        pathEl.parentElement.remove();
        this.edgeEls.delete(id);
        this.hitEls.delete(id);
      }
    }

    for (const edge of this.graph.edges.values()) {
      let group = this.edgeEls.get(edge.id);
      if (!group) {
        group = document.createElementNS(SVG_NS, 'g');
        group.classList.add('nfe-edge-group');
        group.dataset.edgeId = edge.id;

        const visible = document.createElementNS(SVG_NS, 'path');
        visible.classList.add('nfe-edge');
        const hit = document.createElementNS(SVG_NS, 'path');
        hit.classList.add('nfe-edge-hit');

        group.appendChild(visible);
        group.appendChild(hit);
        this.edgeLayer.appendChild(group);
        this.edgeEls.set(edge.id, visible);
        this.hitEls.set(edge.id, hit);
      }
    }
  }

  // 节点位置变化（拖拽中）调用，仅更新 transform 和相关边
  updatePositionsFor(nodeIds) {
    const affected = new Set(nodeIds);
    for (const id of nodeIds) {
      const el = this.nodeEls.get(id);
      const node = this.graph.getNode(id);
      if (el && node) el.style.transform = `translate(${node.x}px, ${node.y}px)`;
      for (const edge of this.graph.edges.values()) {
        if (edge.source === id || edge.target === id) affected.add(edge.id);
      }
    }
    for (const edgeId of affected) {
      if (this.graph.edges.has(edgeId)) this._updateEdgePath(edgeId);
    }
  }

  updateAllPositions() {
    for (const node of this.graph.nodes.values()) {
      const el = this.nodeEls.get(node.id);
      if (el) el.style.transform = `translate(${node.x}px, ${node.y}px)`;
    }
    for (const edgeId of this.graph.edges.keys()) this._updateEdgePath(edgeId);
  }

  _updateEdgePath(edgeId) {
    const edge = this.graph.getEdge(edgeId);
    const pathEl = this.edgeEls.get(edgeId);
    const hitEl = this.hitEls.get(edgeId);
    if (!edge || !pathEl) return;
    const sourceNode = this.graph.getNode(edge.source);
    const targetNode = this.graph.getNode(edge.target);
    if (!sourceNode || !targetNode) return;
    const source = portPosition(sourceNode, 'out', edge.sourcePort);
    const target = portPosition(targetNode, 'in', edge.targetPort);
    const path = edgePath(source, target);
    pathEl.setAttribute('d', path.d);
    hitEl.setAttribute('d', path.d);
  }

  // 拖拽连线时的临时边
  showTempEdge(sourcePoint, targetPoint) {
    if (!this.tempEdgePath) {
      const path = document.createElementNS(SVG_NS, 'path');
      path.classList.add('nfe-edge', 'nfe-edge-temp');
      this.edgeLayer.appendChild(path);
      this.tempEdgePath = path;
    }
    this.tempEdgePath.setAttribute('d', edgePath(sourcePoint, targetPoint).d);
  }

  hideTempEdge() {
    if (this.tempEdgePath) {
      this.tempEdgePath.remove();
      this.tempEdgePath = null;
    }
  }

  showGuides(guides) {
    const vertical = (guides.vertical || [])
      .map(
        (g) =>
          `<line class="nfe-guide" x1="${g.x}" y1="${g.from}" x2="${g.x}" y2="${g.to}"></line>`,
      )
      .join('');
    const horizontal = (guides.horizontal || [])
      .map(
        (g) =>
          `<line class="nfe-guide" x1="${g.from}" y1="${g.y}" x2="${g.to}" y2="${g.y}"></line>`,
      )
      .join('');
    this.guidesEl.innerHTML = vertical + horizontal;
  }

  clearGuides() {
    this.guidesEl.innerHTML = '';
  }

  applySelection() {
    for (const [id, el] of this.nodeEls) {
      el.classList.toggle('nfe-selected', this.selection.hasNode(id));
    }
    for (const [id, el] of this.edgeEls) {
      el.parentElement.classList.toggle(
        'nfe-selected',
        this.selection.kind === 'edge' && this.selection.edgeId === id,
      );
    }
  }

  // 属性改动后刷新节点文字（名称 / 条件出口标签 / 摘要）
  refreshNodeContent(nodeIds = null) {
    const ids = nodeIds ? new Set(nodeIds) : new Set(this.graph.nodes.keys());
    for (const id of ids) {
      const node = this.graph.getNode(id);
      const el = this.nodeEls.get(id);
      if (node && el) this._refreshNodeContent(el, node);
    }
  }

  getNodeElement(id) {
    return this.nodeEls.get(id) || null;
  }
}
