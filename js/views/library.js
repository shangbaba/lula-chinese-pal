// js/views/library.js — Article library with folders and grouping

import { getArticles, getArticle, getFolders, getPages, saveFolder, updateFolder, deleteFolder, updateArticle, deleteArticle, shareArticleToProfile, getProfiles, saveArticle, savePage } from '../db.js';
import { processImageOCR, fileToBase64 } from '../ai/provider.js';
import { showToast, showLoading, hideLoading, showModal, closeModal, logError } from '../ui.js';

export async function renderLibrary(profile) {
  const view = document.getElementById('view-library');
  let currentFolderId = null;
  let viewMode = 'list'; // 'list' | 'folders'

  // One-time folder change listener (won't stack on re-renders)
  const folderChangeHandler = (e) => {
    currentFolderId = e.detail || null;
    render();
  };
  view.removeEventListener('folderChange', view._folderChangeHandler);
  view._folderChangeHandler = folderChangeHandler;
  view.addEventListener('folderChange', folderChangeHandler);

  async function render() {
    const [articles, folders] = await Promise.all([
      getArticles(profile.id),
      getFolders(profile.id)
    ]);

    const displayed = currentFolderId
      ? articles.filter(a => a.folderIds?.includes(currentFolderId))
      : articles;

    view.innerHTML = `
      <div class="top-bar">
        <button class="btn btn-ghost btn-icon" id="btn-back-profile">←</button>
        <div style="flex:1;min-width:0">
          <div class="top-bar-title">${profile.name}'s Library</div>
          <div class="top-bar-subtitle">卢拉陪读</div>
        </div>
        <button class="btn btn-icon ${viewMode === 'folders' ? 'active' : ''}" id="btn-toggle-view" title="Folder view">📁</button>
        <button class="btn btn-icon" id="btn-settings" title="Settings">⚙️</button>
        <button class="btn btn-primary btn-sm" id="btn-add-article">+ Add</button>
      </div>

      ${viewMode === 'folders' ? renderFolderBar(folders, currentFolderId) : ''}

      <div class="scroll-area" id="library-scroll">
        ${displayed.length === 0 ? renderEmpty(currentFolderId) : ''}
        <div class="article-list" id="article-list">
          ${await renderArticles(displayed, folders)}
        </div>
        ${viewMode === 'folders' && !currentFolderId ? renderFolderGrid(folders) : ''}
      </div>
    `;

    bindLibraryEvents(profile, folders, render, { get: () => viewMode, set: (v) => { viewMode = v; } });
  }

  await render();
}

function renderFolderBar(folders, currentFolderId) {
  return `
    <div class="folder-bar">
      <button class="folder-chip ${!currentFolderId ? 'active' : ''}" data-folder-id="">All</button>
      ${folders.map(f => `
        <button class="folder-chip ${currentFolderId === f.id ? 'active' : ''}" data-folder-id="${f.id}">${f.name}</button>
      `).join('')}
      <button class="folder-chip folder-chip-add" id="btn-new-folder">+ New</button>
    </div>
  `;
}

function renderFolderGrid(folders) {
  if (folders.length === 0) return '';
  return `
    <div class="folder-section-title">Folders</div>
    <div class="folder-grid">
      ${folders.map(f => `
        <div class="folder-card" data-folder-id="${f.id}">
          <div class="folder-icon">📁</div>
          <div class="folder-name">${f.name}</div>
        </div>
      `).join('')}
    </div>
  `;
}

async function renderArticles(articles, folders) {
  if (articles.length === 0) return '';
  const items = await Promise.all(articles.map(async (a) => {
    const pages = await getPages(a.id);
    const folderBadges = (a.folderIds || [])
      .map(fid => folders.find(f => f.id === fid))
      .filter(Boolean)
      .map(f => `<span class="badge badge-blue">${f.name}</span>`)
      .join('');
    return `
      <div class="article-card" data-article-id="${a.id}">
        <div class="article-card-body">
          <div class="article-title">${a.title}</div>
          <div class="article-meta">
            <span class="text-sm text-muted">${formatDate(a.dateCreated)}</span>
            ${pages.length > 1 ? `<span class="badge badge-red">${pages.length} pages</span>` : ''}
            ${folderBadges}
          </div>
        </div>
        <button class="btn btn-ghost article-menu-btn" data-article-id="${a.id}">⋯</button>
      </div>
    `;
  }));
  return items.join('');
}

function renderEmpty(folderId) {
  return `
    <div class="empty-state">
      <div class="empty-state-icon">📷</div>
      <div class="empty-state-title">${folderId ? 'No articles in this folder' : 'No articles yet'}</div>
      <div class="empty-state-text">Tap <strong>+ Add</strong> to take a photo<br>of a Chinese article to get started!</div>
    </div>
  `;
}

function bindLibraryEvents(profile, folders, rerender, viewModeRef) {
  const view = document.getElementById('view-library');

  document.getElementById('btn-back-profile')?.addEventListener('click', () => {
    window.lula.navigate('profile');
  });

  document.getElementById('btn-toggle-view')?.addEventListener('click', () => {
    viewModeRef.set(viewModeRef.get() === 'folders' ? 'list' : 'folders');
    rerender();
  });

  document.getElementById('btn-settings')?.addEventListener('click', () => {
    window.lula.navigate('settings');
  });

  document.getElementById('btn-add-article')?.addEventListener('click', () => {
    showAddArticleSheet(profile, rerender);
  });

  document.getElementById('btn-new-folder')?.addEventListener('click', () => {
    showNewFolderSheet(profile, rerender);
  });

  // Folder chips
  view.querySelectorAll('.folder-chip[data-folder-id]').forEach(chip => {
    chip.addEventListener('click', () => {
      // Use a custom event to communicate back to the closure
      const fid = chip.dataset.folderId || null;
      view.dispatchEvent(new CustomEvent('folderChange', { detail: fid }));
    });
  });

  // Folder grid cards
  view.querySelectorAll('.folder-card[data-folder-id]').forEach(card => {
    card.addEventListener('click', () => {
      view.dispatchEvent(new CustomEvent('folderChange', { detail: card.dataset.folderId }));
    });
  });

  // Article cards
  view.querySelectorAll('.article-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.classList.contains('article-menu-btn')) return;
      const articleId = card.dataset.articleId;
      window.lula.navigate('pages', { articleId });
    });
  });

  // Article menu
  view.querySelectorAll('.article-menu-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      showArticleMenu(btn.dataset.articleId, profile, folders, rerender);
    });
  });
}

function showAddArticleSheet(profile, rerender) {
  const content = `
    <div class="modal-handle"></div>
    <div class="modal-title">Add Article</div>
    <p class="text-sm text-muted mb-3">Take a photo or choose from your camera roll. You can add multiple photos for multi-page articles.</p>
    <div class="add-article-options">
      <button class="add-option-btn" id="btn-take-photo">
        <span class="add-option-icon">📷</span>
        <span>Take Photo</span>
      </button>
      <button class="add-option-btn" id="btn-upload-photo">
        <span class="add-option-icon">🖼️</span>
        <span>Upload from Camera Roll</span>
      </button>
    </div>
    <input type="file" id="file-input-camera" accept="image/*" capture="environment" style="display:none">
    <input type="file" id="file-input-gallery" accept="image/*" multiple style="display:none">
    <div id="selected-photos-preview"></div>
    <div id="add-article-actions" style="display:none;margin-top:16px;gap:10px;flex-direction:column">
      <button class="btn btn-primary w-full" id="btn-process-photos">✨ Recognise Characters</button>
    </div>
  `;

  showModal(content);
  let selectedFiles = [];

  document.getElementById('btn-take-photo')?.addEventListener('click', () => {
    document.getElementById('file-input-camera').click();
  });

  document.getElementById('btn-upload-photo')?.addEventListener('click', () => {
    document.getElementById('file-input-gallery').click();
  });

  const handleFiles = (files) => {
    selectedFiles = [...selectedFiles, ...Array.from(files)];
    renderPreview();
  };

  const renderPreview = () => {
    const preview = document.getElementById('selected-photos-preview');
    const actions = document.getElementById('add-article-actions');
    if (selectedFiles.length > 0) {
      preview.innerHTML = `
        <div class="photo-preview-grid">
          ${selectedFiles.map((f, i) => `
            <div class="photo-thumb">
              <img src="${URL.createObjectURL(f)}" alt="Page ${i+1}">
              <span class="photo-thumb-label">Page ${i+1}</span>
            </div>
          `).join('')}
        </div>
        <button class="btn btn-ghost btn-sm mt-2" id="btn-add-more-photos">+ Add More Pages</button>
      `;
      actions.style.display = 'flex';

      document.getElementById('btn-add-more-photos')?.addEventListener('click', () => {
        document.getElementById('file-input-gallery').click();
      });
    }
  };

  document.getElementById('file-input-camera')?.addEventListener('change', (e) => {
    if (e.target.files.length) handleFiles(e.target.files);
  });

  document.getElementById('file-input-gallery')?.addEventListener('change', (e) => {
    if (e.target.files.length) handleFiles(e.target.files);
  });

  document.getElementById('btn-process-photos')?.addEventListener('click', async () => {
    if (!selectedFiles.length) return;
    closeModal();
    await processPhotos(selectedFiles, profile, rerender);
  });
}

async function processPhotos(files, profile, rerender) {
  showLoading('Recognising Chinese characters…');

  try {
    const processed = [];

    for (let i = 0; i < files.length; i++) {
      showLoading(`Scanning page ${i + 1} of ${files.length}…`);
      let base64, mimeType;
      try {
        ({ base64, mimeType } = await fileToBase64(files[i]));
      } catch (convertErr) {
        throw new Error(`Failed to read photo ${i + 1}: ${convertErr.message}`);
      }
      try {
        const result = await processImageOCR(base64, mimeType);
        processed.push({ base64, mimeType, title: result.title, rawText: result.rawText || '' });
      } catch (aiErr) {
        throw new Error(`Page ${i + 1} of ${files.length} — ${aiErr.message}`);
      }
    }

    hideLoading();

    // Show bulk edit screen so user can clean up text before saving
    showBulkEditScreen(processed, profile, rerender);

  } catch (err) {
    hideLoading();
    logError(err.message || 'Unknown error during OCR', err.stack || '');
  }
}

function showBulkEditScreen(processed, profile, rerender) {
  const detectedTitle = processed[0]?.title || '';

  const pagesHtml = processed.map((p, i) => `
    <div class="bulk-edit-page">
      <div class="bulk-edit-page-label">Page ${i + 1}</div>
      <textarea class="bulk-edit-textarea" id="bulk-text-${i}" rows="8">${p.rawText}</textarea>
    </div>
  `).join('');

  showModal(`
    <div class="modal-handle"></div>
    <div class="modal-title">Review Recognised Text</div>
    <p class="text-sm text-muted mb-3">Remove any text that isn't part of the article, then tap Save.</p>
    <div class="bulk-edit-title-row">
      <label class="settings-label">Article Title</label>
      <input class="input mt-2" id="bulk-title-input" type="text"
        value="${detectedTitle}" placeholder="Enter article title…">
    </div>
    <div class="bulk-edit-pages mt-3">${pagesHtml}</div>
    <div style="display:flex;gap:10px;margin-top:16px">
      <button class="btn btn-secondary w-full" id="btn-bulk-cancel">Cancel</button>
      <button class="btn btn-primary w-full" id="btn-bulk-save">Save Article</button>
    </div>
  `);

  // Focus title if empty, otherwise first textarea
  setTimeout(() => {
    const titleInput = document.getElementById('bulk-title-input');
    if (titleInput && !detectedTitle) titleInput.focus();
    else document.getElementById('bulk-text-0')?.focus();
  }, 450);

  document.getElementById('btn-bulk-cancel')?.addEventListener('click', closeModal);

  document.getElementById('btn-bulk-save')?.addEventListener('click', async () => {
    const title = document.getElementById('bulk-title-input')?.value.trim() || 'Unknown';

    // Collect edited text from each textarea
    const editedPages = processed.map((p, i) => ({
      ...p,
      rawText: document.getElementById(`bulk-text-${i}`)?.value.trim() || p.rawText
    }));

    closeModal();
    await saveProcessedArticle(editedPages, title, profile, rerender);
  });
}

async function saveProcessedArticle(pages, title, profile, rerender) {
  showLoading('Saving article…');
  try {
    const article = await saveArticle(profile.id, title);
    for (let i = 0; i < pages.length; i++) {
      const { base64, mimeType, rawText } = pages[i];
      await savePage(article.id, i + 1, base64, mimeType, rawText);
    }
    hideLoading();
    showToast(`✅ "${title}" saved!`);
    rerender();
  } catch (err) {
    hideLoading();
    logError(`Failed to save article: ${err.message}`, err.stack || '');
  }
}

function promptForTitle() {
  return new Promise((resolve) => {
    const content = `
      <div class="modal-handle"></div>
      <div class="modal-title">What's this article called?</div>
      <p class="text-sm text-muted mb-3">We couldn't detect a title. Enter one below, or leave blank for "Unknown".</p>
      <input class="input" id="title-input" placeholder="Article title…" type="text">
      <button class="btn btn-primary w-full mt-3" id="btn-confirm-title">Save</button>
    `;
    showModal(content);

    const confirm = () => {
      const val = document.getElementById('title-input')?.value.trim();
      closeModal();
      resolve(val || null);
    };

    document.getElementById('btn-confirm-title')?.addEventListener('click', confirm);
    document.getElementById('title-input')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') confirm();
    });
    setTimeout(() => document.getElementById('title-input')?.focus(), 300);
  });
}

function showNewFolderSheet(profile, rerender) {
  const content = `
    <div class="modal-handle"></div>
    <div class="modal-title">New Folder</div>
    <input class="input" id="folder-name-input" placeholder="Folder name…" type="text">
    <button class="btn btn-primary w-full mt-3" id="btn-create-folder">Create Folder</button>
  `;
  showModal(content);

  const create = async () => {
    const name = document.getElementById('folder-name-input')?.value.trim();
    if (!name) return;
    closeModal();
    await saveFolder(profile.id, name);
    showToast(`📁 "${name}" created`);
    rerender();
  };

  document.getElementById('btn-create-folder')?.addEventListener('click', create);
  document.getElementById('folder-name-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') create();
  });
  setTimeout(() => document.getElementById('folder-name-input')?.focus(), 300);
}

async function showArticleMenu(articleId, profile, folders, rerender) {
  const article = await getArticle(articleId);
  const profiles = await getProfiles();
  const otherProfile = profiles.find(p => p.id !== profile.id);

  const content = `
    <div class="modal-handle"></div>
    <div class="modal-title">${article.title}</div>
    <div class="menu-list">
      <button class="menu-item" id="menu-rename">✏️ Rename article</button>
      <button class="menu-item" id="menu-add-folder">📁 Add to folder</button>
      ${otherProfile ? `<button class="menu-item" id="menu-share">🔁 Share to ${otherProfile.name}</button>` : ''}
      <div class="divider"></div>
      <button class="menu-item menu-item-danger" id="menu-delete">🗑️ Delete article</button>
    </div>
  `;
  showModal(content);

  document.getElementById('menu-rename')?.addEventListener('click', async () => {
    closeModal();
    await showRenameSheet(article, rerender);
  });

  document.getElementById('menu-add-folder')?.addEventListener('click', async () => {
    closeModal();
    await showAddToFolderSheet(article, folders, rerender);
  });

  document.getElementById('menu-share')?.addEventListener('click', async () => {
    closeModal();
    await shareArticleToProfile(articleId, otherProfile.id);
    showToast(`📤 Shared to ${otherProfile.name}`);
  });

  document.getElementById('menu-delete')?.addEventListener('click', async () => {
    closeModal();
    await deleteArticle(articleId);
    showToast('🗑️ Article deleted');
    rerender();
  });
}

async function showRenameSheet(article, rerender) {
  const content = `
    <div class="modal-handle"></div>
    <div class="modal-title">Rename Article</div>
    <input class="input" id="rename-input" value="${article.title}" type="text">
    <button class="btn btn-primary w-full mt-3" id="btn-rename-confirm">Save</button>
  `;
  showModal(content);

  const confirm = async () => {
    const val = document.getElementById('rename-input')?.value.trim();
    if (!val) return;
    await updateArticle(article.id, { title: val });
    closeModal();
    showToast('✅ Renamed');
    rerender();
  };

  document.getElementById('btn-rename-confirm')?.addEventListener('click', confirm);
  setTimeout(() => {
    const input = document.getElementById('rename-input');
    if (input) { input.focus(); input.select(); }
  }, 300);
}

async function showAddToFolderSheet(article, folders, rerender) {
  if (folders.length === 0) {
    showToast('No folders yet — create one first');
    return;
  }

  const content = `
    <div class="modal-handle"></div>
    <div class="modal-title">Add to Folder</div>
    <div class="folder-toggle-list">
      ${folders.map(f => `
        <label class="folder-toggle-item">
          <input type="checkbox" value="${f.id}" ${(article.folderIds || []).includes(f.id) ? 'checked' : ''}>
          <span class="folder-toggle-name">📁 ${f.name}</span>
        </label>
      `).join('')}
    </div>
    <button class="btn btn-primary w-full mt-3" id="btn-folder-confirm">Done</button>
  `;
  showModal(content);

  document.getElementById('btn-folder-confirm')?.addEventListener('click', async () => {
    const checked = Array.from(document.querySelectorAll('.folder-toggle-item input:checked')).map(c => c.value);
    await updateArticle(article.id, { folderIds: checked });
    closeModal();
    showToast('📁 Folders updated');
    rerender();
  });
}

function formatDate(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}
