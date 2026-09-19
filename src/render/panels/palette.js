// 左侧节点类型面板：拖拽（HTML5 DnD）或点击添加
import { NODE_TYPES, PALETTE_ORDER } from '../../core/node-types.js';
import { icon } from '../icons.js';

export class Palette {
  constructor(element, { onAddType }) {
    this.el = element;
    this.onAddType = onAddType;
    this._render();
  }

  _render() {
    this.el.innerHTML = `
      <div class="nfe-panel-title">节点库</div>
      <div class="nfe-palette-list"></div>
      <div class="nfe-panel-hint">拖到画布创建节点<br>也可以点击直接添加</div>
    `;
    const list = this.el.querySelector('.nfe-palette-list');
    for (const type of PALETTE_ORDER) {
      const def = NODE_TYPES[type];
      const item = document.createElement('div');
      item.className = 'nfe-palette-item';
      item.draggable = true;
      item.dataset.type = type;
      item.innerHTML = `
        <span class="nfe-palette-icon" style="color:${def.color}">${icon(def.icon, 18)}</span>
        <span class="nfe-palette-text">
          <span class="nfe-palette-name">${def.paletteLabel}</span>
          <span class="nfe-palette-hint">${def.hint}</span>
        </span>
      `;
      item.addEventListener('dragstart', (event) => {
        event.dataTransfer.setData('application/x-nfe-node', type);
        event.dataTransfer.effectAllowed = 'copy';
        item.classList.add('nfe-dragging');
      });
      item.addEventListener('dragend', () => item.classList.remove('nfe-dragging'));
      item.addEventListener('click', () => this.onAddType(type, null));
      list.appendChild(item);
    }
  }
}
