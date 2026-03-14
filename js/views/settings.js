// js/views/settings.js — Settings with PIN lock

import { getSetting, setSetting } from '../db.js';
import { showToast, showErrorLog } from '../ui.js';

export async function renderSettings() {
  const view = document.getElementById('view-settings');

  // Show PIN lock first
  const isPinLocked = await checkPinLock(view);
  if (!isPinLocked) return;

  await renderSettingsContent(view);
}

async function checkPinLock(view) {
  return new Promise((resolve) => {
    view.innerHTML = `
      <div class="top-bar">
        <button class="btn btn-ghost btn-icon" id="btn-settings-back">←</button>
        <div class="top-bar-title">Settings</div>
      </div>
      <div class="pin-lock-screen">
        <div class="pin-lock-icon">🔒</div>
        <div class="pin-lock-title">Enter PIN to unlock</div>
        <div style="width:100%;max-width:280px;display:flex;flex-direction:column;gap:12px">
          <input class="input" id="pin-text-input" type="password"
            placeholder="Enter PIN…"
            style="text-align:center;font-size:18px;letter-spacing:0.15em">
          <button class="btn btn-primary w-full" id="btn-pin-submit">Unlock</button>
        </div>
        <div class="pin-error hidden" id="pin-error">Incorrect PIN — try again</div>
        <p class="text-sm text-muted" style="text-align:center;margin-top:8px">Default PIN: <strong>welcome</strong></p>
      </div>
    `;

    document.getElementById('btn-settings-back')?.addEventListener('click', () => {
      window.lula.navigate('library');
      resolve(false);
    });

    const submit = async () => {
      const entered = document.getElementById('pin-text-input')?.value || '';
      const stored = await getSetting('pin') || 'welcome';
      if (entered === stored) {
        resolve(true);
        await renderSettingsContent(view);
      } else {
        document.getElementById('pin-error')?.classList.remove('hidden');
        const input = document.getElementById('pin-text-input');
        if (input) {
          input.value = '';
          input.style.borderColor = '#DC2626';
          setTimeout(() => { input.style.borderColor = ''; }, 1000);
        }
      }
    };

    document.getElementById('btn-pin-submit')?.addEventListener('click', submit);
    document.getElementById('pin-text-input')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submit();
    });
    setTimeout(() => document.getElementById('pin-text-input')?.focus(), 300);
  });
}

async function renderSettingsContent(view) {
  const [geminiKey, aiProvider, pinyinProvider, translationProvider] = await Promise.all([
    getSetting('geminiApiKey'),
    getSetting('aiProvider'),
    getSetting('pinyinProvider'),
    getSetting('translationProvider')
  ]);

  view.innerHTML = `
    <div class="top-bar">
      <button class="btn btn-ghost btn-icon" id="btn-settings-back">←</button>
      <div class="top-bar-title">Settings</div>
    </div>
    <div class="scroll-area">

      <div class="settings-section">
        <div class="settings-section-title">API Keys</div>
        <div class="card" style="padding:16px;gap:12px;display:flex;flex-direction:column">
          <div>
            <label class="settings-label">Gemini API Key</label>
            <div style="display:flex;gap:8px;margin-top:6px">
              <input class="input" id="gemini-key-input" type="password"
                placeholder="Paste your Gemini API key…"
                value="${geminiKey || ''}">
              <button class="btn btn-secondary btn-sm" id="btn-toggle-key">👁️</button>
            </div>
            <p class="text-sm text-muted mt-2">Get a free key at <strong>aistudio.google.com</strong></p>
          </div>
          <button class="btn btn-primary btn-sm" id="btn-save-key">Save API Key</button>
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-section-title">AI Providers</div>
        <div class="card" style="padding:16px;gap:16px;display:flex;flex-direction:column">
          <div>
            <label class="settings-label">OCR (Character Recognition)</label>
            <select class="input mt-2" id="sel-ocr-provider">
              <option value="gemini" ${aiProvider === 'gemini' ? 'selected' : ''}>Gemini 2.5 Flash</option>
              <option value="claude" ${aiProvider === 'claude' ? 'selected' : ''}>Claude (Anthropic)</option>
            </select>
          </div>
          <div>
            <label class="settings-label">Pinyin</label>
            <select class="input mt-2" id="sel-pinyin-provider">
              <option value="gemini" ${pinyinProvider === 'gemini' ? 'selected' : ''}>Gemini (online)</option>
              <option value="pinyin-pro" ${pinyinProvider === 'pinyin-pro' ? 'selected' : ''}>pinyin-pro (offline)</option>
            </select>
          </div>
          <div>
            <label class="settings-label">Translation</label>
            <select class="input mt-2" id="sel-translation-provider">
              <option value="gemini" ${translationProvider === 'gemini' ? 'selected' : ''}>Gemini</option>
              <option value="deepl" ${translationProvider === 'deepl' ? 'selected' : ''}>DeepL</option>
            </select>
          </div>
          <button class="btn btn-primary btn-sm" id="btn-save-providers">Save Provider Settings</button>
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-section-title">Security</div>
        <div class="card" style="padding:16px;gap:12px;display:flex;flex-direction:column">
          <div>
            <label class="settings-label">Current PIN</label>
            <input class="input mt-2" id="current-pin-input" type="password" placeholder="Current PIN">
          </div>
          <div>
            <label class="settings-label">New PIN</label>
            <input class="input mt-2" id="new-pin-input" type="text" placeholder="New PIN (letters or numbers)">
          </div>
          <button class="btn btn-secondary btn-sm" id="btn-change-pin">Change PIN</button>
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-section-title">Diagnostics</div>
        <div class="card" style="padding:16px">
          <p class="text-sm text-muted mb-3">View a log of any errors that have occurred in this session.</p>
          <button class="btn btn-secondary w-full" id="btn-view-error-log">🪲 View Error Log</button>
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-section-title">About</div>
        <div class="card" style="padding:16px">
          <div class="flex items-center gap-3">
            <div style="font-size:36px">卢拉</div>
            <div>
              <div class="font-bold">Lula Chinese Pal</div>
              <div class="text-sm text-muted">卢拉陪读 · v1.0</div>
            </div>
          </div>
        </div>
      </div>

    </div>
  `;

  document.getElementById('btn-settings-back')?.addEventListener('click', () => {
    window.lula.navigate('library');
  });

  // Toggle key visibility
  document.getElementById('btn-toggle-key')?.addEventListener('click', () => {
    const input = document.getElementById('gemini-key-input');
    if (input) input.type = input.type === 'password' ? 'text' : 'password';
  });

  document.getElementById('btn-save-key')?.addEventListener('click', async () => {
    const key = document.getElementById('gemini-key-input')?.value.trim();
    if (!key) { showToast('⚠️ Please enter an API key'); return; }
    await setSetting('geminiApiKey', key);
    showToast('✅ API key saved');
  });

  document.getElementById('btn-save-providers')?.addEventListener('click', async () => {
    const ocr = document.getElementById('sel-ocr-provider')?.value;
    const pinyin = document.getElementById('sel-pinyin-provider')?.value;
    const translation = document.getElementById('sel-translation-provider')?.value;
    await Promise.all([
      setSetting('aiProvider', ocr),
      setSetting('pinyinProvider', pinyin),
      setSetting('translationProvider', translation)
    ]);
    showToast('✅ Providers saved');
  });

  document.getElementById('btn-view-error-log')?.addEventListener('click', () => {
    showErrorLog();
  });

  document.getElementById('btn-change-pin')?.addEventListener('click', async () => {
    const current = document.getElementById('current-pin-input')?.value;
    const newPin = document.getElementById('new-pin-input')?.value.trim();

    const stored = await getSetting('pin') || 'welcome';
    if (current !== stored) { showToast('❌ Current PIN is incorrect'); return; }
    if (!newPin || newPin.length < 4) { showToast('⚠️ New PIN must be at least 4 characters'); return; }

    await setSetting('pin', newPin);
    document.getElementById('current-pin-input').value = '';
    document.getElementById('new-pin-input').value = '';
    showToast('✅ PIN changed successfully');
  });
}
