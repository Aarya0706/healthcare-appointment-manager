import { useEffect, useState } from 'react';
import { api } from '../../api.js';
import { useAuth } from '../../AuthContext.jsx';

const STEPS = { SEARCH: 'search', SYMPTOMS: 'symptoms', DONE: 'done' };

export default function BookAppointment() {
  const { auth } = useAuth();
  const token = auth.token;

  const [specialisation, setSpecialisation] = useState('');
  const [doctors, setDoctors] = useState([]);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [slots, setSlots] = useState([]);
  const [held, setHeld] = useState(null); // HELD appointment
  const [step, setStep] = useState(STEPS.SEARCH);
  const [symptoms, setSymptoms] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api.listDoctors(token, specialisation).then(setDoctors).catch((e) => setError(e.message));
  }, [specialisation]);

  useEffect(() => {
    if (!selectedDoctor) return;
    api.availability(token, selectedDoctor.id, date).then((r) => setSlots(r.available || [])).catch((e) => setError(e.message));
  }, [selectedDoctor, date]);

  async function pickSlot(iso) {
    setError('');
    try {
      const appt = await api.holdSlot(token, { doctorId: selectedDoctor.id, startTime: iso });
      setHeld(appt);
      setStep(STEPS.SYMPTOMS);
    } catch (e) {
      setError(e.message);
      // Refresh availability — slot was probably just taken by someone else.
      api.availability(token, selectedDoctor.id, date).then((r) => setSlots(r.available || []));
    }
  }

  async function submitSymptomsAndConfirm(e) {
    e.preventDefault();
    setError('');
    try {
      await api.submitSymptoms(token, held.id, { symptoms });
      await api.confirmAppointment(token, held.id);
      setStep(STEPS.DONE);
    } catch (e) {
      setError(e.message);
    }
  }

  if (step === STEPS.DONE) {
    return (
      <div className="card">
        <h2>Appointment confirmed</h2>
        <p>You'll get an email confirmation, and it's been added to your Google Calendar if connected.</p>
        <a href="/patient/appointments"><button className="btn">View my appointments</button></a>
      </div>
    );
  }

  if (step === STEPS.SYMPTOMS) {
    return (
      <div className="card" style={{ maxWidth: 520 }}>
        <h2>Tell the doctor what's going on</h2>
        <p className="muted">
          This helps Dr. {selectedDoctor.user.name} prepare before your visit.
          Your slot is held for a few minutes while you fill this in.
        </p>
        <form onSubmit={submitSymptomsAndConfirm}>
          <label>Describe your symptoms</label>
          <textarea value={symptoms} onChange={(e) => setSymptoms(e.target.value)} required placeholder="e.g. fever for 3 days, sore throat, mild headache" />
          {error && <div className="error">{error}</div>}
          <button className="btn" type="submit">Confirm appointment</button>
        </form>
      </div>
    );
  }

  return (
    <div>
      <h2>Book an appointment</h2>
      <div className="card">
        <label>Search by specialisation</label>
        <input value={specialisation} onChange={(e) => setSpecialisation(e.target.value)} placeholder="e.g. Dermatology, Cardiology" />
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h3 style={{ fontSize: 15 }}>Doctors</h3>
          {doctors.map((d) => (
            <div
              key={d.id}
              onClick={() => setSelectedDoctor(d)}
              style={{
                padding: '10px 8px', borderRadius: 6, cursor: 'pointer',
                background: selectedDoctor?.id === d.id ? 'var(--primary-tint)' : 'transparent',
              }}
            >
              <strong>Dr. {d.user.name}</strong>
              <div className="muted">{d.specialisation} · {d.slotDurationMin} min slots</div>
            </div>
          ))}
          {doctors.length === 0 && <p className="muted">No doctors found.</p>}
        </div>

        <div className="card">
          <h3 style={{ fontSize: 15 }}>Available slots</h3>
          {selectedDoctor ? (
            <>
              <label>Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              <div className="slot-grid">
                {slots.map((iso) => (
                  <button key={iso} className="slot-btn" onClick={() => pickSlot(iso)}>
                    {new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </button>
                ))}
                {slots.length === 0 && <p className="muted">No slots available this day.</p>}
              </div>
            </>
          ) : (
            <p className="muted">Pick a doctor to see availability.</p>
          )}
          {error && <div className="error">{error}</div>}
        </div>
      </div>
    </div>
  );
}
