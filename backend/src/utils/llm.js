const { GoogleGenAI } = require('@google/genai');

const ai = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  : null;

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
    summary: { type: 'string' },
    medicationSchedule: { type: 'string' },
    followUpSteps: { type: 'string' },
  },
  required: ['summary', 'medicationSchedule', 'followUpSteps'],
};

async function callLLMJson(
  prompt,
  { timeoutMs = 15000, schema = null } = {}
) {
  if (!ai) {
    return {
      ok: false,
      data: null,
      raw: null,
      error: 'GEMINI_API_KEY not configured',
    };
  }

  try {
    const config = {
      responseMimeType: 'application/json',
    };

    if (schema) {
      config.responseSchema = schema;
    }

    const result = await withTimeout(
      ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config,
      }),
      timeoutMs
    );

    const text = result.text?.trim();

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
      setTimeout(
        () => reject(new Error('LLM request timed out')),
        ms
      )
    ),
  ]);
}

function buildPreVisitPrompt(symptoms) {
  return `Analyse these symptoms and return ONLY valid JSON.

{
  "urgency": "Low" | "Medium" | "High",
  "chiefComplaint": "string",
  "suggestedQuestions": ["question 1", "question 2", "question 3"]
}

Do not diagnose the patient.

Symptoms: ${symptoms}`;
}

function buildPostVisitPrompt(clinicalNotes) {
  return `Convert these clinical notes into a patient-friendly summary.

Return ONLY valid JSON:

{
  "summary": "string",
  "medicationSchedule": "string",
  "followUpSteps": "string"
}

Do not invent information.

Clinical notes: ${clinicalNotes}`;
}

async function generatePreVisitSummary(symptoms) {
  return callLLMJson(buildPreVisitPrompt(symptoms), {
    schema: PRE_VISIT_SCHEMA,
  });
}

async function generatePostVisitSummary(clinicalNotes) {
  return callLLMJson(buildPostVisitPrompt(clinicalNotes), {
    schema: POST_VISIT_SCHEMA,
  });
}

module.exports = {
  callLLMJson,
  buildPreVisitPrompt,
  buildPostVisitPrompt,
  generatePreVisitSummary,
  generatePostVisitSummary,
};