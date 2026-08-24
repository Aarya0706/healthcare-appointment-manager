const cron = require('node-cron');
const prisma = require('../config/db');
const { queueNotification, drainNotificationQueue } = require('../utils/notify');

/**
 * Every REMINDER_CRON tick: find medication reminders whose time has
 * come and haven't been sent, queue an email for each, mark them sent.
 * Queueing (rather than sending inline) means a slow/broken SMTP server
 * can't back up this loop — the retry job below owns actual delivery.
 */
function startMedicationReminderJob() {
  cron.schedule(process.env.REMINDER_CRON || '*/15 * * * *', async () => {
    const due = await prisma.medicationReminder.findMany({
      where: { sent: false, scheduledFor: { lte: new Date() } },
      include: { postVisitNote: { include: { appointment: true } } },
      take: 100,
    });

    for (const r of due) {
      await prisma.$transaction(async (tx) => {
        await queueNotification(tx, {
          userId: r.postVisitNote.appointment.patientId,
          type: 'MEDICATION_REMINDER',
          payload: { medicine: r.medicine },
        });
        await tx.medicationReminder.update({ where: { id: r.id }, data: { sent: true, sentAt: new Date() } });
      });
    }
    if (due.length) console.log(`[reminders] queued ${due.length} medication reminder emails`);
  });
}

/** Flushes the notification outbox (new + previously failed sends). */
function startEmailRetryJob() {
  cron.schedule(process.env.EMAIL_RETRY_CRON || '*/5 * * * *', async () => {
    const result = await drainNotificationQueue();
    if (result.sent || result.failed) {
      console.log(`[email-retry] sent=${result.sent} failed=${result.failed}`);
    }
  });
}

function startJobs() {
  startMedicationReminderJob();
  startEmailRetryJob();
}

module.exports = { startJobs };
