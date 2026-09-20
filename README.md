# 自动化流程配置原型

纯前端可视化流程编排原型（类 n8n 交互），原生 HTML/CSS/JS，零依赖、零构建，数据保存在 sessionStorage。

## 运行

静态文件直接起个服务即可（ES Modules 需要 http 协议）：

```bash
python3 -m http.server 8000
# 打开 http://localhost:8000
```

## 功能

- **列表页** `index.html`：新建 / 重命名 / 复制 / 删除流程，展示节点数与最后编辑时间
- **编辑页** `editor.html?id=xxx`：
  - 画布：滚轮以鼠标为锚点缩放（0.25–4 倍）、拖空白 / 空格+拖 / 中键平移、网格随视口变换、左下角缩放百分比与复位
  - 节点：触发器 / 动作 / 条件分支（双出口）/ 合并（双入口）/ 结束（无出口），左侧面板拖入创建
  - 连线：端口拖拽连线，三次贝塞尔曲线，自环 / 重复边 / 成环均拦截并 toast 提示
  - 选中：单击、Shift+拖框选、多选整体拖动与批量删除，节点 / 连线 / 空白三态互斥
  - 对齐吸附：拖动时与邻近节点边缘 / 中心线吸附，显示虚线辅助线
  - 撤销重做：Ctrl+Z / Ctrl+Shift+Z，覆盖增删、移动（松手记一步）、属性修改，栈深 100
  - 属性面板：右侧编辑名称与类型化参数，条件分支可配每个出口的表达式，实时同步画布
  - 持久化：sessionStorage 自动保存（含视口缩放 / 平移），刷新还原，坏数据兜底回列表页，支持导出 JSON

## 快捷键

| 按键 | 功能 |
| --- | --- |
| `Delete` / `Backspace` | 删除选中 |
| `Ctrl/Cmd + C / V` | 复制 / 粘贴（新 id，位置偏移） |
| `Ctrl/Cmd + Z / Shift+Z` | 撤销 / 重做 |
| `Ctrl/Cmd + A` | 全选节点 |
| `Shift + 拖拽` | 框选 |
| `空格 + 拖拽` | 平移画布 |

## 目录结构

```
index.html / editor.html   两个页面
styles/                    基础样式 + 列表页 + 编辑页
src/
  core/                    纯逻辑（无 DOM）
    model.js               节点类型定义、图数据模型、成环检测、数据校验兜底
    store.js               sessionStorage 读写（索引 + 单流程）
    history.js             命令栈（撤销/重做）
    geometry.js            坐标换算、贝塞尔路径、矩形相交、吸附计算
    id.js                  id 生成
  ui/                      toast、模态框
  list/listPage.js         列表页
  editor/                  编辑页（渲染与交互，按职责拆分）
    editorPage.js          编排入口：状态、快捷键、复制粘贴、删除、导出
    viewport.js            缩放/平移/网格
    nodeView.js            节点渲染、拖拽、吸附辅助线
    edgeView.js            连线渲染、连线交互与校验
    selection.js           选中体系与框选
    palette.js             左侧节点面板
    inspector.js           右侧属性面板
    commands.js            可撤销命令工厂
```

流程 JSON 结构见 `src/core/model.js`（`{ id, name, viewport, nodes, edges }`），后续接后端时可直接复用该结构。
