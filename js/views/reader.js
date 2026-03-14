// js/views/reader.js — Reading view with pinyin interactions, swipe, audio

import { getArticle, getPages, updatePage } from '../db.js';
import { showToast } from '../ui.js';
import { renderRecorder } from './recorder.js';

export async function renderReader(articleId, startPageIndex = 0) {
  const view = document.getElementById('view-reader');
  const [article, pages] = await Promise.all([
    getArticle(articleId),
    getPages(articleId)
  ]);

  if (!article || !pages.length) {
    window.lula.navigate('library');
    return;
  }

  let currentIndex = startPageIndex;
  let pinyinVisible = false;
  let ttsUtterance = null;
  let editingCharEl = null;
  let tapTimers = {};

  function render() {
    const page = pages[currentIndex];
    const chars = page.characters || [];

    view.innerHTML = `
      <div class="top-bar reader-top-bar">
        <button class="btn btn-ghost btn-icon" id="btn-reader-back">←</button>
        <div style="flex:1;min-width:0">
          <div class="top-bar-title" style="font-size:15px">${article.title}</div>
          <div class="top-bar-subtitle">${currentIndex + 1} / ${pages.length}</div>
        </div>
        <button class="btn btn-icon ${pinyinVisible ? 'active' : ''}" id="btn-toggle-pinyin" title="Toggle all pinyin">拼</button>
        <button class="btn btn-icon" id="btn-audio" title="Read aloud">🔊</button>
        <button class="btn btn-icon" id="btn-translation" title="Show translation">EN</button>
        <button class="btn btn-icon" id="btn-recordings" title="Recordings">🎙️</button>
      </div>

      <div class="reader-content" id="reader-content">
        <div class="chinese-text" id="chinese-text">
          ${renderChars(chars, pinyinVisible)}
        </div>
      </div>

      <div class="translation-panel hidden" id="translation-panel">
        <div class="translation-header">
          <span class="font-bold text-sm">English Translation</span>
          <button class="btn btn-ghost btn-sm" id="btn-close-translation">✕</button>
        </div>
        <div class="translation-text">${page.fullTranslation || 'No translation available.'}</div>
      </div>

      <div class="page-nav-hint" id="page-nav-hint">
        ${currentIndex > 0 ? '<span class="nav-hint-left">← Swipe right</span>' : ''}
        ${currentIndex < pages.length - 1 ? '<span class="nav-hint-right">Swipe left →</span>' : ''}
      </div>
    `;

    // Render recorder FAB
    renderRecorder(articleId, article, view);

    bindReaderEvents(page, chars);
  }

  function renderChars(chars, allVisible) {
    return chars.map((c, i) => {
      if (c.char === ' ' || c.char === '\n') {
        return c.char === '\n' ? '<br>' : '<span class="char-wrap space"> </span>';
      }

      const hasPinyin = c.pinyin && c.pinyin.length > 0;
      const isPunct = isPunctuation(c.char);

      return `
        <span class="char-wrap ${isPunct ? 'punctuation' : ''}" data-index="${i}" data-pinyin="${c.pinyin || ''}" data-char="${c.char}">
          <span class="pinyin ${allVisible && hasPinyin ? '' : 'hidden'}" id="pinyin-${i}">${c.pinyin || ''}</span>
          <span class="han" id="char-${i}">${c.char}</span>
        </span>
      `;
    }).join('');
  }

  function bindReaderEvents(page, chars) {
    // Back button
    document.getElementById('btn-reader-back')?.addEventListener('click', () => {
      stopTTS();
      if (pages.length > 1) {
        window.lula.navigate('pages', { articleId });
      } else {
        window.lula.navigate('library');
      }
    });

    // Toggle all pinyin
    document.getElementById('btn-toggle-pinyin')?.addEventListener('click', () => {
      pinyinVisible = !pinyinVisible;
      document.getElementById('btn-toggle-pinyin')?.classList.toggle('active', pinyinVisible);
      document.querySelectorAll('.char-wrap:not(.punctuation):not(.space)').forEach((wrap, i) => {
        const pinyin = wrap.querySelector('.pinyin');
        if (pinyin && wrap.dataset.pinyin) {
          pinyin.classList.toggle('hidden', !pinyinVisible);
        }
      });
    });

    // Audio
    document.getElementById('btn-audio')?.addEventListener('click', () => {
      const btn = document.getElementById('btn-audio');
      if (ttsUtterance && speechSynthesis.speaking) {
        stopTTS();
        btn.classList.remove('active');
        return;
      }
      const text = chars.map(c => c.char).join('');
      ttsUtterance = new SpeechSynthesisUtterance(text);
      ttsUtterance.lang = 'zh-CN';
      ttsUtterance.rate = 0.85;
      ttsUtterance.onend = () => btn.classList.remove('active');
      speechSynthesis.speak(ttsUtterance);
      btn.classList.add('active');
    });

    // Translation
    document.getElementById('btn-translation')?.addEventListener('click', () => {
      const panel = document.getElementById('translation-panel');
      panel.classList.toggle('hidden');
    });

    document.getElementById('btn-close-translation')?.addEventListener('click', () => {
      document.getElementById('translation-panel')?.classList.add('hidden');
    });

    // Recordings sheet
    document.getElementById('btn-recordings')?.addEventListener('click', async () => {
      const { showRecordingsSheet } = await import('./recorder.js');
      showRecordingsSheet(articleId, article);
    });

    // Character interactions — tap and long-hold
    document.querySelectorAll('.char-wrap:not(.punctuation):not(.space)').forEach(wrap => {
      const index = parseInt(wrap.dataset.index);
      let holdTimer = null;
      let isHolding = false;

      wrap.addEventListener('pointerdown', () => {
        isHolding = false;
        holdTimer = setTimeout(() => {
          isHolding = true;
          enterEditMode(wrap, index, page, chars);
        }, 600);
      });

      wrap.addEventListener('pointerup', () => {
        clearTimeout(holdTimer);
        if (!isHolding && !pinyinVisible && wrap.dataset.pinyin) {
          showPinyinBriefly(index, wrap.dataset.pinyin);
        }
      });

      wrap.addEventListener('pointercancel', () => clearTimeout(holdTimer));
    });

    // Tap elsewhere to exit edit mode
    document.getElementById('reader-content')?.addEventListener('click', (e) => {
      if (editingCharEl && !e.target.closest('.char-wrap.editing')) {
        exitEditMode(editingCharEl, page, chars);
      }
    });

    // Swipe navigation
    bindSwipe();
  }

  function showPinyinBriefly(index, pinyin) {
    const el = document.getElementById(`pinyin-${index}`);
    if (!el || !pinyin) return;

    // Clear existing timer
    if (tapTimers[index]) {
      clearTimeout(tapTimers[index]);
      el.classList.remove('hidden');
    } else {
      el.classList.remove('hidden');
    }

    tapTimers[index] = setTimeout(() => {
      if (!pinyinVisible) el.classList.add('hidden');
      delete tapTimers[index];
    }, 5000);
  }

  function enterEditMode(wrap, index, page, chars) {
    if (editingCharEl) exitEditMode(editingCharEl, page, chars);
    editingCharEl = wrap;
    wrap.classList.add('editing');

    const hanEl = document.getElementById(`char-${index}`);
    const currentChar = chars[index]?.char || '';

    hanEl.contentEditable = 'true';
    hanEl.focus();

    // Select all text
    const range = document.createRange();
    range.selectNodeContents(hanEl);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);

    showToast('✏️ Edit character — tap elsewhere to save');
  }

  function exitEditMode(wrap, page, chars) {
    if (!wrap) return;
    const index = parseInt(wrap.dataset.index);
    const hanEl = document.getElementById(`char-${index}`);

    if (hanEl) {
      const newChar = hanEl.textContent.trim();
      if (newChar && newChar !== chars[index]?.char) {
        chars[index] = { ...chars[index], char: newChar };
        wrap.dataset.char = newChar;
        // Persist
        updatePage(page.id, { characters: chars });
        showToast('✅ Character updated');
      }
      hanEl.contentEditable = 'false';
    }

    wrap.classList.remove('editing');
    editingCharEl = null;
  }

  function bindSwipe() {
    const content = document.getElementById('reader-content');
    if (!content) return;

    let startX = 0;
    let startY = 0;
    let isDragging = false;

    content.addEventListener('touchstart', (e) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      isDragging = true;
    }, { passive: true });

    content.addEventListener('touchend', (e) => {
      if (!isDragging) return;
      const deltaX = e.changedTouches[0].clientX - startX;
      const deltaY = e.changedTouches[0].clientY - startY;

      // Only swipe if horizontal movement dominates
      if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 60) {
        if (deltaX < 0 && currentIndex < pages.length - 1) {
          // Swipe left — next page
          stopTTS();
          currentIndex++;
          pinyinVisible = false;
          render();
        } else if (deltaX > 0 && currentIndex > 0) {
          // Swipe right — previous page
          stopTTS();
          currentIndex--;
          pinyinVisible = false;
          render();
        }
      }
      isDragging = false;
    }, { passive: true });
  }

  function stopTTS() {
    if (speechSynthesis.speaking) speechSynthesis.cancel();
    ttsUtterance = null;
  }

  render();
}

function isPunctuation(char) {
  return /[。，！？；：""''（）【】、…—·\.\,\!\?\;\:\(\)\[\]\"\']/u.test(char);
}
