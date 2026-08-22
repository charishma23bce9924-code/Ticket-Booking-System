import React, { useEffect, useState } from 'react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';

const DEFAULT_SUGGESTED_PRICES = { Standard: 45, Premium: 75, VIP: 120 };

export default function OrganiserDashboard() {
  const { user } = useAuth();
  const [venues, setVenues] = useState([]);
  const [myEvents, setMyEvents] = useState([]);
  const [form, setForm] = useState({ title: '', type: 'MOVIE', description: '', venueId: '', dateTime: '' });
  const [pricingRows, setPricingRows] = useState([]); // [{ category, price }]
  const [summaries, setSummaries] = useState({});
  const [summaryErrors, setSummaryErrors] = useState({});
  const [msg, setMsg] = useState('');
  const [loadError, setLoadError] = useState('');

  async function loadVenues() {
    try {
      const res = await api.get('/venues');
      setVenues(res.data);
      if (res.data.length && !form.venueId) {
        setForm((f) => ({ ...f, venueId: res.data[0].id }));
        loadCategoriesForVenue(res.data[0].id);
      }
    } catch (err) {
      setLoadError(err.friendlyMessage || 'Failed to load venues');
    }
  }

  async function loadEvents() {
    if (!user) return;
    try {
      // Only this organiser's own events — not everyone else's
      const res = await api.get('/events', { params: { organiserId: user.id } });
      setMyEvents(res.data);
    } catch (err) {
      setLoadError(err.friendlyMessage || 'Failed to load events');
    }
  }

  useEffect(() => { loadVenues(); }, []);
  useEffect(() => { loadEvents(); }, [user]);

  // When a venue is chosen, pull its actual seat categories from the seat
  // layout (set by Admin) and pre-fill a price row for each one, so pricing
  // always lines up with seats that really exist. Organiser can still edit
  // categories or add extra ones (e.g. if the venue supports more tiers).
  async function loadCategoriesForVenue(venueId) {
    if (!venueId) { setPricingRows([]); return; }
    try {
      const res = await api.get(`/venues/${venueId}`);
      const categories = [...new Set((res.data.seats || []).map((s) => s.category))];
      setPricingRows(
        categories.length
          ? categories.map((cat) => ({ category: cat, price: DEFAULT_SUGGESTED_PRICES[cat] ?? 20 }))
          : [{ category: 'Standard', price: 45 }]
      );
    } catch (err) {
      setPricingRows([{ category: 'Standard', price: 45 }]);
    }
  }

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    if (field === 'venueId') loadCategoriesForVenue(value);
  }

  function updatePricingRow(index, field, value) {
    setPricingRows((rows) => rows.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
  }

  function addPricingRow() {
    setPricingRows((rows) => [...rows, { category: '', price: 0 }]);
  }

  function removePricingRow(index) {
    setPricingRows((rows) => rows.filter((_, i) => i !== index));
  }

  async function handleCreate(e) {
    e.preventDefault();
    setMsg('');
    const cleanPricing = pricingRows
      .filter((r) => r.category.trim())
      .map((r) => ({ category: r.category.trim(), price: Number(r.price) || 0 }));
    if (cleanPricing.length === 0) {
      setMsg('Add at least one seat category with a price.');
      return;
    }
    try {
      await api.post('/events', {
        title: form.title,
        type: form.type,
        description: form.description,
        venueId: form.venueId,
        dateTime: form.dateTime,
        pricing: cleanPricing,
      });
      setMsg('Event created!');
      setForm((f) => ({ ...f, title: '', description: '', dateTime: '' }));
      loadEvents();
    } catch (err) {
      setMsg(err.friendlyMessage || err.response?.data?.error || 'Failed to create event');
    }
  }

  async function loadSummary(eventId) {
    setSummaryErrors((s) => ({ ...s, [eventId]: '' }));
    try {
      const res = await api.get(`/events/${eventId}/summary`);
      setSummaries((s) => ({ ...s, [eventId]: res.data }));
    } catch (err) {
      setSummaryErrors((s) => ({ ...s, [eventId]: err.friendlyMessage || err.response?.data?.error || 'Failed to load summary' }));
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 space-y-10">
      <div>
        <h1 className="text-3xl font-bold mb-1">Organiser Dashboard</h1>
        <p className="text-stone-600 text-sm">Create listings and track revenue per event.</p>
      </div>

      {loadError && (
        <div className="card p-4 border-rose-800 bg-rose-950/30 text-rose-300 text-sm">{loadError}</div>
      )}

      {venues.length === 0 && !loadError && (
        <div className="card p-4 border-amber-800 bg-amber-950/30 text-amber-300 text-sm">
          No venues exist yet. An <strong>Admin</strong> needs to create a venue first
          (Admin Dashboard → Create Venue) before you can create an event listing here.
        </div>
      )}

      <div className="card p-6">
        <h2 className="text-lg font-semibold mb-4">Create Event Listing</h2>
        <form onSubmit={handleCreate} className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="label">Title</label>
            <input className="input" value={form.title} onChange={(e) => update('title', e.target.value)} required />
          </div>
          <div>
            <label className="label">Type</label>
            <select className="input" value={form.type} onChange={(e) => update('type', e.target.value)}>
              <option value="MOVIE">Movie</option>
              <option value="CONCERT">Concert</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="label">Description</label>
            <textarea className="input" value={form.description} onChange={(e) => update('description', e.target.value)} rows={2} />
          </div>
          <div>
            <label className="label">Venue</label>
            <select
              className="input"
              value={form.venueId}
              onChange={(e) => update('venueId', e.target.value)}
              required
              disabled={venues.length === 0}
            >
              {venues.length === 0 && <option value="">No venues available</option>}
              {venues.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Date & Time</label>
            <input className="input" type="datetime-local" value={form.dateTime} onChange={(e) => update('dateTime', e.target.value)} required />
          </div>

          <div className="md:col-span-2">
            <label className="label">Seat Categories & Pricing</label>
            <p className="text-xs text-stone-500 mb-2">
              Pre-filled from this venue's actual seat layout. Edit prices, remove rows,
              or add extra categories if you want.
            </p>
            <div className="space-y-2">
              {pricingRows.map((row, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    className="input flex-1"
                    placeholder="Category name (e.g. VIP)"
                    value={row.category}
                    onChange={(e) => updatePricingRow(i, 'category', e.target.value)}
                  />
                  <span className="text-stone-500">$</span>
                  <input
                    className="input w-28"
                    type="number"
                    min="0"
                    step="0.01"
                    value={row.price}
                    onChange={(e) => updatePricingRow(i, 'price', e.target.value)}
                  />
                  <button type="button" className="btn-secondary text-xs px-2 py-1" onClick={() => removePricingRow(i)}>
                    Remove
                  </button>
                </div>
              ))}
              <button type="button" className="btn-secondary text-xs" onClick={addPricingRow}>
                + Add Category
              </button>
            </div>
          </div>

          <div className="md:col-span-2 flex items-center gap-3">
            <button className="btn-primary" disabled={venues.length === 0}>Create Event</button>
            {msg && <span className="text-sm text-stone-600">{msg}</span>}
          </div>
        </form>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-4">Your Events</h2>
        {myEvents.length === 0 ? (
          <p className="text-stone-500 text-sm">You haven't created any events yet.</p>
        ) : (
          <div className="space-y-3">
            {myEvents.map((ev) => (
              <div key={ev.id} className="card p-5">
                <div className="flex justify-between items-center flex-wrap gap-2">
                  <div>
                    <p className="font-semibold">{ev.title}</p>
                    <p className="text-sm text-stone-600">{ev.venue?.name} · {new Date(ev.dateTime).toLocaleString()}</p>
                  </div>
                  <button className="btn-secondary text-sm" onClick={() => loadSummary(ev.id)}>View Summary</button>
                </div>
                {summaryErrors[ev.id] && (
                  <p className="text-rose-400 text-sm mt-2">{summaryErrors[ev.id]}</p>
                )}
                {summaries[ev.id] && (
                  <div className="mt-3 pt-3 border-t border-stone-200 text-sm grid grid-cols-3 gap-3">
                    <div><p className="text-stone-500 text-xs">Bookings</p><p className="font-semibold">{summaries[ev.id].totalBookings}</p></div>
                    <div><p className="text-stone-500 text-xs">Seats Booked</p><p className="font-semibold">{summaries[ev.id].totalSeatsBooked}</p></div>
                    <div><p className="text-stone-500 text-xs">Revenue</p><p className="font-semibold text-emerald-400">${summaries[ev.id].totalRevenue}</p></div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
