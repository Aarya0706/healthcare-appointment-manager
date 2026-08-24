import { useEffect, useState } from 'react';
import { api } from '../../api.js';
import { useAuth } from '../../AuthContext.jsx';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function AdminDoctors() {
  const { auth } = useAuth();
  const [doctors, setDoctors] = useState([]);
  const [form, setForm] = useState({
    name: '', email: '', password: '', specialisation: '', slotDurationMin: 30,
    workingHours: [{ dayOfWeek: 1, startTime: '09:00', endTime: '17:00' }],
  });
  const [leaveDate, setLeaveDate] = useState({});
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  function refresh() {
    api.adminListDoctors(auth.token).then(setDoctors);
  }
  useEffect(refresh, []);

  function updateHour(i, field, value) {
    setForm((f) => {
      const workingHours = [...f.workingHours];
      workingHours[i] = { ...workingHours[i], [field]: value };
      return { ...f, workingHours };
    });
  }

  async function createDoctor(e) {
    e.preventDefault();
    setError(''); setMsg('');
    try {
      await api.adminCreateDoctor(auth.token, {
        ...form,
        slotDurationMin: Number(form.slotDurationMin),
        workingHours: form.workingHours.map((h) => ({ ...h, dayOfWeek: Number(h.dayOfWeek) })),
      });
      setMsg('Doctor created.');
      setForm({ name: '', email: '', password: '', specialisation: '', slotDurationMin: 30, workingHours: [{ dayOfWeek: 1, startTime: '09:00', endTime: '17:00' }] });
      refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  async function markLeave(doctorProfileId) {
    const date = leaveDate[doctorProfileId];
    if (!date) return;
    const res = await api.adminMarkLeave(auth.token, doctorProfileId, { date });
    alert(`Leave recorded. ${res.affectedCount} patient(s) notified.`);
    refresh();
  }

  async function unmarkLeave(doctorProfileId, leaveId) {
    await api.adminUnmarkLeave(auth.token, doctorProfileId, leaveId);
    refresh();
  }

  return (
    <div>
      <h2>Doctors</h2>

      <div className="card">
        <h3 style={{ fontSize: 15 }}>Add a doctor</h3>
        <form onSubmit={createDoctor}>
          <div className="grid grid-2">
            <div><label>Name</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
            <div><label>Specialisation</label><input value={form.specialisation} onChange={(e) => setForm({ ...form, specialisation: e.target.value })} required /></div>
            <div><label>Email</label><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></div>
            <div><label>Temporary password</label><input type="password" minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required /></div>
            <div><label>Slot duration (min)</label><input type="number" value={form.slotDurationMin} onChange={(e) => setForm({ ...form, slotDurationMin: e.target.value })} /></div>
          </div>
          <label>Working hours</label>
          {form.workingHours.map((h, i) => (
            <div key={i} className="grid" style={{ gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 6 }}>
              <select value={h.dayOfWeek} onChange={(e) => updateHour(i, 'dayOfWeek', e.target.value)}>
                {DAYS.map((d, idx) => <option key={idx} value={idx}>{d}</option>)}
              </select>
              <input type="time" value={h.startTime} onChange={(e) => updateHour(i, 'startTime', e.target.value)} />
              <input type="time" value={h.endTime} onChange={(e) => updateHour(i, 'endTime', e.target.value)} />
            </div>
          ))}
          <button type="button" className="btn secondary" onClick={() => setForm((f) => ({ ...f, workingHours: [...f.workingHours, { dayOfWeek: 1, startTime: '09:00', endTime: '17:00' }] }))}>
            + Add day
          </button>
          {error && <div className="error">{error}</div>}
          {msg && <p className="muted">{msg}</p>}
          <br /><button className="btn" type="submit">Create doctor</button>
        </form>
      </div>

      <h3>Existing doctors</h3>
      {doctors.map((d) => (
        <div key={d.id} className="card">
          <strong>Dr. {d.user.name}</strong> — {d.specialisation}
          <div className="muted">{d.slotDurationMin} min slots · {d.workingHours.length} working day(s) set · {d.leaves.length} leave day(s) recorded</div>
          <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="date" onChange={(e) => setLeaveDate((s) => ({ ...s, [d.id]: e.target.value }))} />
            <button className="btn secondary" onClick={() => markLeave(d.id)}>Mark on leave</button>
          </div>
          {d.leaves.length > 0 && (
            <ul style={{ marginTop: 8, paddingLeft: 18 }}>
              {d.leaves.map((l) => (
                <li key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {new Date(l.date).toLocaleDateString()}
                  <button className="btn secondary" onClick={() => unmarkLeave(d.id, l.id)}>Unmark</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}
