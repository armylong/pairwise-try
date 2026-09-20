/** 轻量模态：confirm 与 prompt（输入框）。均返回 Promise。 */

function openModal({ title, body, okText = '确定', cancelText = '取消', danger = false }) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal" role="dialog">
        <div class="modal-title"></div>
        <div class="modal-body"></div>
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" data-act="cancel"></button>
          <button type="button" class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-act="ok"></button>
        </div>
      </div>`;
    overlay.querySelector('.modal-title').textContent = title;
    const bodyEl = overlay.querySelector('.modal-body');
    if (typeof body === 'string') bodyEl.textContent = body;
    else bodyEl.appendChild(body);
    const [cancelBtn, okBtn] = overlay.querySelectorAll('button');
    cancelBtn.textContent = cancelText;
    okBtn.textContent = okText;

    const close = (val) => {
      overlay.remove();
      document.removeEventListener('keydown', onKey);
      resolve(val);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') close(null);
      if (e.key === 'Enter' && (e.target === overlay || e.target.closest('.modal'))) {
        if (e.target.tagName !== 'TEXTAREA') close(true);
      }
    };
    cancelBtn.addEventListener('click', () => close(null));
    okBtn.addEventListener('click', () => close(true));
    overlay.addEventListener('mousedown', (e) => {
      if (e.target === overlay) close(null);
    });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(overlay);
    const input = bodyEl.querySelector('input');
    if (input) {
      input.focus();
      input.select();
    } else okBtn.focus();
  });
}

export async function confirmDialog(title, message, { danger = false, okText = '确定' } = {}) {
  return (await openModal({ title, body: message, danger, okText })) === true;
}

export async function promptDialog(title, initial = '', placeholder = '') {
  const wrap = document.createElement('div');
  const input = document.createElement('input');
  input.className = 'modal-input';
  input.type = 'text';
  input.value = initial;
  input.placeholder = placeholder;
  wrap.appendChild(input);
  const ok = await openModal({ title, body: wrap, okText: '保存' });
  if (ok !== true) return null;
  const v = input.value.trim();
  return v || null;
}
