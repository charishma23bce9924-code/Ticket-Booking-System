import React, { useEffect, useState } from 'react';
import api from '../lib/api';

export default function AdminDashboard() {
  const [venues, setVenues] = useState([]);
  const [form, setForm] = useState({ name: '', address: '', rows: 5, cols: 8, premiumRows: 'A,B' });
  const [msg, setMsg] = useState('');
  const [loadError, setLoadError] = useState('');

  async function loadVenues() {
    try {
      const res = await api.get('/venues');
      setVenues(res.data);
    } catch (err) {
      setLoadError(err.friendlyMessage || 'Failed to load venues');
    }
  }

  useEffect(() => { loadVenues(); }, []);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleCreate(e) {
    e.preventDefault();
    setMsg('');
    const premiumRows = form.premiumRows.split(',').map((r) => r.trim().toUpperCase()).filter(Boolean);
    const categoryMap = premiumRows.map((rowLabel) => ({ rowLabel, category: 'Premium' }));
    try {
      await api.post('/venues', {
        name: form.name,
        address: form.address,
        rows: Number(form.rows),
        cols: Number(form.cols),
        categoryMap,
      });
      setMsg('Venue created!');
      setForm({ name: '', address: '', rows: 5, cols: 8, premiumRows: 'A,B' });
      loadVenues();
    } catch (err) {
      setMsg(err.friendlyMessage || err.response?.data?.error || 'Failed to create venue');
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 space-y-10">
      <div>
        <h1 className="text-3xl font-bold mb-1">Admin Dashboard</h1>
        <p className="text-stone-600 text-sm">Manage venues and seat layouts.</p>
      </div>

      {loadError && (
        <div className="card p-4 border-rose-800 bg-rose-950/30 text-rose-300 text-sm">{loadError}</div>
      )}

      <div className="card p-6">
        <h2 className="text-lg font-semibold mb-4">Create Venue</h2>
        <form onSubmit={handleCreate} className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="label">Venue Name</label>
            <input className="input" value={form.name} onChange={(e) => update('name', e.target.value)} required />
          </div>
          <div>
            <label className="label">Address</label>
            <input className="input" value={form.address} onChange={(e) => update('address', e.target.value)} required />
          </div>
          <div>
            <label className="label">Rows</label>
            <input className="input" type="number" min="1" max="26" value={form.rows} onChange={(e) => update('rows', e.target.value)} required />
          </div>
          <div>
            <label className="label">Seats per Row (Columns)</label>
            <input className="input" type="number" min="1" value={form.cols} onChange={(e) => update('cols', e.target.value)} required />
          </div>
          <div className="md:col-span-2">
            <label className="label">Premium Row Labels (comma separated, e.g. "A,B")</label>
            <input className="input" value={form.premiumRows} onChange={(e) => update('premiumRows', e.target.value)} />
            <p className="text-xs text-stone-500 mt-1">All other rows default to Standard category.</p>
          </div>
          <div className="md:col-span-2 flex items-center gap-3">
            <button className="btn-primary">Create Venue</button>
            {msg && <span className="text-sm text-stone-600">{msg}</span>}
          </div>
        </form>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-4">Venues</h2>
        <div className="grid md:grid-cols-3 gap-4">
          {venues.map((v) => (
            <div key={v.id} className="card p-4">
              <p className="font-semibold">{v.name}</p>
              <p className="text-sm text-stone-600">{v.address}</p>
              <p className="text-xs text-stone-500 mt-1">{v.rows} rows × {v.cols} cols</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
