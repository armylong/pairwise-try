// 全局键盘：撤销重做 / 删除 / 复制粘贴 / 全选 / 空格平移
import {
  removeEdgeCommand,
  removeSelectionCommand,
  pasteCommand,
  addNodeCommand,
} from '../core/commands.js';
import { createNode } from '../core/graph.js';
import { copySubgraph, remapForPaste } from '../core/clipboard.js';
import { SELECTION_KIND } from '../core/selection.js';
import { toastInfo } from '../render/panels/toast.js';

function isEditableTarget(event) {
  const el = event.target;
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

export class KeyboardController {
  constructor(deps) {
    this.graph = deps.graph;
    this.history = deps.history;
    this.selection = deps.selection;
    this.pointer = deps.pointer;
    this.renderer = deps.renderer;
    this.clipboardBuffer = null;
    this.onAfterCommand = deps.onAfterCommand;
    this.onSelectionChange = deps.onSelectionChange;
    this._bind();
  }

  _bind() {
    window.addEventListener('keydown', (event) => this._onKeyDown(event));
    window.addEventListener('keyup', (event) => {
      if (event.code === 'Space') this.pointer.setSpace(false);
    });
  }

  _onKeyDown(event) {
    if (event.code === 'Space' && !isEditableTarget(event) && !this.pointer.spacePressed) {
      this.pointer.setSpace(true);
      event.preventDefault();
      return;
    }

    if (isEditableTarget(event)) return;

    const ctrl = event.ctrlKey || event.metaKey;

    if (ctrl && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      const did = event.shiftKey ? this.history.redo(this.graph) : this.history.undo(this.graph);
      if (did) this._afterHistory();
      return;
    }
    if (ctrl && event.key.toLowerCase() === 'y') {
      event.preventDefault();
      if (this.history.redo(this.graph)) this._afterHistory();
      return;
    }

    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      this._deleteSelection();
      return;
    }

    if (ctrl && event.key.toLowerCase() === 'c') {
      this._copy();
      return;
    }
    if (ctrl && event.key.toLowerCase() === 'v') {
      event.preventDefault();
      this._paste();
      return;
    }
    if (ctrl && event.key.toLowerCase() === 'a') {
      event.preventDefault();
      this.selection.selectNodes(Array.from(this.graph.nodes.keys()));
      this.onSelectionChange();
    }
  }

  _deleteSelection() {
    if (this.selection.kind === SELECTION_KIND.EDGE) {
      const edgeId = this.selection.edgeId;
      this.selection.clear();
      this.history.execute(removeEdgeCommand(edgeId), this.graph);
      this._afterHistory();
    } else if (this.selection.kind === SELECTION_KIND.NODES) {
      const nodeIds = Array.from(this.selection.nodeIds);
      this.selection.clear();
      this.history.execute(removeSelectionCommand(nodeIds, []), this.graph);
      this._afterHistory();
    }
  }

  _copy() {
    if (this.selection.kind !== SELECTION_KIND.NODES) return;
    this.clipboardBuffer = copySubgraph(this.graph, Array.from(this.selection.nodeIds));
    toastInfo(`已复制 ${this.clipboardBuffer.nodes.length} 个节点`, 'info', 1200);
  }

  _paste() {
    if (!this.clipboardBuffer || !this.clipboardBuffer.nodes.length) return;
    const remapped = remapForPaste(this.clipboardBuffer);
    this.history.execute(pasteCommand(remapped.nodes, remapped.edges), this.graph);
    this.selection.selectNodes(remapped.nodes.map((node) => node.id));
    this._afterHistory();
  }

  _afterHistory() {
    this.selection.prune(this.graph.nodes, this.graph.edges);
    this.onAfterCommand();
  }
}

// 供“点击面板添加”使用的便捷工厂命令
export function buildAddNodeAt(type, worldPoint) {
  const node = createNode(type, Math.round(worldPoint.x - 92), Math.round(worldPoint.y - 40));
  return { command: addNodeCommand(node), node };
}
