import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import socket from '../lib/socket';
import { useAuth } from '../context/AuthContext';
import SeatMap from '../components/SeatMap';
import CountdownTimer from '../components/CountdownTimer';

export default function EventDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [event, setEvent] = useState(null);
  const [seats, setSeats] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [holdToken, setHoldToken] = useState(null);
  const [holdExpiresAt, setHoldExpiresAt] = useState(null);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmation, setConfirmation] = useState(null);

  const loadSeatMap = useCallback(async () => {
    try {
      const res = await api.get(`/events/${id}/seatmap`);
      setSeats(res.data.seats);
    } catch (err) {
      setLoadError(err.friendlyMessage || 'Failed to load seat map');
    }
  }, [id]);

  useEffect(() => {
    api.get(`/events/${id}`)
      .then((res) => setEvent(res.data))
      .catch((err) => setLoadError(err.friendlyMessage || 'Failed to load event'));
    loadSeatMap();

    socket.emit('joinEvent', id);
    const handler = (updatedShowSeat) => {
      setSeats((prev) => prev.map((s) => (
        s.showSeatId === updatedShowSeat.id
          ? { ...s, status: updatedShowSeat.status, holdExpiresAt: updatedShowSeat.holdExpiresAt }
          : s
      )));
    };
    socket.on('seatUpdate', handler);
    return () => {
      socket.emit('leaveEvent', id);
      socket.off('seatUpdate', handler);
    };
  }, [id, loadSeatMap]);

  const categoryAvailability = useMemo(() => {
    const map = {};
    for (const s of seats) {
      map[s.category] = map[s.category] || { available: 0, total: 0 };
      map[s.category].total += 1;
      if (s.status === 'AVAILABLE') map[s.category].available += 1;
    }
    return map;
  }, [seats]);

  function toggleSeat(seat) {
    if (!user) { navigate('/login'); return; }
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(seat.showSeatId)) next.delete(seat.showSeatId);
      else next.add(seat.showSeatId);
      return next;
    });
  }

  async function handleHold() {
    if (selected.size === 0) return;
    setBusy(true);
    setError('');
    try {
      const res = await api.post('/seats/hold', {
        eventId: id,
        showSeatIds: Array.from(selected),
      });
      setHoldToken(res.data.holdToken);
      setHoldExpiresAt(res.data.expiresAt);
    } catch (err) {
      setError(err.friendlyMessage || err.response?.data?.error || 'Failed to hold seats');
      loadSeatMap();
      setSelected(new Set());
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirmBooking() {
    setBusy(true);
    setError('');
    try {
      const res = await api.post('/bookings', {
        eventId: id,
        showSeatIds: Array.from(selected),
        holdToken,
      });
      setConfirmation(res.data);
      setSelected(new Set());
      setHoldToken(null);
      setHoldExpiresAt(null);
      loadSeatMap();
    } catch (err) {
      setError(err.friendlyMessage || err.response?.data?.error || 'Booking failed');
    } finally {
      setBusy(false);
    }
  }

  async function handleHoldExpire() {
    setError('Your seat hold expired. Please select seats again.');
    setSelected(new Set());
    setHoldToken(null);
    setHoldExpiresAt(null);
    loadSeatMap();
  }

  async function handleCancelSelection() {
    if (holdToken) {
      await api.post('/seats/release', { eventId: id, showSeatIds: Array.from(selected), holdToken });
    }
    setSelected(new Set());
    setHoldToken(null);
    setHoldExpiresAt(null);
    loadSeatMap();
  }

  async function handleJoinWaitlist(category) {
    if (!user) { navigate('/login'); return; }
    try {
      await api.post('/waitlist/join', { eventId: id, category });
      alert(`You're on the waitlist for ${category}. We'll email you if a seat opens up — you can also track your status anytime under "My Waitlist" in the nav bar.`);
    } catch (err) {
      alert(err.friendlyMessage || err.response?.data?.error || 'Failed to join waitlist');
    }
  }

  if (loadError) return <div className="max-w-4xl mx-auto px-4 py-10 text-rose-400">{loadError}</div>;
  if (!event) return <div className="max-w-4xl mx-auto px-4 py-10 text-stone-500">Loading...</div>;

  if (confirmation) {
    return (
      <div className="max-w-md mx-auto px-4 py-16">
        <div className="card p-8 text-center">
          <h1 className="text-2xl font-bold text-emerald-400 mb-2">Booking Confirmed!</h1>
          <p className="text-stone-600 text-sm mb-4">Ref: {confirmation.bookingRef}</p>
          <img src={confirmation.qrCodeDataUrl} alt="QR Ticket" className="mx-auto w-48 h-48 rounded-lg border border-stone-300" />
          <p className="mt-4 text-sm">Seats: {confirmation.seats.join(', ')}</p>
          <p className="text-sm text-stone-600">Total: ${confirmation.totalAmount}</p>
          <p className="text-xs text-stone-500 mt-3">A confirmation email with your QR ticket has been sent.</p>
          <button className="btn-primary mt-6" onClick={() => navigate('/my-bookings')}>View My Bookings</button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <div className="mb-6">
        <span className="text-[10px] uppercase tracking-wide text-brand-700">{event.type}</span>
        <h1 className="text-3xl font-bold">{event.title}</h1>
        <p className="text-stone-600 text-sm mt-1">{event.venue?.name} · {new Date(event.dateTime).toLocaleString()}</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card p-6">
          <SeatMap seats={seats} selected={selected} onToggle={toggleSeat} eventType={event.type} />
        </div>

        <div className="space-y-4">
          <div className="card p-5">
            <h3 className="font-semibold mb-3">Availability by Category</h3>
            {Object.entries(categoryAvailability).map(([cat, info]) => {
              const price = event.pricing?.find((p) => p.category === cat)?.price;
              return (
                <div key={cat} className="flex items-center justify-between text-sm py-1.5 border-b border-stone-200 last:border-0">
                  <div>
                    <p>{cat} {price != null && <span className="text-stone-500">(${price})</span>}</p>
                    <p className="text-xs text-stone-500">{info.available}/{info.total} available</p>
                  </div>
                  {info.available === 0 && (
                    <button className="btn-secondary text-xs py-1" onClick={() => handleJoinWaitlist(cat)}>
                      Join Waitlist
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <div className="card p-5 space-y-3">
            <h3 className="font-semibold">Your Selection</h3>
            {selected.size === 0 ? (
              <p className="text-stone-500 text-sm">Select seats from the map.</p>
            ) : (
              <p className="text-sm">{selected.size} seat(s) selected</p>
            )}

            {holdExpiresAt && <CountdownTimer expiresAt={holdExpiresAt} onExpire={handleHoldExpire} />}

            {error && <p className="text-rose-400 text-sm">{error}</p>}

            {!holdToken ? (
              <button className="btn-primary w-full" disabled={selected.size === 0 || busy} onClick={handleHold}>
                {busy ? 'Holding...' : 'Hold Selected Seats'}
              </button>
            ) : (
              <div className="space-y-2">
                <button className="btn-primary w-full" disabled={busy} onClick={handleConfirmBooking}>
                  {busy ? 'Booking...' : 'Confirm Booking'}
                </button>
                <button className="btn-secondary w-full" disabled={busy} onClick={handleCancelSelection}>
                  Cancel Selection
                </button>
              </div>
            )}
            {!user && <p className="text-xs text-stone-500">You'll need to log in to book seats.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
