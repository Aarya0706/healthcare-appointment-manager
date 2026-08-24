import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../AuthContext.jsx';

export default function Register() {
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '' });
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  async function submit(e) {
    e.preventDefault();
    setError('');
    try {
      const res = await api.register(form);
      login(res);
      navigate('/patient');
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={submit}>
        <h2>Create your account</h2>
        <p className="muted">Patient registration. Doctor and admin accounts are created by the clinic.</p>
        <label>Full name</label>
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        <label>Email</label>
        <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} type="email" required />
        <label>Phone</label>
        <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        <label>Password (min 8 characters)</label>
        <input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} type="password" minLength={8} required />
        {error && <div className="error">{error}</div>}
        <button className="btn" type="submit" style={{ width: '100%' }}>Create account</button>
        <p className="muted" style={{ marginTop: 16 }}>
          Already registered? <Link to="/login">Sign in</Link>
        </p>
      </form>
    </div>
  );
}
