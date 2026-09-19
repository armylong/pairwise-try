// 命令工厂：每个命令自带 do / undo，操作 Graph 模型
import { deepClone } from './utils.js';

export function addNodesCommand(nodes) {
  const copies = nodes.map(deepClone);
  return {
    label: 'addNodes',
    do(graph) {
      for (const node of copies) graph.addNode(deepClone(node));
    },
    undo(graph) {
      for (const node of copies) graph.removeNode(node.id);
    },
  };
}

export function addNodeCommand(node) {
  return addNodesCommand([node]);
}

export function removeNodesCommand(nodeIds) {
  let removed = [];
  return {
    label: 'removeNodes',
    do(graph) {
      removed = [];
      for (const id of nodeIds) {
        const result = graph.removeNode(id);
        if (result) removed.push(result);
      }
    },
    undo(graph) {
      for (const { node, edges } of removed) {
        graph.addNode(deepClone(node));
        for (const edge of edges) graph.addEdge(deepClone(edge));
      }
    },
  };
}

export function addEdgeCommand(edge) {
  const copy = deepClone(edge);
  return {
    label: 'addEdge',
    do(graph) {
      graph.addEdge(deepClone(copy));
    },
    undo(graph) {
      graph.removeEdge(copy.id);
    },
  };
}

export function removeEdgeCommand(edgeId) {
  let removed = null;
  return {
    label: 'removeEdge',
    do(graph) {
      removed = graph.removeEdge(edgeId);
    },
    undo(graph) {
      if (removed) graph.addEdge(deepClone(removed));
    },
  };
}

export function removeSelectionCommand(nodeIds, edgeIds) {
  let removedNodes = [];
  let removedEdges = [];
  return {
    label: 'removeSelection',
    do(graph) {
      removedEdges = [];
      for (const id of edgeIds) {
        const edge = graph.removeEdge(id);
        if (edge) removedEdges.push(edge);
      }
      removedNodes = [];
      for (const id of nodeIds) {
        const result = graph.removeNode(id);
        if (result) removedNodes.push(result);
      }
    },
    undo(graph) {
      for (const { node, edges } of removedNodes) {
        graph.addNode(deepClone(node));
        for (const edge of edges) graph.addEdge(deepClone(edge));
      }
      for (const edge of removedEdges) graph.addEdge(deepClone(edge));
    },
  };
}

// 移动：松手时记录起点->终点，一次移动一步
export function moveNodesCommand(moves) {
  // moves: [{id, from:{x,y}, to:{x,y}}]
  const snapshot = deepClone(moves);
  return {
    label: 'moveNodes',
    do(graph) {
      for (const move of snapshot) {
        graph.moveNode(move.id, move.to.x, move.to.y);
      }
    },
    undo(graph) {
      for (const move of snapshot) {
        graph.moveNode(move.id, move.from.x, move.from.y);
      }
    },
  };
}

// 属性修改：name / params
export function updateNodeCommand(id, before, after) {
  const beforeCopy = deepClone(before);
  const afterCopy = deepClone(after);
  return {
    label: 'updateNode',
    do(graph) {
      graph.updateNode(id, afterCopy);
    },
    undo(graph) {
      graph.updateNode(id, beforeCopy);
    },
  };
}

// 批量新增节点+内部连线（粘贴）
export function pasteCommand(nodes, edges) {
  const nodeCopies = nodes.map(deepClone);
  const edgeCopies = edges.map(deepClone);
  return {
    label: 'paste',
    do(graph) {
      for (const node of nodeCopies) graph.addNode(deepClone(node));
      for (const edge of edgeCopies) graph.addEdge(deepClone(edge));
    },
    undo(graph) {
      for (const edge of edgeCopies) graph.removeEdge(edge.id);
      for (const node of nodeCopies) graph.removeNode(node.id);
    },
  };
}
