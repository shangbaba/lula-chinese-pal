// js/ai/provider.js — Adapter pattern for swappable AI providers

import { processImageWithGemini } from './gemini.js';
import { getSetting } from '../db.js';

export async function processImage(imageBase64, mimeType) {
  const provider = await getSetting('aiProvider') || 'gemini';
  const apiKey = await getSetting(`${provider}ApiKey`);

  if (!apiKey) {
    throw new Error(`No API key found for provider "${provider}". Please add it in Settings.`);
  }

  switch (provider) {
    case 'gemini':
      return processImageWithGemini(imageBase64, mimeType, apiKey);
    default:
      throw new Error(`Unknown provider: ${provider}`);
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
