import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../AuthContext.jsx';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  async function submit(e) {
    e.preventDefault();
    setError('');

    try {
      const res = await api.login({ email, password });
      login(res);

      navigate(
        res.user.role === 'ADMIN'
          ? '/admin'
          : res.user.role === 'DOCTOR'
            ? '/doctor'
            : '/patient'
      );
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={submit}>
        <h2>Sign in</h2>

        <p className="muted">
          Patients, doctors, and admins all sign in here.
        </p>

        <label>Email</label>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          required
        />

        <label>Password</label>
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          required
        />

        {error && <div className="error">{error}</div>}

        <button
          className="btn"
          type="submit"
          style={{ width: '100%' }}
        >
          Sign in
        </button>

        <div className="demo-box">
          <strong>Demo accounts</strong>

          <p>
            <strong>Admin</strong><br />
            admin@clinic.dev<br />
            ChangeMe123!
          </p>

          <p>
            <strong>Doctor</strong><br />
            testdoctor@clinic.dev<br />
            TestDoctor123
          </p>

          <p className="muted">
            Patients can create an account using <b>Create an account</b>.
          </p>
        </div>

        <p className="muted" style={{ marginTop: 16 }}>
          New patient? <Link to="/register">Create an account</Link>
        </p>
      </form>
    </div>
  );
}