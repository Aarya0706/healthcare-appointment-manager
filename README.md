# Healthcare Appointment & Follow-up Manager

A clinic platform with separate portals for **patients**, **doctors**, and **admins**.

Patients can book appointments and submit symptoms in advance. Google Gemini generates a pre-visit summary with an urgency level for the doctor. After the visit, doctors submit clinical notes and prescriptions, and Gemini generates a patient-friendly summary. The system also supports email notifications, Google Calendar integration, medication reminders, doctor leave handling, and safe concurrent booking.

## 🌐 Live Demo

**Frontend:**  
https://healthcare-appointment-manager-sandy.vercel.app

**Backend:**  
https://healthcare-appointment-manager-olad.onrender.com

**Backend Health Check:**  
https://healthcare-appointment-manager-olad.onrender.com/api/health

Expected response:

```json
{"ok":true}
```

**GitHub Repository:**  
https://github.com/Aarya0706/healthcare-appointment-manager

---

## 🔐 Demo Login

### Admin

```text
Email: admin@clinic.dev
Password: ChangeMe123!
```

### Doctor

```text
Email: testdoctor@clinic.dev
Password: TestDoctor123
```

### Patient

Patients can create an account from the **Create an account** page.

> These credentials are for demonstration/testing only.

---

## ✨ Features

### Patient Portal

- Patient registration and login
- Search doctors by specialisation
- View doctor availability
- Hold an appointment slot temporarily
- Submit symptoms before confirmation
- Receive an AI-generated pre-visit summary
- Confirm and cancel appointments
- View appointment history
- View completed visit summaries
- View medication information
- Connect Google Calendar

### Doctor Portal

- Doctor login
- View scheduled appointments
- View patient symptoms
- View AI-generated pre-visit summary
- See urgency level and suggested questions
- Submit clinical notes
- Add prescriptions
- Generate a patient-friendly post-visit summary
- Connect Google Calendar

### Admin Portal

- Admin login
- Create doctor profiles
- Configure doctor specialisation
- Configure slot duration
- Configure recurring working hours
- Mark doctors on leave
- Automatically handle affected appointments

### AI Features

- Pre-visit symptom analysis
- Urgency classification: Low / Medium / High
- Chief complaint extraction
- Three suggested doctor questions
- Post-visit patient-friendly summary
- Medication schedule summary
- Follow-up guidance
- Graceful LLM failure handling

### Booking & Reliability

- Temporary slot holds
- Hold expiration
- Double-booking prevention
- Database unique constraint on doctor + start time
- Doctor leave conflict handling
- Transactional notification outbox
- Background email retry handling

### Notifications & Reminders

- Booking confirmation notifications
- Cancellation notifications
- Leave notifications
- Medication reminders
- Background reminder job
- Background email retry job

### Google Calendar

- OAuth 2.0 connection
- Per-user Google Calendar authorization
- Calendar event creation for confirmed appointments
- Calendar event deletion on cancellation
- Best-effort calendar synchronization

---

## 🛠️ Tech Stack

- **Frontend:** React + Vite + React Router
- **Backend:** Node.js + Express
- **Database:** PostgreSQL + Prisma ORM
- **Authentication:** JWT + role-based access control
- **LLM:** Google Gemini via `@google/genai`
- **Background Jobs:** `node-cron`
- **Email:** Nodemailer / SMTP
- **Calendar:** Google Calendar API + OAuth 2.0
- **Frontend Hosting:** Vercel
- **Backend Hosting:** Render
- **Database Hosting:** Neon PostgreSQL

---

## 📁 Project Structure

```text
healthcare-appointment-manager/
│
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── seed.js
│   │   └── demo-seed.js
│   │
│   ├── src/
│   │   ├── routes/
│   │   │   ├── auth.js
│   │   │   ├── admin.js
│   │   │   ├── doctors.js
│   │   │   ├── appointments.js
│   │   │   ├── symptoms.js
│   │   │   ├── visits.js
│   │   │   └── calendarAuth.js
│   │   │
│   │   ├── utils/
│   │   │   ├── llm.js
│   │   │   ├── email.js
│   │   │   ├── calendar.js
│   │   │   └── notify.js
│   │   │
│   │   ├── jobs/
│   │   │   └── background jobs
│   │   │
│   │   └── middleware/
│   │       └── auth.js
│   │
│   ├── package.json
│   └── .env.example
│
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── patient/
│   │   │   ├── doctor/
│   │   │   └── admin/
│   │   ├── components/
│   │   └── api.js
│   ├── package.json
│   └── .env.example
│
├── README.md
├── SYSTEM_DESIGN.md
└── postman_collection.json
```

---

## ⚙️ Local Setup

### 1. Database

Any PostgreSQL database can be used.

Create a database if needed:

```bash
createdb ham
```

Set the connection string in `backend/.env`:

```env
DATABASE_URL=your_postgresql_connection_string
```

### 2. Backend

```bash
cd backend
npm install
```

Create `.env` from `.env.example` and configure the required values:

```env
DATABASE_URL=...
JWT_SECRET=...
JWT_EXPIRES_IN=7d

GEMINI_API_KEY=...
GEMINI_MODEL=gemini-3.6-flash

EMAIL_PROVIDER=...
EMAIL_FROM=...

SMTP_HOST=...
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...

GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=...

SLOT_HOLD_MINUTES=10
REMINDER_CRON=*/15 * * * *
EMAIL_RETRY_CRON=*/5 * * * *
```

Run Prisma:

```bash
npx prisma migrate dev
```

Seed the initial admin:

```bash
npm run seed
```

Start the backend:

```bash
npm run dev
```

Local backend:

```text
http://localhost:4000
```

Health check:

```text
http://localhost:4000/api/health
```

### 3. Frontend

```bash
cd frontend
npm install
```

Create `frontend/.env`:

```env
VITE_API_URL=http://localhost:4000/api
```

Start the frontend:

```bash
npm run dev
```

Local frontend:

```text
http://localhost:5173
```

---

## 🤖 Gemini Setup

Create a Gemini API key using Google AI Studio:

https://aistudio.google.com/apikey

Set:

```env
GEMINI_API_KEY=your_key
GEMINI_MODEL=gemini-3.6-flash
```

The application uses the `@google/genai` SDK.

### LLM Failure Handling

The LLM helper catches failures and returns a structured result instead of throwing.

```text
{
  ok,
  data,
  raw,
  error
}
```

If Gemini is unavailable:

- Appointment booking still completes
- Visit-note submission still completes
- The database records `llmStatus = FAILED`
- The UI falls back to raw symptoms or clinical notes

---

## 🧠 LLM Prompts

### Pre-visit Summary

```text
Analyse these symptoms and return a JSON object with EXACTLY these keys:

{
  "urgency": "Low" | "Medium" | "High",
  "chiefComplaint": string,
  "suggestedQuestions": [string, string, string]
}

Respond with ONLY the JSON object.

Symptoms: <symptoms>
```

### Post-visit Summary

```text
Convert these clinical notes into a patient-friendly summary.

Return a JSON object with EXACTLY these keys:

{
  "summary": string,
  "medicationSchedule": string,
  "followUpSteps": string
}

Respond with ONLY the JSON object.

Clinical notes: <notes>
```

The backend requests structured JSON output so the result can be parsed and stored reliably.

---

## 🗄️ Database Schema

The full schema is in:

```text
backend/prisma/schema.prisma
```

Main models:

```text
User
DoctorProfile
WorkingHours
DoctorLeave
Appointment
SymptomForm
PostVisitNote
MedicationReminder
Notification
```

Key relationship flow:

```text
User
 ├── DoctorProfile
 ├── Appointments
 └── Notifications

DoctorProfile
 ├── WorkingHours
 ├── DoctorLeave
 └── Appointments

Appointment
 ├── SymptomForm
 └── PostVisitNote

PostVisitNote
 └── MedicationReminder
```

Double-booking protection:

```prisma
@@unique([doctorId, startTime])
```

---

## 📡 API Overview

| Method | Endpoint | Role | Purpose |
|---|---|---|---|
| POST | `/api/auth/register` | Anyone | Patient registration |
| POST | `/api/auth/login` | Anyone | Login |
| POST | `/api/admin/doctors` | Admin | Create doctor |
| POST | `/api/admin/doctors/:id/leave` | Admin | Mark doctor leave |
| GET | `/api/doctors` | Authenticated | Search doctors |
| GET | `/api/doctors/:id/availability` | Authenticated | Get available slots |
| POST | `/api/appointments/hold` | Patient | Hold a slot |
| POST | `/api/appointments/:id/confirm` | Patient | Confirm booking |
| POST | `/api/appointments/:id/cancel` | Patient/Doctor/Admin | Cancel appointment |
| GET | `/api/appointments` | Authenticated | List appointments |
| POST | `/api/symptoms/:appointmentId` | Patient | Submit symptoms |
| POST | `/api/visits/:appointmentId` | Doctor | Submit visit note |
| GET | `/api/calendar/connect` | Authenticated | Start Google Calendar OAuth |
| GET | `/api/calendar/oauth/callback` | Google | OAuth callback |
| GET | `/api/health` | Public | Backend health check |

---

## ⏰ Background Jobs

### Medication Reminder Job

Finds due, unsent medication reminders and creates notification-outbox entries.

Default schedule:

```env
REMINDER_CRON=*/15 * * * *
```

### Email Retry Job

Processes pending and failed notification deliveries.

Default schedule:

```env
EMAIL_RETRY_CRON=*/5 * * * *
```

This keeps slow or failed email delivery from blocking the main booking and visit transactions.

---

## 📅 Google Calendar Setup

1. Open Google Cloud Console:
   https://console.cloud.google.com/
2. Enable **Google Calendar API**.
3. Create an OAuth 2.0 **Web application** client.
4. Add the local redirect URI if developing locally:

```text
http://localhost:4000/api/calendar/oauth/callback
```

5. Add the production redirect URI:

```text
https://healthcare-appointment-manager-olad.onrender.com/api/calendar/oauth/callback
```

6. Configure the matching variables in the backend:

```env
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=...
```

7. Add the Google account used for testing as a test user if the OAuth app is in Testing mode.
8. Users connect their own calendar from the application **Settings** page.

Calendar synchronization is best-effort. A booking should not fail just because calendar synchronization fails.

---

## 📬 Notifications

The application uses a notification outbox so email/calendar side effects do not control the success of core database transactions.

Notification statuses:

```text
PENDING
SENT
FAILED
```

Supported notification types include:

```text
BOOKING_CONFIRMATION
APPOINTMENT_REMINDER
CANCELLATION
LEAVE_NOTICE
MEDICATION_REMINDER
```

---

## 📦 Postman

The repository includes:

```text
postman_collection.json
```

The collection covers the main API workflow:

```text
Admin login
→ Create doctor
→ Patient login
→ Hold slot
→ Submit symptoms
→ Confirm appointment
→ Doctor login
→ Submit visit note
```

Set `baseUrl` to the deployed API or your local API before running the collection.

---

## 🚀 Deployment

### Frontend — Vercel

Live URL:

https://healthcare-appointment-manager-sandy.vercel.app

Environment variable:

```env
VITE_API_URL=https://healthcare-appointment-manager-olad.onrender.com/api
```

### Backend — Render

Live URL:

https://healthcare-appointment-manager-olad.onrender.com

Health check:

https://healthcare-appointment-manager-olad.onrender.com/api/health

Production environment variables are configured in Render and are not committed to Git.

### Database — Neon

The production backend uses PostgreSQL hosted on Neon.

---

## 📄 System Design

See `SYSTEM_DESIGN.md` for:

- Double-booking prevention
- Appointment hold mechanism
- Database transaction strategy
- Doctor leave conflict handling
- Notification outbox and retry handling
- LLM failure handling
- Google Calendar failure handling
- Background jobs

---

## 🔗 Useful Links

| Resource | Link |
|---|---|
| Live Application | https://healthcare-appointment-manager-sandy.vercel.app |
| Backend API | https://healthcare-appointment-manager-olad.onrender.com |
| Backend Health | https://healthcare-appointment-manager-olad.onrender.com/api/health |
| GitHub Repository | https://github.com/Aarya0706/healthcare-appointment-manager |
| Gemini API Key | https://aistudio.google.com/apikey |
| Google Cloud Console | https://console.cloud.google.com/ |
