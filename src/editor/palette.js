import { NODE_TYPES, createNode } from '../core/model.js';

/** 左侧节点面板：拖拽入画布创建节点。 */
export function initPalette(ctx) {
  const { palette, canvasWrap } = ctx.els;

  const title = document.createElement('h3');
  title.textContent = '节点';
  palette.appendChild(title);

  for (const [type, def] of Object.entries(NODE_TYPES)) {
    const item = document.createElement('div');
    item.className = 'palette-item';
    item.draggable = true;
    item.style.setProperty('--node-color', def.color);
    item.innerHTML = `
      <span class="p-icon">${def.icon}</span>
      <span class="p-name">${def.label}</span>
      <span class="p-ports">${def.inputs}进${def.outputs}出</span>`;
    item.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('application/x-flow-node', type);
      e.dataTransfer.effectAllowed = 'copy';
    });
    palette.appendChild(item);
  }

  const hint = document.createElement('div');
  hint.className = 'palette-hint';
  hint.innerHTML = `
    拖拽节点到画布创建<br/>
    <kbd>Delete</kbd> 删除选中<br/>
    <kbd>Ctrl+C</kbd> / <kbd>Ctrl+V</kbd> 复制粘贴<br/>
    <kbd>Ctrl+Z</kbd> / <kbd>Ctrl+Shift+Z</kbd> 撤销重做<br/>
    <kbd>Ctrl+A</kbd> 全选节点`;
  palette.appendChild(hint);

  canvasWrap.addEventListener('dragover', (e) => {
    if (e.dataTransfer.types.includes('application/x-flow-node')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  });

  canvasWrap.addEventListener('drop', (e) => {
    const type = e.dataTransfer.getData('application/x-flow-node');
    if (!type || !NODE_TYPES[type]) return;
    e.preventDefault();
    const w = ctx.worldFromEvent(e);
    const node = createNode(type, w.x - 88, w.y - 32);
    ctx.history.exec(ctx.commands.addNodeCmd(ctx, node));
    ctx.selectOnlyNode(node.id);
    ctx.applyViewport();
  });
}
