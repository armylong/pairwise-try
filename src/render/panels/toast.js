// 轻量 toast：顶部居中，自动消失
let container = null;

function ensureContainer() {
  if (!container) {
    container = document.createElement('div');
    container.className = 'nfe-toast-container';
    document.body.appendChild(container);
  }
  return container;
}

export function toast(message, type = 'error', duration = 2400) {
  const root = ensureContainer();
  const item = document.createElement('div');
  item.className = `nfe-toast nfe-toast-${type}`;
  item.textContent = message;
  root.appendChild(item);
  requestAnimationFrame(() => item.classList.add('nfe-toast-show'));
  setTimeout(() => {
    item.classList.remove('nfe-toast-show');
    setTimeout(() => item.remove(), 200);
  }, duration);
}

export const toastError = (message) => toast(message, 'error');
export const toastInfo = (message) => toast(message, 'info');
export const toastSuccess = (message) => toast(message, 'success');
