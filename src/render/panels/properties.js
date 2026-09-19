// 右侧属性面板：按节点类型动态渲染字段；输入实时上屏，失焦/回车记一次历史
import { getNodeType } from '../../core/node-types.js';

export class PropertiesPanel {
  constructor(element, deps) {
    this.el = element;
    this.graph = deps.graph;
    this.selection = deps.selection;
    this.onLivePatch = deps.onLivePatch; // (nodeId, patch) => void
    this.onCommit = deps.onCommit; // (nodeId, before, after) => void
    this.activeBefore = null;
    this.activeNodeId = null;
  }

  refresh() {
    const sel = this.selection;
    if (sel.kind === 'nodes' && sel.nodeIds.size === 1) {
      const node = this.graph.getNode(Array.from(sel.nodeIds)[0]);
      if (node) {
        this._renderNode(node);
        return;
      }
    }
    if (sel.kind === 'nodes' && sel.nodeIds.size > 1) {
      this._renderMulti(sel.nodeIds.size);
      return;
    }
    if (sel.kind === 'edge') {
      this._renderEdge();
      return;
    }
    this._renderEmpty();
  }

  _renderEmpty() {
    this.el.innerHTML = `
      <div class="nfe-panel-title">属性</div>
      <div class="nfe-props-empty">
        <p>未选中任何元素</p>
        <span>单击节点查看并编辑参数<br>单击连线可选中删除</span>
      </div>`;
  }

  _renderMulti(count) {
    this.el.innerHTML = `
      <div class="nfe-panel-title">属性</div>
      <div class="nfe-props-empty">
        <p>已选中 ${count} 个节点</p>
        <span>可整体拖动或按 Delete 删除</span>
      </div>`;
  }

  _renderEdge() {
    const edge = this.graph.getEdge(this.selection.edgeId);
    this.el.innerHTML = `
      <div class="nfe-panel-title">属性</div>
      <div class="nfe-props-empty">
        <p>连线</p>
        <span>按 Delete 删除该连线</span>
      </div>`;
    if (!edge) return;
  }

  _renderNode(node) {
    const def = getNodeType(node.type);
    this.activeNodeId = node.id;
    this.el.innerHTML = `
      <div class="nfe-panel-title">属性</div>
      <div class="nfe-props-type" style="color:${def.color}">${def.label}</div>
      <label class="nfe-field">
        <span class="nfe-field-label">节点名称</span>
        <input class="nfe-input" data-key="name" />
      </label>
      <div class="nfe-props-fields"></div>
    `;

    const nameInput = this.el.querySelector('[data-key="name"]');
    nameInput.value = node.name;
    this._wireField(nameInput, () => ({ name: nameInput.value }));

    const fieldsEl = this.el.querySelector('.nfe-props-fields');
    for (const field of def.fields) {
      fieldsEl.appendChild(this._renderField(node, field));
    }
  }

  _renderField(node, field) {
    const wrap = document.createElement('label');
    wrap.className = 'nfe-field';
    const label = document.createElement('span');
    label.className = 'nfe-field-label';
    label.textContent = field.label;
    wrap.appendChild(label);

    if (field.type === 'conditionList') {
      wrap.appendChild(this._renderConditionList(node, field));
      return wrap;
    }

    let input;
    if (field.type === 'textarea') {
      input = document.createElement('textarea');
      input.className = 'nfe-input nfe-textarea';
      input.rows = 3;
      input.placeholder = field.placeholder || '';
    } else if (field.type === 'select') {
      input = document.createElement('select');
      input.className = 'nfe-input nfe-select';
      for (const option of field.options) {
        const opt = document.createElement('option');
        opt.value = option;
        opt.textContent = option;
        input.appendChild(opt);
      }
    } else {
      input = document.createElement('input');
      input.className = 'nfe-input';
      input.type = field.type === 'number' ? 'number' : 'text';
      input.placeholder = field.placeholder || '';
    }

    input.value = node.params[field.key] ?? '';
    this._wireField(input, () => ({ params: { ...this._currentNode().params, [field.key]: input.value } }));
    wrap.appendChild(input);
    return wrap;
  }

  _renderConditionList(node, field) {
    const container = document.createElement('div');
    container.className = 'nfe-conditions';
    for (const branch of field.branches) {
      const row = document.createElement('div');
      row.className = 'nfe-condition-row';
      const head = document.createElement('div');
      head.className = 'nfe-condition-head';
      const dot = document.createElement('span');
      dot.className = 'nfe-condition-dot';
      const title = document.createElement('span');
      title.textContent = `出口「${branch.label}」`;
      head.appendChild(dot);
      head.appendChild(title);

      const labelInput = document.createElement('input');
      labelInput.className = 'nfe-input nfe-condition-label-input';
      labelInput.placeholder = '出口名称';
      labelInput.value = node.params.branches[branch.port]?.label ?? branch.label;

      const exprInput = document.createElement('textarea');
      exprInput.className = 'nfe-input nfe-textarea';
      exprInput.rows = 2;
      exprInput.placeholder = branch.placeholder;
      exprInput.value = node.params.branches[branch.port]?.expr ?? '';

      const buildParams = () => ({
        params: {
          ...this._currentNode().params,
          branches: {
            ...this._currentNode().params.branches,
            [branch.port]: {
              label: labelInput.value,
              expr: exprInput.value,
            },
          },
        },
      });

      this._wireField(labelInput, buildParams);
      this._wireField(exprInput, buildParams);

      row.appendChild(head);
      row.appendChild(labelInput);
      row.appendChild(exprInput);
      container.appendChild(row);
    }
    return container;
  }

  _currentNode() {
    return this.graph.getNode(this.activeNodeId);
  }

  // 实时 patch（不入栈）；失焦/change 时与 focus 前快照对比，入一条历史
  _wireField(input, buildPatch) {
    const beginEdit = () => {
      const node = this._currentNode();
      if (!node) return;
      this.activeBefore = JSON.parse(JSON.stringify({ name: node.name, params: node.params }));
    };
    const livePatch = () => {
      const node = this._currentNode();
      if (!node) return;
      this.onLivePatch(node.id, buildPatch());
    };
    const commit = () => {
      const node = this._currentNode();
      if (!node || !this.activeBefore) return;
      const after = JSON.parse(JSON.stringify({ name: node.name, params: node.params }));
      if (JSON.stringify(after) !== JSON.stringify(this.activeBefore)) {
        this.onCommit(node.id, this.activeBefore, after);
      }
      this.activeBefore = null;
    };

    input.addEventListener('focus', beginEdit);
    input.addEventListener('input', livePatch);
    input.addEventListener('change', () => {
      livePatch();
      commit();
    });
    input.addEventListener('blur', commit);
  }
}
