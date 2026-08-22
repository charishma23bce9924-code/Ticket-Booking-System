import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';

export default function Events() {
  const [events, setEvents] = useState([]);
  const [type, setType] = useState('');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (type) params.type = type;
      if (q) params.q = q;
      const res = await api.get('/events', { params });
      setEvents(res.data);
    } catch (err) {
      setError(err.friendlyMessage || 'Failed to load events');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [type]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="flex flex-wrap gap-3 items-end mb-8 justify-between">
        <div>
          <h1 className="font-display text-3xl font-medium text-stone-900">Upcoming Events</h1>
          <p className="text-stone-600 text-sm mt-1">Movies and concerts near you</p>
        </div>
        <div className="flex gap-2">
          <input
            className="input w-56"
            placeholder="Search events..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load()}
          />
          <select className="input w-40" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">All Types</option>
            <option value="MOVIE">Movies</option>
            <option value="CONCERT">Concerts</option>
          </select>
          <button className="btn-secondary" onClick={load}>Search</button>
        </div>
      </div>

      {loading ? (
        <p className="text-stone-500">Loading events...</p>
      ) : error ? (
        <p className="text-rose-400">{error}</p>
      ) : events.length === 0 ? (
        <p className="text-stone-500">No events found.</p>
      ) : (
        <div className="grid md:grid-cols-3 gap-5">
          {events.map((ev) => (
            <Link to={`/events/${ev.id}`} key={ev.id} className="card p-5 hover:border-brand-400 hover:shadow-md transition-all">
              <span className="text-[10px] uppercase tracking-widest text-brand-600 font-medium">{ev.type}</span>
              <h3 className="font-display text-lg mt-1 text-stone-900">{ev.title}</h3>
              <p className="text-stone-600 text-sm mt-1">{ev.venue?.name}</p>
              <p className="text-stone-500 text-xs mt-2">{new Date(ev.dateTime).toLocaleString()}</p>
              <div className="flex gap-2 mt-3 flex-wrap">
                {ev.pricing?.map((p) => (
                  <span key={p.id} className="text-xs bg-stone-100 border border-stone-200 px-2 py-1 rounded-full text-stone-700">
                    {p.category}: ${p.price}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
