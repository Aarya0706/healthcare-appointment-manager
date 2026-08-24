const express = require('express');
const prisma = require('../config/db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Public-ish search (still requires login so patients see it inside the app)
router.get('/', authenticate, async (req, res) => {
  const { specialisation } = req.query;
  const doctors = await prisma.doctorProfile.findMany({
    where: specialisation ? { specialisation: { contains: String(specialisation), mode: 'insensitive' } } : {},
    include: { user: { select: { id: true, name: true } } },
  });
  res.json(doctors);
});

// Computes bookable slots for one doctor on one date, using:
//   working hours (recurring)  -  leave days  -  already HELD/CONFIRMED slots
router.get('/:doctorProfileId/availability', authenticate, async (req, res) => {
  const { doctorProfileId } = req.params;
  const dateStr = req.query.date; // "YYYY-MM-DD"
  if (!dateStr) return res.status(400).json({ error: 'date query param required, e.g. ?date=2026-09-01' });

  const doctor = await prisma.doctorProfile.findUnique({
    where: { id: doctorProfileId },
    include: { workingHours: true },
  });
  if (!doctor) return res.status(404).json({ error: 'Doctor not found' });

  const date = new Date(`${dateStr}T00:00:00`);
  const dayOfWeek = date.getDay();
  const dayStart = new Date(date); dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date); dayEnd.setHours(23, 59, 59, 999);

  const onLeave = await prisma.doctorLeave.findUnique({
    where: { doctorId_date: { doctorId: doctorProfileId, date: dayStart } },
  });
  if (onLeave) return res.json({ available: [], reason: 'Doctor is on leave this day' });

  const hours = doctor.workingHours.filter((h) => h.dayOfWeek === dayOfWeek);
  if (hours.length === 0) return res.json({ available: [], reason: 'Doctor does not work this day' });

  // Existing bookings that block a slot (HELD counts too — an unexpired hold occupies the slot)
  const taken = await prisma.appointment.findMany({
    where: {
      doctorId: doctorProfileId,
      startTime: { gte: dayStart, lte: dayEnd },
      status: { in: ['CONFIRMED', 'HELD'] },
      OR: [{ status: 'CONFIRMED' }, { status: 'HELD', holdExpiresAt: { gt: new Date() } }],
    },
    select: { startTime: true },
  });
  const takenSet = new Set(taken.map((a) => a.startTime.toISOString()));

  const slotMs = doctor.slotDurationMin * 60 * 1000;
  const slots = [];
  for (const h of hours) {
    let cursor = combineDateAndTime(date, h.startTime);
    const end = combineDateAndTime(date, h.endTime);
    while (cursor.getTime() + slotMs <= end.getTime()) {
      const iso = cursor.toISOString();
      if (!takenSet.has(iso) && cursor > new Date()) slots.push(iso);
      cursor = new Date(cursor.getTime() + slotMs);
    }
  }

  res.json({ available: slots });
});

function combineDateAndTime(date, hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date(date);
  d.setHours(h, m, 0, 0);
  return d;
}

module.exports = router;
