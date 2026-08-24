import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import BookAppointment from './pages/patient/BookAppointment.jsx';
import MyAppointments from './pages/patient/MyAppointments.jsx';
import DoctorSchedule from './pages/doctor/DoctorSchedule.jsx';
import AdminDoctors from './pages/admin/AdminDoctors.jsx';
import Settings from './pages/Settings.jsx';

function Protected({ role, children }) {
  const { auth } = useAuth();
  if (!auth) return <Navigate to="/login" replace />;
  if (role && auth.user.role !== role) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
}

export default function App() {
  const { auth } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route path="/patient" element={<Protected role="PATIENT"><BookAppointment /></Protected>} />
      <Route path="/patient/appointments" element={<Protected role="PATIENT"><MyAppointments /></Protected>} />

      <Route path="/doctor" element={<Protected role="DOCTOR"><DoctorSchedule /></Protected>} />

      <Route path="/admin" element={<Protected role="ADMIN"><AdminDoctors /></Protected>} />
      <Route
        path="/settings"
        element={
          <Protected>
            <Settings />
          </Protected>
        }
      />

      <Route
        path="/"
        element={<Navigate to={auth ? (auth.user.role === 'ADMIN' ? '/admin' : auth.user.role === 'DOCTOR' ? '/doctor' : '/patient') : '/login'} replace />}
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
