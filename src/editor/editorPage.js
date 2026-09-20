import { loadFlow, saveFlow } from '../core/store.js';
import { History } from '../core/history.js';
import { screenToWorld } from '../core/geometry.js';
import { uid } from '../core/id.js';
import { toast } from '../ui/toast.js';
import { promptDialog } from '../ui/modal.js';
import * as commands from './commands.js';
import { initViewport } from './viewport.js';
import { initNodes } from './nodeView.js';
import { initEdges } from './edgeView.js';
import { initSelection } from './selection.js';
import { initPalette } from './palette.js';
import { initInspector } from './inspector.js';

// ---------- 加载流程，坏数据兜底 ----------
const flowId = new URLSearchParams(location.search).get('id');
const flow = flowId ? loadFlow(flowId) : null;
if (!flow) {
  location.replace('index.html?corrupt=1');
  throw new Error('flow not found');
}

const els = {
  canvasWrap: document.getElementById('canvasWrap'),
  canvasGrid: document.getElementById('canvasGrid'),
  viewportEl: document.getElementById('viewport'),
  edgeLayer: document.getElementById('edgeLayer'),
  nodeLayer: document.getElementById('nodeLayer'),
  guideLayer: document.getElementById('guideLayer'),
  marquee: document.getElementById('marquee'),
  zoomLabel: document.getElementById('zoomLabel'),
  palette: document.getElementById('palette'),
  inspector: document.getElementById('inspector'),
  flowTitle: document.getElementById('flowTitle'),
  saveState: document.getElementById('saveState'),
  btnUndo: document.getElementById('btnUndo'),
  btnRedo: document.getElementById('btnRedo'),
  btnZoomIn: document.getElementById('btnZoomIn'),
  btnZoomOut: document.getElementById('btnZoomOut'),
  btnZoomReset: document.getElementById('btnZoomReset'),
};

const ctx = {
  flow,
  els,
  commands,
  history: new History(100),
  selection: { nodes: new Set(), edges: new Set() },
  nodeEls: new Map(),
  edgeEls: new Map(),
  nodeSizes: new Map(),
  dragPositions: null,

  worldFromEvent(e) {
    const rect = els.canvasWrap.getBoundingClientRect();
    return screenToWorld(flow.viewport, e.clientX - rect.left, e.clientY - rect.top);
  },

  /** 结构性变化后的整体重绘。 */
  refresh() {
    // 清理失效选中
    const nodeIds = new Set(flow.nodes.map((n) => n.id));
    const edgeIds = new Set(flow.edges.map((e) => e.id));
    for (const id of [...ctx.selection.nodes]) if (!nodeIds.has(id)) ctx.selection.nodes.delete(id);
    for (const id of [...ctx.selection.edges]) if (!edgeIds.has(id)) ctx.selection.edges.delete(id);
    ctx.renderNodes();
    ctx.renderEdges();
    ctx.applyViewport();
    ctx.saveSoon();
  },
};

// ---------- 持久化（防抖） ----------
let saveTimer = null;
ctx.saveSoon = () => {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flushSave, 300);
};
function flushSave() {
  clearTimeout(saveTimer);
  saveFlow(flow);
  els.saveState.textContent = `已保存 ${new Date().toLocaleTimeString('zh-CN', { hour12: false })}`;
}
window.addEventListener('beforeunload', flushSave);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') flushSave();
});

// ---------- 初始化各模块 ----------
initSelection(ctx);
initInspector(ctx);
initNodes(ctx);
initEdges(ctx);
initViewport(ctx);
initPalette(ctx);

ctx.renderNodes();
ctx.renderEdges();
ctx.applyViewport();
ctx.renderInspector();
els.flowTitle.textContent = flow.name;
flushSave();

// ---------- 顶栏 ----------
document.getElementById('btnBack').addEventListener('click', () => {
  flushSave();
  location.href = 'index.html';
});
els.flowTitle.addEventListener('click', async () => {
  const name = await promptDialog('重命名流程', flow.name, '请输入流程名称');
  if (name && name !== flow.name) {
    flow.name = name;
    els.flowTitle.textContent = name;
    flushSave();
    toast('已重命名', 'success');
  }
});
document.getElementById('btnExport').addEventListener('click', () => {
  flushSave();
  const blob = new Blob([JSON.stringify(flow, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${flow.name || 'flow'}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast('已导出 JSON', 'success');
});
els.btnUndo.addEventListener('click', doUndo);
els.btnRedo.addEventListener('click', doRedo);

function doUndo() {
  if (ctx.history.undo()) toast('已撤销', 'info', 1200);
  ctx.applyViewport();
}
function doRedo() {
  if (ctx.history.redo()) toast('已重做', 'info', 1200);
  ctx.applyViewport();
}

// ---------- 画布空白处：平移 / 框选 / 取消选中 ----------
els.canvasWrap.addEventListener('pointerdown', (e) => {
  if (e.target.closest('.node') || e.target.closest('.port') || e.target.closest('g.edge')) return;
  if (e.target.closest('.zoom-controls') || e.target.closest('button')) return;

  if (e.button === 1 || (e.button === 0 && spaceHeld)) {
    e.preventDefault();
    ctx.startPan(e);
    return;
  }
  if (e.button === 0 && e.shiftKey) {
    ctx.startMarquee(e);
    return;
  }
  if (e.button === 0) {
    ctx.clearSelection();
    ctx.startPan(e);
  }
});

// ---------- 键盘 ----------
let spaceHeld = false;
window.addEventListener('keydown', (e) => {
  const t = e.target;
  if (t.matches?.('input, textarea, select') || t.isContentEditable) {
    if (e.key === 'Escape') t.blur();
    return;
  }
  const mod = e.ctrlKey || e.metaKey;
  const key = e.key.toLowerCase();

  if (e.key === ' ') {
    spaceHeld = true;
    els.canvasWrap.classList.add('space-pan');
    e.preventDefault();
    return;
  }
  if (mod && key === 'z') {
    e.preventDefault();
    e.shiftKey ? doRedo() : doUndo();
  } else if (mod && key === 'y') {
    e.preventDefault();
    doRedo();
  } else if (mod && key === 'c') {
    copySelection();
  } else if (mod && key === 'v') {
    pasteClipboard();
  } else if (mod && key === 'a') {
    e.preventDefault();
    ctx.selectAllNodes();
  } else if (e.key === 'Delete' || e.key === 'Backspace') {
    deleteSelection();
  }
});
window.addEventListener('keyup', (e) => {
  if (e.key === ' ') {
    spaceHeld = false;
    els.canvasWrap.classList.remove('space-pan');
  }
});
window.addEventListener('blur', () => {
  spaceHeld = false;
  els.canvasWrap.classList.remove('space-pan');
});

// ---------- 删除 ----------
function deleteSelection() {
  const nodeIds = new Set(ctx.selection.nodes);
  const edgeIds = new Set(ctx.selection.edges);
  // 级联删除与选中节点相连的边
  for (const e of flow.edges) {
    if (nodeIds.has(e.from.node) || nodeIds.has(e.to.node)) edgeIds.add(e.id);
  }
  if (!nodeIds.size && !edgeIds.size) return;
  ctx.history.exec(commands.removeBatchCmd(ctx, nodeIds, edgeIds));
  ctx.applyViewport();
}

// ---------- 复制粘贴 ----------
let clipboard = null;
let pasteCount = 0;

function copySelection() {
  const ids = ctx.selection.nodes;
  if (!ids.size) return;
  const nodes = flow.nodes.filter((n) => ids.has(n.id)).map((n) => JSON.parse(JSON.stringify(n)));
  const edges = flow.edges
    .filter((e) => ids.has(e.from.node) && ids.has(e.to.node))
    .map((e) => JSON.parse(JSON.stringify(e)));
  clipboard = { nodes, edges };
  pasteCount = 0;
  toast(`已复制 ${nodes.length} 个节点`, 'info', 1200);
}

function pasteClipboard() {
  if (!clipboard || !clipboard.nodes.length) return;
  pasteCount += 1;
  const offset = 28 * pasteCount;
  const idMap = new Map();
  const nodes = clipboard.nodes.map((n) => {
    const copy = JSON.parse(JSON.stringify(n));
    copy.id = uid('n'); // 重新生成 id
    copy.x += offset; // 位置向右下偏移
    copy.y += offset;
    idMap.set(n.id, copy.id);
    return copy;
  });
  const edges = clipboard.edges
    .filter((e) => idMap.has(e.from.node) && idMap.has(e.to.node))
    .map((e) => ({
      id: uid('e'),
      from: { node: idMap.get(e.from.node), port: e.from.port },
      to: { node: idMap.get(e.to.node), port: e.to.port },
    }));

  ctx.history.exec(commands.addBatchCmd(ctx, nodes, edges));
  ctx.selection.nodes = new Set(nodes.map((n) => n.id));
  ctx.selection.edges.clear();
  ctx.renderSelection();
  ctx.applyViewport();
}
