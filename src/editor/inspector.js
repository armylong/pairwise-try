import { NODE_TYPES, getNode } from '../core/model.js';

/** 右侧属性面板：编辑选中节点的名称与参数，实时同步画布，失焦提交撤销步。 */
export function initInspector(ctx) {
  const { inspector } = ctx.els;

  function renderInspector() {
    inspector.innerHTML = '';
    const { nodes, edges } = ctx.selection;

    if (nodes.size === 1) return renderNodeForm([...nodes][0]);
    if (nodes.size > 1) return renderHint(`已选中 ${nodes.size} 个节点`, '可整体拖动、批量删除（Delete）或复制粘贴。');
    if (edges.size > 0) return renderEdgeInfo([...edges]);
    return renderHint('未选中任何元素', '单击节点或连线进行编辑；从左侧拖入新节点。');
  }
  ctx.renderInspector = renderInspector;

  function renderHint(title, sub) {
    inspector.innerHTML = `<h3>属性</h3><div class="insp-empty">${title}<br/><small>${sub}</small></div>`;
  }

  function renderEdgeInfo(edgeIds) {
    const h = document.createElement('h3');
    h.textContent = '连线';
    inspector.appendChild(h);
    const box = document.createElement('div');
    box.className = 'insp-empty';
    const names = edgeIds.map((id) => {
      const e = ctx.flow.edges.find((x) => x.id === id);
      if (!e) return '';
      const from = getNode(ctx.flow, e.from.node);
      const to = getNode(ctx.flow, e.to.node);
      const fromLabel = NODE_TYPES[from.type].outputLabels[e.from.port] || '输出';
      return `${from.name}（${fromLabel}）→ ${to.name}`;
    });
    box.innerHTML = names.map(esc).join('<br/>') + '<br/><small>按 Delete 删除选中连线</small>';
    inspector.appendChild(box);
  }

  function renderNodeForm(nodeId) {
    const node = getNode(ctx.flow, nodeId);
    if (!node) return renderHint('未选中任何元素', '');
    const def = NODE_TYPES[node.type];

    const h = document.createElement('h3');
    h.textContent = '节点属性';
    inspector.appendChild(h);

    const tag = document.createElement('div');
    tag.className = 'insp-node-type';
    tag.style.setProperty('--node-color', def.color);
    tag.textContent = `${def.icon} ${def.label}`;
    inspector.appendChild(tag);

    addField('名称', node.name, (v) => commitProps(node, { name: v || def.label }), (v) => {
      node.name = v;
      ctx.updateNodeSummary(node);
    });

    for (const p of def.params) {
      addParamField(node, p);
    }
  }

  function addParamField(node, p) {
    const key = p.key;
    const commit = (v) => commitProps(node, { params: { ...node.params, [key]: v } });
    const live = (v) => {
      node.params[key] = v;
      ctx.updateNodeSummary(node);
    };
    if (p.type === 'select') {
      addSelectField(p.label, p.options, node.params[key], commit, live);
    } else if (p.type === 'textarea') {
      addField(p.label, node.params[key], commit, live, 'textarea');
    } else {
      addField(p.label, node.params[key], commit, live);
    }
  }

  /** 提交一步可撤销的属性修改（live 阶段已改过模型，这里对比快照入栈）。 */
  function commitProps(node, afterProps) {
    const before = {};
    const after = {};
    if (afterProps.name !== undefined) {
      // live 阶段 node.name 已是新值，快照在 focus 时记录
      before.name = focusSnapshot?.name ?? node.name;
      after.name = afterProps.name;
    }
    if (afterProps.params !== undefined) {
      before.params = focusSnapshot?.params ?? node.params;
      after.params = afterProps.params;
    }
    // 提交时把最终值（如 trim 后）写回模型
    if (afterProps.name !== undefined) node.name = afterProps.name;
    if (afterProps.params !== undefined) node.params = { ...afterProps.params };
    ctx.updateNodeSummary(node);
    if (JSON.stringify(before) === JSON.stringify(after)) return;
    ctx.history.pushApplied(ctx.commands.setNodePropsCmd(ctx, node.id, before, after));
    ctx.applyViewport();
    ctx.saveSoon();
  }

  // focus 时的快照，用于撤销恢复
  let focusSnapshot = null;

  function wrapField(labelText, input) {
    const wrap = document.createElement('div');
    wrap.className = 'field';
    const label = document.createElement('label');
    label.textContent = labelText;
    wrap.append(label, input);
    inspector.appendChild(wrap);
    return input;
  }

  function snapshot(node) {
    return { name: node.name, params: { ...node.params } };
  }

  function addField(labelText, value, commit, live, tag = 'input') {
    const node = currentNode();
    const input = document.createElement(tag === 'textarea' ? 'textarea' : 'input');
    if (tag !== 'textarea') input.type = 'text';
    input.value = value ?? '';
    input.addEventListener('focus', () => (focusSnapshot = snapshot(node)));
    input.addEventListener('input', () => {
      live(input.value);
      ctx.saveSoon();
    });
    input.addEventListener('change', () => commit(input.value.trim ? input.value.trim() : input.value));
    wrapField(labelText, input);
  }

  function addSelectField(labelText, options, value, commit, live) {
    const node = currentNode();
    const select = document.createElement('select');
    for (const opt of options) {
      const o = document.createElement('option');
      o.value = opt;
      o.textContent = opt;
      select.appendChild(o);
    }
    select.value = value ?? options[0];
    select.addEventListener('focus', () => (focusSnapshot = snapshot(node)));
    select.addEventListener('change', () => {
      live(select.value);
      commit(select.value);
    });
    wrapField(labelText, select);
  }

  function currentNode() {
    return getNode(ctx.flow, [...ctx.selection.nodes][0]);
  }
}

function esc(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}
