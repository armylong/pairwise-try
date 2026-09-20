/** 命令工厂：每条命令 apply()/revert() 后触发 ctx.refresh()。 */

export function addNodeCmd(ctx, node) {
  return {
    label: '新增节点',
    apply() {
      ctx.flow.nodes.push(node);
      ctx.refresh();
    },
    revert() {
      ctx.flow.nodes = ctx.flow.nodes.filter((n) => n.id !== node.id);
      ctx.selection.nodes.delete(node.id);
      ctx.refresh();
    },
  };
}

export function addEdgeCmd(ctx, edge) {
  return {
    label: '新增连线',
    apply() {
      ctx.flow.edges.push(edge);
      ctx.refresh();
    },
    revert() {
      ctx.flow.edges = ctx.flow.edges.filter((e) => e.id !== edge.id);
      ctx.selection.edges.delete(edge.id);
      ctx.refresh();
    },
  };
}

export function addBatchCmd(ctx, nodes, edges) {
  return {
    label: '粘贴',
    apply() {
      ctx.flow.nodes.push(...nodes);
      ctx.flow.edges.push(...edges);
      ctx.refresh();
    },
    revert() {
      const nids = new Set(nodes.map((n) => n.id));
      const eids = new Set(edges.map((e) => e.id));
      ctx.flow.nodes = ctx.flow.nodes.filter((n) => !nids.has(n.id));
      ctx.flow.edges = ctx.flow.edges.filter((e) => !eids.has(e.id));
      for (const id of nids) ctx.selection.nodes.delete(id);
      for (const id of eids) ctx.selection.edges.delete(id);
      ctx.refresh();
    },
  };
}

/** 删除指定节点集合与连线集合（含级联边已在调用方算好）。 */
export function removeBatchCmd(ctx, nodeIds, edgeIds) {
  const nodes = ctx.flow.nodes.filter((n) => nodeIds.has(n.id));
  const edges = ctx.flow.edges.filter((e) => edgeIds.has(e.id));
  return {
    label: '删除',
    apply() {
      ctx.flow.nodes = ctx.flow.nodes.filter((n) => !nodeIds.has(n.id));
      ctx.flow.edges = ctx.flow.edges.filter((e) => !edgeIds.has(e.id));
      for (const id of nodeIds) ctx.selection.nodes.delete(id);
      for (const id of edgeIds) ctx.selection.edges.delete(id);
      ctx.refresh();
    },
    revert() {
      ctx.flow.nodes.push(...nodes);
      ctx.flow.edges.push(...edges);
      ctx.refresh();
    },
  };
}

/** 移动节点：before/after 均为 Map<id, {x, y}>。拖拽松手后以 pushApplied 入栈。 */
export function moveNodesCmd(ctx, before, after) {
  const applyPos = (map) => {
    for (const n of ctx.flow.nodes) {
      const p = map.get(n.id);
      if (p) {
        n.x = p.x;
        n.y = p.y;
      }
    }
    ctx.refresh();
  };
  return {
    label: '移动节点',
    apply: () => applyPos(after),
    revert: () => applyPos(before),
  };
}

/** 修改节点属性：before/after 为 { name?, params? } 快照。 */
export function setNodePropsCmd(ctx, nodeId, before, after) {
  const applyProps = (props) => {
    const n = ctx.flow.nodes.find((x) => x.id === nodeId);
    if (!n) return;
    if (props.name !== undefined) n.name = props.name;
    if (props.params !== undefined) n.params = { ...props.params };
    ctx.refresh();
  };
  return {
    label: '修改属性',
    apply: () => applyProps(after),
    revert: () => applyProps(before),
  };
}
