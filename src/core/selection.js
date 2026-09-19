// 选区模型：节点 / 连线 / 空白三态互斥
export const SELECTION_KIND = Object.freeze({
  NONE: 'none',
  NODES: 'nodes',
  EDGE: 'edge',
});

export class Selection {
  constructor() {
    this.kind = SELECTION_KIND.NONE;
    this.nodeIds = new Set();
    this.edgeId = null;
  }

  clear() {
    this.kind = SELECTION_KIND.NONE;
    this.nodeIds.clear();
    this.edgeId = null;
  }

  selectNodes(ids, additive = false) {
    if (!additive) this.nodeIds.clear();
    for (const id of ids) this.nodeIds.add(id);
    this.kind = this.nodeIds.size ? SELECTION_KIND.NODES : SELECTION_KIND.NONE;
    this.edgeId = null;
  }

  toggleNode(id) {
    if (this.kind !== SELECTION_KIND.NODES) {
      this.clear();
      this.kind = SELECTION_KIND.NODES;
    }
    if (this.nodeIds.has(id)) {
      this.nodeIds.delete(id);
      if (!this.nodeIds.size) this.kind = SELECTION_KIND.NONE;
    } else {
      this.nodeIds.add(id);
    }
  }

  selectEdge(edgeId) {
    this.nodeIds.clear();
    this.edgeId = edgeId;
    this.kind = edgeId ? SELECTION_KIND.EDGE : SELECTION_KIND.NONE;
  }

  hasNode(id) {
    return this.kind === SELECTION_KIND.NODES && this.nodeIds.has(id);
  }

  isEmpty() {
    return this.kind === SELECTION_KIND.NONE;
  }

  // 删除已不存在的元素
  prune(existingNodeIds, existingEdgeIds) {
    if (this.kind === SELECTION_KIND.NODES) {
      for (const id of Array.from(this.nodeIds)) {
        if (!existingNodeIds.has(id)) this.nodeIds.delete(id);
      }
      if (!this.nodeIds.size) this.kind = SELECTION_KIND.NONE;
    } else if (this.kind === SELECTION_KIND.EDGE) {
      if (!existingEdgeIds.has(this.edgeId)) {
        this.edgeId = null;
        this.kind = SELECTION_KIND.NONE;
      }
    }
  }
}
