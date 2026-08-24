# Healthcare Appointment & Follow-up Manager

A clinic platform with separate portals for **patients**, **doctors**, and an **admin**.
Patients book appointments and describe symptoms in advance; an LLM produces a pre-visit
summary with urgency level for the doctor; the doctor logs notes and a prescription after
the visit and an LLM turns that into a patient-friendly summary; both sides get email
confirmations and Google Calendar events; patients get medication reminders.

## Stack

- **Backend:** Node.js + Express, PostgreSQL via Prisma ORM, JWT auth, `node-cron` background jobs
- **Frontend:** React (Vite), React Router
- **LLM:** Google Gemini (`gemini-2.5-flash`) — free tier, no card required
- **Email:** Nodemailer (SMTP / SendGrid / Mailgun — pick one)
- **Calendar:** Google Calendar API via OAuth 2.0

## Project structure

```
backend/
  prisma/schema.prisma   # DB schema (see below)
  prisma/seed.js         # creates an initial admin user
  src/
    routes/               auth, admin, doctors, appointments, symptoms, visits, calendarAuth
    utils/                llm.js, email.js, calendar.js, notify.js (notification outbox)
    jobs/                 medication reminders + email retry (cron)
    middleware/auth.js    JWT auth + role guard
frontend/
  src/
    pages/patient/         booking flow, appointment list
    pages/doctor/           schedule, pre-visit summary, post-visit note form
    pages/admin/            doctor management, leave
README.md
SYSTEM_DESIGN.md
```

## Setup

### 1. Database

```bash
# any Postgres works — local, or a free instance on Render/Neon/Supabase
createdb ham
```

### 2. Backend

```bash
cd backend
cp .env.example .env      # fill in DATABASE_URL, JWT_SECRET, GEMINI_API_KEY, SMTP_*, GOOGLE_*
npm install
npx prisma migrate dev --name init
npm run seed               # creates admin@clinic.dev / ChangeMe123!
npm run dev                 # http://localhost:4000
```

### 3. Frontend

```bash
cd frontend
cp .env.example .env       # VITE_API_URL=http://localhost:4000/api
npm install
npm run dev                 # http://localhost:5173
```

### 4. Log in

- **Admin:** `admin@clinic.dev` / `ChangeMe123!` (seeded — change the password via the DB/console; there's no self-service admin password reset in this MVP)
- **Doctor:** create one from the Admin → Doctors screen (or `POST /api/admin/doctors`)
- **Patient:** register from the app's Sign up page

### 5. Demo data (optional)

For a ready-to-click demo without manually creating accounts:

```bash
cd backend
npm run seed:demo
```

Creates 3 doctors (General Medicine, Dermatology, Cardiology — each with different working
hours) and one demo patient, all with password `Demo1234!`:

| Role | Email |
|---|---|
| Doctor | priya.nair@clinic.dev (Mon–Fri mornings) |
| Doctor | arjun.mehta@clinic.dev (Mon/Wed/Fri afternoons) |
| Doctor | leah.thomas@clinic.dev (Tue/Thu) |
| Patient | demo.patient@clinic.dev |

### 6. Postman collection

`postman_collection.json` at the project root covers every endpoint, with test scripts that
auto-capture tokens and IDs into collection variables so you can run requests top-to-bottom
(login as admin → create doctor → login as patient → hold slot → submit symptoms → confirm →
login as doctor → submit visit note) without copy-pasting values by hand. Import it into
Postman and set `baseUrl` if your API isn't on `localhost:4000`.

## Getting a free Gemini API key

1. Go to https://aistudio.google.com/apikey
2. Create a key (no billing required on the free tier)
3. Put it in `backend/.env` as `GEMINI_API_KEY`

Free tier covers this project comfortably (1,500 requests/day on Flash). If `GEMINI_API_KEY`
is missing or a request fails, the app **does not break** — see "LLM failure handling" below.

## Google Calendar setup (OAuth 2.0)

1. In [Google Cloud Console](https://console.cloud.google.com/), create a project and enable the **Google Calendar API**.
2. Under **APIs & Services → Credentials**, create an **OAuth client ID** (type: Web application).
3. Add an authorized redirect URI matching `GOOGLE_REDIRECT_URI` in `.env`, e.g. `http://localhost:4000/api/calendar/oauth/callback`.
4. Copy the client ID/secret into `backend/.env`.
5. Each user (patient or doctor) connects their own calendar from the app by calling `GET /api/calendar/connect`, visiting the returned URL, and granting access. Google redirects back to the callback route, which stores their refresh token.
6. Calendar sync is **best-effort**: a user who hasn't connected simply doesn't get an event created — booking still succeeds.

## LLM prompts (as used in `backend/src/utils/llm.js`)

**Pre-visit summary** (patient symptoms → doctor prep):
```
Analyse these symptoms and return a JSON object with EXACTLY these keys:
{ "urgency": "Low"|"Medium"|"High", "chiefComplaint": string, "suggestedQuestions": [string, string, string] }
Respond with ONLY the JSON object.
Symptoms: <symptoms>
```

**Post-visit summary** (clinical notes → patient-friendly):
```
Convert these clinical notes into a patient-friendly summary. Return a JSON object with EXACTLY these keys:
{ "summary": string, "medicationSchedule": string, "followUpSteps": string }
Respond with ONLY the JSON object.
Clinical notes: <notes>
```

Both are requested as strict JSON (`responseMimeType: application/json`) so the backend can
parse and store structured fields instead of free text.

### LLM failure handling

`callLLMJson()` never throws — it always resolves to `{ ok, data, raw, error }`. On failure,
the appointment/visit-note is still created; the record is stored with `llmStatus: "FAILED"`
and the raw error, and the doctor/patient sees a plain-text fallback (raw symptoms / raw
clinical notes) instead of a summary. Nothing in the booking or visit-note flow depends on
the LLM call succeeding.

## Database schema (see `backend/prisma/schema.prisma` for the full source)

`User` (role: PATIENT/DOCTOR/ADMIN) → `DoctorProfile` (1:1 for doctors) → `WorkingHours` (recurring
weekly availability) + `DoctorLeave` (specific dates) → `Appointment` (unique on
`[doctorId, startTime]`, statuses HELD/CONFIRMED/CANCELLED/COMPLETED/DOCTOR_LEAVE) →
`SymptomForm` (1:1, pre-visit) and `PostVisitNote` (1:1, post-visit, holds prescription JSON) →
`MedicationReminder` (many per note) → `Notification` (outbox for all emails).

## API overview

| Method | Path | Who | Purpose |
|---|---|---|---|
| POST | `/api/auth/register` | anyone | patient self-registration |
| POST | `/api/auth/login` | anyone | login, all roles |
| POST | `/api/admin/doctors` | admin | create doctor + working hours |
| POST | `/api/admin/doctors/:id/leave` | admin | mark a leave day; cancels & notifies affected patients |
| GET | `/api/doctors?specialisation=` | authenticated | search doctors |
| GET | `/api/doctors/:id/availability?date=` | authenticated | computed open slots |
| POST | `/api/appointments/hold` | patient | step 1: reserve a slot (with hold expiry) |
| POST | `/api/appointments/:id/confirm` | patient | step 2: confirm after symptom form; sends email + calendar |
| POST | `/api/appointments/:id/cancel` | patient/doctor/admin | cancel; sends email, deletes calendar events |
| GET | `/api/appointments` | authenticated | list mine (role-scoped) |
| POST | `/api/symptoms/:appointmentId` | patient | submit symptoms → pre-visit LLM summary |
| POST | `/api/visits/:appointmentId` | doctor | submit notes/prescription → post-visit LLM summary + reminders |
| GET | `/api/calendar/connect` | authenticated | returns Google consent URL |
| GET | `/api/calendar/oauth/callback` | (Google redirect) | stores refresh token |

## Deployment

- **Backend:** Render/Railway (Node service) + managed Postgres (Render/Neon/Supabase free tier).
  Set all `.env` vars in the host's dashboard, run `npx prisma migrate deploy` on release.
- **Frontend:** Vercel/Netlify/Render static site. Set `VITE_API_URL` to the deployed backend URL.
- Remember to add the deployed backend's callback URL to the Google OAuth client's authorized redirect URIs, and to your CORS `CLIENT_URL`.
