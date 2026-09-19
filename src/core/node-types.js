// 节点类型注册表：端口数量、参数字段、默认值、颜色/图标
export const PORT_IN = 'in';
export const PORT_OUT = 'out';

// 端口槽位（一进一出的节点端口 id 即 in / out）
export const INPUT_PORTS = Object.freeze({
  single: ['in'],
  double: ['a', 'b'],
  none: [],
});
export const OUTPUT_PORTS = Object.freeze({
  single: ['out'],
  double: ['true', 'false'],
  none: [],
});

// 字段类型：text / textarea / number / select / conditionList
export const NODE_TYPES = Object.freeze({
  trigger: {
    type: 'trigger',
    label: '触发器',
    paletteLabel: '触发器',
    hint: '定时 / 事件触发',
    icon: 'clock',
    color: '#22d3ee',
    inputs: INPUT_PORTS.none,
    outputs: OUTPUT_PORTS.single,
    height: 96,
    summary: (p) => (p.schedule ? p.schedule : '未配置触发条件'),
    fields: [
      { key: 'schedule', label: 'Cron 表达式', type: 'text', placeholder: '0 9 * * 1-5' },
      { key: 'timezone', label: '时区', type: 'text', placeholder: 'Asia/Shanghai' },
      {
        key: 'mode',
        label: '触发方式',
        type: 'select',
        options: ['定时触发', 'Webhook', '手动触发'],
      },
    ],
    defaultParams: () => ({ schedule: '', timezone: 'Asia/Shanghai', mode: '定时触发' }),
  },

  action: {
    type: 'action',
    label: '动作',
    paletteLabel: '动作',
    hint: '拉数据 / 发通知 / 调接口',
    icon: 'bolt',
    color: '#818cf8',
    inputs: INPUT_PORTS.single,
    outputs: OUTPUT_PORTS.single,
    height: 96,
    summary: (p) => (p.action ? `${p.action}` : '未配置动作'),
    fields: [
      {
        key: 'action',
        label: '动作类型',
        type: 'select',
        options: ['拉取数据', '发送通知', '调用接口', '写入数据库'],
      },
      { key: 'target', label: '目标 / URL', type: 'text', placeholder: 'https://...' },
      { key: 'body', label: '请求体模板', type: 'textarea', placeholder: '{ "key": "{{value}}" }' },
    ],
    defaultParams: () => ({ action: '拉取数据', target: '', body: '' }),
  },

  condition: {
    type: 'condition',
    label: '条件分支',
    paletteLabel: '条件分支',
    hint: '按条件走不同出口',
    icon: 'split',
    color: '#f472b6',
    inputs: INPUT_PORTS.single,
    outputs: OUTPUT_PORTS.double,
    height: 120,
    summary: () => '两个出口，各配一个表达式',
    // conditionList 类型对应两个出口，key 固定 branches
    fields: [
      {
        key: 'branches',
        label: '出口条件',
        type: 'conditionList',
        branches: [
          { port: 'true', label: '是', placeholder: '{{value}} > 10' },
          { port: 'false', label: '否', placeholder: '其他情况' },
        ],
      },
      { key: 'logic', label: '组合逻辑', type: 'select', options: ['表达式为真', '表达式为假'] },
    ],
    defaultParams: () => ({
      logic: '表达式为真',
      branches: {
        true: { label: '是', expr: '' },
        false: { label: '否', expr: '' },
      },
    }),
  },

  merge: {
    type: 'merge',
    label: '合并',
    paletteLabel: '合并',
    hint: '汇聚两个分支',
    icon: 'merge',
    color: '#fbbf24',
    inputs: INPUT_PORTS.double,
    outputs: OUTPUT_PORTS.single,
    height: 120,
    summary: (p) => (p.mode === '等待全部' ? '等待两个分支都完成' : '任一分支到达即继续'),
    fields: [
      { key: 'mode', label: '合并模式', type: 'select', options: ['等待全部', '任一到达'] },
      { key: 'note', label: '备注', type: 'text', placeholder: '可选' },
    ],
    defaultParams: () => ({ mode: '等待全部', note: '' }),
  },

  end: {
    type: 'end',
    label: '结束',
    paletteLabel: '结束',
    hint: '流程终点',
    icon: 'stop',
    color: '#f87171',
    inputs: INPUT_PORTS.single,
    outputs: OUTPUT_PORTS.none,
    height: 96,
    summary: (p) => (p.status === 'success' ? '成功结束' : p.status === 'failed' ? '失败结束' : '结束流程'),
    fields: [
      { key: 'status', label: '结束状态', type: 'select', options: ['default', 'success', 'failed'] },
      { key: 'message', label: '结束说明', type: 'textarea', placeholder: '可选' },
    ],
    defaultParams: () => ({ status: 'default', message: '' }),
  },
});

export const PALETTE_ORDER = ['trigger', 'action', 'condition', 'merge', 'end'];

export function getNodeType(type) {
  return NODE_TYPES[type] || null;
}

export function defaultParams(type) {
  const def = NODE_TYPES[type];
  return def ? def.defaultParams() : {};
}
