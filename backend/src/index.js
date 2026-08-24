require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const doctorRoutes = require('./routes/doctors');
const appointmentRoutes = require('./routes/appointments');
const symptomRoutes = require('./routes/symptoms');
const visitRoutes = require('./routes/visits');
const calendarAuthRoutes = require('./routes/calendarAuth');
const { startJobs } = require('./jobs');

const app = express();
app.use(cors({ origin: process.env.CLIENT_URL || '*' }));
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/symptoms', symptomRoutes);
app.use('/api/visits', visitRoutes);
app.use('/api/calendar', calendarAuthRoutes);

// Central error handler — keeps a thrown/rejected route handler from
// crashing the process (LLM/email/calendar helpers already fail soft,
// but this is the backstop for anything else).
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`API listening on :${PORT}`);
  startJobs();
});
