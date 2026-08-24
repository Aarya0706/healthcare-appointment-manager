import { useEffect, useState } from 'react';
import { api } from '../../api.js';
import { useAuth } from '../../AuthContext.jsx';

export default function DoctorSchedule() {
  const { auth } = useAuth();
  const [appts, setAppts] = useState([]);
  const [open, setOpen] = useState(null);
  const [symptomForms, setSymptomForms] = useState({});
  const [noteForm, setNoteForm] = useState({ clinicalNotes: '', prescription: [] });

  function refresh() {
    api.listAppointments(auth.token).then(setAppts);
  }
  useEffect(refresh, []);

  async function openAppt(a) {
    if (open === a.id) return setOpen(null);
    setOpen(a.id);
    setNoteForm({ clinicalNotes: '', prescription: [{ medicine: '', dosage: '', frequencyPerDay: 2, durationDays: 5 }] });
    if (a.symptomForm) return;
    try {
      const form = await api.getSymptoms(auth.token, a.id);
      setSymptomForms((s) => ({ ...s, [a.id]: form }));
    } catch {}
  }

  function updateRx(i, field, value) {
    setNoteForm((f) => {
      const prescription = [...f.prescription];
      prescription[i] = { ...prescription[i], [field]: value };
      return { ...f, prescription };
    });
  }

  function addRxRow() {
    setNoteForm((f) => ({ ...f, prescription: [...f.prescription, { medicine: '', dosage: '', frequencyPerDay: 2, durationDays: 5 }] }));
  }

  async function submitNote(appt) {
    const prescription = noteForm.prescription
      .filter((p) => p.medicine)
      .map((p) => ({ ...p, frequencyPerDay: Number(p.frequencyPerDay), durationDays: Number(p.durationDays) }));
    await api.submitVisitNote(auth.token, appt.id, { clinicalNotes: noteForm.clinicalNotes, prescription });
    refresh();
    setOpen(null);
  }

  return (
    <div>
      <h2>My schedule</h2>
      {appts.map((a) => {
        const symptoms = a.symptomForm || symptomForms[a.id];
        return (
          <div key={a.id} className={`appt-row ${a.status === 'CANCELLED' ? 'cancelled' : ''}`}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => openAppt(a)}>
              <div>
                <strong>{a.patient.name}</strong>
                <div className="muted">{new Date(a.startTime).toLocaleString()}</div>
              </div>
              <div>
                {symptoms?.urgency && <span className={`badge ${symptoms.urgency.toLowerCase()}`}>{symptoms.urgency}</span>}{' '}
                <span className="badge status">{a.status}</span>
              </div>
            </div>

            {open === a.id && (
              <div style={{ marginTop: 12 }}>
                {symptoms ? (
                  <div className="card" style={{ background: '#fafcfc' }}>
                    <strong>Pre-visit AI summary</strong>
                    <p className="muted">Chief complaint: {symptoms.chiefComplaint || '—'}</p>
                    <p className="muted">Reported symptoms: {symptoms.rawSymptoms}</p>
                    {Array.isArray(symptoms.suggestedQuestions) && (
                      <ul className="muted">
                        {symptoms.suggestedQuestions.map((q, i) => <li key={i}>{q}</li>)}
                      </ul>
                    )}
                    {symptoms.llmStatus === 'FAILED' && <p className="error">AI summary unavailable — review raw symptoms above.</p>}
                  </div>
                ) : (
                  <p className="muted">No symptom form submitted.</p>
                )}

                {a.status === 'CONFIRMED' && (
                  <div className="card">
                    <strong>Post-visit note</strong>
                    <label>Clinical notes</label>
                    <textarea value={noteForm.clinicalNotes} onChange={(e) => setNoteForm({ ...noteForm, clinicalNotes: e.target.value })} />
                    <label>Prescription</label>
                    {noteForm.prescription.map((p, i) => (
                      <div key={i} className="grid" style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 8, marginBottom: 6 }}>
                        <input placeholder="Medicine" value={p.medicine} onChange={(e) => updateRx(i, 'medicine', e.target.value)} />
                        <input placeholder="Dosage" value={p.dosage} onChange={(e) => updateRx(i, 'dosage', e.target.value)} />
                        <input type="number" placeholder="Times/day" value={p.frequencyPerDay} onChange={(e) => updateRx(i, 'frequencyPerDay', e.target.value)} />
                        <input type="number" placeholder="Days" value={p.durationDays} onChange={(e) => updateRx(i, 'durationDays', e.target.value)} />
                      </div>
                    ))}
                    <button className="btn secondary" onClick={addRxRow}>+ Add medicine</button>
                    <br />
                    <button className="btn" onClick={() => submitNote(a)}>Submit visit summary</button>
                  </div>
                )}

                {a.status === 'COMPLETED' && <p className="muted">Visit completed.</p>}
              </div>
            )}
          </div>
        );
      })}
      {appts.length === 0 && <p className="muted">No appointments scheduled.</p>}
    </div>
  );
}
