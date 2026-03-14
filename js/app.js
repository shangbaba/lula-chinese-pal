// js/app.js — Main app router and state

import { initDB, seedProfiles, seedSettings } from './db.js';
import { renderProfileView } from './views/profile.js';
import { renderLibrary } from './views/library.js';
import { renderPagesView } from './views/pages.js';
import { renderReader } from './views/reader.js';
import { renderSettings } from './views/settings.js';

// Global app state
window.lula = {
  currentProfile: null,
  currentArticleId: null,
  currentFolderId: null,
  currentLibraryViewMode: 'list',
  navigate
};

const VIEWS = ['profile', 'library', 'pages', 'reader', 'settings'];

function navigate(viewName, params = {}) {
  // Hide all views
  VIEWS.forEach(v => {
    const el = document.getElementById(`view-${v}`);
    if (el) el.classList.add('hidden');
  });

  // Remove fab if navigating away from reader
  if (viewName !== 'reader') {
    document.getElementById('recorder-fab')?.remove();
    document.getElementById('recording-indicator')?.remove();
  }

  const target = document.getElementById(`view-${viewName}`);
  if (target) {
    target.classList.remove('hidden');
    target.classList.remove('slide-left');
  }

  // Render view
  switch (viewName) {
    case 'profile':
      renderProfileView((profile) => {
        window.lula.currentProfile = profile;
        navigate('library');
      });
      break;

    case 'library':
      if (!window.lula.currentProfile) { navigate('profile'); return; }
      renderLibrary(window.lula.currentProfile);
      break;

    case 'pages':
      window.lula.currentArticleId = params.articleId;
      renderPagesView(params.articleId);
      break;

    case 'reader':
      renderReader(params.articleId || window.lula.currentArticleId, params.pageIndex || 0);
      break;

    case 'settings':
      renderSettings();
      break;
  }
}

async function init() {
  await initDB();
  await seedProfiles();
  await seedSettings();
  navigate('profile');
}

document.addEventListener('DOMContentLoaded', init);
