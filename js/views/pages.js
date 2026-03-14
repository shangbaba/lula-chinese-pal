// js/views/pages.js — Shows list of pages for an article

import { getArticle, getPages, updateArticle } from '../db.js';
import { showToast } from '../ui.js';

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

  document.getElementById('btn-rename-article')?.addEventListener('click', async () => {
    const newTitle = prompt('Rename article:', article.title);
    if (newTitle && newTitle.trim()) {
      await updateArticle(article.id, { title: newTitle.trim() });
      document.getElementById('article-title-display').textContent = newTitle.trim();
      showToast('✅ Renamed');
    }
  });

  view.querySelectorAll('.page-card').forEach(card => {
    card.addEventListener('click', () => {
      const pageIndex = parseInt(card.dataset.pageIndex);
      window.lula.navigate('reader', { articleId, pageIndex });
    });
  });
}
