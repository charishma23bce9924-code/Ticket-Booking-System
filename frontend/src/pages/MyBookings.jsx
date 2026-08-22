import React, { useEffect, useState } from 'react';
import api from '../lib/api';

export default function MyBookings() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/bookings/my');
      setBookings(res.data);
    } catch (err) {
      setError(err.friendlyMessage || 'Failed to load bookings');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleCancel(id) {
    if (!confirm('Cancel this booking? Your seats will be released or offered to the waitlist.')) return;
    await api.post(`/bookings/${id}/cancel`);
    load();
  }

  if (loading) return <div className="max-w-4xl mx-auto px-4 py-10 text-stone-500">Loading...</div>;
  if (error) return <div className="max-w-4xl mx-auto px-4 py-10 text-rose-400">{error}</div>;

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold mb-6">My Bookings</h1>
      {bookings.length === 0 ? (
        <p className="text-stone-500">No bookings yet.</p>
      ) : (
        <div className="space-y-4">
          {bookings.map((b) => (
            <div key={b.id} className="card p-5 flex justify-between items-center flex-wrap gap-4">
              <div>
                <p className="font-semibold">{b.event.title}</p>
                <p className="text-sm text-stone-600">{b.event.venue?.name} · {new Date(b.event.dateTime).toLocaleString()}</p>
                <p className="text-xs text-stone-500 mt-1">
                  Ref: {b.bookingRef} · Seats: {b.seats.map((s) => `${s.showSeat.seat.rowLabel}${s.showSeat.seat.colNumber}`).join(', ')}
                </p>
                <span className={`inline-block mt-1 text-[10px] uppercase px-2 py-0.5 rounded-full ${
                  b.status === 'CONFIRMED' ? 'bg-emerald-900 text-emerald-300' : 'bg-stone-200 text-stone-600'
                }`}>{b.status}</span>
              </div>
              <div className="flex items-center gap-3">
                {b.qrCodeDataUrl && <img src={b.qrCodeDataUrl} alt="QR" className="w-16 h-16 rounded border border-stone-300" />}
                {b.status === 'CONFIRMED' && (
                  <button className="btn-secondary text-sm" onClick={() => handleCancel(b.id)}>Cancel</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
