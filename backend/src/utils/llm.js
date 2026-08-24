const { GoogleGenAI } = require('@google/genai');

const apiKey = process.env.GEMINI_API_KEY;
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

const MODEL_NAME = process.env.GEMINI_MODEL || 'gemini-3.5-flash';

const PRE_VISIT_SCHEMA = {
  type: 'object',
  properties: {
    urgency: {
      type: 'string',
      enum: ['Low', 'Medium', 'High'],
    },
    chiefComplaint: {
      type: 'string',
    },
    suggestedQuestions: {
      type: 'array',
      items: { type: 'string' },
    },
  },
  required: ['urgency', 'chiefComplaint', 'suggestedQuestions'],
};

const POST_VISIT_SCHEMA = {
  type: 'object',
  properties: {
    summary: {
      type: 'string',
    },
    medicationSchedule: {
      type: 'string',
    },
    followUpSteps: {
      type: 'string',
    },
  },
  required: ['summary', 'medicationSchedule', 'followUpSteps'],
};

async function callLLMJson(prompt, schema, { timeoutMs = 15000 } = {}) {
  if (!ai) {
    return {
      ok: false,
      data: null,
      raw: null,
      error: 'GEMINI_API_KEY not configured',
    };
  }

  try {
    const response = await withTimeout(
      ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: schema,
        },
      }),
      timeoutMs
    );

    const text = response.text?.trim();

    if (!text) {
      throw new Error('Gemini returned an empty response');
    }

    const data = JSON.parse(text);

    return {
      ok: true,
      data,
      raw: text,
      error: null,
    };
  } catch (err) {
    console.error('[llm] callLLMJson failed:', err.message || err);

    return {
      ok: false,
      data: null,
      raw: null,
      error: err.message || String(err),
    };
  }
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('LLM request timed out')), ms)
    ),
  ]);
}

function buildPreVisitPrompt(symptoms) {
  return `Analyze the patient's symptoms and return JSON only.

Return:
- urgency: exactly one of Low, Medium, High
- chiefComplaint: a concise description of the main complaint
- suggestedQuestions: exactly 3 useful questions for the doctor to ask

Do not diagnose the patient.

Symptoms:
${symptoms}`;
}

function buildPostVisitPrompt(clinicalNotes) {
  return `Convert the following doctor's clinical notes into a clear,
patient-friendly summary.

Return JSON only with:
- summary: easy-to-understand explanation
- medicationSchedule: explain medicines and schedule if present
- followUpSteps: explain follow-up instructions

Do not add information that is not present in the clinical notes.

Clinical notes:
${clinicalNotes}`;
}

async function generatePreVisitSummary(symptoms) {
  return callLLMJson(
    buildPreVisitPrompt(symptoms),
    PRE_VISIT_SCHEMA
  );
}

async function generatePostVisitSummary(clinicalNotes) {
  return callLLMJson(
    buildPostVisitPrompt(clinicalNotes),
    POST_VISIT_SCHEMA
  );
}

module.exports = {
  callLLMJson,
  buildPreVisitPrompt,
  buildPostVisitPrompt,
  generatePreVisitSummary,
  generatePostVisitSummary,
};