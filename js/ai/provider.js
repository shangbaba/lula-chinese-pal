// js/ai/provider.js — Adapter for swappable AI providers

import { ocrImage, getPinyinForText, getTranslationForText } from './gemini.js';
import { getSetting } from '../db.js';

async function getApiKey() {
  const provider = await getSetting('aiProvider') || 'gemini';
  const apiKey = await getSetting(`${provider}ApiKey`);
  if (!apiKey) throw new Error(`No API key found. Please add your Gemini API key in Settings.`);
  return { provider, apiKey };
}

// Step 1 — OCR only: returns { title, rawText }
export async function processImageOCR(imageBase64, mimeType) {
  const { provider, apiKey } = await getApiKey();
  switch (provider) {
    case 'gemini': return ocrImage(imageBase64, mimeType, apiKey);
    default: throw new Error(`Unknown provider: ${provider}`);
  }
}

// Step 2 — Pinyin: returns array of { char, pinyin }
export async function processPinyin(rawText) {
  const { provider, apiKey } = await getApiKey();
  switch (provider) {
    case 'gemini': return getPinyinForText(rawText, apiKey);
    default: throw new Error(`Unknown provider: ${provider}`);
  }
}

// Step 3 — Translation: returns plain string
export async function processTranslation(rawText) {
  const { provider, apiKey } = await getApiKey();
  switch (provider) {
    case 'gemini': return getTranslationForText(rawText, apiKey);
    default: throw new Error(`Unknown provider: ${provider}`);
  }
}

// Convert file to base64
export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(',')[1];
      resolve({ base64, mimeType: file.type });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
