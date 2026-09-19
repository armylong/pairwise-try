// 顶部栏：返回 / 标题 / 撤销重做 / 模式切换 / 导出
import { icon } from '../icons.js';

export class Topbar {
  constructor(element, handlers) {
    this.el = element;
    this.handlers = handlers;
    this.el.innerHTML = `
      <div class="nfe-topbar-left">
        <a class="nfe-btn nfe-btn-ghost nfe-back" href="list.html" title="返回流程列表">← 列表</a>
        <span class="nfe-flow-name" title="流程名称"></span>
      </div>
      <div class="nfe-topbar-right">
        <div class="nfe-mode-switch" title="画布交互模式（或按住空格平移 / Shift 框选）">
          <button class="nfe-mode-btn" data-mode="pan">${icon('hand', 15)}<span>平移</span></button>
          <button class="nfe-mode-btn" data-mode="select">${icon('select', 15)}<span>框选</span></button>
        </div>
        <button class="nfe-icon-btn" data-action="undo" title="撤销 (Ctrl+Z)">↶</button>
        <button class="nfe-icon-btn" data-action="redo" title="重做 (Ctrl+Shift+Z)">↷</button>
        <button class="nfe-btn nfe-btn-primary nfe-export" data-action="export">导出 JSON</button>
      </div>
    `;
    this.nameEl = this.el.querySelector('.nfe-flow-name');
    this.undoBtn = this.el.querySelector('[data-action="undo"]');
    this.redoBtn = this.el.querySelector('[data-action="redo"]');

    this.el.addEventListener('click', (event) => {
      const actionEl = event.target.closest('[data-action]');
      const modeEl = event.target.closest('[data-mode]');
      if (actionEl) this.handlers.onAction(actionEl.dataset.action);
      if (modeEl) this.handlers.onModeChange(modeEl.dataset.mode);
    });
  }

  setName(name) {
    this.nameEl.textContent = name;
  }

  setMode(mode) {
    for (const btn of this.el.querySelectorAll('.nfe-mode-btn')) {
      btn.classList.toggle('nfe-active', btn.dataset.mode === mode);
    }
  }

  setHistoryState(canUndo, canRedo) {
    this.undoBtn.disabled = !canUndo;
    this.redoBtn.disabled = !canRedo;
  }
}
