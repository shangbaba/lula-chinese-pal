// js/ai/gemini.js — Gemini 2.5 Flash provider for OCR + Pinyin + Translation

export async function processImageWithGemini(imageBase64, mimeType, apiKey) {
  const prompt = `You are a Chinese language assistant. Analyse this image of Chinese text.

Return ONLY a valid JSON object, no markdown fences, no explanation, no extra text whatsoever.

JSON structure:
{
  "title": "detected article title string, or null",
  "characters": [
    { "char": "你", "pinyin": "nǐ", "translation": "you" },
    { "char": "好", "pinyin": "hǎo", "translation": "good" },
    { "char": "。", "pinyin": "", "translation": "" },
    { "char": " ", "pinyin": "", "translation": "" }
  ],
  "fullTranslation": "Full natural English translation of the entire text"
}

Rules:
- characters array must contain EVERY character in reading order
- spaces/line breaks: { "char": " ", "pinyin": "", "translation": "" }
- punctuation: { "char": "。", "pinyin": "", "translation": "" }
- pinyin must use tone marks (nǐ hǎo), never numbers (ni3 hao3)
- Chinese is Simplified
- translation per character should be very short (1-3 words max)
- Return ONLY the raw JSON object, starting with { and ending with }`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  const body = JSON.stringify({
    contents: [{
      parts: [
        { inline_data: { mime_type: mimeType, data: imageBase64 } },
        { text: prompt }
      ]
    }],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 65536,
      responseMimeType: 'application/json'
    }
  });

  // ── Make the request with detailed error capture ──────────────
  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body
    });
  } catch (networkErr) {
    // fetch() itself threw — network offline, DNS failure, CORS, SSL, etc.
    const detail = networkErr?.message || String(networkErr);
    throw new Error(
      `Network error reaching Gemini API. ` +
      `Check your internet connection. Detail: ${detail}`
    );
  }

  // ── Non-200 HTTP response ─────────────────────────────────────
  if (!response.ok) {
    let errBody = {};
    try { errBody = await response.json(); } catch {}

    const apiMsg = errBody?.error?.message || '';
    const status = response.status;

    if (status === 400) throw new Error(`Gemini 400 Bad Request: ${apiMsg || 'Invalid request — check image format.'}`);
    if (status === 401) throw new Error(`Gemini 401 Unauthorised: API key is invalid or missing. Go to Settings and re-enter your key.`);
    if (status === 403) throw new Error(`Gemini 403 Forbidden: API key does not have access to this model. Check your Google AI Studio project.`);
    if (status === 429) throw new Error(`Gemini 429 Rate Limited: Too many requests or quota exceeded. Wait a moment and try again. ${apiMsg}`);
    if (status === 500) throw new Error(`Gemini 500 Server Error: Google's API had an internal error. Try again in a moment.`);
    if (status === 503) throw new Error(`Gemini 503 Unavailable: Google's API is temporarily down. Try again shortly.`);
    throw new Error(`Gemini API error ${status}: ${apiMsg || response.statusText}`);
  }

  // ── Parse response body ───────────────────────────────────────
  let data;
  try {
    data = await response.json();
  } catch (parseErr) {
    throw new Error(`Failed to parse Gemini response body: ${parseErr.message}`);
  }

  const finishReason = data.candidates?.[0]?.finishReason;
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    const blockReason = data.promptFeedback?.blockReason;
    if (blockReason) throw new Error(`Gemini blocked the request: ${blockReason}. Try a different image.`);
    if (finishReason) throw new Error(`Gemini returned no text. Finish reason: ${finishReason}.`);
    throw new Error(`Gemini returned an empty response. Check your API key in Settings.`);
  }

  // ── Strip markdown fences if present ─────────────────────────
  let clean = text.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim();

  // ── Parse JSON ────────────────────────────────────────────────
  try {
    return JSON.parse(clean);
  } catch (jsonErr) {
    if (finishReason === 'MAX_TOKENS') {
      const recovered = attemptRecovery(clean);
      if (recovered) return recovered;
      throw new Error(`Article too long — the response was cut off. Try splitting the photo into smaller sections.`);
    }
    throw new Error(
      `Gemini response was not valid JSON. Finish reason: ${finishReason || 'STOP'}. ` +
      `First 300 chars of response: ${clean.slice(0, 300)}`
    );
  }
}

// Attempt to salvage a truncated JSON response
function attemptRecovery(text) {
  try {
    const lastComplete = text.lastIndexOf('},');
    if (lastComplete === -1) return null;
    let trimmed = text.slice(0, lastComplete + 1);
    trimmed += '], "fullTranslation": "" }';
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}
