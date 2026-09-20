import { listFlows, createAndSaveFlow, deleteFlow, renameFlow, duplicateFlow } from '../core/store.js';
import { toast } from '../ui/toast.js';
import { confirmDialog, promptDialog } from '../ui/modal.js';

const listEl = document.getElementById('flowList');

if (new URLSearchParams(location.search).get('corrupt')) {
  history.replaceState(null, '', 'index.html');
  setTimeout(() => toast('流程数据缺失或已损坏，无法打开', 'error'), 50);
}

function fmtTime(ts) {
  if (!ts) return '-';
  const d = new Date(ts);
  const diff = Date.now() - ts;
  if (diff < 60_000) return '刚刚';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function render() {
  const flows = listFlows();
  listEl.innerHTML = '';
  if (!flows.length) {
    listEl.innerHTML = `
      <div class="flow-table"><div class="empty-state">
        <div class="icon">🗂️</div>
        <div>还没有流程，点击右上角「新建流程」开始编排</div>
      </div></div>`;
    return;
  }
  const table = document.createElement('div');
  table.className = 'flow-table';
  table.innerHTML = `
    <div class="flow-row flow-row-head">
      <div>名称</div><div>节点数</div><div>最后编辑</div><div style="text-align:right">操作</div>
    </div>`;
  for (const meta of flows) {
    const row = document.createElement('div');
    row.className = 'flow-row';

    const name = document.createElement('div');
    name.className = 'flow-name';
    name.textContent = meta.name;
    name.title = '点击打开，双击重命名';
    name.addEventListener('click', () => openFlow(meta.id));
    name.addEventListener('dblclick', () => doRename(meta.id, meta.name));

    const count = document.createElement('div');
    count.className = 'flow-meta';
    count.textContent = `${meta.nodeCount ?? 0} 个节点`;

    const time = document.createElement('div');
    time.className = 'flow-meta';
    time.textContent = fmtTime(meta.updatedAt);

    const actions = document.createElement('div');
    actions.className = 'flow-actions';
    actions.append(
      makeBtn('打开', () => openFlow(meta.id)),
      makeBtn('重命名', () => doRename(meta.id, meta.name)),
      makeBtn('复制', () => {
        duplicateFlow(meta.id);
        toast('已复制流程', 'success');
        render();
      }),
      makeBtn('删除', async () => {
        const ok = await confirmDialog('删除流程', `确定删除「${meta.name}」吗？该操作不可恢复。`, {
          danger: true,
          okText: '删除',
        });
        if (ok) {
          deleteFlow(meta.id);
          toast('已删除', 'success');
          render();
        }
      }),
    );

    row.append(name, count, time, actions);
    table.appendChild(row);
  }
  listEl.appendChild(table);
}

function makeBtn(text, onClick) {
  const b = document.createElement('button');
  b.className = 'btn btn-ghost';
  b.textContent = text;
  b.addEventListener('click', onClick);
  return b;
}

function openFlow(id) {
  location.href = `editor.html?id=${encodeURIComponent(id)}`;
}

async function doRename(id, oldName) {
  const name = await promptDialog('重命名流程', oldName, '请输入流程名称');
  if (name && name !== oldName) {
    renameFlow(id, name);
    toast('已重命名', 'success');
    render();
  }
}

document.getElementById('btnNew').addEventListener('click', async () => {
  const name = await promptDialog('新建流程', '', '例如：每日数据同步');
  if (!name) return;
  const flow = createAndSaveFlow(name);
  openFlow(flow.id);
});

render();
