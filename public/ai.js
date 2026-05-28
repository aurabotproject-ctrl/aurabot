// ============================================================
// ai.js — Gemini (text) + Pollinations (image) helpers
// ============================================================

const AI = (() => {

  // Gemini key is stored in localStorage after teacher enters it once
  const GEMINI_KEY_STORAGE = 'classcard_gemini_key';

  function getGeminiKey() {
    return localStorage.getItem(GEMINI_KEY_STORAGE) || '';
  }
  function setGeminiKey(key) {
    localStorage.setItem(GEMINI_KEY_STORAGE, key);
  }

  // ── Call Gemini 2.5 Flash Lite for text/JSON ───────────────
  async function callGemini(prompt) {
    const apiKey = getGeminiKey();
    if (!apiKey) throw new Error('No Gemini API key set. Enter it in Settings.');

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 1.1, maxOutputTokens: 700 }
      })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Gemini ${res.status}: ${err.error?.message || res.statusText}`);
    }
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }

  // ── Generate card JSON from achievement description ────────
  async function generateCardData(studentName, achievement, characterHint, rarity) {
    const rarityContext = {
      'common':    'a common card — modest but positive stats (50–75 range)',
      'silver':    'an uncommon silver card — good stats (65–85 range)',
      'gold-rare': 'a rare gold card — exceptional stats (80–99 range), very powerful',
      'prismatic': 'an EXTREMELY RARE prismatic card — legendary stats (95–100 range), the most powerful card possible. This is the highest honour a student can receive.',
    }[rarity] || 'a common card';

    const characterGuide = characterHint
      ? `The character should be themed around: "${characterHint}"`
      : 'Choose a creative Pokémon-style creature type that fits the achievement (e.g. reading → book dragon; maths → clockwork fox).';

    const prompt = `You are designing a Pokémon-style reward card for a school achievement system.

Student name: "${studentName || 'Student'}"
Achievement: "${achievement}"
Rarity: ${rarityContext}
${characterGuide}

Return ONLY a JSON object — no markdown, no explanation:
{
  "cardName": "2-4 word Pokémon-style character name",
  "hp": ${rarity === 'common' ? 50 : rarity === 'silver' ? 75 : rarity === 'gold-rare' ? 100 : 150},
  "type": "ONE WORD TYPE (SCHOLAR/BRAVE/SWIFT/SAGE/SPARK/WONDER)",
  "description": "Fun 1-sentence flavour text praising the student. Max 90 chars.",
  "stat1Name": "STAT NAME (CAPS)",
  "stat1Val": ${rarity === 'common' ? 60 : rarity === 'silver' ? 75 : rarity === 'gold-rare' ? 90 : 99},
  "stat2Name": "STAT NAME",
  "stat2Val": ${rarity === 'common' ? 55 : rarity === 'silver' ? 70 : rarity === 'gold-rare' ? 85 : 98},
  "stat3Name": "STAT NAME",
  "stat3Val": ${rarity === 'common' ? 50 : rarity === 'silver' ? 65 : rarity === 'gold-rare' ? 80 : 97},
  "move1Name": "Move name with emoji",
  "move1Dmg": ${rarity === 'common' ? 35 : rarity === 'silver' ? 55 : rarity === 'gold-rare' ? 75 : 100},
  "move2Name": "Signature move with emoji",
  "move2Dmg": ${rarity === 'common' ? 55 : rarity === 'silver' ? 75 : rarity === 'gold-rare' ? 110 : 150},
  "imagePrompt": "Detailed prompt for a Pokémon-style character: creature type, colours, pose. Must be full body, white background, cartoon style, vibrant, no text."
}`;

    const raw = await callGemini(prompt);
    const clean = raw.replace(/```json|```/g, '').trim();
    try {
      return JSON.parse(clean);
    } catch {
      // Try to extract JSON if model added extra text
      const match = clean.match(/\{[\s\S]*\}/);
      if (match) return JSON.parse(match[0]);
      throw new Error('Gemini returned invalid JSON. Try again.');
    }
  }

  // ── Generate image via Pollinations (no API key needed) ────
  function generateImageUrl(prompt) {
    const encoded = encodeURIComponent(
      prompt + ', Pokemon trading card character art style, cute vibrant full body, pure white background, no text, no borders, digital illustration'
    );
    // Add a random seed so each generation is unique
    const seed = Math.floor(Math.random() * 999999);
    return `https://image.pollinations.ai/prompt/${encoded}?width=512&height=512&seed=${seed}&nologo=true`;
  }

  return { getGeminiKey, setGeminiKey, generateCardData, generateImageUrl };
})();
