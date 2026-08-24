const express = require('express');
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const prisma = require('../config/db');
const { authenticate, requireRole } = require('../middleware/auth');
const { queueNotification } = require('../utils/notify');

const router = express.Router();
router.use(authenticate, requireRole('ADMIN'));

// --- Create a doctor (account + profile + working hours) ---
const createDoctorSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  specialisation: z.string().min(1),
  slotDurationMin: z.number().int().positive().default(30),
  bio: z.string().optional(),
  workingHours: z
    .array(z.object({ dayOfWeek: z.number().int().min(0).max(6), startTime: z.string(), endTime: z.string() }))
    .min(1),
});

router.post('/doctors', async (req, res) => {
  const parsed = createDoctorSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const d = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email: d.email } });
  if (existing) return res.status(409).json({ error: 'Email already registered' });

  const passwordHash = await bcrypt.hash(d.password, 10);

  const doctor = await prisma.user.create({
    data: {
      name: d.name,
      email: d.email,
      passwordHash,
      role: 'DOCTOR',
      doctorProfile: {
        create: {
          specialisation: d.specialisation,
          slotDurationMin: d.slotDurationMin,
          bio: d.bio,
          workingHours: { createMany: { data: d.workingHours } },
        },
      },
    },
    include: { doctorProfile: { include: { workingHours: true } } },
  });

  res.status(201).json({ id: doctor.id, name: doctor.name, email: doctor.email, doctorProfile: doctor.doctorProfile });
});

router.get('/doctors', async (req, res) => {
  const doctors = await prisma.doctorProfile.findMany({
    include: { user: { select: { id: true, name: true, email: true } }, workingHours: true, leaves: true },
  });
  res.json(doctors);
});

router.patch('/doctors/:doctorProfileId', async (req, res) => {
  const schema = z.object({
    specialisation: z.string().optional(),
    slotDurationMin: z.number().int().positive().optional(),
    bio: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const updated = await prisma.doctorProfile.update({
    where: { id: req.params.doctorProfileId },
    data: parsed.data,
  });
  res.json(updated);
});

// --- Leave management ---
// Marking a doctor on leave for a date must cascade: cancel any existing
// CONFIRMED appointments that day and notify each affected patient. This
// runs as one transaction so a crash mid-way can't leave some patients
// silently un-notified while the leave is already recorded.
router.post('/doctors/:doctorProfileId/leave', async (req, res) => {
  const schema = z.object({ date: z.string(), reason: z.string().optional() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { doctorProfileId } = req.params;
  const date = new Date(parsed.data.date);
  const dayStart = new Date(date); dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date); dayEnd.setHours(23, 59, 59, 999);

  const result = await prisma.$transaction(async (tx) => {
    const leave = await tx.doctorLeave.upsert({
      where: { doctorId_date: { doctorId: doctorProfileId, date: dayStart } },
      update: { reason: parsed.data.reason },
      create: { doctorId: doctorProfileId, date: dayStart, reason: parsed.data.reason },
    });

    const affected = await tx.appointment.findMany({
      where: {
        doctorId: doctorProfileId,
        startTime: { gte: dayStart, lte: dayEnd },
        status: { in: ['CONFIRMED', 'HELD'] },
      },
      include: { doctor: { include: { user: true } } },
    });

    for (const appt of affected) {
      await tx.appointment.update({ where: { id: appt.id }, data: { status: 'DOCTOR_LEAVE' } });
      await queueNotification(tx, {
        userId: appt.patientId,
        type: 'LEAVE_NOTICE',
        payload: { doctorName: appt.doctor.user.name, date: dayStart },
      });
    }

    return { leave, affectedCount: affected.length };
  });

  res.status(201).json(result);
});

router.get('/doctors/:doctorProfileId/leave', async (req, res) => {
  const leaves = await prisma.doctorLeave.findMany({ where: { doctorId: req.params.doctorProfileId } });
  res.json(leaves);
});

// --- Unmark a leave day ---
// Only removes the DoctorLeave record. Appointments that were cancelled
// when the leave was marked stay CANCELLED/DOCTOR_LEAVE — we don't
// silently re-confirm them, since that would re-book patients without
// their say. The admin/patient can re-book normally once the slot is
// open again.
router.delete('/doctors/:doctorProfileId/leave/:leaveId', async (req, res) => {
  const { doctorProfileId, leaveId } = req.params;

  const leave = await prisma.doctorLeave.findUnique({ where: { id: leaveId } });
  if (!leave || leave.doctorId !== doctorProfileId) {
    return res.status(404).json({ error: 'Leave record not found' });
  }

  await prisma.doctorLeave.delete({ where: { id: leaveId } });
  res.json({ ok: true });
});

module.exports = router;
