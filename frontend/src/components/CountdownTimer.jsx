import React, { useEffect, useState } from 'react';

export default function CountdownTimer({ expiresAt, onExpire }) {
  const [remaining, setRemaining] = useState(getRemaining());

  function getRemaining() {
    if (!expiresAt) return 0;
    return Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
  }

  useEffect(() => {
    if (!expiresAt) return;
    const interval = setInterval(() => {
      const r = getRemaining();
      setRemaining(r);
      if (r <= 0) {
        clearInterval(interval);
        onExpire?.();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  if (!expiresAt) return null;
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const urgent = remaining <= 60;

  return (
    <div className={`text-sm font-mono px-3 py-1 rounded-lg border ${urgent ? 'text-rose-700 border-rose-300 bg-rose-50' : 'text-brand-700 border-brand-300 bg-brand-50'}`}>
      Seats held for {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
    </div>
  );
}
