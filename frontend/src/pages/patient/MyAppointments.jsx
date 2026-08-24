import { useEffect, useState } from 'react';
import { api } from '../../api.js';
import { useAuth } from '../../AuthContext.jsx';

export default function MyAppointments() {
  const { auth } = useAuth();
  const [appts, setAppts] = useState([]);
  const [expanded, setExpanded] = useState(null);
  const [notes, setNotes] = useState({});

  function refresh() {
    api.listAppointments(auth.token).then(setAppts);
  }
  useEffect(refresh, []);

  async function toggle(appt) {
    if (expanded === appt.id) return setExpanded(null);
    setExpanded(appt.id);
    if (appt.status === 'COMPLETED' && !notes[appt.id]) {
      try {
        const note = await api.getVisitNote(auth.token, appt.id);
        setNotes((n) => ({ ...n, [appt.id]: note }));
      } catch {}
    }
  }

  async function cancel(appt) {
    if (!confirm('Cancel this appointment?')) return;
    await api.cancelAppointment(auth.token, appt.id);
    refresh();
  }

  return (
    <div>
      <h2>My appointments</h2>
      {appts.map((a) => (
        <div key={a.id} className={`appt-row ${a.status === 'CANCELLED' ? 'cancelled' : ''} ${a.status === 'DOCTOR_LEAVE' ? 'leave' : ''}`}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => toggle(a)}>
            <div>
              <strong>Dr. {a.doctor.user.name}</strong>
              <div className="muted">{new Date(a.startTime).toLocaleString()}</div>
            </div>
            <span className="badge status">{a.status}</span>
          </div>

          {expanded === a.id && (
            <div style={{ marginTop: 10 }}>
              {a.symptomForm && (
                <p className="muted">Symptoms reported: {a.symptomForm.rawSymptoms}</p>
              )}
              {a.status === 'COMPLETED' && notes[a.id] && (
                <div className="card" style={{ background: 'var(--primary-tint)', border: 'none' }}>
                  <strong>Visit summary</strong>
                  <p style={{ whiteSpace: 'pre-wrap' }}>{notes[a.id].patientSummary || 'Summary not available.'}</p>
                </div>
              )}
              {(a.status === 'CONFIRMED' || a.status === 'HELD') && (
                <button className="btn danger" onClick={() => cancel(a)}>Cancel appointment</button>
              )}
            </div>
          )}
        </div>
      ))}
      {appts.length === 0 && <p className="muted">No appointments yet.</p>}
    </div>
  );
}
