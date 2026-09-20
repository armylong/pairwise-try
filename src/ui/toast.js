let container = null;

function ensureContainer() {
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  return container;
}

export function toast(message, type = 'info', duration = 2600) {
  const box = ensureContainer();
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = message;
  box.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 250);
  }, duration);
}
