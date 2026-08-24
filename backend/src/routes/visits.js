const express = require('express');
const { z } = require('zod');
const prisma = require('../config/db');
const { authenticate, requireRole } = require('../middleware/auth');
const { callLLMJson, buildPostVisitPrompt } = require('../utils/llm');

const router = express.Router();
router.use(authenticate);

const prescriptionItem = z.object({
  medicine: z.string(),
  dosage: z.string(),
  frequencyPerDay: z.number().int().positive(),
  durationDays: z.number().int().positive(),
});

router.post('/:appointmentId', requireRole('DOCTOR'), async (req, res) => {
  const schema = z.object({
    clinicalNotes: z.string().min(3),
    prescription: z.array(prescriptionItem).default([]),
    followUpDate: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const appt = await prisma.appointment.findUnique({
    where: { id: req.params.appointmentId },
    include: { doctor: true },
  });
  if (!appt) return res.status(404).json({ error: 'Appointment not found' });

  const doctorProfile = await prisma.doctorProfile.findUnique({ where: { userId: req.user.id } });
  if (!doctorProfile || appt.doctorId !== doctorProfile.id) return res.status(403).json({ error: 'Forbidden' });

  const { clinicalNotes, prescription, followUpDate } = parsed.data;
  const llm = await callLLMJson(buildPostVisitPrompt(clinicalNotes));

  const patientSummary = llm.ok
    ? `${llm.data.summary}\n\nMedication schedule: ${llm.data.medicationSchedule}\n\nNext steps: ${llm.data.followUpSteps}`
    : null;

  const note = await prisma.$transaction(async (tx) => {
    const created = await tx.postVisitNote.upsert({
      where: { appointmentId: appt.id },
      update: {
        clinicalNotes,
        prescription,
        followUpDate: followUpDate ? new Date(followUpDate) : null,
        patientSummary,
        llmStatus: llm.ok ? 'OK' : 'FAILED',
        llmRawResponse: llm.raw,
        llmError: llm.error,
      },
      create: {
        appointmentId: appt.id,
        clinicalNotes,
        prescription,
        followUpDate: followUpDate ? new Date(followUpDate) : null,
        patientSummary,
        llmStatus: llm.ok ? 'OK' : 'FAILED',
        llmRawResponse: llm.raw,
        llmError: llm.error,
      },
    });
    await tx.medicationReminder.deleteMany({
      where: { postVisitNoteId: created.id },
    });

    await tx.appointment.update({ where: { id: appt.id }, data: { status: 'COMPLETED' } });

    // Schedule medication reminders based on prescription frequency,
    // starting the day after the visit, spaced evenly across the day.
    for (const item of prescription) {
      const timesPerDay = item.frequencyPerDay;
      for (let day = 0; day < item.durationDays; day++) {
        for (let dose = 0; dose < timesPerDay; dose++) {
          const scheduledFor = new Date(appt.startTime);
          scheduledFor.setDate(scheduledFor.getDate() + day + 1);
          scheduledFor.setHours(8 + Math.round((dose * 12) / timesPerDay), 0, 0, 0);
          await tx.medicationReminder.create({
            data: { postVisitNoteId: created.id, medicine: `${item.medicine} (${item.dosage})`, scheduledFor },
          });
        }
      }
    }

    return created;
  });

  res.status(201).json(note);
});

router.get('/:appointmentId', async (req, res) => {
  const note = await prisma.postVisitNote.findUnique({
    where: { appointmentId: req.params.appointmentId },
    include: { medicationReminders: true },
  });
  if (!note) return res.status(404).json({ error: 'No post-visit note yet' });
  res.json(note);
});

module.exports = router;
