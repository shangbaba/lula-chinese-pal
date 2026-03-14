// js/ui.js — Shared UI utilities

// ─── Error Log ───────────────────────────────────────────────────
const errorLog = [];

export function logError(msg, detail = '') {
  const entry = {
    time: new Date().toLocaleTimeString('en-AU'),
    msg: String(msg),
    detail: String(detail)
  };
  errorLog.push(entry);
  console.error('[Lula Error]', msg, detail);
  // Show a persistent error banner
  showErrorBanner(entry);
}

function showErrorBanner(entry) {
  // Remove any existing banner
  document.getElementById('error-banner')?.remove();

  const banner = document.createElement('div');
  banner.id = 'error-banner';
  banner.className = 'error-banner';
  banner.innerHTML = `
    <div class="error-banner-header">
      <span class="error-banner-icon">⚠️</span>
      <span class="error-banner-title">Error at ${entry.time}</span>
      <button class="error-banner-close" id="btn-error-close">✕</button>
    </div>
    <div class="error-banner-msg">${entry.msg}</div>
    ${entry.detail ? `<div class="error-banner-detail">${entry.detail}</div>` : ''}
    <button class="error-banner-log-btn" id="btn-show-error-log">View full log (${errorLog.length})</button>
  `;
  document.body.appendChild(banner);

  document.getElementById('btn-error-close')?.addEventListener('click', () => {
    banner.remove();
  });

  document.getElementById('btn-show-error-log')?.addEventListener('click', () => {
    showErrorLog();
  });
}

export function showErrorLog() {
  const lines = errorLog.map((e, i) =>
    `<div class="log-entry">
      <div class="log-time">${i + 1}. ${e.time}</div>
      <div class="log-msg">${e.msg}</div>
      ${e.detail ? `<div class="log-detail">${e.detail}</div>` : ''}
    </div>`
  ).join('');

  showModal(`
    <div class="modal-handle"></div>
    <div class="modal-title">Error Log (${errorLog.length})</div>
    ${errorLog.length === 0
      ? '<p class="text-sm text-muted">No errors recorded.</p>'
      : `<div class="error-log-list">${lines}</div>`
    }
    <button class="btn btn-secondary w-full mt-3" id="btn-clear-log">Clear log</button>
  `);

  document.getElementById('btn-clear-log')?.addEventListener('click', () => {
    errorLog.length = 0;
    closeModal();
    showToast('🗑️ Error log cleared');
  });
}

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
