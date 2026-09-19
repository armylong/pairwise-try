// 解析外部 / 存储中的流程数据，坏数据兜底，绝不抛异常
import { getNodeType, defaultParams } from './node-types.js';
import { uid } from './utils.js';

function isObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function finiteNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function sanitizeParams(type, params) {
  const def = getNodeType(type);
  const base = defaultParams(type);
  if (!isObject(params)) return base;
  const merged = { ...base };
  for (const field of def.fields) {
    if (field.type === 'conditionList') {
      const incoming = isObject(params[field.key]) ? params[field.key] : {};
      const branches = {};
      for (const branch of field.branches) {
        const current = isObject(incoming[branch.port]) ? incoming[branch.port] : {};
        branches[branch.port] = {
          label: typeof current.label === 'string' ? current.label : branch.label,
          expr: typeof current.expr === 'string' ? current.expr : '',
        };
      }
      merged[field.key] = branches;
    } else if (params[field.key] !== undefined) {
      merged[field.key] = params[field.key];
    }
  }
  return merged;
}

// 返回干净的 graph JSON：{nodes:[], edges:[]}
export function sanitizeGraph(raw) {
  const data = isObject(raw) ? raw : {};
  const nodes = [];
  const nodeIds = new Set();
  const rawNodes = Array.isArray(data.nodes) ? data.nodes : [];

  for (const item of rawNodes) {
    if (!isObject(item)) continue;
    const def = getNodeType(item.type);
    if (!def) continue;
    const id = typeof item.id === 'string' && item.id ? item.id : uid('node');
    if (nodeIds.has(id)) continue;
    nodeIds.add(id);
    nodes.push({
      id,
      type: item.type,
      name: typeof item.name === 'string' && item.name.trim() ? item.name : def.label,
      x: finiteNumber(item.x, 0),
      y: finiteNumber(item.y, 0),
      params: sanitizeParams(item.type, item.params),
    });
  }

  const edges = [];
  const edgeIds = new Set();
  const edgeKeys = new Set();
  const rawEdges = Array.isArray(data.edges) ? data.edges : [];

  for (const item of rawEdges) {
    if (!isObject(item)) continue;
    const source = nodeIds.has(item.source) ? nodes.find((n) => n.id === item.source) : null;
    const target = nodeIds.has(item.target) ? nodes.find((n) => n.id === item.target) : null;
    if (!source || !target) continue;
    const sourceDef = getNodeType(source.type);
    const targetDef = getNodeType(target.type);
    if (
      !sourceDef.outputs.includes(item.sourcePort) ||
      !targetDef.inputs.includes(item.targetPort)
    ) {
      continue;
    }
    if (source.id === target.id) continue;
    const key = `${source.id}:${item.sourcePort}->${target.id}:${item.targetPort}`;
    if (edgeKeys.has(key)) continue;
    edgeKeys.add(key);
    const id = typeof item.id === 'string' && item.id && !edgeIds.has(item.id) ? item.id : uid('edge');
    if (edgeIds.has(id)) continue;
    edgeIds.add(id);
    edges.push({
      id,
      source: source.id,
      sourcePort: item.sourcePort,
      target: target.id,
      targetPort: item.targetPort,
    });
  }

  return { nodes, edges };
}

export function sanitizeViewport(raw) {
  if (!isObject(raw)) return { scale: 1, tx: 0, ty: 0 };
  const scale = Math.min(4, Math.max(0.25, finiteNumber(raw.scale, 1)));
  return {
    scale,
    tx: finiteNumber(raw.tx, 0),
    ty: finiteNumber(raw.ty, 0),
  };
}

// 单条流程记录兜底
export function sanitizeFlow(raw) {
  if (!isObject(raw)) return null;
  const id = typeof raw.id === 'string' && raw.id ? raw.id : uid('flow');
  const now = Date.now();
  return {
    id,
    name: typeof raw.name === 'string' && raw.name.trim() ? raw.name : '未命名流程',
    graph: sanitizeGraph(raw.graph),
    viewport: sanitizeViewport(raw.viewport),
    createdAt: finiteNumber(raw.createdAt, now),
    updatedAt: finiteNumber(raw.updatedAt, raw.createdAt || now),
  };
}

export { uid };
