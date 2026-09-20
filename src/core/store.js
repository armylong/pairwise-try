import { createFlow, normalizeFlow } from './model.js';
import { uid } from './id.js';

const INDEX_KEY = 'flowproto.index.v1';
const flowKey = (id) => `flowproto.flow.v1.${id}`;

function readIndex() {
  try {
    const raw = sessionStorage.getItem(INDEX_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter((m) => m && typeof m.id === 'string') : [];
  } catch {
    return [];
  }
}

function writeIndex(list) {
  sessionStorage.setItem(INDEX_KEY, JSON.stringify(list));
}

function touchMeta(flow) {
  const index = readIndex();
  const meta = {
    id: flow.id,
    name: flow.name,
    nodeCount: flow.nodes.length,
    edgeCount: flow.edges.length,
    createdAt: flow.createdAt,
    updatedAt: flow.updatedAt,
  };
  const i = index.findIndex((m) => m.id === flow.id);
  if (i >= 0) index[i] = meta;
  else index.push(meta);
  writeIndex(index);
}

export function listFlows() {
  return readIndex().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

export function loadFlow(id) {
  try {
    const raw = sessionStorage.getItem(flowKey(id));
    if (!raw) return null;
    return normalizeFlow(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveFlow(flow) {
  flow.updatedAt = Date.now();
  sessionStorage.setItem(flowKey(flow.id), JSON.stringify(flow));
  touchMeta(flow);
}

export function createAndSaveFlow(name) {
  const flow = createFlow(name);
  saveFlow(flow);
  return flow;
}

export function deleteFlow(id) {
  sessionStorage.removeItem(flowKey(id));
  writeIndex(readIndex().filter((m) => m.id !== id));
}

export function renameFlow(id, name) {
  const flow = loadFlow(id);
  if (flow) {
    flow.name = name;
    saveFlow(flow);
  } else {
    const index = readIndex();
    const meta = index.find((m) => m.id === id);
    if (meta) {
      meta.name = name;
      meta.updatedAt = Date.now();
      writeIndex(index);
    }
  }
}

export function duplicateFlow(id) {
  const src = loadFlow(id);
  const index = readIndex();
  const meta = index.find((m) => m.id === id);
  const base = src || null;
  const copy = base || createFlow(meta ? `${meta.name} 副本` : '未命名流程 副本');
  if (base) {
    copy.id = uid('flow');
    copy.name = `${base.name} 副本`;
    copy.createdAt = Date.now();
  }
  saveFlow(copy);
  return copy;
}
