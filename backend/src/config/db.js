const { PrismaClient } = require('@prisma/client');

// Single shared Prisma instance across the app (avoids exhausting DB
// connections in dev with hot-reload, and is the standard pattern for
// serverless/small deployments too).
const prisma = new PrismaClient();

module.exports = prisma;
