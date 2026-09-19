// 编辑页装配：组合纯逻辑 / 渲染 / 交互，负责持久化与导出
import { FlowRepository } from '../core/repository.js';
import { Graph } from '../core/graph.js';
import { createNode } from '../core/graph.js';
import { History } from '../core/history.js';
import { HISTORY_LIMIT, NODE_WIDTH } from '../core/constants.js';
import { Selection } from '../core/selection.js';
import { Viewport } from '../render/viewport.js';
import { Renderer } from '../render/renderer.js';
import { Palette } from '../render/panels/palette.js';
import { PropertiesPanel } from '../render/panels/properties.js';
import { Topbar } from '../render/panels/topbar.js';
import { ZoomWidget } from '../render/panels/zoom-widget.js';
import { Marquee } from '../render/panels/marquee.js';
import { PointerController } from '../interaction/pointer.js';
import { KeyboardController, buildAddNodeAt } from '../interaction/keyboard.js';
import { WheelController } from '../interaction/wheel.js';
import { addNodeCommand, updateNodeCommand } from '../core/commands.js';
import { downloadJson } from '../core/utils.js';
import { sanitizeGraph, sanitizeViewport } from '../core/validate.js';
import { toastInfo } from '../render/panels/toast.js';

const repo = new FlowRepository();

function getFlowId() {
  const params = new URLSearchParams(window.location.search);
  return params.get('id');
}

function boot() {
  const flowId = getFlowId();
  let flow = flowId ? repo.get(flowId) : null;
  if (!flow) {
    // 非法 / 缺失 id：兜底新建一条，避免白屏
    flow = repo.create('未命名流程');
    const url = new URL(window.location.href);
    url.searchParams.set('id', flow.id);
    window.history.replaceState(null, '', url);
  }

  const graph = Graph.fromJSON(sanitizeGraph(flow.graph));
  const history = new History(HISTORY_LIMIT);
  const selection = new Selection();

  // ---- DOM 引用 ----
  const topbarEl = document.querySelector('.nfe-topbar');
  const paletteEl = document.querySelector('.nfe-palette');
  const propertiesEl = document.querySelector('.nfe-properties');
  const canvasEl = document.querySelector('.nfe-canvas');
  const gridEl = document.querySelector('.nfe-grid');
  const worldEl = document.querySelector('.nfe-world');
  const edgeLayerEl = document.querySelector('.nfe-edge-layer');
  const guidesLayerEl = document.querySelector('.nfe-guide-layer');
  const nodeLayerEl = document.querySelector('.nfe-node-layer');
  const marqueeEl = document.querySelector('.nfe-marquee');
  const zoomEl = document.querySelector('.nfe-zoom');
  const emptyHintEl = document.querySelector('.nfe-empty-hint');

  const viewport = new Viewport(worldEl, gridEl, sanitizeViewport(flow.viewport));
  const renderer = new Renderer({
    worldEl,
    edgeLayerEl,
    nodeLayerEl,
    guidesEl: guidesLayerEl,
    graph,
    selection,
  });
  renderer.syncStructure();

  const marquee = new Marquee(marqueeEl);

  let saveTimer = 0;
  const scheduleSave = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(persist, 300);
  };

  function persist() {
    repo.update(flow.id, {
      name: flow.name,
      graph: sanitizeGraph(graph.toJSON()),
      viewport: viewport.toJSON(),
    });
  }

  function updateEmptyHint() {
    emptyHintEl.classList.toggle('nfe-hidden', graph.nodes.size > 0);
  }

  function refreshContext() {
    renderer.syncStructure();
    renderer.applySelection();
    properties.refresh();
    zoomWidget.update();
    topbar.setHistoryState(history.canUndo(), history.canRedo());
    updateEmptyHint();
    scheduleSave();
  }

  const topbar = new Topbar(topbarEl, {
    onAction(action) {
      if (action === 'undo') {
        if (history.undo(graph)) afterHistory();
      } else if (action === 'redo') {
        if (history.redo(graph)) afterHistory();
      } else if (action === 'export') {
        const payload = {
          name: flow.name,
          version: 1,
          exportedAt: new Date().toISOString(),
          graph: sanitizeGraph(graph.toJSON()),
        };
        downloadJson(`${flow.name || 'workflow'}.json`, payload);
        toastInfo('已导出 JSON 文件', 'success');
      }
    },
    onModeChange(mode) {
      pointer.setMode(mode);
      topbar.setMode(mode);
    },
  });
  topbar.setName(flow.name);
  topbar.setMode('pan');

  const zoomWidget = new ZoomWidget(zoomEl, viewport, () => {
    viewport.reset();
    zoomWidget.update();
    scheduleSave();
  });
  zoomWidget.update();

  const pointer = new PointerController({
    canvas: canvasEl,
    viewport,
    graph,
    selection,
    renderer,
    marquee,
    history,
    onSelectionChange: () => {
      renderer.applySelection();
      properties.refresh();
    },
    onAfterCommand: () => refreshContext(),
  });

  const properties = new PropertiesPanel(propertiesEl, {
    graph,
    selection,
    onLivePatch(nodeId, patch) {
      graph.updateNode(nodeId, patch);
      renderer.refreshNodeContent([nodeId]);
      // 实时更新，但不立即保存/入栈
    },
    onCommit(nodeId, before, after) {
      history.execute(updateNodeCommand(nodeId, before, after), graph);
      refreshContext();
    },
  });
  properties.refresh();

  // eslint-disable-next-line no-new
  new KeyboardController({
    graph,
    history,
    selection,
    pointer,
    renderer,
    onAfterCommand: () => refreshContext(),
    onSelectionChange: () => {
      renderer.applySelection();
      properties.refresh();
    },
  });

  // eslint-disable-next-line no-new
  new WheelController(canvasEl, viewport, () => {
    zoomWidget.update();
    scheduleSave();
  });

  let clickAddCounter = 0;
  // eslint-disable-next-line no-new
  new Palette(paletteEl, {
    onAddType(type, worldPoint) {
      let world;
      if (worldPoint) {
        world = worldPoint;
      } else {
        const rect = canvasEl.getBoundingClientRect();
        const stagger = clickAddCounter * 90;
        clickAddCounter += 1;
        world = viewport.toWorld({
          x: rect.width / 2 - NODE_WIDTH / 2 + stagger,
          y: rect.height / 2 - 40 + stagger,
        });
      }
      const { command, node } = buildAddNodeAt(type, world);
      history.execute(command, graph);
      selection.selectNodes([node.id]);
      refreshContext();
    },
  });

  function afterHistory() {
    selection.prune(graph.nodes, graph.edges);
    refreshContext();
  }

  // ---- 面板拖拽到画布（HTML5 DnD） ----
  canvasEl.addEventListener('dragover', (event) => {
    if (event.dataTransfer.types.includes('application/x-nfe-node')) {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
      canvasEl.classList.add('nfe-drop-active');
    }
  });
  canvasEl.addEventListener('dragleave', (event) => {
    if (event.target === canvasEl) canvasEl.classList.remove('nfe-drop-active');
  });
  canvasEl.addEventListener('drop', (event) => {
    event.preventDefault();
    canvasEl.classList.remove('nfe-drop-active');
    const type = event.dataTransfer.getData('application/x-nfe-node');
    if (!type) return;
    const rect = canvasEl.getBoundingClientRect();
    const local = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    const world = viewport.toWorld(local);
    const node = createNode(type, Math.round(world.x - NODE_WIDTH / 2), Math.round(world.y - 40));
    history.execute(addNodeCommand(node), graph);
    selection.selectNodes([node.id]);
    refreshContext();
  });

  // 平移结束后保存视图
  let pendingViewportSave = false;
  canvasEl.addEventListener('pointerup', () => {
    if (pointer.session === null) {
      scheduleSave();
    }
  });

  // 双击节点名可快速重命名（额外的小便利）
  nodeLayerEl.addEventListener('dblclick', (event) => {
    const nodeEl = event.target.closest('.nfe-node');
    if (!nodeEl) return;
    const node = graph.getNode(nodeEl.dataset.nodeId);
    selection.selectNodes([node.id]);
    renderer.applySelection();
    properties.refresh();
    const input = propertiesEl.querySelector('[data-key="name"]');
    if (input) {
      input.focus();
      input.select();
    }
  });

  window.addEventListener('beforeunload', () => {
    clearTimeout(saveTimer);
    persist();
  });

  updateEmptyHint();

  // 暴露给自动化冒烟测试的只读调试句柄（不影响产品功能）
  window.__nfe = { graph, history, selection, renderer, viewport };
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
