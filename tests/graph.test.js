import { test, assert, assertEqual } from './harness.js';
import { Graph, createNode, createEdge, EDGE_ERROR } from '../src/core/graph.js';

function makeGraph() {
  const graph = new Graph();
  graph.addNode(createNode('trigger', 0, 0, { id: 't' }));
  graph.addNode(createNode('action', 300, 0, { id: 'a' }));
  graph.addNode(createNode('condition', 600, 0, { id: 'c' }));
  graph.addNode(createNode('end', 900, 0, { id: 'e' }));
  return graph;
}

test('createNode 生成默认参数', () => {
  const node = createNode('trigger', 10, 20);
  assert(node.id.startsWith('node_'), 'id 带前缀');
  assertEqual(node.x, 10);
  assertEqual(node.params.mode, '定时触发');
});

test('未知类型节点抛错', () => {
  let threw = false;
  try {
    createNode('nope', 0, 0);
  } catch {
    threw = true;
  }
  assert(threw);
});

test('正常连线校验通过', () => {
  const graph = makeGraph();
  const result = graph.validateConnection({ nodeId: 't', portId: 'out' }, { nodeId: 'a', portId: 'in' });
  assert(result.ok, JSON.stringify(result));
});

test('自环被拒绝', () => {
  const graph = makeGraph();
  graph.addNode(createNode('action', 0, 0, { id: 'self' }));
  // action 一进一出，自环 out->in
  const result = graph.validateConnection({ nodeId: 'a', portId: 'out' }, { nodeId: 'a', portId: 'in' });
  assertEqual(result.code, EDGE_ERROR.SELF_LOOP);
});

test('重复边被拒绝', () => {
  const graph = makeGraph();
  const edge = createEdge({ nodeId: 't', portId: 'out' }, { nodeId: 'a', portId: 'in' }, { id: 'x' });
  graph.addEdge(edge);
  const result = graph.validateConnection({ nodeId: 't', portId: 'out' }, { nodeId: 'a', portId: 'in' });
  assertEqual(result.code, EDGE_ERROR.DUPLICATE);
});

test('成环被拒绝：a->b->a', () => {
  const graph = new Graph();
  graph.addNode(createNode('action', 0, 0, { id: 'a' }));
  graph.addNode(createNode('action', 0, 0, { id: 'b' }));
  graph.addEdge(createEdge({ nodeId: 'a', portId: 'out' }, { nodeId: 'b', portId: 'in' }, { id: 'e1' }));
  // 想从 b 连回 a
  const result = graph.validateConnection({ nodeId: 'b', portId: 'out' }, { nodeId: 'a', portId: 'in' });
  assertEqual(result.code, EDGE_ERROR.CYCLE);
});

test('输入口已占用被拒绝（一进一出）', () => {
  const graph = new Graph();
  graph.addNode(createNode('trigger', 0, 0, { id: 't1' }));
  graph.addNode(createNode('trigger', 0, 0, { id: 't2' }));
  graph.addNode(createNode('action', 0, 0, { id: 'a' }));
  graph.addEdge(createEdge({ nodeId: 't1', portId: 'out' }, { nodeId: 'a', portId: 'in' }, { id: 'e1' }));
  const result = graph.validateConnection({ nodeId: 't2', portId: 'out' }, { nodeId: 'a', portId: 'in' });
  assertEqual(result.code, EDGE_ERROR.PORT_OCCUPIED);
});

test('合并节点两个输入口可分别接入', () => {
  const graph = new Graph();
  graph.addNode(createNode('trigger', 0, 0, { id: 't1' }));
  graph.addNode(createNode('trigger', 0, 0, { id: 't2' }));
  graph.addNode(createNode('merge', 0, 0, { id: 'm' }));
  const r1 = graph.validateConnection({ nodeId: 't1', portId: 'out' }, { nodeId: 'm', portId: 'a' });
  const r2 = graph.validateConnection({ nodeId: 't2', portId: 'out' }, { nodeId: 'm', portId: 'b' });
  assert(r1.ok && r2.ok, '两个输入口独立');
});

test('end 节点没有输出口，非法端口被拒绝', () => {
  const graph = makeGraph();
  const result = graph.validateConnection({ nodeId: 'e', portId: 'out' }, { nodeId: 'a', portId: 'in' });
  assertEqual(result.code, EDGE_ERROR.INVALID_PORT);
});

test('删除节点连带删除关联边', () => {
  const graph = makeGraph();
  graph.addEdge(createEdge({ nodeId: 't', portId: 'out' }, { nodeId: 'a', portId: 'in' }, { id: 'e1' }));
  const removed = graph.removeNode('a');
  assertEqual(removed.edges.length, 1);
  assertEqual(graph.edges.size, 0);
});

test('toJSON / fromJSON 往返一致', () => {
  const graph = makeGraph();
  graph.addEdge(createEdge({ nodeId: 't', portId: 'out' }, { nodeId: 'a', portId: 'in' }, { id: 'e1' }));
  const restored = Graph.fromJSON(graph.toJSON());
  assertEqual(restored.nodes.size, 4);
  assertEqual(restored.edges.size, 1);
});

test('fromJSON 忽略引用不存在节点的边', () => {
  const restored = Graph.fromJSON({
    nodes: [createNode('action', 0, 0, { id: 'a' })],
    edges: [
      createEdge({ nodeId: 'a', portId: 'out' }, { nodeId: 'ghost', portId: 'in' }, { id: 'bad' }),
    ],
  });
  assertEqual(restored.edges.size, 0);
});
