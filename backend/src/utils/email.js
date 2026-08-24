const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  const provider = process.env.EMAIL_PROVIDER || 'smtp';

  if (provider === 'sendgrid') {
    transporter = nodemailer.createTransport({
      host: 'smtp.sendgrid.net',
      port: 587,
      auth: { user: 'apikey', pass: process.env.SENDGRID_API_KEY },
    });
  } else if (provider === 'mailgun') {
    transporter = nodemailer.createTransport({
      host: `smtp.mailgun.org`,
      port: 587,
      auth: { user: `postmaster@${process.env.MAILGUN_DOMAIN}`, pass: process.env.MAILGUN_API_KEY },
    });
  } else {
    // Plain SMTP (Gmail app password, Mailtrap for dev, etc.)
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: false,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transporter;
}

/**
 * Sends one email. Throws on failure — callers (the notification outbox
 * worker) catch this and mark the Notification row FAILED for retry,
 * rather than letting a bad SMTP config crash a request.
 */
async function sendEmail({ to, subject, html }) {
  const t = getTransporter();
  await t.sendMail({ from: process.env.EMAIL_FROM, to, subject, html });
}

const templates = {
  BOOKING_CONFIRMATION: ({ name, doctorName, startTime }) => ({
    subject: 'Appointment confirmed',
    html: `<p>Hi ${name},</p><p>Your appointment with Dr. ${doctorName} is confirmed for <b>${new Date(startTime).toLocaleString()}</b>.</p>`,
  }),
  APPOINTMENT_REMINDER: ({ name, doctorName, startTime }) => ({
    subject: 'Appointment reminder',
    html: `<p>Hi ${name},</p><p>Reminder: your appointment with Dr. ${doctorName} is at <b>${new Date(startTime).toLocaleString()}</b>.</p>`,
  }),
  CANCELLATION: ({ name, doctorName, startTime, reason }) => ({
    subject: 'Appointment cancelled',
    html: `<p>Hi ${name},</p><p>Your appointment with Dr. ${doctorName} on <b>${new Date(startTime).toLocaleString()}</b> has been cancelled.${reason ? ` Reason: ${reason}` : ''}</p>`,
  }),
  LEAVE_NOTICE: ({ name, doctorName, date }) => ({
    subject: 'Your doctor is unavailable — please rebook',
    html: `<p>Hi ${name},</p><p>Dr. ${doctorName} is on leave on <b>${new Date(date).toDateString()}</b>, so your appointment that day has been cancelled. Please rebook at a convenient slot — we're sorry for the inconvenience.</p>`,
  }),
  MEDICATION_REMINDER: ({ name, medicine }) => ({
    subject: 'Medication reminder',
    html: `<p>Hi ${name},</p><p>Time to take your medicine: <b>${medicine}</b>.</p>`,
  }),
};

module.exports = { sendEmail, templates };
