// 剪贴板逻辑：抽出子图，粘贴时重新生成所有 id 并偏移
import { uid } from './utils.js';
import { PASTE_OFFSET } from './constants.js';

export function copySubgraph(graph, nodeIds) {
  const ids = new Set(nodeIds);
  const nodes = [];
  for (const id of ids) {
    const node = graph.getNode(id);
    if (node) nodes.push(JSON.parse(JSON.stringify(node)));
  }
  const edges = [];
  for (const edge of graph.edges.values()) {
    if (ids.has(edge.source) && ids.has(edge.target)) {
      edges.push(JSON.parse(JSON.stringify(edge)));
    }
  }
  return { nodes, edges };
}

export function remapForPaste(subgraph, offset = PASTE_OFFSET) {
  const nodeMap = new Map();
  const nodes = subgraph.nodes.map((node) => {
    const newId = uid('node');
    nodeMap.set(node.id, newId);
    return { ...JSON.parse(JSON.stringify(node)), id: newId, x: node.x + offset, y: node.y + offset };
  });
  const edges = [];
  const usedEdgeKeys = new Set();
  for (const edge of subgraph.edges) {
    const newEdge = {
      ...JSON.parse(JSON.stringify(edge)),
      id: uid('edge'),
      source: nodeMap.get(edge.source),
      target: nodeMap.get(edge.target),
    };
    const key = `${newEdge.source}:${newEdge.sourcePort}->${newEdge.target}:${newEdge.targetPort}`;
    if (!usedEdgeKeys.has(key)) {
      usedEdgeKeys.add(key);
      edges.push(newEdge);
    }
  }
  return { nodes, edges };
}
