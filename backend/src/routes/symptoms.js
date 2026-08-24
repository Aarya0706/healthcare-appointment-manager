const express = require('express');
const { z } = require('zod');
const prisma = require('../config/db');
const { authenticate, requireRole } = require('../middleware/auth');
const { callLLMJson, buildPreVisitPrompt } = require('../utils/llm');

const router = express.Router();
router.use(authenticate);

// Patient submits symptoms for a held/confirmed appointment; we generate
// the pre-visit LLM summary synchronously (it's a short prompt, and the
// doctor needs it before the visit) but NEVER let an LLM failure block
// the booking — see llm.js: callLLMJson always resolves, never throws.
router.post('/:appointmentId', requireRole('PATIENT'), async (req, res) => {
  const schema = z.object({ symptoms: z.string().min(3), durationDays: z.number().int().optional() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const appt = await prisma.appointment.findUnique({ where: { id: req.params.appointmentId } });
  if (!appt || appt.patientId !== req.user.id) return res.status(404).json({ error: 'Appointment not found' });

  const { symptoms, durationDays } = parsed.data;
  const llm = await callLLMJson(buildPreVisitPrompt(symptoms));

  const data = {
    rawSymptoms: symptoms,
    durationDays,
    llmStatus: llm.ok ? 'OK' : 'FAILED',
    llmRawResponse: llm.raw,
    llmError: llm.error,
    ...(llm.ok
      ? {
          urgency: mapUrgency(llm.data.urgency),
          chiefComplaint: llm.data.chiefComplaint,
          suggestedQuestions: llm.data.suggestedQuestions,
        }
      : {}),
  };

  const form = await prisma.symptomForm.upsert({
    where: { appointmentId: appt.id },
    update: data,
    create: { appointmentId: appt.id, ...data },
  });

  res.status(201).json(form);
});

router.get('/:appointmentId', async (req, res) => {
  const form = await prisma.symptomForm.findUnique({ where: { appointmentId: req.params.appointmentId } });
  if (!form) return res.status(404).json({ error: 'No symptom form yet' });
  res.json(form);
});

function mapUrgency(v) {
  const m = { Low: 'LOW', Medium: 'MEDIUM', High: 'HIGH' };
  return m[v] || null;
}

module.exports = router;
