// js/ai/gemini.js — Gemini 2.0 Flash provider for OCR + Pinyin + Translation

export async function processImageWithGemini(imageBase64, mimeType, apiKey) {
  const prompt = `You are a Chinese language assistant. Analyse this image of a Chinese text.

Return ONLY a valid JSON object with this exact structure (no markdown, no extra text):
{
  "title": "detected article title, or null if not found",
  "characters": [
    { "char": "你", "pinyin": "nǐ", "translation": "you" },
    { "char": "好", "pinyin": "hǎo", "translation": "good" },
    { "char": " ", "pinyin": "", "translation": "" }
  ],
  "fullTranslation": "Full natural English translation of the entire text"
}

Rules:
- Include EVERY character including punctuation marks
- For spaces or line breaks use { "char": " ", "pinyin": "", "translation": "" }
- For punctuation use { "char": "。", "pinyin": "", "translation": "" }
- Pinyin must use tone marks (nǐ hǎo, not ni3 hao3)
- Chinese is Simplified
- The characters array must preserve the original reading order
- Return ONLY the JSON, nothing else`;

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
          maxOutputTokens: 8192
        }
      })
    }
  );

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || `Gemini API error: ${response.status}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) throw new Error('No response from Gemini');

  // Strip markdown code fences if present
  const clean = text.replace(/```json|```/g, '').trim();

  try {
    return JSON.parse(clean);
  } catch (e) {
    throw new Error('Failed to parse Gemini response as JSON: ' + clean.slice(0, 200));
  }
}
