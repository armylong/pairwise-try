import { uid } from './id.js';

export const NODE_TYPES = {
  trigger: {
    label: '触发器',
    icon: '⚡',
    color: '#f0a35e',
    inputs: 0,
    outputs: 1,
    outputLabels: ['输出'],
    params: [
      { key: 'mode', label: '触发方式', type: 'select', options: ['定时触发', '手动触发', 'Webhook'], default: '定时触发' },
      { key: 'cron', label: 'Cron 表达式', type: 'text', default: '0 9 * * *' },
    ],
  },
  action: {
    label: '动作',
    icon: '⚙️',
    color: '#6d8dff',
    inputs: 1,
    outputs: 1,
    outputLabels: ['输出'],
    params: [
      { key: 'actionType', label: '动作类型', type: 'select', options: ['拉取数据', '发送通知', '写入表格', '调用接口'], default: '拉取数据' },
      { key: 'target', label: '目标', type: 'text', default: '' },
      { key: 'remark', label: '备注', type: 'textarea', default: '' },
    ],
  },
  condition: {
    label: '条件分支',
    icon: '⑂',
    color: '#e5c07b',
    inputs: 1,
    outputs: 2,
    outputLabels: ['是', '否'],
    params: [
      { key: 'exprTrue', label: '出口「是」条件表达式', type: 'text', default: '', outlet: 0 },
      { key: 'exprFalse', label: '出口「否」条件表达式', type: 'text', default: '', outlet: 1 },
    ],
  },
  merge: {
    label: '合并',
    icon: '⋎',
    color: '#9d7bff',
    inputs: 2,
    outputs: 1,
    inputLabels: ['A', 'B'],
    outputLabels: ['输出'],
    params: [
      { key: 'strategy', label: '合并策略', type: 'select', options: ['全部到达后继续', '任意一路到达即继续'], default: '全部到达后继续' },
    ],
  },
  end: {
    label: '结束',
    icon: '⏹',
    color: '#6fcf97',
    inputs: 1,
    outputs: 0,
    outputLabels: [],
    params: [{ key: 'note', label: '结束说明', type: 'textarea', default: '' }],
  },
};

export function defaultParams(type) {
  const params = {};
  for (const p of NODE_TYPES[type].params) params[p.key] = p.default;
  return params;
}

export function createNode(type, x, y) {
  const def = NODE_TYPES[type];
  if (!def) throw new Error(`unknown node type: ${type}`);
  return {
    id: uid('n'),
    type,
    name: def.label,
    x: Math.round(x),
    y: Math.round(y),
    params: defaultParams(type),
  };
}

export function createEdge(fromNode, fromPort, toNode, toPort) {
  return { id: uid('e'), from: { node: fromNode, port: fromPort }, to: { node: toNode, port: toPort } };
}

export function createFlow(name) {
  const now = Date.now();
  return {
    version: 1,
    id: uid('flow'),
    name,
    createdAt: now,
    updatedAt: now,
    viewport: { x: 0, y: 0, zoom: 1 },
    nodes: [],
    edges: [],
  };
}

export function getNode(flow, id) {
  return flow.nodes.find((n) => n.id === id) || null;
}

export function edgeExists(flow, fromNode, fromPort, toNode, toPort) {
  return flow.edges.some(
    (e) =>
      e.from.node === fromNode && e.from.port === fromPort && e.to.node === toNode && e.to.port === toPort,
  );
}

/** 若新增 from -> to 的边后会成环则返回 true（即 to 已能到达 from）。 */
export function wouldCycle(flow, fromNode, toNode) {
  if (fromNode === toNode) return true;
  const adj = new Map();
  for (const e of flow.edges) {
    if (!adj.has(e.from.node)) adj.set(e.from.node, []);
    adj.get(e.from.node).push(e.to.node);
  }
  const stack = [toNode];
  const seen = new Set([toNode]);
  while (stack.length) {
    const cur = stack.pop();
    if (cur === fromNode) return true;
    for (const next of adj.get(cur) || []) {
      if (!seen.has(next)) {
        seen.add(next);
        stack.push(next);
      }
    }
  }
  return false;
}

/** 校验并规范化从存储读出的数据，坏数据返回 null。 */
export function normalizeFlow(raw) {
  try {
    if (!raw || typeof raw !== 'object') return null;
    if (!Array.isArray(raw.nodes) || !Array.isArray(raw.edges)) return null;
    const flow = {
      version: 1,
      id: typeof raw.id === 'string' ? raw.id : uid('flow'),
      name: typeof raw.name === 'string' && raw.name ? raw.name : '未命名流程',
      createdAt: Number(raw.createdAt) || Date.now(),
      updatedAt: Number(raw.updatedAt) || Date.now(),
      viewport: {
        x: Number(raw.viewport?.x) || 0,
        y: Number(raw.viewport?.y) || 0,
        zoom: clampZoom(Number(raw.viewport?.zoom) || 1),
      },
      nodes: [],
      edges: [],
    };
    const ids = new Set();
    for (const n of raw.nodes) {
      if (!n || typeof n.id !== 'string' || !NODE_TYPES[n.type]) continue;
      if (ids.has(n.id)) continue;
      ids.add(n.id);
      flow.nodes.push({
        id: n.id,
        type: n.type,
        name: typeof n.name === 'string' ? n.name : NODE_TYPES[n.type].label,
        x: Number(n.x) || 0,
        y: Number(n.y) || 0,
        params: { ...defaultParams(n.type), ...(n.params && typeof n.params === 'object' ? n.params : {}) },
      });
    }
    const edgeIds = new Set();
    for (const e of raw.edges) {
      if (!e || !ids.has(e.from?.node) || !ids.has(e.to?.node)) continue;
      const fromPort = Number(e.from.port) || 0;
      const toPort = Number(e.to.port) || 0;
      if (fromPort >= NODE_TYPES[getNode(flow, e.from.node).type].outputs) continue;
      if (toPort >= NODE_TYPES[getNode(flow, e.to.node).type].inputs) continue;
      const id = typeof e.id === 'string' && !edgeIds.has(e.id) ? e.id : uid('e');
      edgeIds.add(id);
      flow.edges.push({ id, from: { node: e.from.node, port: fromPort }, to: { node: e.to.node, port: toPort } });
    }
    return flow;
  } catch {
    return null;
  }
}

export function clampZoom(z) {
  return Math.min(4, Math.max(0.25, z));
}
