const { google } = require('googleapis');
const prisma = require('../config/db');

function oauthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

function getAuthUrl(state) {
  const client = oauthClient();
  return client.generateAuthUrl({
    access_type: 'offline', // needed to get a refresh_token
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/calendar.events'],
    state, // pass the userId through so the callback knows who's connecting
  });
}

async function exchangeCodeForTokens(code) {
  const client = oauthClient();
  const { tokens } = await client.getToken(code);
  return tokens; // { access_token, refresh_token, expiry_date, ... }
}

/** Returns an authorized calendar client for a given user, or null if they haven't connected Google Calendar. */
async function calendarClientForUser(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.googleRefreshToken) return null;

  const client = oauthClient();
  client.setCredentials({
    refresh_token: user.googleRefreshToken,
    access_token: user.googleAccessToken || undefined,
  });
  return google.calendar({ version: 'v3', auth: client });
}

/** Creates a calendar event for a user; returns the Google event id, or null if not connected / on failure. */
async function createEvent(userId, { summary, description, startTime, endTime }) {
  try {
    const calendar = await calendarClientForUser(userId);
    if (!calendar) return null;

    const res = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: {
        summary,
        description,
        start: { dateTime: new Date(startTime).toISOString() },
        end: { dateTime: new Date(endTime).toISOString() },
      },
    });
    return res.data.id;
  } catch (err) {
    console.error('Google Calendar createEvent failed:', err.message);
    return null; // calendar sync is best-effort — never blocks a booking
  }
}

async function updateEvent(userId, eventId, { summary, description, startTime, endTime }) {
  try {
    const calendar = await calendarClientForUser(userId);
    if (!calendar || !eventId) return false;
    await calendar.events.patch({
      calendarId: 'primary',
      eventId,
      requestBody: {
        summary,
        description,
        start: { dateTime: new Date(startTime).toISOString() },
        end: { dateTime: new Date(endTime).toISOString() },
      },
    });
    return true;
  } catch (err) {
    console.error('Google Calendar updateEvent failed:', err.message);
    return false;
  }
}

async function deleteEvent(userId, eventId) {
  try {
    const calendar = await calendarClientForUser(userId);
    if (!calendar || !eventId) return false;
    await calendar.events.delete({ calendarId: 'primary', eventId });
    return true;
  } catch (err) {
    console.error('Google Calendar deleteEvent failed:', err.message);
    return false;
  }
}

module.exports = { getAuthUrl, exchangeCodeForTokens, createEvent, updateEvent, deleteEvent };
