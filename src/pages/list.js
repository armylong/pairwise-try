// 流程列表页
import { FlowRepository } from '../core/repository.js';
import { timeAgo } from '../core/utils.js';
import { promptModal, confirmModal } from '../render/panels/modal.js';
import { toastSuccess, toastError } from '../render/panels/toast.js';

const repo = new FlowRepository();

const gridEl = document.querySelector('.nfe-flow-grid');
const emptyEl = document.querySelector('.nfe-list-empty');

function render() {
  const flows = repo.list();
  gridEl.innerHTML = '';
  emptyEl.classList.toggle('nfe-hidden', flows.length > 0);

  for (const flow of flows) {
    const card = document.createElement('div');
    card.className = 'nfe-flow-card';
    card.innerHTML = `
      <div class="nfe-flow-card-main">
        <div class="nfe-flow-card-title"></div>
        <div class="nfe-flow-card-meta">
          <span class="nfe-flow-count">${flow.nodeCount} 个节点</span>
          <span class="nfe-flow-dot">·</span>
          <span title="最后编辑时间">最后编辑 ${timeAgo(flow.updatedAt)}</span>
        </div>
      </div>
      <div class="nfe-flow-actions">
        <button class="nfe-btn nfe-btn-ghost nfe-flow-rename">重命名</button>
        <button class="nfe-btn nfe-btn-ghost nfe-flow-duplicate">复制</button>
        <button class="nfe-btn nfe-btn-danger-ghost nfe-flow-delete">删除</button>
      </div>
    `;
    card.querySelector('.nfe-flow-card-title').textContent = flow.name;
    card.addEventListener('click', (event) => {
      if (event.target.closest('.nfe-flow-actions')) return;
      window.location.href = `editor.html?id=${encodeURIComponent(flow.id)}`;
    });
    card.querySelector('.nfe-flow-rename').addEventListener('click', async (event) => {
      event.stopPropagation();
      const name = await promptModal({
        title: '重命名流程',
        initialValue: flow.name,
        placeholder: '输入流程名称',
        okText: '保存',
      });
      if (name && name.trim()) {
        repo.rename(flow.id, name);
        render();
        toastSuccess('已重命名');
      }
    });
    card.querySelector('.nfe-flow-duplicate').addEventListener('click', (event) => {
      event.stopPropagation();
      const copy = repo.duplicate(flow.id);
      if (copy) {
        render();
        toastSuccess('已复制流程');
      }
    });
    card.querySelector('.nfe-flow-delete').addEventListener('click', async (event) => {
      event.stopPropagation();
      const ok = await confirmModal({
        title: '删除流程',
        message: `确定删除「${flow.name}」吗？此操作不可恢复。`,
      });
      if (ok) {
        repo.remove(flow.id);
        render();
        toastSuccess('已删除');
      }
    });
    gridEl.appendChild(card);
  }
}

document.querySelector('.nfe-new-flow').addEventListener('click', async () => {
  const name = await promptModal({
    title: '新建流程',
    initialValue: '',
    placeholder: '例如：每日对账通知',
    okText: '创建',
  });
  const flow = repo.create(name || '未命名流程');
  window.location.href = `editor.html?id=${encodeURIComponent(flow.id)}`;
});

render();
