// 轻量内联 SVG 图标（stroke 风格，currentColor）
const PATHS = {
  clock:
    '<circle cx="12" cy="12" r="8"></circle><path d="M12 8v4l2.5 2"></path>',
  bolt: '<path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z"></path>',
  split:
    '<path d="M5 4v6c0 2 2 3 4 3h6"></path><circle cx="17" cy="8" r="2"></circle><circle cx="17" cy="16" r="2"></circle><path d="M5 20v-6c0-2 2-3 4-3h6"></path>',
  merge:
    '<path d="M17 4v6c0 2-2 3-4 3H7"></path><circle cx="5" cy="8" r="2"></circle><circle cx="5" cy="16" r="2"></circle><path d="M17 20v-6c0-2-2-3-4-3H7"></path>',
  stop:
    '<rect x="6" y="6" width="12" height="12" rx="2"></rect>',
  hand: '<path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V12m0-1.5v-5a1.5 1.5 0 0 1 3 0V12m0-1v-3.5a1.5 1.5 0 0 1 3 0V14c0 4-2.5 7-6 7s-5-2-6-4l-2-4c-.5-1 .5-2.5 1.8-1.8L8 13"></path>',
  select:
    '<rect x="4" y="4" width="16" height="16" rx="2"></rect><path d="M4 12h16M12 4v16" opacity="0.0"></path>',
};

export function icon(name, size = 16) {
  const body = PATHS[name] || PATHS.bolt;
  return `<svg class="nfe-icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}

export function inlineSvg(name, size = 16) {
  return icon(name, size);
}
