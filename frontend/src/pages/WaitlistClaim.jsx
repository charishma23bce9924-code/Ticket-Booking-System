import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import CountdownTimer from '../components/CountdownTimer';

export default function WaitlistClaim() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [offer, setOffer] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmation, setConfirmation] = useState(null);

  useEffect(() => {
    api.get(`/waitlist/offer/${token}`)
      .then((res) => setOffer(res.data))
      .catch((err) => setError(err.response?.data?.error || 'Offer not found'));
  }, [token]);

  async function claim() {
    setBusy(true);
    setError('');
    try {
      const res = await api.post('/bookings', {
        eventId: offer.eventId,
        showSeatIds: [offer.showSeatId],
        holdToken: offer.offerToken,
      });
      setConfirmation(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to claim seat');
    } finally {
      setBusy(false);
    }
  }

  if (confirmation) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <div className="card p-8">
          <h1 className="text-2xl font-bold text-emerald-400 mb-2">Seat Claimed!</h1>
          <img src={confirmation.qrCodeDataUrl} alt="QR" className="mx-auto w-48 h-48 rounded-lg border border-stone-300" />
          <p className="mt-4 text-sm">Ref: {confirmation.bookingRef}</p>
          <button className="btn-primary mt-6" onClick={() => navigate('/my-bookings')}>View My Bookings</button>
        </div>
      </div>
    );
  }

  if (error) {
    return <div className="max-w-md mx-auto px-4 py-16 text-center text-rose-400">{error}</div>;
  }

  if (!offer) return <div className="max-w-md mx-auto px-4 py-16 text-center text-stone-500">Loading offer...</div>;

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <div className="card p-8 text-center space-y-4">
        <h1 className="text-2xl font-bold">A Seat Opened Up! 🎉</h1>
        <p className="text-stone-600">{offer.eventTitle} · {offer.category}</p>
        <CountdownTimer expiresAt={offer.offerExpiresAt} onExpire={() => setError('This offer has expired.')} />
        <button className="btn-primary w-full" disabled={busy} onClick={claim}>
          {busy ? 'Claiming...' : 'Claim This Seat'}
        </button>
      </div>
    </div>
  );
}
