import { test, assert, assertEqual } from './harness.js';
import { Graph, createNode, createEdge } from '../src/core/graph.js';
import { History } from '../src/core/history.js';
import { addNodeCommand, removeNodesCommand, moveNodesCommand, updateNodeCommand } from '../src/core/commands.js';

function graphWithNode(id = 'a') {
  const graph = new Graph();
  graph.addNode(createNode('action', 0, 0, { id }));
  return graph;
}

test('execute 后 redo 栈被清空', () => {
  const graph = graphWithNode();
  const history = new History();
  history.execute(addNodeCommand(createNode('action', 1, 1, { id: 'b' })), graph);
  history.undo(graph);
  assert(history.canRedo(), 'undo 后可 redo');
  history.execute(addNodeCommand(createNode('action', 2, 2, { id: 'c' })), graph);
  assert(!history.canRedo(), '新命令清空 redo');
});

test('节点增删的撤销重做', () => {
  const graph = graphWithNode();
  const history = new History();
  history.execute(addNodeCommand(createNode('action', 5, 5, { id: 'b' })), graph);
  assertEqual(graph.nodes.size, 2);
  history.undo(graph);
  assertEqual(graph.nodes.size, 1);
  history.redo(graph);
  assertEqual(graph.nodes.size, 2);
});

test('删除节点撤销时连关联边一起恢复', () => {
  const graph = new Graph();
  graph.addNode(createNode('trigger', 0, 0, { id: 't' }));
  graph.addNode(createNode('action', 0, 0, { id: 'a' }));
  graph.addEdge(createEdge({ nodeId: 't', portId: 'out' }, { nodeId: 'a', portId: 'in' }, { id: 'e' }));
  const history = new History();
  history.execute(removeNodesCommand(['a']), graph);
  assertEqual(graph.edges.size, 0);
  history.undo(graph);
  assertEqual(graph.nodes.size, 2);
  assertEqual(graph.edges.size, 1);
});

test('移动命令撤销恢复原坐标', () => {
  const graph = graphWithNode();
  const history = new History();
  history.execute(
    moveNodesCommand([{ id: 'a', from: { x: 0, y: 0 }, to: { x: 100, y: 200 } }]),
    graph,
  );
  assertEqual(graph.getNode('a').x, 100);
  history.undo(graph);
  assertEqual(graph.getNode('a').x, 0);
  assertEqual(graph.getNode('a').y, 0);
});

test('属性修改撤销恢复', () => {
  const graph = graphWithNode();
  const history = new History();
  history.execute(
    updateNodeCommand('a', { name: '旧名' }, { name: '新名' }),
    graph,
  );
  assertEqual(graph.getNode('a').name, '新名');
  history.undo(graph);
  assertEqual(graph.getNode('a').name, '旧名');
});

test('栈深超过上限丢弃最旧记录', () => {
  const graph = new Graph();
  const history = new History(5);
  for (let i = 0; i < 8; i += 1) {
    history.execute(addNodeCommand(createNode('action', i, 0, { id: `n${i}` })), graph);
  }
  assertEqual(history.undoStack.length, 5);
  assertEqual(graph.nodes.size, 8);
});
