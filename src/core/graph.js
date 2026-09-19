// 图数据模型：节点 / 边的纯内存状态与校验，不触碰 DOM
import { getNodeType, defaultParams } from './node-types.js';
import { uid } from './utils.js';

export const EDGE_ERROR = Object.freeze({
  SELF_LOOP: 'SELF_LOOP',
  DUPLICATE: 'DUPLICATE',
  CYCLE: 'CYCLE',
  INVALID_PORT: 'INVALID_PORT',
  SAME_SIDE: 'SAME_SIDE',
  PORT_OCCUPIED: 'PORT_OCCUPIED',
  MISSING_NODE: 'MISSING_NODE',
});

export function createNode(type, x, y, overrides = {}) {
  const def = getNodeType(type);
  if (!def) throw new Error(`unknown node type: ${type}`);
  return {
    id: overrides.id || uid('node'),
    type,
    name: overrides.name || def.label,
    x: Math.round(x),
    y: Math.round(y),
    params: overrides.params ? structuredCloneSafe(overrides.params) : defaultParams(type),
  };
}

function structuredCloneSafe(value) {
  return JSON.parse(JSON.stringify(value));
}

export function createEdge(source, target, overrides = {}) {
  return {
    id: overrides.id || uid('edge'),
    source: source.nodeId,
    sourcePort: source.portId,
    target: target.nodeId,
    targetPort: target.portId,
  };
}

export class Graph {
  constructor() {
    this.nodes = new Map();
    this.edges = new Map();
  }

  static fromJSON(data) {
    const graph = new Graph();
    if (!data || typeof data !== 'object') return graph;
    for (const node of data.nodes || []) {
      if (getNodeType(node.type)) {
        graph.nodes.set(node.id, structuredCloneSafe(node));
      }
    }
    for (const edge of data.edges || []) {
      if (graph.isEdgeShapeValid(edge) && !graph.edges.has(edge.id)) {
        graph.edges.set(edge.id, structuredCloneSafe(edge));
      }
    }
    return graph;
  }

  toJSON() {
    return {
      nodes: Array.from(this.nodes.values()).map(structuredCloneSafe),
      edges: Array.from(this.edges.values()).map(structuredCloneSafe),
    };
  }

  clone() {
    return Graph.fromJSON(this.toJSON());
  }

  getNode(id) {
    return this.nodes.get(id);
  }

  getEdge(id) {
    return this.edges.get(id);
  }

  addNode(node) {
    this.nodes.set(node.id, node);
    return node;
  }

  removeNode(id) {
    const node = this.nodes.get(id);
    if (!node) return null;
    const removedEdges = [];
    for (const [edgeId, edge] of this.edges) {
      if (edge.source === id || edge.target === id) {
        removedEdges.push(edge);
        this.edges.delete(edgeId);
      }
    }
    this.nodes.delete(id);
    return { node, edges: removedEdges };
  }

  moveNode(id, x, y) {
    const node = this.nodes.get(id);
    if (!node) return;
    node.x = x;
    node.y = y;
  }

  updateNode(id, patch) {
    const node = this.nodes.get(id);
    if (!node) return null;
    if (patch.name !== undefined) node.name = patch.name;
    if (patch.params !== undefined) node.params = patch.params;
    return node;
  }

  // 端口形状是否合法（节点存在、端口存在、方向正确）
  isEdgeShapeValid(edge) {
    const source = this.nodes.get(edge.source);
    const target = this.nodes.get(edge.target);
    if (!source || !target) return false;
    const sourceDef = getNodeType(source.type);
    const targetDef = getNodeType(target.type);
    return (
      sourceDef.outputs.includes(edge.sourcePort) &&
      targetDef.inputs.includes(edge.targetPort)
    );
  }

  hasDuplicate(edge) {
    for (const existing of this.edges.values()) {
      if (
        existing.source === edge.source &&
        existing.sourcePort === edge.sourcePort &&
        existing.target === edge.target &&
        existing.targetPort === edge.targetPort
      ) {
        return true;
      }
    }
    return false;
  }

  isInputPortOccupied(nodeId, portId, ignoreEdgeId = null) {
    for (const edge of this.edges.values()) {
      if (ignoreEdgeId && edge.id === ignoreEdgeId) continue;
      if (edge.target === nodeId && edge.targetPort === portId) return edge;
    }
    return null;
  }

  // 从 source 出发能否到达 target（BFS）
  reaches(sourceId, targetId) {
    const adjacency = new Map();
    for (const edge of this.edges.values()) {
      if (!adjacency.has(edge.source)) adjacency.set(edge.source, []);
      adjacency.get(edge.source).push(edge.target);
    }
    const queue = [sourceId];
    const visited = new Set();
    while (queue.length) {
      const current = queue.shift();
      if (current === targetId) return true;
      if (visited.has(current)) continue;
      visited.add(current);
      for (const next of adjacency.get(current) || []) queue.push(next);
    }
    return false;
  }

  // 完整连线校验，返回 { ok:true } 或 { ok:false, code }
  validateConnection(source, target, ignoreEdgeId = null) {
    const sourceNode = this.nodes.get(source.nodeId);
    const targetNode = this.nodes.get(target.nodeId);
    if (!sourceNode || !targetNode) return { ok: false, code: EDGE_ERROR.MISSING_NODE };

    const sourceDef = getNodeType(sourceNode.type);
    const targetDef = getNodeType(targetNode.type);
    if (
      !sourceDef.outputs.includes(source.portId) ||
      !targetDef.inputs.includes(target.portId)
    ) {
      return { ok: false, code: EDGE_ERROR.INVALID_PORT };
    }

    if (source.nodeId === target.nodeId) {
      return { ok: false, code: EDGE_ERROR.SELF_LOOP };
    }

    const duplicated = Array.from(this.edges.values()).some(
      (edge) =>
        edge.id !== ignoreEdgeId &&
        edge.source === source.nodeId &&
        edge.sourcePort === source.portId &&
        edge.target === target.nodeId &&
        edge.targetPort === target.portId,
    );
    if (duplicated) return { ok: false, code: EDGE_ERROR.DUPLICATE };

    const occupied = this.isInputPortOccupied(target.nodeId, target.portId, ignoreEdgeId);
    if (occupied) return { ok: false, code: EDGE_ERROR.PORT_OCCUPIED };

    // target 已能到达 source：再加 source->target 就成环
    if (this.reaches(target.nodeId, source.nodeId)) {
      return { ok: false, code: EDGE_ERROR.CYCLE };
    }

    return { ok: true };
  }

  addEdge(edge) {
    this.edges.set(edge.id, edge);
    return edge;
  }

  removeEdge(id) {
    const edge = this.edges.get(id);
    if (!edge) return null;
    this.edges.delete(id);
    return edge;
  }

  edgesBetween(sourceId, targetId) {
    return Array.from(this.edges.values()).filter(
      (edge) => edge.source === sourceId && edge.target === targetId,
    );
  }

  nodeCount() {
    return this.nodes.size;
  }
}
