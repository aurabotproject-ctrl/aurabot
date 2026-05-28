// ai.ts — Gemini (text) + Pollinations (image) helpers
const GEMINI_KEY_STORAGE = 'classcard_gemini_key';

export const AI = {
  getGeminiKey(): string {
    return localStorage.getItem(GEMINI_KEY_STORAGE) || '';
  },

  setGeminiKey(key: string) {
    localStorage.setItem(GEMINI_KEY_STORAGE, key);
  },

  /* async callGemini(prompt: string): Promise<string> {
    const apiKey = this.getGeminiKey();
    if (!apiKey) throw new Error('No Gemini API key set. Enter it in Settings.');

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 1.1, maxOutputTokens: 700 },
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Gemini ${res.status}: ${err.error?.message || res.statusText}`);
    }
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  },
  */

  async callGemini(prompt: string): Promise<string> {
    const apiKey = this.getGeminiKey(); // You can leave this named 'Gemini' so your UI settings still work!
    if (!apiKey) throw new Error('No AI API key set. Enter it in Settings.');

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        // We are using Meta's massive 70-billion parameter model. It's smart and great at JSON.
        model: 'llama-3.3-70b-versatile', 
        messages: [{ role: 'user', content: prompt }],
        // This forces the AI to strictly return JSON, preventing formatting errors
        response_format: { type: 'json_object' },
        temperature: 1.1
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`AI Error ${res.status}: ${err.error?.message || res.statusText}`);
    }

    const data = await res.json();
    return data.choices[0].message.content || '';
  },

  async generateCardData(studentName: string, achievement: string, characterHint: string, rarity: string) {
    const rarityContext: Record<string, string> = {
      common: 'a common card — modest but positive stats (50-75 range)',
      silver: 'an uncommon silver card — good stats (65-85 range)',
      'gold-rare': 'a rare gold card — exceptional stats (80-99 range), very powerful',
      prismatic: 'an EXTREMELY RARE prismatic card — legendary stats (95-100 range), the most powerful card possible',
    };

    const characterGuide = characterHint
      ? `The character should be themed around: "${characterHint}"`
      : 'Choose a creative Pokemon-style creature type that fits the achievement (e.g. reading -> book dragon; maths -> clockwork fox).';

    const hp = rarity === 'common' ? 50 : rarity === 'silver' ? 75 : rarity === 'gold-rare' ? 100 : 150;
    const stat1 = rarity === 'common' ? 60 : rarity === 'silver' ? 75 : rarity === 'gold-rare' ? 90 : 99;
    const stat2 = rarity === 'common' ? 55 : rarity === 'silver' ? 70 : rarity === 'gold-rare' ? 85 : 98;
    const stat3 = rarity === 'common' ? 50 : rarity === 'silver' ? 65 : rarity === 'gold-rare' ? 80 : 97;
    const dmg1 = rarity === 'common' ? 35 : rarity === 'silver' ? 55 : rarity === 'gold-rare' ? 75 : 100;
    const dmg2 = rarity === 'common' ? 55 : rarity === 'silver' ? 75 : rarity === 'gold-rare' ? 110 : 150;

    const prompt = `You are designing a Pokemon-style reward card for a school achievement system.

Student name: "${studentName || 'Student'}"
Achievement: "${achievement}"
Rarity: ${rarityContext[rarity] || 'a common card'}
${characterGuide}

Return ONLY a JSON object — no markdown, no explanation:
{
  "cardName": "2-4 word Pokemon-style character name",
  "hp": ${hp},
  "type": "ONE WORD TYPE (SCHOLAR/BRAVE/SWIFT/SAGE/SPARK/WONDER)",
  "description": "Fun 1-sentence flavour text praising the student. Max 90 chars.",
  "stat1Name": "STAT NAME (CAPS)",
  "stat1Val": ${stat1},
  "stat2Name": "STAT NAME",
  "stat2Val": ${stat2},
  "stat3Name": "STAT NAME",
  "stat3Val": ${stat3},
  "move1Name": "Move name with emoji",
  "move1Dmg": ${dmg1},
  "move2Name": "Signature move with emoji",
  "move2Dmg": ${dmg2},
  "imagePrompt": "Detailed prompt for a Pokemon-style character: creature type, colours, pose. Must be full body, white background, cartoon style, vibrant, no text."
}`;

    const raw = await this.callGemini(prompt);
    const clean = raw.replace(/```json|```/g, '').trim();
    try {
      return JSON.parse(clean);
    } catch {
      const match = clean.match(/\{[\s\S]*\}/);
      if (match) return JSON.parse(match[0]);
      throw new Error('Gemini returned invalid JSON. Try again.');
    }
  },

  generateImageUrl(prompt: string): string {
    const encoded = encodeURIComponent(
      prompt + ', Pokemon trading card character art style, cute vibrant full body, pure white background, no text, no borders, digital illustration'
    );
    const seed = Math.floor(Math.random() * 999999);
    return `https://image.pollinations.ai/prompt/${encoded}?width=512&height=512&seed=${seed}&nologo=true`;
  },
};
