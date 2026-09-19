import { test, assert, assertEqual } from './harness.js';
import { sanitizeGraph, sanitizeViewport, sanitizeFlow } from '../src/core/validate.js';

test('坏数据：null / 字符串 / 数字不抛异常', () => {
  assertEqual(sanitizeGraph(null).nodes, []);
  assertEqual(sanitizeGraph('garbage').edges, []);
  assertEqual(sanitizeGraph(42).nodes, []);
});

test('未知类型节点被剔除，其边也被剔除', () => {
  const result = sanitizeGraph({
    nodes: [
      { id: 'a', type: 'action', x: 0, y: 0 },
      { id: 'b', type: 'unknown', x: 10, y: 10 },
    ],
    edges: [{ id: 'e', source: 'a', sourcePort: 'out', target: 'b', targetPort: 'in' }],
  });
  assertEqual(result.nodes.length, 1);
  assertEqual(result.edges.length, 0);
});

test('坏端口 / 自环 / 重复边被清理', () => {
  const result = sanitizeGraph({
    nodes: [
      { id: 'a', type: 'trigger', x: 0, y: 0 },
      { id: 'b', type: 'action', x: 10, y: 10 },
    ],
    edges: [
      { id: 'e1', source: 'a', sourcePort: 'out', target: 'b', targetPort: 'in' },
      { id: 'e2', source: 'a', sourcePort: 'out', target: 'b', targetPort: 'in' },
      { id: 'e3', source: 'a', sourcePort: 'wrong', target: 'b', targetPort: 'in' },
      { id: 'e4', source: 'a', sourcePort: 'out', target: 'a', targetPort: 'in' },
      { id: 'e5', source: 'ghost', sourcePort: 'out', target: 'b', targetPort: 'in' },
    ],
  });
  assertEqual(result.edges.length, 1);
});

test('缺失字段补默认值，坐标非法归零', () => {
  const result = sanitizeGraph({
    nodes: [{ type: 'trigger', x: 'oops', y: null }],
  });
  const node = result.nodes[0];
  assert(typeof node.id === 'string', '生成 id');
  assertEqual(node.name, '触发器');
  assertEqual(node.x, 0);
  assertEqual(node.params.mode, '定时触发');
});

test('条件分支参数被规整为两个出口', () => {
  const result = sanitizeGraph({
    nodes: [{ id: 'c', type: 'condition', x: 0, y: 0, params: { branches: { true: { label: '通过' } } } }],
  });
  const branches = result.nodes[0].params.branches;
  assertEqual(branches.true.label, '通过');
  assertEqual(branches.true.expr, '');
  assertEqual(branches.false.label, '否');
});

test('viewport 夹在范围内，坏值回退', () => {
  assertEqual(sanitizeViewport({ scale: 99, tx: 'x', ty: 1 }).scale, 4);
  assertEqual(sanitizeViewport(null), { scale: 1, tx: 0, ty: 0 });
});

test('sanitizeFlow 保证完整记录结构', () => {
  const flow = sanitizeFlow({ id: 'f', graph: null });
  assertEqual(flow.id, 'f');
  assertEqual(flow.name, '未命名流程');
  assertEqual(flow.graph.nodes, []);
  assert(typeof flow.updatedAt === 'number');
  assertEqual(sanitizeFlow('bad'), null);
});
