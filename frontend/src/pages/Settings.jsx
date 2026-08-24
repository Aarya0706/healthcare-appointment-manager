import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../AuthContext';

export default function Settings() {
  const { auth } = useAuth();
  const [loading, setLoading] = useState(false);
  const [searchParams] = useSearchParams();

  const connected = searchParams.get('calendar') === 'connected';

  async function handleConnect() {
    try {
      setLoading(true);

      const data = await api.connectCalendar(auth.token);

      window.location.href = data.url;
    } catch (err) {
      alert(err.message || 'Could not connect Google Calendar');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <h1>Settings</h1>

      <section className="card">
        <h2>Google Calendar</h2>

        <p>
          {connected
            ? '✅ Google Calendar connected successfully!'
            : 'Connect your Google Calendar to automatically sync your appointments.'}
        </p>

        {!connected && (
          <button onClick={handleConnect} disabled={loading}>
            {loading ? 'Connecting...' : 'Connect Google Calendar'}
          </button>
        )}
      </section>
    </main>
  );
}