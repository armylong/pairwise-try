// 全局常量
export const STORAGE_KEY = 'nfe.flows.v1';
export const EDITOR_SESSION_KEY = 'nfe.editor.last';

export const MIN_SCALE = 0.25;
export const MAX_SCALE = 4;

export const HISTORY_LIMIT = 80; // >= 50

export const NODE_WIDTH = 184;

export const SNAP_THRESHOLD = 6; // 屏幕像素
export const SNAP_GUIDE_COLOR = '#5eead4';

export const PASTE_OFFSET = 28; // 世界坐标
export const DUP_FLOW_SUFFIX = ' 副本';

export const DRAG_THRESHOLD = 3; // 屏幕像素，超过才算拖拽

export const PORT_KIND = Object.freeze({
  IN: 'in',
  OUT: 'out',
});
