// 简单的输入框 / 确认框，Promise 返回
function mountOverlay(content) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'nfe-modal-overlay';
    overlay.innerHTML = `
      <div class="nfe-modal">
        <div class="nfe-modal-title"></div>
        <div class="nfe-modal-body"></div>
        <div class="nfe-modal-actions">
          <button class="nfe-btn nfe-btn-ghost" data-action="cancel"></button>
          <button class="nfe-btn nfe-btn-primary" data-action="ok"></button>
        </div>
      </div>`;
    overlay.querySelector('.nfe-modal-title').textContent = content.title;
    const body = overlay.querySelector('.nfe-modal-body');
    body.appendChild(content.input);
    overlay.querySelector('[data-action="cancel"]').textContent = content.cancelText || '取消';
    const okBtn = overlay.querySelector('[data-action="ok"]');
    okBtn.textContent = content.okText || '确定';

    const close = (value) => {
      overlay.remove();
      document.removeEventListener('keydown', onKey);
      resolve(value);
    };
    const onKey = (event) => {
      if (event.key === 'Escape') close(null);
      if (event.key === 'Enter' && event.target.tagName !== 'TEXTAREA') {
        event.preventDefault();
        okBtn.click();
      }
    };

    overlay.addEventListener('mousedown', (event) => {
      if (event.target === overlay) close(null);
    });
    okBtn.addEventListener('click', () => close(content.getValue()));
    overlay.querySelector('[data-action="cancel"]').addEventListener('click', () => close(null));

    document.body.appendChild(overlay);
    document.addEventListener('keydown', onKey);
    requestAnimationFrame(() => content.input.focus && content.input.focus());
  });
}

export function promptModal({ title, initialValue = '', placeholder = '', okText }) {
  const input = document.createElement('input');
  input.className = 'nfe-input nfe-modal-input';
  input.value = initialValue;
  input.placeholder = placeholder;
  return mountOverlay({
    title,
    input,
    okText,
    getValue: () => input.value,
  });
}

export function confirmModal({ title, message, okText = '删除', cancelText = '取消' }) {
  const input = document.createElement('p');
  input.className = 'nfe-modal-message';
  input.textContent = message;
  return mountOverlay({
    title,
    input,
    okText,
    cancelText,
    getValue: () => true,
  });
}
