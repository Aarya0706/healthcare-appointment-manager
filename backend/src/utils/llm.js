const { GoogleGenAI } = require('@google/genai');

const ai = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  : null;

const MODEL_NAME = process.env.GEMINI_MODEL || 'gemini-3.5-flash';

/**
 * Calls Gemini and asks for STRICT JSON back. Never throws — callers get
 * { ok, data, raw, error } so a down/rate-limited LLM never breaks the
 * booking/visit flow (per assignment requirement: "LLM failures must be
 * handled gracefully, system should not break").
 */
async function callLLMJson(prompt, { timeoutMs = 15000 } = {}) {
  if (!ai) {
    return { ok: false, data: null, raw: null, error: 'GEMINI_API_KEY not configured' };
  }

  try {
    const result = await withTimeout(
      ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: { responseMimeType: 'application/json' },
      }),
      timeoutMs
    );

    const text = result.text;
    const data = JSON.parse(text);
    return { ok: true, data, raw: text, error: null };
  } catch (err) {
    // IMPORTANT: log this — this line is why you've had no idea what's failing
    console.error('[llm] callLLMJson failed:', err.message || err);
    return { ok: false, data: null, raw: null, error: err.message || String(err) };
  }
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('LLM request timed out')), ms)),
  ]);
}

// --- Prompt builders (unchanged) ---

function buildPreVisitPrompt(symptoms) {
  return `Analyse these symptoms and return a JSON object with EXACTLY these keys:
{
  "urgency": "Low" | "Medium" | "High",
  "chiefComplaint": string,
  "suggestedQuestions": [string, string, string]
}
Respond with ONLY the JSON object, no markdown fences, no extra text.

Symptoms: ${symptoms}`;
}

function buildPostVisitPrompt(clinicalNotes) {
  return `Convert these clinical notes into a patient-friendly summary. Return a JSON object with EXACTLY these keys:
{
  "summary": string,
  "medicationSchedule": string,
  "followUpSteps": string
}
Respond with ONLY the JSON object, no markdown fences, no extra text.

Clinical notes: ${clinicalNotes}`;
}

module.exports = { callLLMJson, buildPreVisitPrompt, buildPostVisitPrompt };