// 纯几何逻辑：坐标换算 / 端口位置 / 贝塞尔路径 / 对齐吸附 / 命中判定
import { NODE_WIDTH, MIN_SCALE, MAX_SCALE } from './constants.js';
import { getNodeType } from './node-types.js';
import { clamp } from './utils.js';

// ---------- 视图坐标 ----------
// screen: 相对画布容器左上角的像素；world: 图数据坐标
export function screenToWorld(point, viewport) {
  return {
    x: (point.x - viewport.tx) / viewport.scale,
    y: (point.y - viewport.ty) / viewport.scale,
  };
}

export function worldToScreen(point, viewport) {
  return {
    x: point.x * viewport.scale + viewport.tx,
    y: point.y * viewport.scale + viewport.ty,
  };
}

// 以锚点（鼠标位置）不动的方式求新的平移
export function zoomToward(viewport, nextScale, anchor) {
  const scale = clamp(nextScale, MIN_SCALE, MAX_SCALE);
  const world = screenToWorld(anchor, viewport);
  return {
    scale,
    tx: anchor.x - world.x * scale,
    ty: anchor.y - world.y * scale,
  };
}

export function defaultViewport() {
  return { scale: 1, tx: 0, ty: 0 };
}

// ---------- 节点尺寸 / 端口 ----------
export function nodeSize(type) {
  const def = getNodeType(type);
  return { width: NODE_WIDTH, height: def ? def.height : 96 };
}

export function nodeBounds(node) {
  const size = nodeSize(node.type);
  return { x: node.x, y: node.y, width: size.width, height: size.height };
}

function slotRatio(index, total) {
  if (total <= 1) return 0.5;
  return (index + 1) / (total + 1);
}

// 世界坐标下端口中心点
export function portPosition(node, kind, portId) {
  const def = getNodeType(node.type);
  const size = nodeSize(node.type);
  const ports = kind === 'in' ? def.inputs : def.outputs;
  const index = Math.max(0, ports.indexOf(portId));
  const ratio = slotRatio(index, ports.length);
  const y = node.y + size.height * ratio;
  const x = kind === 'in' ? node.x : node.x + size.width;
  return { x, y };
}

// ---------- 三次贝塞尔（控制点自己算，水平走向） ----------
export function edgePath(source, target) {
  const dx = Math.max(40, Math.abs(target.x - source.x) * 0.5);
  const c1 = { x: source.x + dx, y: source.y };
  const c2 = { x: target.x - dx, y: target.y };
  return {
    d: `M ${source.x} ${source.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${target.x} ${target.y}`,
    source,
    target,
    c1,
    c2,
  };
}

function cubicPoint(t, p0, p1, p2, p3) {
  const u = 1 - t;
  const uu = u * u;
  const tt = t * t;
  return {
    x: uu * u * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + tt * t * p3.x,
    y: uu * u * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + tt * t * p3.y,
  };
}

export function distToEdge(point, path) {
  let minSq = Infinity;
  const steps = 24;
  for (let i = 0; i <= steps; i += 1) {
    const p = cubicPoint(i / steps, path.source, path.c1, path.c2, path.target);
    const dx = p.x - point.x;
    const dy = p.y - point.y;
    const sq = dx * dx + dy * dy;
    if (sq < minSq) minSq = sq;
  }
  return Math.sqrt(minSq);
}

// ---------- 矩形 ----------
export function pointInBounds(point, bounds, pad = 0) {
  return (
    point.x >= bounds.x - pad &&
    point.x <= bounds.x + bounds.width + pad &&
    point.y >= bounds.y - pad &&
    point.y <= bounds.y + bounds.height + pad
  );
}

export function boundsFromPoints(a, b) {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(a.x - b.x),
    height: Math.abs(a.y - b.y),
  };
}

export function boundsIntersect(a, b) {
  return (
    a.x <= b.x + b.width &&
    a.x + a.width >= b.x &&
    a.y <= b.y + b.height &&
    a.y + a.height >= b.y
  );
}

// ---------- 对齐吸附 ----------
// 两遍独立评估 x / y 轴；threshold 为世界坐标距离
// moving: 待吸附节点数组（候选位置），others: Map<id,node> 静止节点
export function computeSnap(movingNodes, others, threshold) {
  const edgeCandidates = (node) => {
    const b = nodeBounds(node);
    return {
      v: [
        { value: b.x, kind: 'left' },
        { value: b.x + b.width / 2, kind: 'center' },
        { value: b.x + b.width, kind: 'right' },
      ],
      h: [
        { value: b.y, kind: 'top' },
        { value: b.y + b.height / 2, kind: 'center' },
        { value: b.y + b.height, kind: 'bottom' },
      ],
    };
  };

  const collect = (axis) => {
    const list = [];
    for (const node of others.values()) {
      for (const item of edgeCandidates(node)[axis]) {
        list.push({ ...item, nodeId: node.id });
      }
    }
    return list;
  };

  const matchAxis = (nodes, candidates, axis) => {
    let best = { delta: 0, score: Infinity, match: null };
    for (const node of nodes) {
      for (const target of edgeCandidates(node)[axis]) {
        for (const cand of candidates) {
          const delta = cand.value - target.value;
          const score = Math.abs(delta);
          if (score <= threshold && score < best.score) {
            best = { delta, score, match: { movingId: node.id, cand, target } };
          }
        }
      }
    }
    return best;
  };

  const staticV = collect('v');
  const staticH = collect('h');

  const bestX = matchAxis(movingNodes, staticV, 'v');
  const shiftedY = movingNodes.map((node) => ({ ...node, x: node.x + bestX.delta }));
  const bestY = matchAxis(shiftedY, staticH, 'h');

  const guides = { vertical: [], horizontal: [] };
  const extend = 14;

  if (bestX.match) {
    const anchor = shiftedY.find((node) => node.id === bestX.match.movingId);
    const staticNode = others.get(bestX.match.cand.nodeId);
    const ab = nodeBounds(anchor);
    const sb = nodeBounds(staticNode);
    guides.vertical.push({
      x: bestX.match.cand.value,
      from: Math.min(ab.y, sb.y) - extend,
      to: Math.max(ab.y + ab.height, sb.y + sb.height) + extend,
    });
  }
  if (bestY.match) {
    const anchor = shiftedY.find((node) => node.id === bestY.match.movingId);
    const staticNode = others.get(bestY.match.cand.nodeId);
    const ab = nodeBounds(anchor);
    const sb = nodeBounds(staticNode);
    guides.horizontal.push({
      y: bestY.match.cand.value,
      from: Math.min(ab.x, sb.x) - extend,
      to: Math.max(ab.x + ab.width, sb.x + sb.width) + extend,
    });
  }

  return { dx: bestX.delta, dy: bestY.delta, guides };
}
