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

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            {
              inline_data: {
                mime_type: mimeType,
                data: imageBase64
              }
            },
            { text: prompt }
          ]
        }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 65536,
          responseMimeType: 'application/json'
        },
        thinkingConfig: {
          thinkingBudget: 0
        }
      })
    }
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Gemini API error: ${response.status}`);
  }

  const data = await response.json();

  // Check for truncation due to max tokens
  const finishReason = data.candidates?.[0]?.finishReason;
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) throw new Error('No response from Gemini — check your API key in Settings.');

  // Strip markdown fences if Gemini added them anyway
  let clean = text.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim();

  // Attempt direct parse first
  try {
    return JSON.parse(clean);
  } catch (e) {
    // If truncated, attempt to recover by closing the JSON
    if (finishReason === 'MAX_TOKENS') {
      const recovered = attemptRecovery(clean);
      if (recovered) return recovered;
      throw new Error('Article too long — please split into smaller photos and try again.');
    }
    throw new Error('Gemini returned unexpected format. Please try again.');
  }
}

// Attempt to salvage a truncated JSON response by closing open structures
function attemptRecovery(text) {
  try {
    // Find the last complete character entry
    const lastComplete = text.lastIndexOf('},');
    if (lastComplete === -1) return null;

    // Trim to last complete entry, close the array and object
    let trimmed = text.slice(0, lastComplete + 1);
    trimmed += '], "fullTranslation": "" }';

    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}
