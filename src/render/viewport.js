// 视图状态：缩放 / 平移，以及把变换应用到 world 层与网格背景
import { MIN_SCALE, MAX_SCALE } from '../core/constants.js';
import { defaultViewport, screenToWorld, zoomToward } from '../core/geometry.js';
import { clamp } from '../core/utils.js';

const GRID_SIZE = 24;

export class Viewport {
  constructor(worldElement, gridElement, initial = defaultViewport()) {
    this.world = worldElement;
    this.grid = gridElement;
    this.state = { ...initial };
    this.apply();
  }

  get scale() {
    return this.state.scale;
  }

  get tx() {
    return this.state.tx;
  }

  get ty() {
    return this.state.ty;
  }

  set(next) {
    this.state = {
      scale: clamp(next.scale, MIN_SCALE, MAX_SCALE),
      tx: next.tx,
      ty: next.ty,
    };
    this.apply();
  }

  panBy(dx, dy) {
    this.state.tx += dx;
    this.state.ty += dy;
    this.apply();
  }

  zoomAt(anchor, factor) {
    this.set(zoomToward(this.state, this.state.scale * factor, anchor));
  }

  setScale(scale, anchor = { x: 0, y: 0 }) {
    this.set(zoomToward(this.state, scale, anchor));
  }

  reset() {
    this.set(defaultViewport());
  }

  toWorld(screenPoint) {
    return screenToWorld(screenPoint, this.state);
  }

  apply() {
    const { scale, tx, ty } = this.state;
    this.world.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
    // 网格：背景尺寸随缩放，位置跟随平移（世界固定网格）
    const size = GRID_SIZE * scale;
    this.grid.style.backgroundPosition = `${tx}px ${ty}px`;
    this.grid.style.backgroundSize = `${size}px ${size}px`;
  }

  toJSON() {
    return { ...this.state };
  }
}
