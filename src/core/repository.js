// 流程仓库：sessionStorage 持久化。坏数据降级为空列表，不抛异常。
import { STORAGE_KEY } from './constants.js';
import { sanitizeFlow } from './validate.js';
import { uid, deepClone } from './utils.js';

export class FlowRepository {
  constructor(storageKey = STORAGE_KEY, storage = safeSessionStorage()) {
    this.storageKey = storageKey;
    this.storage = storage;
  }

  _readAll() {
    if (!this.storage) return [];
    let parsed;
    try {
      const raw = this.storage.getItem(this.storageKey);
      parsed = raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
    if (!Array.isArray(parsed)) return [];
    const flows = [];
    for (const item of parsed) {
      const clean = sanitizeFlow(item);
      if (clean) flows.push(clean);
    }
    return flows;
  }

  _writeAll(flows) {
    if (!this.storage) return;
    try {
      this.storage.setItem(this.storageKey, JSON.stringify(flows));
    } catch {
      // 隐私模式 / 配额超限时静默失败，内存状态仍可用
    }
  }

  list() {
    return this._readAll()
      .map((flow) => ({
        id: flow.id,
        name: flow.name,
        nodeCount: flow.graph.nodes.length,
        createdAt: flow.createdAt,
        updatedAt: flow.updatedAt,
      }))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  get(id) {
    const flow = this._readAll().find((item) => item.id === id);
    return flow ? deepClone(flow) : null;
  }

  create(name) {
    const flows = this._readAll();
    const now = Date.now();
    const flow = {
      id: uid('flow'),
      name: name && name.trim() ? name.trim() : '未命名流程',
      graph: { nodes: [], edges: [] },
      viewport: { scale: 1, tx: 0, ty: 0 },
      createdAt: now,
      updatedAt: now,
    };
    flows.push(flow);
    this._writeAll(flows);
    return deepClone(flow);
  }

  update(id, patch) {
    const flows = this._readAll();
    const index = flows.findIndex((item) => item.id === id);
    if (index === -1) return null;
    const current = flows[index];
    const next = {
      ...current,
      ...patch,
      id: current.id,
      updatedAt: Date.now(),
    };
    const clean = sanitizeFlow(next);
    flows[index] = clean;
    this._writeAll(flows);
    return deepClone(clean);
  }

  rename(id, name) {
    const trimmed = (name || '').trim();
    if (!trimmed) return null;
    return this.update(id, { name: trimmed });
  }

  duplicate(id, suffix = ' 副本') {
    const flows = this._readAll();
    const source = flows.find((item) => item.id === id);
    if (!source) return null;
    const now = Date.now();
    const copy = {
      ...deepClone(source),
      id: uid('flow'),
      name: `${source.name}${suffix}`,
      createdAt: now,
      updatedAt: now,
    };
    flows.push(copy);
    this._writeAll(flows);
    return deepClone(copy);
  }

  remove(id) {
    const flows = this._readAll();
    const next = flows.filter((item) => item.id !== id);
    this._writeAll(next);
    return flows.length !== next.length;
  }
}

export function safeSessionStorage() {
  try {
    const probe = '__nfe_probe__';
    window.sessionStorage.setItem(probe, '1');
    window.sessionStorage.removeItem(probe);
    return window.sessionStorage;
  } catch {
    return null;
  }
}
