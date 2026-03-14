// js/ai/gemini.js — Gemini 2.5 Flash — three separate operations

const MODEL_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

async function callGemini(apiKey, parts, expectJson = true) {
  const url = `${MODEL_URL}?key=${apiKey}`;
  const body = JSON.stringify({
    contents: [{ parts }],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 65536,
      ...(expectJson ? { responseMimeType: 'application/json' } : {})
    }
  });

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body
    });
  } catch (networkErr) {
    throw new Error(`Network error reaching Gemini API. Check your internet connection. Detail: ${networkErr?.message || networkErr}`);
  }

  if (!response.ok) {
    let errBody = {};
    try { errBody = await response.json(); } catch {}
    const apiMsg = errBody?.error?.message || '';
    const status = response.status;
    if (status === 400) throw new Error(`Gemini 400 Bad Request: ${apiMsg || 'Invalid request — check image format.'}`);
    if (status === 401) throw new Error(`Gemini 401 Unauthorised: API key is invalid or missing. Go to Settings and re-enter your key.`);
    if (status === 403) throw new Error(`Gemini 403 Forbidden: API key does not have access to this model.`);
    if (status === 429) throw new Error(`Gemini 429 Rate Limited: Quota exceeded. Wait a moment and try again. ${apiMsg}`);
    if (status === 500) throw new Error(`Gemini 500 Server Error: Try again in a moment.`);
    if (status === 503) throw new Error(`Gemini 503 Unavailable: Google's API is temporarily down.`);
    throw new Error(`Gemini API error ${status}: ${apiMsg || response.statusText}`);
  }

  let data;
  try { data = await response.json(); } catch (e) {
    throw new Error(`Failed to parse Gemini response: ${e.message}`);
  }

  const finishReason = data.candidates?.[0]?.finishReason;
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    const blockReason = data.promptFeedback?.blockReason;
    if (blockReason) throw new Error(`Gemini blocked the request: ${blockReason}.`);
    throw new Error(`Gemini returned an empty response. Finish reason: ${finishReason || 'unknown'}`);
  }

  if (!expectJson) return text.trim();

  const clean = text.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim();
  try {
    return JSON.parse(clean);
  } catch {
    if (finishReason === 'MAX_TOKENS') {
      const recovered = attemptRecovery(clean);
      if (recovered) return recovered;
      throw new Error(`Response was cut off — article too long. Try splitting into smaller photos.`);
    }
    throw new Error(`Gemini response was not valid JSON. First 300 chars: ${clean.slice(0, 300)}`);
  }
}

// ── Step 1: OCR only ─────────────────────────────────────────────
// Returns { title, rawText }
export async function ocrImage(imageBase64, mimeType, apiKey) {
  const prompt = `You are a Chinese OCR assistant. Extract all Chinese text from this image exactly as it appears.

Return ONLY a JSON object:
{
  "title": "the article title if visible at the top, or null",
  "rawText": "the full extracted text, preserving line breaks with \\n"
}

Rules:
- Extract ONLY the main article text
- Preserve punctuation exactly
- Use \\n for line breaks
- Do NOT add pinyin, translation, or any explanation
- Return ONLY the raw JSON object`;

  return callGemini(apiKey, [
    { inline_data: { mime_type: mimeType, data: imageBase64 } },
    { text: prompt }
  ]);
}

// ── Step 2: Pinyin for cleaned text ─────────────────────────────
// Returns { characters: [{ char, pinyin }] }
export async function getPinyinForText(rawText, apiKey) {
  const prompt = `You are a Chinese language assistant. Add pinyin to the following Chinese text.

Text:
${rawText}

Return ONLY a JSON object:
{
  "characters": [
    { "char": "你", "pinyin": "nǐ" },
    { "char": "好", "pinyin": "hǎo" },
    { "char": "。", "pinyin": "" },
    { "char": " ", "pinyin": "" }
  ]
}

Rules:
- Include EVERY character in order, including punctuation and spaces
- Spaces: { "char": " ", "pinyin": "" }
- Punctuation: { "char": "。", "pinyin": "" }
- Pinyin must use tone marks (nǐ hǎo), never numbers
- Return ONLY the raw JSON object`;

  const result = await callGemini(apiKey, [{ text: prompt }]);
  return result.characters || [];
}

// ── Step 3: Translation for cleaned text ────────────────────────
// Returns a plain string
export async function getTranslationForText(rawText, apiKey) {
  const prompt = `Translate the following Chinese text into natural English. Return only the translation, no explanation.

Chinese text:
${rawText}`;

  return callGemini(apiKey, [{ text: prompt }], false);
}

// Attempt to salvage truncated JSON
function attemptRecovery(text) {
  try {
    const lastComplete = text.lastIndexOf('},');
    if (lastComplete === -1) return null;
    let trimmed = text.slice(0, lastComplete + 1);
    trimmed += '], "fullTranslation": "" }';
    return JSON.parse(trimmed);
  } catch { return null; }
}
