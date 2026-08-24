import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';

const NAV = {
  PATIENT: [
    { to: '/patient', label: 'Book appointment', end: true },
    { to: '/patient/appointments', label: 'My appointments' },
    { to: '/settings', label: 'Settings' },
  ],
  DOCTOR: [
    { to: '/doctor', label: 'My schedule', end: true },
    { to: '/settings', label: 'Settings' },
  ],
  ADMIN: [
    { to: '/admin', label: 'Doctors', end: true },
    { to: '/settings', label: 'Settings' },
  ],
};

export default function Layout({ children }) {
  const { auth, logout } = useAuth();
  const navigate = useNavigate();
  const items = NAV[auth?.user?.role] || [];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">Clinic Appointments</div>

        <nav>
          {items.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end}>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="muted" style={{ marginTop: 24, color: '#cfe6e4' }}>
          {auth?.user?.name} · {auth?.user?.role}
        </div>

        <button
          className="signout"
          onClick={() => {
            logout();
            navigate('/login');
          }}
        >
          Sign out
        </button>
      </aside>

      <main className="main">{children}</main>
    </div>
  );
}