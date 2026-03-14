// js/views/pages.js — Shows list of pages for an article

import { getArticle, getPages, updateArticle } from '../db.js';
import { showToast, showModal, closeModal } from '../ui.js';

export async function renderPagesView(articleId) {
  const view = document.getElementById('view-pages');
  const [article, pages] = await Promise.all([
    getArticle(articleId),
    getPages(articleId)
  ]);

  if (!article) {
    window.lula.navigate('library');
    return;
  }

  // If only one page, go straight to reader
  if (pages.length === 1) {
    window.lula.navigate('reader', { articleId, pageIndex: 0 });
    return;
  }

  view.innerHTML = `
    <div class="top-bar">
      <button class="btn btn-ghost btn-icon" id="btn-back-library">←</button>
      <div class="top-bar-title" id="article-title-display">${article.title}</div>
      <button class="btn btn-ghost btn-icon" id="btn-rename-article">✏️</button>
    </div>

    <div class="scroll-area">
      <p class="text-sm text-muted mb-3" style="text-align:center">${pages.length} pages — tap to open</p>
      <div class="pages-grid">
        ${pages.map((page, i) => `
          <div class="page-card" data-page-index="${i}">
            <div class="page-thumb">
              ${page.imageBase64
                ? `<img src="data:${page.mimeType || 'image/jpeg'};base64,${page.imageBase64}" alt="Page ${i+1}" class="page-thumb-img">`
                : `<div class="page-thumb-placeholder">📄</div>`
              }
            </div>
            <div class="page-label">Page ${i + 1}</div>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  document.getElementById('btn-back-library')?.addEventListener('click', () => {
    window.lula.navigate('library');
  });

  document.getElementById('btn-rename-article')?.addEventListener('click', () => {
    showRenameModal(article, (newTitle) => {
      document.getElementById('article-title-display').textContent = newTitle;
    });
  });

  view.querySelectorAll('.page-card').forEach(card => {
    card.addEventListener('click', () => {
      const pageIndex = parseInt(card.dataset.pageIndex);
      window.lula.navigate('reader', { articleId, pageIndex });
    });
  });
}

function showRenameModal(article, onRenamed) {
  showModal(`
    <div class="modal-handle"></div>
    <div class="modal-title">Rename Article</div>
    <input class="input" id="rename-modal-input" type="text" value="${article.title}" placeholder="Article name…" readonly>
    <div style="display:flex;gap:10px;margin-top:12px">
      <button class="btn btn-secondary w-full" id="btn-rename-cancel">Cancel</button>
      <button class="btn btn-primary w-full" id="btn-rename-save">Save</button>
    </div>
  `);

  // Remove readonly after a delay so iOS doesn't auto-dismiss
  // when the keyboard fires during the touch sequence
  setTimeout(() => {
    const input = document.getElementById('rename-modal-input');
    if (!input) return;
    input.removeAttribute('readonly');
    input.focus();
    // Move cursor to end
    const len = input.value.length;
    input.setSelectionRange(len, len);
  }, 400);

  const save = async () => {
    const val = document.getElementById('rename-modal-input')?.value.trim();
    if (!val) return;
    await updateArticle(article.id, { title: val });
    article.title = val;
    closeModal();
    onRenamed(val);
    showToast('✅ Renamed');
  };

  document.getElementById('btn-rename-save')?.addEventListener('click', save);
  document.getElementById('btn-rename-cancel')?.addEventListener('click', closeModal);
  document.getElementById('rename-modal-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') save();
  });
}
