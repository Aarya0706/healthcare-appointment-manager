# System Design Write-up

## Slot hold mechanism

Booking is two steps, not one write. Step 1 (`POST /appointments/hold`) creates an
`Appointment` row in status `HELD` with `holdExpiresAt = now + SLOT_HOLD_MINUTES` (default
10). This reserves the slot while the patient fills out the symptom form, without
permanently claiming it if they abandon the flow. Step 2 (`POST /appointments/:id/confirm`)
flips `HELD → CONFIRMED` only if the hold hasn't expired; an expired hold is rejected with
`410 Gone` and the row is cancelled so the slot frees up. A held-but-expired row is also
swept just before a new hold is created for the same slot, so abandoned holds don't
permanently block a slot even before the cron-driven cleanup runs. This mirrors the
"reserve → checkout" pattern used by ticketing systems, where the alternative — writing a
CONFIRMED row immediately — would mean a patient who never finishes the symptom form
occupies the slot forever.

## Double-booking prevention

Two layers, because either one alone is insufficient under concurrency:

1. **Application-level read.** `GET /doctors/:id/availability` and the hold endpoint both
   exclude slots that already have a `CONFIRMED` row or an unexpired `HELD` row. This is
   what makes the UI show accurate availability.
2. **Database constraint (the real guarantee).** `Appointment` has
   `@@unique([doctorId, startTime])`. Two patients clicking the same slot within
   milliseconds of each other can both pass the application-level check — there's a race
   window between the read and the write — but only one `INSERT` can succeed at the
   database level; Postgres rejects the second with a unique-violation, which the hold
   route catches (`err.code === 'P2002'`) and returns as a clean `409 Conflict` telling the
   patient to pick another slot. This is the layer that actually prevents double-booking
   under simultaneous requests; the availability check is just a UX nicety that makes
   conflicts rare rather than the thing that makes them impossible.

An alternative considered was row-level locking (`SELECT ... FOR UPDATE`) on a synthetic
"slot" row before insert. The unique constraint is preferred here: it needs no extra table,
works correctly even if two requests hit different application server instances (which a
locked in-memory mutex would not), and pushes the correctness guarantee to the one place
that can actually enforce it atomically — the database's own consistency model.

## Doctor leave conflict handling

Marking a doctor on leave (`POST /admin/doctors/:id/leave`) and handling its fallout — cancel
affected bookings, notify affected patients — runs inside a single Prisma `$transaction`.
The transaction: (1) upserts the `DoctorLeave` row for that date, (2) queries every
`CONFIRMED`/`HELD` appointment for that doctor on that date, (3) flips each to status
`DOCTOR_LEAVE`, and (4) writes a `Notification` row (outbox pattern, see below) for each
affected patient. Doing this atomically matters because the failure mode to avoid is a
doctor being recorded as on leave while some of their patients silently keep a booking that
will never happen, or a partial run notifying some patients but not others if the process
dies mid-loop. Because it is a single transaction, either the whole leave-and-cascade
succeeds and every affected patient has a queued notification, or none of it commits and
the admin can retry safely (the `upsert` on `[doctorId, date]` makes retries idempotent).

The `DoctorLeave` table is also consulted directly in `availability` and `hold`, so it isn't
possible to double-book a doctor who is already marked on leave for that date after the
fact — leave and availability read from the same source of truth.

## Notification failure handling

Emails (and, less critically, calendar syncs) must never block or roll back the action that
triggered them — a down SMTP server shouldn't prevent a booking from being confirmed. The
system uses an **outbox pattern**: a `Notification` row is written inside the *same*
transaction as the business action (booking confirmation, cancellation, leave cascade), so
"the booking succeeded but nobody was even queued to be notified" cannot happen. Sending the
actual email happens afterward, decoupled from that transaction, either immediately after
commit or by a cron job (`EMAIL_RETRY_CRON`, every 5 minutes) that drains all `PENDING` and
previously `FAILED` notifications up to a max retry count, tracking `attempts` and
`lastError` per row. A send failure marks the row `FAILED` for the next retry pass rather
than raising an error to the user. Google Calendar events follow the same "best-effort,
after commit, never blocks the transaction" principle, but are not currently retried via the
outbox (a failed calendar sync just leaves `googleEventId*` null) — a reasonable follow-up
would be to route calendar sync through the same outbox/retry mechanism as email.
