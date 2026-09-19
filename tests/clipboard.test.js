import { test, assert, assertEqual } from './harness.js';
import { Graph, createNode, createEdge } from '../src/core/graph.js';
import { copySubgraph, remapForPaste } from '../src/core/clipboard.js';

test('复制只包含选中节点之间的内部边', () => {
  const graph = new Graph();
  graph.addNode(createNode('trigger', 0, 0, { id: 't' }));
  graph.addNode(createNode('action', 0, 0, { id: 'a' }));
  graph.addNode(createNode('end', 0, 0, { id: 'e' }));
  graph.addEdge(createEdge({ nodeId: 't', portId: 'out' }, { nodeId: 'a', portId: 'in' }, { id: 'e1' }));
  graph.addEdge(createEdge({ nodeId: 'a', portId: 'out' }, { nodeId: 'e', portId: 'in' }, { id: 'e2' }));
  const sub = copySubgraph(graph, ['t', 'a']);
  assertEqual(sub.nodes.length, 2);
  assertEqual(sub.edges.length, 1);
  assertEqual(sub.edges[0].id, 'e1');
});

test('粘贴时所有 id 重新生成且坐标右下偏移', () => {
  const graph = new Graph();
  graph.addNode(createNode('action', 100, 200, { id: 'a' }));
  graph.addNode(createNode('end', 400, 200, { id: 'e' }));
  graph.addEdge(createEdge({ nodeId: 'a', portId: 'out' }, { nodeId: 'e', portId: 'in' }, { id: 'edge' }));
  const sub = copySubgraph(graph, ['a', 'e']);
  const pasted = remapForPaste(sub, 28);
  assertEqual(pasted.nodes.length, 2);
  assertEqual(pasted.edges.length, 1);
  for (const node of pasted.nodes) {
    assert(!['a', 'e'].includes(node.id), '节点 id 已更换');
  }
  const movedA = pasted.nodes.find((n) => n.type === 'action');
  assertEqual(movedA.x, 128);
  assertEqual(movedA.y, 228);
  // 内部边指向新 id
  assertEqual(pasted.edges[0].source, movedA.id);
});
