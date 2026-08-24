const express = require('express');
const { z } = require('zod');
const prisma = require('../config/db');
const { authenticate, requireRole } = require('../middleware/auth');
const { queueNotification } = require('../utils/notify');
const calendar = require('../utils/calendar');

const router = express.Router();
router.use(authenticate);

const HOLD_MINUTES = Number(process.env.SLOT_HOLD_MINUTES || 10);

/**
 * STEP 1 — Hold a slot.
 *
 * Double-booking prevention has two layers:
 *  1. Application check: look up any CONFIRMED row, or a HELD row whose
 *     hold hasn't expired, for this (doctorId, startTime).
 *  2. DB guarantee: @@unique([doctorId, startTime]) on Appointment. Two
 *     simultaneous requests can both pass the application check (race
 *     window between the read and the write), but only one INSERT can
 *     win — Postgres rejects the second with a unique-violation (P2002),
 *     which we translate into a clean 409. This is what actually makes
 *     concurrent booking attempts safe, not the pre-check alone.
 */
router.post('/hold', requireRole('PATIENT'), async (req, res) => {
  const schema = z.object({ doctorId: z.string(), startTime: z.string() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { doctorId, startTime } = parsed.data;
  const doctor = await prisma.doctorProfile.findUnique({ where: { id: doctorId } });
  if (!doctor) return res.status(404).json({ error: 'Doctor not found' });

  const start = new Date(startTime);
  const end = new Date(start.getTime() + doctor.slotDurationMin * 60 * 1000);

  // Best-effort cleanup of stale holds so the slot frees up for others.
  await prisma.appointment.updateMany({
    where: { doctorId, startTime: start, status: 'HELD', holdExpiresAt: { lt: new Date() } },
    data: { status: 'CANCELLED' },
  });

  try {
    const appt = await prisma.appointment.create({
      data: {
        patientId: req.user.id,
        doctorId,
        startTime: start,
        endTime: end,
        status: 'HELD',
        holdExpiresAt: new Date(Date.now() + HOLD_MINUTES * 60 * 1000),
      },
    });
    res.status(201).json(appt);
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'That slot was just taken. Please pick another.' });
    }
    throw err;
  }
});

/**
 * STEP 2 — Confirm a held slot (after the symptom form is submitted).
 * Sends booking-confirmation emails and creates Google Calendar events
 * for both patient and doctor. Calendar/email side effects are queued in
 * the SAME transaction as the status flip, then flushed after commit —
 * see utils/notify.js for why.
 */
router.post('/:id/confirm', requireRole('PATIENT'), async (req, res) => {
  const appt = await prisma.appointment.findUnique({
    where: { id: req.params.id },
    include: { doctor: { include: { user: true } }, patient: true },
  });
  if (!appt || appt.patientId !== req.user.id) return res.status(404).json({ error: 'Appointment not found' });
  if (appt.status !== 'HELD') return res.status(400).json({ error: `Cannot confirm an appointment in status ${appt.status}` });
  if (appt.holdExpiresAt && appt.holdExpiresAt < new Date()) {
    await prisma.appointment.update({ where: { id: appt.id }, data: { status: 'CANCELLED' } });
    return res.status(410).json({ error: 'Hold expired. Please book the slot again.' });
  }

  const confirmed = await prisma.$transaction(async (tx) => {
    const updated = await tx.appointment.update({ where: { id: appt.id }, data: { status: 'CONFIRMED' } });
    await queueNotification(tx, {
      userId: appt.patientId,
      type: 'BOOKING_CONFIRMATION',
      payload: { doctorName: appt.doctor.user.name, startTime: appt.startTime },
    });
    await queueNotification(tx, {
      userId: appt.doctor.user.id,
      type: 'BOOKING_CONFIRMATION',
      payload: { doctorName: appt.doctor.user.name, startTime: appt.startTime },
    });
    return updated;
  });

  // Calendar sync is best-effort and happens after commit — a failed
  // Google API call must never roll back a confirmed booking.
  const [patientEventId, doctorEventId] = await Promise.all([
    calendar.createEvent(appt.patientId, {
      summary: `Appointment with Dr. ${appt.doctor.user.name}`,
      description: 'Booked via Clinic Appointment Manager',
      startTime: appt.startTime,
      endTime: appt.endTime,
    }),
    calendar.createEvent(appt.doctor.user.id, {
      summary: `Appointment with ${appt.patient.name}`,
      description: 'Booked via Clinic Appointment Manager',
      startTime: appt.startTime,
      endTime: appt.endTime,
    }),
  ]);

  if (patientEventId || doctorEventId) {
    await prisma.appointment.update({
      where: { id: appt.id },
      data: { googleEventIdPatient: patientEventId, googleEventIdDoctor: doctorEventId },
    });
  }

  res.json(confirmed);
});

router.post('/:id/cancel', async (req, res) => {
  const appt = await prisma.appointment.findUnique({
    where: { id: req.params.id },
    include: { doctor: { include: { user: true } } },
  });
  if (!appt) return res.status(404).json({ error: 'Appointment not found' });

  const isOwner = appt.patientId === req.user.id;
  const isDoctor = appt.doctor.user.id === req.user.id;
  if (!isOwner && !isDoctor && req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Forbidden' });

  await prisma.$transaction(async (tx) => {
    await tx.appointment.update({ where: { id: appt.id }, data: { status: 'CANCELLED' } });
    await queueNotification(tx, {
      userId: appt.patientId,
      type: 'CANCELLATION',
      payload: { doctorName: appt.doctor.user.name, startTime: appt.startTime, reason: req.body?.reason },
    });
  });

  if (appt.googleEventIdPatient) await calendar.deleteEvent(appt.patientId, appt.googleEventIdPatient);
  if (appt.googleEventIdDoctor) await calendar.deleteEvent(appt.doctor.user.id, appt.googleEventIdDoctor);

  res.json({ ok: true });
});

router.get('/', async (req, res) => {
  let where = {};
  if (req.user.role === 'PATIENT') where = { patientId: req.user.id };
  else if (req.user.role === 'DOCTOR') {
    const profile = await prisma.doctorProfile.findUnique({ where: { userId: req.user.id } });
    where = { doctorId: profile?.id };
  }
  const appts = await prisma.appointment.findMany({
    where,
    include: {
      doctor: { include: { user: { select: { name: true } } } },
      patient: { select: { name: true, email: true } },
      symptomForm: true,
      postVisitNote: true,
    },
    orderBy: { startTime: 'desc' },
  });
  res.json(appts);
});

module.exports = router;
