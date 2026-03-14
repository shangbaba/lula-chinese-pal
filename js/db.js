// db.js — IndexedDB wrapper for Lula Chinese Pal

const DB_NAME = 'LulaChinesePal';
const DB_VERSION = 1;

let db = null;

export async function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (e) => {
      const db = e.target.result;

      if (!db.objectStoreNames.contains('profiles')) {
        const profiles = db.createObjectStore('profiles', { keyPath: 'id' });
        profiles.createIndex('name', 'name', { unique: true });
      }

      if (!db.objectStoreNames.contains('articles')) {
        const articles = db.createObjectStore('articles', { keyPath: 'id' });
        articles.createIndex('profileId', 'profileId');
        articles.createIndex('dateCreated', 'dateCreated');
      }

      if (!db.objectStoreNames.contains('pages')) {
        const pages = db.createObjectStore('pages', { keyPath: 'id' });
        pages.createIndex('articleId', 'articleId');
        pages.createIndex('pageNumber', 'pageNumber');
      }

      if (!db.objectStoreNames.contains('folders')) {
        const folders = db.createObjectStore('folders', { keyPath: 'id' });
        folders.createIndex('profileId', 'profileId');
      }

      if (!db.objectStoreNames.contains('recordings')) {
        const recordings = db.createObjectStore('recordings', { keyPath: 'id' });
        recordings.createIndex('articleId', 'articleId');
        recordings.createIndex('profileId', 'profileId');
      }

      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
    };

    request.onsuccess = (e) => {
      db = e.target.result;
      resolve(db);
    };

    request.onerror = () => reject(request.error);
  });
}

function getDB() {
  if (!db) throw new Error('DB not initialised. Call initDB() first.');
  return db;
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// ─── Generic helpers ───────────────────────────────────────────────

function txGet(storeName, key) {
  return new Promise((resolve, reject) => {
    const tx = getDB().transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function txGetAll(storeName, indexName, value) {
  return new Promise((resolve, reject) => {
    const tx = getDB().transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = indexName ? store.index(indexName).getAll(value) : store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function txPut(storeName, obj) {
  return new Promise((resolve, reject) => {
    const tx = getDB().transaction(storeName, 'readwrite');
    const req = tx.objectStore(storeName).put(obj);
    req.onsuccess = () => resolve(obj);
    req.onerror = () => reject(req.error);
  });
}

function txDelete(storeName, key) {
  return new Promise((resolve, reject) => {
    const tx = getDB().transaction(storeName, 'readwrite');
    const req = tx.objectStore(storeName).delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ─── Profiles ──────────────────────────────────────────────────────

export async function getProfiles() {
  return txGetAll('profiles');
}

export async function saveProfile(name) {
  const profile = { id: generateId(), name };
  return txPut('profiles', profile);
}

export async function seedProfiles() {
  const existing = await getProfiles();
  if (existing.length === 0) {
    await saveProfile('Lucas');
    await saveProfile('Kayla');
  }
}

// ─── Settings ──────────────────────────────────────────────────────

export async function getSetting(key) {
  const record = await txGet('settings', key);
  return record ? record.value : null;
}

export async function setSetting(key, value) {
  return txPut('settings', { key, value });
}

export async function seedSettings() {
  const pin = await getSetting('pin');
  if (!pin) await setSetting('pin', 'welcome');
  const provider = await getSetting('aiProvider');
  if (!provider) await setSetting('aiProvider', 'gemini');
  const pinyinProvider = await getSetting('pinyinProvider');
  if (!pinyinProvider) await setSetting('pinyinProvider', 'gemini');
  const translationProvider = await getSetting('translationProvider');
  if (!translationProvider) await setSetting('translationProvider', 'gemini');
}

// ─── Folders ───────────────────────────────────────────────────────

export async function getFolders(profileId) {
  return txGetAll('folders', 'profileId', profileId);
}

export async function saveFolder(profileId, name) {
  const folder = { id: generateId(), profileId, name, dateCreated: Date.now() };
  return txPut('folders', folder);
}

export async function updateFolder(id, updates) {
  const existing = await txGet('folders', id);
  return txPut('folders', { ...existing, ...updates });
}

export async function deleteFolder(id) {
  // Remove folder from all articles
  const allArticles = await txGetAll('articles', 'profileId');
  for (const article of allArticles) {
    if (article.folderIds && article.folderIds.includes(id)) {
      article.folderIds = article.folderIds.filter(fid => fid !== id);
      await txPut('articles', article);
    }
  }
  return txDelete('folders', id);
}

// ─── Articles ──────────────────────────────────────────────────────

export async function getArticles(profileId) {
  const articles = await txGetAll('articles', 'profileId', profileId);
  return articles.sort((a, b) => b.dateCreated - a.dateCreated);
}

export async function getArticle(id) {
  return txGet('articles', id);
}

export async function saveArticle(profileId, title, folderIds = []) {
  const article = {
    id: generateId(),
    profileId,
    title: title || 'Unknown',
    folderIds,
    dateCreated: Date.now(),
    dateModified: Date.now()
  };
  return txPut('articles', article);
}

export async function updateArticle(id, updates) {
  const existing = await txGet('articles', id);
  return txPut('articles', { ...existing, ...updates, dateModified: Date.now() });
}

export async function deleteArticle(id) {
  // Delete all pages and recordings
  const pages = await getPages(id);
  for (const page of pages) await txDelete('pages', page.id);
  const recordings = await getRecordings(id);
  for (const rec of recordings) await txDelete('recordings', rec.id);
  return txDelete('articles', id);
}

// ─── Pages ─────────────────────────────────────────────────────────

export async function getPages(articleId) {
  const pages = await txGetAll('pages', 'articleId', articleId);
  return pages.sort((a, b) => a.pageNumber - b.pageNumber);
}

export async function getPage(id) {
  return txGet('pages', id);
}

export async function savePage(articleId, pageNumber, imageBase64, mimeType, characters, fullTranslation) {
  const page = {
    id: generateId(),
    articleId,
    pageNumber,
    imageBase64,
    mimeType: mimeType || 'image/jpeg',
    characters,
    fullTranslation,
    dateCreated: Date.now()
  };
  return txPut('pages', page);
}

export async function updatePage(id, updates) {
  const existing = await txGet('pages', id);
  return txPut('pages', { ...existing, ...updates });
}

// ─── Recordings ────────────────────────────────────────────────────

export async function getRecordings(articleId) {
  const recs = await txGetAll('recordings', 'articleId', articleId);
  return recs.sort((a, b) => b.dateCreated - a.dateCreated);
}

export async function saveRecording(articleId, profileId, name, audioBlob) {
  const recording = {
    id: generateId(),
    articleId,
    profileId,
    name,
    audioBlob,
    dateCreated: Date.now()
  };
  return txPut('recordings', recording);
}

export async function updateRecording(id, updates) {
  const existing = await txGet('recordings', id);
  return txPut('recordings', { ...existing, ...updates });
}

export async function deleteRecording(id) {
  return txDelete('recordings', id);
}

// ─── Share between profiles ────────────────────────────────────────

export async function shareArticleToProfile(articleId, targetProfileId) {
  const article = await getArticle(articleId);
  const pages = await getPages(articleId);
  const recordings = await getRecordings(articleId);

  // Copy article
  const newArticle = {
    ...article,
    id: generateId(),
    profileId: targetProfileId,
    folderIds: [],
    dateCreated: Date.now(),
    dateModified: Date.now(),
    sharedFrom: article.profileId
  };
  await txPut('articles', newArticle);

  // Copy pages
  for (const page of pages) {
    await txPut('pages', {
      ...page,
      id: generateId(),
      articleId: newArticle.id,
      dateCreated: Date.now()
    });
  }

  // Copy recordings
  for (const rec of recordings) {
    await txPut('recordings', {
      ...rec,
      id: generateId(),
      articleId: newArticle.id,
      profileId: targetProfileId,
      dateCreated: Date.now()
    });
  }

  return newArticle;
}
