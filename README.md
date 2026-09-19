# 自动化流程编辑器（纯前端原型）

运营自助配置自动化流程的节点编辑器原型：流程列表 + 画布编辑两页，数据全部存
`sessionStorage`，无框架、无第三方库，ES Modules 按生产级目录拆分。

## 运行

ES Modules 不能用 `file://` 直接打开，需要起一个静态服务器：

```bash
# 任选其一
python3 -m http.server 8080
npx serve .
```

然后访问 <http://localhost:8080/list.html>。

## 目录结构

```
list.html / editor.html       两个页面入口
src/
  core/                       纯逻辑层（无 DOM、无渲染）
    constants.js              全局常量
    node-types.js             节点类型注册表（端口/字段/默认参数）
    geometry.js               坐标换算、贝塞尔控制点、对齐吸附、命中判定
    graph.js                  图模型：增删改查、重复边/自环/环校验
    commands.js               命令对象（do/undo）
    history.js                撤销重做栈（上限 80）
    selection.js              节点/连线/空白三态选区
    clipboard.js              复制子图、粘贴 id 重映射
    validate.js               坏数据兜底（sanitize，不抛异常）
    repository.js             sessionStorage 仓库（流程 CRUD）
    utils.js                  uid、时间、下载等
  render/
    renderer.js               节点 DOM + 边 SVG 的 diff 渲染
    viewport.js               缩放/平移变换 + 网格联动
    icons.js                  内联 SVG 图标
    panels/                   顶栏、节点库、属性面板、缩放、toast、modal、框选
  interaction/
    pointer.js                指针状态机：平移/拖拽/拉线/框选/点选
    keyboard.js               快捷键、复制粘贴、删除、撤销重做
    wheel.js                  滚轮缩放（鼠标锚点不动）
  pages/
    list.js                   列表页装配
    editor.js                 编辑页装配（持久化/导出）
styles/                       深色主题样式
tests/                        纯逻辑单元测试（node tests/run-tests.js）
```

## 交互速查

- 滚轮缩放（0.25–4，鼠标指向的点不动）；拖画布空白或按住空格平移；`Shift+拖空白` 或顶栏切「框选」模式做框选
- 左侧节点拖入画布（或点击添加）；从节点右侧输出口拉线到另一节点左侧输入口
- `Ctrl/⌘ + C/V` 复制粘贴（新 id、右下偏移）；`Delete` 删除选中；`Ctrl+Z` / `Ctrl+Shift+Z` 撤销重做
- 拖动节点时边缘/中心线自动吸附并显示虚线辅助线
- 右侧面板编辑名称与参数；条件分支的两个出口可各自配名称与表达式
- 顶栏「导出 JSON」下载当前流程；缩放比例与平移随流程一起保存
