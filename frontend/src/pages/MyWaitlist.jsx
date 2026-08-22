import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';

const STATUS_STYLES = {
  WAITING: 'bg-stone-200 text-stone-700',
  OFFERED: 'bg-amber-900 text-amber-300',
  CLAIMED: 'bg-emerald-900 text-emerald-300',
  EXPIRED: 'bg-rose-950 text-rose-400',
  CANCELLED: 'bg-stone-200 text-stone-500',
};

const STATUS_LABELS = {
  WAITING: 'Waiting in queue',
  OFFERED: 'Seat offered — claim it now!',
  CLAIMED: 'Claimed',
  EXPIRED: 'Offer expired',
  CANCELLED: 'Cancelled',
};

export default function MyWaitlist() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/waitlist/my');
      setEntries(res.data);
    } catch (err) {
      setError(err.friendlyMessage || 'Failed to load waitlist entries');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  if (loading) return <div className="max-w-4xl mx-auto px-4 py-10 text-stone-500">Loading...</div>;
  if (error) return <div className="max-w-4xl mx-auto px-4 py-10 text-rose-400">{error}</div>;

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold mb-2">My Waitlist</h1>
      <p className="text-stone-600 text-sm mb-6">
        Track where you stand for sold-out shows. If a seat opens up, you'll get an email —
        and it'll show here too.
      </p>

      {entries.length === 0 ? (
        <p className="text-stone-500">You're not on any waitlists right now.</p>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => (
            <div key={entry.id} className="card p-5 flex justify-between items-center flex-wrap gap-3">
              <div>
                <p className="font-semibold">{entry.event?.title}</p>
                <p className="text-sm text-stone-600">
                  {entry.category} · Position #{entry.position} in queue
                </p>
                {entry.event?.dateTime && (
                  <p className="text-xs text-stone-500 mt-1">{new Date(entry.event.dateTime).toLocaleString()}</p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs px-3 py-1 rounded-full ${STATUS_STYLES[entry.status] || 'bg-stone-200 text-stone-600'}`}>
                  {STATUS_LABELS[entry.status] || entry.status}
                </span>
                {entry.status === 'OFFERED' && entry.offerToken && (
                  <Link to={`/waitlist/claim/${entry.offerToken}`} className="btn-primary text-sm">
                    Claim Seat
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
