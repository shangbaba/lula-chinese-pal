// js/ui.js — Shared UI utilities

// ─── Toast ──────────────────────────────────────────────────────
let toastTimer = null;

export function showToast(msg, duration = 2500) {
  let toast = document.getElementById('app-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'app-toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), duration);
}

// ─── Loading ─────────────────────────────────────────────────────
export function showLoading(msg = 'Loading…') {
  let overlay = document.getElementById('loading-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'loading-overlay';
    overlay.className = 'loading-overlay';
    document.body.appendChild(overlay);
  }
  overlay.innerHTML = `
    <div class="spinner"></div>
    <div class="loading-text">${msg}</div>
  `;
  overlay.style.display = 'flex';
}

export function hideLoading() {
  const overlay = document.getElementById('loading-overlay');
  if (overlay) overlay.style.display = 'none';
}

// ─── Modal / Bottom Sheet ─────────────────────────────────────────
export function showModal(content) {
  let overlay = document.getElementById('modal-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'modal-overlay';
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `<div class="modal-sheet" id="modal-sheet"></div>`;
    document.body.appendChild(overlay);

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });
  }

  document.getElementById('modal-sheet').innerHTML = content;
  requestAnimationFrame(() => overlay.classList.add('active'));
}

export function closeModal() {
  const overlay = document.getElementById('modal-overlay');
  if (overlay) {
    overlay.classList.remove('active');
    setTimeout(() => {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }, 300);
  }
}
