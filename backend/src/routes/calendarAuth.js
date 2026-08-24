const express = require('express');
const prisma = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { getAuthUrl, exchangeCodeForTokens } = require('../utils/calendar');

const router = express.Router();

// Returns the Google consent URL for the logged-in user to visit.
router.get('/connect', authenticate, (req, res) => {
  const url = getAuthUrl(req.user.id);
  res.json({ url });
});

// Google redirects here after consent. No auth middleware — Google
// can't send our Bearer token — so the userId travels in `state` instead.
router.get('/oauth/callback', async (req, res) => {
  const { code, state: userId } = req.query;
  if (!code || !userId) return res.status(400).send('Missing code or state');

  try {
    const tokens = await exchangeCodeForTokens(code);
    await prisma.user.update({
      where: { id: String(userId) },
      data: {
        googleRefreshToken: tokens.refresh_token || undefined, // only present on first consent
        googleAccessToken: tokens.access_token,
        googleTokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      },
    });
    res.redirect(`${process.env.CLIENT_URL}/settings?calendar=connected`);
  } catch (err) {
    console.error('Calendar OAuth callback failed:', err.message);
    res.redirect(`${process.env.CLIENT_URL}/settings?calendar=error`);
  }
});

module.exports = router;
