/** 坐标换算与几何纯函数，不涉及 DOM。 */

export function screenToWorld(viewport, sx, sy) {
  return { x: (sx - viewport.x) / viewport.zoom, y: (sy - viewport.y) / viewport.zoom };
}

export function worldToScreen(viewport, wx, wy) {
  return { x: wx * viewport.zoom + viewport.x, y: wy * viewport.zoom + viewport.y };
}

/** 以屏幕上某点为锚点缩放，返回新的 viewport，使锚点下的世界坐标不动。 */
export function zoomAt(viewport, sx, sy, nextZoom) {
  const world = screenToWorld(viewport, sx, sy);
  return {
    zoom: nextZoom,
    x: sx - world.x * nextZoom,
    y: sy - world.y * nextZoom,
  };
}

/** 三次贝塞尔曲线路径（水平走向），控制点按水平距离自适应。 */
export function bezierPath(x1, y1, x2, y2) {
  const dx = Math.max(48, Math.abs(x2 - x1) * 0.5);
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
}

export function rectsIntersect(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/**
 * 对齐吸附计算。
 * moving: 正在拖动的节点矩形集合 [{id,x,y,w,h}]（已含未吸附的位移）
 * others: 其余节点矩形
 * threshold: 世界坐标下的吸附阈值
 * 返回 { dx, dy, vGuides: [x...], hGuides: [y...] }
 */
export function computeSnap(moving, others, threshold) {
  if (!moving.length || !others.length) return { dx: 0, dy: 0, vGuides: [], hGuides: [] };

  const movingEdgesX = [];
  const movingEdgesY = [];
  for (const r of moving) {
    movingEdgesX.push(r.x, r.x + r.w / 2, r.x + r.w);
    movingEdgesY.push(r.y, r.y + r.h / 2, r.y + r.h);
  }

  let bestX = null; // {dist, delta, guide}
  let bestY = null;
  for (const o of others) {
    const oxs = [o.x, o.x + o.w / 2, o.x + o.w];
    const oys = [o.y, o.y + o.h / 2, o.y + o.h];
    for (const mx of movingEdgesX) {
      for (const ox of oxs) {
        const delta = ox - mx;
        const dist = Math.abs(delta);
        if (dist <= threshold && (!bestX || dist < bestX.dist)) bestX = { dist, delta, guide: ox };
      }
    }
    for (const my of movingEdgesY) {
      for (const oy of oys) {
        const delta = oy - my;
        const dist = Math.abs(delta);
        if (dist <= threshold && (!bestY || dist < bestY.dist)) bestY = { dist, delta, guide: oy };
      }
    }
  }

  return {
    dx: bestX ? bestX.delta : 0,
    dy: bestY ? bestY.delta : 0,
    vGuides: bestX ? [bestX.guide] : [],
    hGuides: bestY ? [bestY.guide] : [],
  };
}
