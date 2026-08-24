require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const email = 'admin@clinic.dev';
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log('Admin already exists:', email);
    return;
  }

  const passwordHash = await bcrypt.hash('ChangeMe123!', 10);
  await prisma.user.create({
    data: { name: 'Clinic Admin', email, passwordHash, role: 'ADMIN' },
  });
  console.log('Seeded admin user ->', email, '/ ChangeMe123!  (change this immediately)');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
