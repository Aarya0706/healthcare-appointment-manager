const prisma = require('../config/db');
const { sendEmail, templates } = require('./email');

/**
 * Outbox pattern: writing a Notification row is part of the SAME DB
 * transaction as the business action (booking, cancellation, etc.), so
 * "the booking succeeded but nobody got notified" can't happen silently.
 * Actually sending the email happens afterwards (here, or by the retry
 * job), and can fail/retry independently of the booking transaction.
 */
async function queueNotification(tx, { userId, type, payload }) {
  return (tx || prisma).notification.create({
    data: { userId, type, channel: 'EMAIL', payload },
  });
}

async function processNotification(notification) {
  const user = await prisma.user.findUnique({ where: { id: notification.userId } });
  if (!user) throw new Error('Notification target user no longer exists');

  const build = templates[notification.type];
  if (!build) throw new Error(`No email template for type ${notification.type}`);

  const { subject, html } = build({ name: user.name, ...notification.payload });
  await sendEmail({ to: user.email, subject, html });
}

/** Processes all PENDING/FAILED notifications with attempts < maxAttempts. */
async function drainNotificationQueue({ maxAttempts = 5, batchSize = 25 } = {}) {
  const batch = await prisma.notification.findMany({
    where: { status: { in: ['PENDING', 'FAILED'] }, attempts: { lt: maxAttempts } },
    orderBy: { createdAt: 'asc' },
    take: batchSize,
  });

  const results = { sent: 0, failed: 0 };

  for (const n of batch) {
    try {
      await processNotification(n);
      await prisma.notification.update({
        where: { id: n.id },
        data: { status: 'SENT', sentAt: new Date(), attempts: { increment: 1 } },
      });
      results.sent++;
    } catch (err) {
      await prisma.notification.update({
        where: { id: n.id },
        data: { status: 'FAILED', attempts: { increment: 1 }, lastError: err.message || String(err) },
      });
      results.failed++;
    }
  }
  return results;
}

module.exports = { queueNotification, drainNotificationQueue };
