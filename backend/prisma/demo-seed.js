require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const DOCTORS = [
  {
    name: 'Priya Nair',
    email: 'priya.nair@clinic.dev',
    specialisation: 'General Medicine',
    slotDurationMin: 20,
    bio: 'General physician, 10 years experience.',
    workingHours: [
      { dayOfWeek: 1, startTime: '09:00', endTime: '13:00' },
      { dayOfWeek: 2, startTime: '09:00', endTime: '13:00' },
      { dayOfWeek: 3, startTime: '09:00', endTime: '13:00' },
      { dayOfWeek: 4, startTime: '09:00', endTime: '13:00' },
      { dayOfWeek: 5, startTime: '09:00', endTime: '13:00' },
    ],
  },
  {
    name: 'Arjun Mehta',
    email: 'arjun.mehta@clinic.dev',
    specialisation: 'Dermatology',
    slotDurationMin: 30,
    bio: 'Dermatologist specialising in skin allergies.',
    workingHours: [
      { dayOfWeek: 1, startTime: '14:00', endTime: '18:00' },
      { dayOfWeek: 3, startTime: '14:00', endTime: '18:00' },
      { dayOfWeek: 5, startTime: '14:00', endTime: '18:00' },
    ],
  },
  {
    name: 'Leah Thomas',
    email: 'leah.thomas@clinic.dev',
    specialisation: 'Cardiology',
    slotDurationMin: 30,
    bio: 'Cardiologist, focuses on preventive heart health.',
    workingHours: [
      { dayOfWeek: 2, startTime: '10:00', endTime: '16:00' },
      { dayOfWeek: 4, startTime: '10:00', endTime: '16:00' },
    ],
  },
];

const DEMO_PASSWORD = 'Demo1234!';

async function main() {
  for (const d of DOCTORS) {
    const existing = await prisma.user.findUnique({ where: { email: d.email } });
    if (existing) {
      console.log('Skipping (already exists):', d.email);
      continue;
    }
    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
    await prisma.user.create({
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
    });
    console.log('Created doctor:', d.email, '/', DEMO_PASSWORD);
  }

  const patientEmail = 'demo.patient@clinic.dev';
  const existingPatient = await prisma.user.findUnique({ where: { email: patientEmail } });
  if (!existingPatient) {
    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
    await prisma.user.create({
      data: { name: 'Demo Patient', email: patientEmail, passwordHash, role: 'PATIENT', phone: '+91-9000000000' },
    });
    console.log('Created patient:', patientEmail, '/', DEMO_PASSWORD);
  } else {
    console.log('Skipping (already exists):', patientEmail);
  }

  console.log('\nAll demo accounts use password:', DEMO_PASSWORD);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
