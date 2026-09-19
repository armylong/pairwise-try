import { test, assert, assertEqual } from './harness.js';
import {
  screenToWorld,
  worldToScreen,
  zoomToward,
  portPosition,
  edgePath,
  computeSnap,
  boundsIntersect,
  nodeBounds,
} from '../src/core/geometry.js';

test('screenToWorld / worldToScreen 互逆', () => {
  const vp = { scale: 2, tx: 100, ty: -40 };
  const world = screenToWorld({ x: 300, y: 160 }, vp);
  const back = worldToScreen(world, vp);
  assert(Math.abs(back.x - 300) < 1e-9, 'x 往返一致');
  assert(Math.abs(back.y - 160) < 1e-9, 'y 往返一致');
});

test('zoomToward 锚点在缩放前后保持同一世界点', () => {
  const vp = { scale: 1, tx: 0, ty: 0 };
  const anchor = { x: 200, y: 100 };
  const worldBefore = screenToWorld(anchor, vp);
  const next = zoomToward(vp, 2, anchor);
  const worldAfter = screenToWorld(anchor, next);
  assert(Math.abs(worldAfter.x - worldBefore.x) < 1e-9, '锚点 x 不漂移');
  assert(Math.abs(worldAfter.y - worldBefore.y) < 1e-9, '锚点 y 不漂移');
  assertEqual(next.scale, 2);
});

test('zoomToward 夹在 0.25~4', () => {
  const vp = { scale: 1, tx: 0, ty: 0 };
  assertEqual(zoomToward(vp, 100, { x: 0, y: 0 }).scale, 4);
  assertEqual(zoomToward(vp, 0.01, { x: 0, y: 0 }).scale, 0.25);
});

test('条件节点两个输出口位于 1/3 与 2/3 高度', () => {
  const node = { id: 'c', type: 'condition', x: 0, y: 0, params: {} };
  const bounds = nodeBounds(node);
  const p1 = portPosition(node, 'out', 'true');
  const p2 = portPosition(node, 'out', 'false');
  assert(Math.abs(p1.y - bounds.height / 3) < 1e-9, 'true 在 1/3');
  assert(Math.abs(p2.y - (bounds.height * 2) / 3) < 1e-9, 'false 在 2/3');
  assertEqual(p1.x, bounds.width);
});

test('edgePath 生成三次贝塞尔字符串', () => {
  const path = edgePath({ x: 100, y: 50 }, { x: 300, y: 90 });
  assert(path.d.startsWith('M 100 50 C'), '以 M/C 开头');
  assert(path.d.includes('300 90'), '到达终点');
  assert(path.c1.x >= 140, '控制点向右延伸');
});

test('computeSnap: 左边缘对齐吸附返回 dx 与竖辅助线', () => {
  const staticNode = { id: 'a', type: 'action', x: 100, y: 100, params: {} };
  const moving = [{ id: 'b', type: 'action', x: 102, y: 300, params: {} }];
  const result = computeSnap(moving, new Map([['a', staticNode]]), 8);
  assertEqual(result.dx, -2);
  assertEqual(result.guides.vertical.length, 1);
});

test('computeSnap: 距离超出阈值不吸附', () => {
  const staticNode = { id: 'a', type: 'action', x: 100, y: 100, params: {} };
  const moving = [{ id: 'b', type: 'action', x: 140, y: 300, params: {} }];
  const result = computeSnap(moving, new Map([['a', staticNode]]), 6);
  assertEqual(result.dx, 0);
  assertEqual(result.dy, 0);
});

test('computeSnap: 中心线水平对齐', () => {
  const staticNode = { id: 'a', type: 'action', x: 0, y: 0, params: {} };
  const moving = [{ id: 'b', type: 'action', x: 300, y: 2, params: {} }];
  const result = computeSnap(moving, new Map([['a', staticNode]]), 8);
  assertEqual(result.dy, -2);
  assertEqual(result.guides.horizontal.length, 1);
});

test('boundsIntersect 基本判定', () => {
  assert(boundsIntersect({ x: 0, y: 0, width: 10, height: 10 }, { x: 5, y: 5, width: 10, height: 10 }));
  assert(!boundsIntersect({ x: 0, y: 0, width: 10, height: 10 }, { x: 20, y: 20, width: 10, height: 10 }));
});
