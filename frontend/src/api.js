const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

async function request(path, { method = 'GET', body, token } = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(
      data.error?.formErrors?.[0] ||
      data.error ||
      `Request failed (${res.status})`
    );
  }

  return data;
}

export const api = {
  register: (body) => request('/auth/register', { method: 'POST', body }),
  login: (body) => request('/auth/login', { method: 'POST', body }),

  listDoctors: (token, specialisation) =>
    request(
      `/doctors${
        specialisation
          ? `?specialisation=${encodeURIComponent(specialisation)}`
          : ''
      }`,
      { token }
    ),

  availability: (token, doctorProfileId, date) =>
    request(`/doctors/${doctorProfileId}/availability?date=${date}`, {
      token,
    }),

  holdSlot: (token, body) =>
    request('/appointments/hold', { method: 'POST', body, token }),

  confirmAppointment: (token, id) =>
    request(`/appointments/${id}/confirm`, {
      method: 'POST',
      token,
    }),

  cancelAppointment: (token, id, reason) =>
    request(`/appointments/${id}/cancel`, {
      method: 'POST',
      body: { reason },
      token,
    }),

  listAppointments: (token) =>
    request('/appointments', { token }),

  submitSymptoms: (token, appointmentId, body) =>
    request(`/symptoms/${appointmentId}`, {
      method: 'POST',
      body,
      token,
    }),

  getSymptoms: (token, appointmentId) =>
    request(`/symptoms/${appointmentId}`, { token }),

  submitVisitNote: (token, appointmentId, body) =>
    request(`/visits/${appointmentId}`, {
      method: 'POST',
      body,
      token,
    }),

  getVisitNote: (token, appointmentId) =>
    request(`/visits/${appointmentId}`, { token }),

  adminListDoctors: (token) =>
    request('/admin/doctors', { token }),

  adminCreateDoctor: (token, body) =>
    request('/admin/doctors', {
      method: 'POST',
      body,
      token,
    }),

  adminMarkLeave: (token, doctorProfileId, body) =>
    request(`/admin/doctors/${doctorProfileId}/leave`, {
      method: 'POST',
      body,
      token,
    }),

  adminUnmarkLeave: (token, doctorProfileId, leaveId) =>
    request(`/admin/doctors/${doctorProfileId}/leave/${leaveId}`, {
      method: 'DELETE',
      token,
    }),

  // Google Calendar
  connectCalendar: (token) =>
    request('/calendar/connect', {
      method: 'GET',
      token,
    }),
};