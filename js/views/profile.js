// js/views/profile.js — Profile selection screen

import { getProfiles, seedProfiles } from '../db.js';

export async function renderProfileView(onSelect) {
  await seedProfiles();
  const profiles = await getProfiles();

  const view = document.getElementById('view-profile');

  view.innerHTML = `
    <div class="profile-bg">
      <div class="profile-header">
        <div class="profile-logo">
          <span class="profile-logo-han">卢拉</span>
          <span class="profile-logo-en">Lula Chinese Pal</span>
        </div>
        <p class="profile-tagline">Who's reading today? 📖</p>
        <p class="profile-version">v1.7</p>
      </div>
      <div class="profile-cards">
        ${profiles.map(p => `
          <button class="profile-card" data-id="${p.id}" data-name="${p.name}">
            <div class="profile-avatar">${getAvatar(p.name)}</div>
            <div class="profile-name">${p.name}</div>
          </button>
        `).join('')}
      </div>
      <div class="profile-footer">
        <button class="btn btn-ghost text-sm" id="btn-settings-from-profile">⚙️ Settings</button>
      </div>
    </div>
  `;

  view.querySelectorAll('.profile-card').forEach(card => {
    card.addEventListener('click', () => {
      onSelect({ id: card.dataset.id, name: card.dataset.name });
    });
  });

  document.getElementById('btn-settings-from-profile')?.addEventListener('click', () => {
    window.lula.navigate('settings');
  });
}

function getAvatar(name) {
  const avatars = {
    'Lucas': '🦁',
    'Kayla': '🦋'
  };
  return avatars[name] || name.charAt(0);
}
