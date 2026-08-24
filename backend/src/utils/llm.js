const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = process.env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;

const MODEL_NAME = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

/**
 * Calls Gemini and asks for STRICT JSON back. Never throws — callers get
 * { ok, data, raw, error } so a down/rate-limited LLM never breaks the
 * booking/visit flow (per assignment requirement: "LLM failures must be
 * handled gracefully, system should not break").
 */
async function callLLMJson(prompt, { timeoutMs = 15000 } = {}) {
  if (!genAI) {
    return { ok: false, data: null, raw: null, error: 'GEMINI_API_KEY not configured' };
  }

  try {
    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      generationConfig: { responseMimeType: 'application/json' },
    });

    const result = await withTimeout(model.generateContent(prompt), timeoutMs);
    const text = result.response.text();
    const data = JSON.parse(text);
    return { ok: true, data, raw: text, error: null };
  } catch (err) {
    return { ok: false, data: null, raw: null, error: err.message || String(err) };
  }
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('LLM request timed out')), ms)),
  ]);
}

// --- Prompt builders (from the assignment's "LLM Usage Guidance") ---

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
  "summary": string,          // plain-language explanation of the visit and diagnosis
  "medicationSchedule": string, // human-readable schedule, e.g. "Amoxicillin 500mg — twice a day after food, for 5 days"
  "followUpSteps": string     // what the patient should do next / when to come back
}
Respond with ONLY the JSON object, no markdown fences, no extra text.

Clinical notes: ${clinicalNotes}`;
}

module.exports = { callLLMJson, buildPreVisitPrompt, buildPostVisitPrompt };
