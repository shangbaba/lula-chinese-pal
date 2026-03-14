// js/views/recorder.js — FAB recording with playback, rename, share

import { saveRecording, getRecordings, updateRecording, deleteRecording, shareArticleToProfile, getProfiles } from '../db.js';
import { showToast, showModal, closeModal } from '../ui.js';

let mediaRecorder = null;
let audioChunks = [];
let recordingTimer = null;
let recordingSeconds = 0;

export function renderRecorder(articleId, article, parentView) {
  // Remove any existing FAB
  document.getElementById('recorder-fab')?.remove();
  document.getElementById('recording-indicator')?.remove();

  const fab = document.createElement('button');
  fab.id = 'recorder-fab';
  fab.className = 'fab';
  fab.innerHTML = '🎙️';
  fab.title = 'Record reading';

  const indicator = document.createElement('div');
  indicator.id = 'recording-indicator';
  indicator.className = 'recording-indicator hidden';
  indicator.innerHTML = `<span class="rec-dot"></span><span id="rec-timer">0:00</span>`;

  document.body.appendChild(fab);
  document.body.appendChild(indicator);

  fab.addEventListener('click', async () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      stopRecording(articleId, article);
    } else {
      await startRecording();
    }
  });
}

async function startRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioChunks = [];
    const mimeType = getSupportedMimeType();

    mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
    mediaRecorder._mimeType = mediaRecorder.mimeType || mimeType || 'audio/webm';
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunks.push(e.data);
    };

    mediaRecorder.start(100);

    const fab = document.getElementById('recorder-fab');
    const indicator = document.getElementById('recording-indicator');

    fab?.classList.add('recording');
    fab && (fab.innerHTML = '⏹️');
    indicator?.classList.remove('hidden');

    recordingSeconds = 0;
    recordingTimer = setInterval(() => {
      recordingSeconds++;
      const mins = Math.floor(recordingSeconds / 60);
      const secs = recordingSeconds % 60;
      const timerEl = document.getElementById('rec-timer');
      if (timerEl) timerEl.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
    }, 1000);

  } catch (err) {
    showToast('❌ Microphone access denied');
    console.error(err);
  }
}

async function stopRecording(articleId, article) {
  if (!mediaRecorder) return;

  clearInterval(recordingTimer);

  mediaRecorder.stop();
  mediaRecorder.stream.getTracks().forEach(t => t.stop());

  mediaRecorder.onstop = async () => {
    const mimeType = mediaRecorder._mimeType || 'audio/webm';
    const audioBlob = new Blob(audioChunks, { type: mimeType });

    const now = new Date();
    const defaultName = `${article.title} — ${now.toLocaleDateString('en-AU')} ${now.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}`;

    await saveRecording(articleId, window.lula.currentProfile?.id, defaultName, audioBlob);

    const fab = document.getElementById('recorder-fab');
    const indicator = document.getElementById('recording-indicator');

    fab?.classList.remove('recording');
    fab && (fab.innerHTML = '🎙️');
    indicator?.classList.add('hidden');

    showToast('🎙️ Recording saved!');
    mediaRecorder = null;
    audioChunks = [];
  };
}

function getSupportedMimeType() {
  const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return '';
}

export async function showRecordingsSheet(articleId, article) {
  const recordings = await getRecordings(articleId);
  const profiles = await getProfiles();
  const currentProfileId = window.lula.currentProfile?.id;
  const otherProfile = profiles.find(p => p.id !== currentProfileId);

  const content = `
    <div class="modal-handle"></div>
    <div class="modal-title">Recordings (${recordings.length})</div>
    ${recordings.length === 0 ? `
      <div class="empty-state" style="padding:32px 0">
        <div class="empty-state-icon">🎙️</div>
        <div class="empty-state-text">No recordings yet.<br>Tap the mic button to start!</div>
      </div>
    ` : `
      <div class="recordings-list">
        ${recordings.map(rec => `
          <div class="recording-item" data-rec-id="${rec.id}">
            <div class="recording-info">
              <div class="recording-name" id="recname-${rec.id}">${rec.name}</div>
              <div class="recording-date text-sm text-muted">${formatDate(rec.dateCreated)}</div>
            </div>
            <div class="recording-actions">
              <button class="btn btn-icon btn-play" data-rec-id="${rec.id}" title="Play">▶️</button>
              <button class="btn btn-icon btn-rec-menu" data-rec-id="${rec.id}" title="More">⋯</button>
            </div>
          </div>
          <audio id="audio-${rec.id}" style="display:none"></audio>
        `).join('')}
      </div>
    `}
  `;

  showModal(content);

  // Bind play buttons
  document.querySelectorAll('.btn-play').forEach(btn => {
    btn.addEventListener('click', async () => {
      const recId = btn.dataset.recId;
      const rec = recordings.find(r => r.id === recId);
      if (!rec) return;

      const audioEl = document.getElementById(`audio-${recId}`);
      if (!audioEl) return;

      if (audioEl.src) {
        audioEl.paused ? audioEl.play() : audioEl.pause();
        btn.textContent = audioEl.paused ? '▶️' : '⏸️';
      } else {
        const url = URL.createObjectURL(rec.audioBlob);
        audioEl.src = url;
        audioEl.play();
        btn.textContent = '⏸️';
        audioEl.onended = () => { btn.textContent = '▶️'; };
      }
    });
  });

  // Bind menu buttons
  document.querySelectorAll('.btn-rec-menu').forEach(btn => {
    btn.addEventListener('click', async () => {
      const recId = btn.dataset.recId;
      const rec = recordings.find(r => r.id === recId);
      if (!rec) return;
      closeModal();
      showRecordingMenu(rec, otherProfile, articleId, article);
    });
  });
}

async function showRecordingMenu(rec, otherProfile, articleId, article) {
  const content = `
    <div class="modal-handle"></div>
    <div class="modal-title" style="font-size:14px;font-weight:700;color:var(--text-muted)">${rec.name}</div>
    <div class="menu-list">
      <button class="menu-item" id="menu-rec-rename">✏️ Rename</button>
      <button class="menu-item" id="menu-rec-share-native">📤 Share (WhatsApp, AirDrop…)</button>
      ${otherProfile ? `<button class="menu-item" id="menu-rec-share-profile">🔁 Share to ${otherProfile.name}</button>` : ''}
      <div class="divider"></div>
      <button class="menu-item menu-item-danger" id="menu-rec-delete">🗑️ Delete</button>
    </div>
  `;
  showModal(content);

  document.getElementById('menu-rec-rename')?.addEventListener('click', async () => {
    closeModal();
    const newName = prompt('Rename recording:', rec.name);
    if (newName?.trim()) {
      await updateRecording(rec.id, { name: newName.trim() });
      showToast('✅ Renamed');
    }
  });

  document.getElementById('menu-rec-share-native')?.addEventListener('click', async () => {
    closeModal();
    try {
      const ext = rec.audioBlob.type.includes('mp4') ? 'm4a' : 'webm';
      const file = new File([rec.audioBlob], `${rec.name}.${ext}`, { type: rec.audioBlob.type });
      await navigator.share({ files: [file], title: rec.name });
    } catch (err) {
      if (err.name !== 'AbortError') showToast('❌ Share not supported on this device');
    }
  });

  document.getElementById('menu-rec-share-profile')?.addEventListener('click', async () => {
    closeModal();
    if (otherProfile) {
      await shareArticleToProfile(articleId, otherProfile.id);
      showToast(`📤 Shared to ${otherProfile.name}`);
    }
  });

  document.getElementById('menu-rec-delete')?.addEventListener('click', async () => {
    closeModal();
    await deleteRecording(rec.id);
    showToast('🗑️ Recording deleted');
  });
}

function formatDate(ts) {
  return new Date(ts).toLocaleString('en-AU', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
  });
}
