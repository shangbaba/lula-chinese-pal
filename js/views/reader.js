// js/views/reader.js — Reading view with lazy pinyin + translation

import { getArticle, getPages, updatePage } from '../db.js';
import { processPinyin, processTranslation } from '../ai/provider.js';
import { showToast, showLoading, hideLoading, logError } from '../ui.js';
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
    const hasPinyin = page.pinyinReady && chars.length > 0;
    const hasTranslation = page.translationReady && page.fullTranslation;

    view.innerHTML = `
      <div class="top-bar reader-top-bar">
        <button class="btn btn-ghost btn-icon" id="btn-reader-back">←</button>
        <div style="flex:1;min-width:0">
          <div class="top-bar-title" style="font-size:15px">${article.title}</div>
          <div class="top-bar-subtitle">${currentIndex + 1} / ${pages.length}</div>
        </div>
        <button class="btn btn-icon ${pinyinVisible ? 'active' : ''}" id="btn-toggle-pinyin" title="Toggle pinyin">拼</button>
        <button class="btn btn-icon" id="btn-audio" title="Read aloud">🔊</button>
        <button class="btn btn-icon" id="btn-translation" title="Translation">EN</button>
        <button class="btn btn-icon" id="btn-recordings" title="Recordings">🎙️</button>
      </div>

      <div class="reader-content" id="reader-content">
        <div class="chinese-text" id="chinese-text">
          ${hasPinyin
            ? renderChars(chars, pinyinVisible)
            : renderRawText(page.rawText || '')
          }
        </div>
      </div>

      <div class="translation-panel hidden" id="translation-panel">
        <div class="translation-header">
          <span class="font-bold text-sm">English Translation</span>
          <button class="btn btn-ghost btn-sm" id="btn-close-translation">✕</button>
        </div>
        <div class="translation-text" id="translation-text">
          ${hasTranslation ? page.fullTranslation : ''}
        </div>
      </div>

      <div class="page-nav-hint">
        ${currentIndex > 0 ? '<span class="nav-hint-left">← Swipe right</span>' : ''}
        ${currentIndex < pages.length - 1 ? '<span class="nav-hint-right">Swipe left →</span>' : ''}
      </div>
    `;

    renderRecorder(articleId, article, view);
    bindReaderEvents(page, chars);
  }

  // Render raw text (before pinyin is generated)
  function renderRawText(rawText) {
    return rawText.split('').map((c, i) => {
      if (c === '\n') return '<br>';
      if (c === ' ') return '<span class="char-wrap space"> </span>';
      if (isPunctuation(c)) return `<span class="char-wrap punctuation"><span class="pinyin hidden"></span><span class="han">${c}</span></span>`;
      return `<span class="char-wrap" data-index="${i}" data-char="${c}">
        <span class="pinyin hidden"></span>
        <span class="han" id="char-${i}">${c}</span>
      </span>`;
    }).join('');
  }

  function renderChars(chars, allVisible) {
    return chars.map((c, i) => {
      if (c.char === '\n') return '<br>';
      if (c.char === ' ') return '<span class="char-wrap space"> </span>';
      const hasPinyin = c.pinyin && c.pinyin.length > 0;
      const isPunct = isPunctuation(c.char);
      return `
        <span class="char-wrap ${isPunct ? 'punctuation' : ''}" data-index="${i}" data-pinyin="${c.pinyin || ''}" data-char="${c.char}">
          <span class="pinyin ${allVisible && hasPinyin ? '' : 'hidden'}" id="pinyin-${i}">${c.pinyin || ''}</span>
          <span class="han" id="char-${i}">${c.char}</span>
        </span>`;
    }).join('');
  }

  function bindReaderEvents(page, chars) {
    document.getElementById('btn-reader-back')?.addEventListener('click', () => {
      stopTTS();
      if (pages.length > 1) {
        window.lula.navigate('pages', { articleId });
      } else {
        window.lula.navigate('library');
      }
    });

    // 拼 button — fetch pinyin on first tap, toggle on subsequent taps
    document.getElementById('btn-toggle-pinyin')?.addEventListener('click', async () => {
      if (!page.pinyinReady) {
        await fetchPinyin(page);
      } else {
        pinyinVisible = !pinyinVisible;
        document.getElementById('btn-toggle-pinyin')?.classList.toggle('active', pinyinVisible);
        document.querySelectorAll('.char-wrap:not(.punctuation):not(.space)').forEach(wrap => {
          const pinyin = wrap.querySelector('.pinyin');
          if (pinyin && wrap.dataset.pinyin) {
            pinyin.classList.toggle('hidden', !pinyinVisible);
          }
        });
      }
    });

    // EN button — fetch translation on first tap, toggle on subsequent taps
    document.getElementById('btn-translation')?.addEventListener('click', async () => {
      const panel = document.getElementById('translation-panel');
      if (!page.translationReady) {
        await fetchTranslation(page);
      } else {
        panel?.classList.toggle('hidden');
      }
    });

    document.getElementById('btn-close-translation')?.addEventListener('click', () => {
      document.getElementById('translation-panel')?.classList.add('hidden');
    });

    // Audio
    document.getElementById('btn-audio')?.addEventListener('click', () => {
      const btn = document.getElementById('btn-audio');
      if (ttsUtterance && speechSynthesis.speaking) {
        stopTTS();
        btn.classList.remove('active');
        return;
      }
      const text = page.pinyinReady
        ? (page.characters || []).map(c => c.char).join('')
        : (page.rawText || '');
      ttsUtterance = new SpeechSynthesisUtterance(text);
      ttsUtterance.lang = 'zh-CN';
      ttsUtterance.rate = 0.85;
      ttsUtterance.onend = () => btn.classList.remove('active');
      speechSynthesis.speak(ttsUtterance);
      btn.classList.add('active');
    });

    // Recordings
    document.getElementById('btn-recordings')?.addEventListener('click', async () => {
      const { showRecordingsSheet } = await import('./recorder.js');
      showRecordingsSheet(articleId, article);
    });

    // Character tap (only active when pinyin is ready)
    if (page.pinyinReady) {
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
    }

    // Tap elsewhere to exit edit mode
    document.getElementById('reader-content')?.addEventListener('click', (e) => {
      if (editingCharEl && !e.target.closest('.char-wrap.editing')) {
        exitEditMode(editingCharEl, page, chars);
      }
    });

    bindSwipe();
  }

  // ── Lazy fetch pinyin ─────────────────────────────────────────
  async function fetchPinyin(page) {
    const rawText = page.rawText || '';
    if (!rawText.trim()) {
      showToast('⚠️ No text found on this page');
      return;
    }
    showLoading('Getting pinyin…');
    try {
      const characters = await processPinyin(rawText);
      page.characters = characters;
      page.pinyinReady = true;
      await updatePage(page.id, { characters, pinyinReady: true });
      hideLoading();
      pinyinVisible = true;
      render(); // re-render with pinyin
    } catch (err) {
      hideLoading();
      logError(`Pinyin failed: ${err.message}`, err.stack || '');
    }
  }

  // ── Lazy fetch translation ────────────────────────────────────
  async function fetchTranslation(page) {
    const rawText = page.rawText || '';
    if (!rawText.trim()) {
      showToast('⚠️ No text found on this page');
      return;
    }
    showLoading('Translating…');
    try {
      const translation = await processTranslation(rawText);
      page.fullTranslation = translation;
      page.translationReady = true;
      await updatePage(page.id, { fullTranslation: translation, translationReady: true });
      hideLoading();
      // Show the panel with the new translation
      const panel = document.getElementById('translation-panel');
      const textEl = document.getElementById('translation-text');
      if (textEl) textEl.textContent = translation;
      panel?.classList.remove('hidden');
    } catch (err) {
      hideLoading();
      logError(`Translation failed: ${err.message}`, err.stack || '');
    }
  }

  function showPinyinBriefly(index, pinyin) {
    const el = document.getElementById(`pinyin-${index}`);
    if (!el || !pinyin) return;
    if (tapTimers[index]) clearTimeout(tapTimers[index]);
    el.classList.remove('hidden');
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
    if (!hanEl) return;
    hanEl.contentEditable = 'true';
    hanEl.focus();
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
    let startX = 0, startY = 0, isDragging = false;

    content.addEventListener('touchstart', (e) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      isDragging = true;
    }, { passive: true });

    content.addEventListener('touchend', (e) => {
      if (!isDragging) return;
      const deltaX = e.changedTouches[0].clientX - startX;
      const deltaY = e.changedTouches[0].clientY - startY;
      if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 60) {
        if (deltaX < 0 && currentIndex < pages.length - 1) {
          stopTTS(); currentIndex++; pinyinVisible = false; render();
        } else if (deltaX > 0 && currentIndex > 0) {
          stopTTS(); currentIndex--; pinyinVisible = false; render();
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
  return /[。，！？；：""''（）【】、…—·.,!?;:()\[\]"']/u.test(char);
}
