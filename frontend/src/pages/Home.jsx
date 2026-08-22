import React from 'react';
import { Link } from 'react-router-dom';

export default function Home() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-24 text-center">
      <p className="text-xs tracking-[0.3em] uppercase text-brand-600 mb-4">Real seats. Real time.</p>
      <h1 className="font-display text-5xl md:text-6xl font-medium tracking-tight mb-5 text-stone-900">
        Book seats. <span className="italic text-brand-700">Never miss the show.</span>
      </h1>
      <p className="text-stone-600 max-w-xl mx-auto mb-10 leading-relaxed">
        Real-time seat maps, automatic hold release, and a smart waitlist that
        fills every cancelled seat instantly.
      </p>
      <div className="flex justify-center gap-4">
        <Link to="/events" className="btn-primary text-base px-6 py-3">Browse Events</Link>
        <Link to="/register" className="btn-secondary text-base px-6 py-3">Create Account</Link>
      </div>

      <div className="grid md:grid-cols-3 gap-6 mt-24 text-left">
        <Feature n="01" title="Live Seat Maps" desc="Watch seats update in real time as others hold and book — never double-book a seat." />
        <Feature n="02" title="Auto-Release Holds" desc="Abandoned checkouts free up seats automatically after a configurable timer." />
        <Feature n="03" title="Smart Waitlist" desc="Sold out? Join the queue. Cancellations auto-offer seats to the next person in line." />
      </div>
    </div>
  );
}

function Feature({ n, title, desc }) {
  return (
    <div className="card p-7">
      <span className="text-xs font-display italic text-brand-500">{n}</span>
      <h3 className="font-display text-lg mt-1 mb-2 text-stone-900">{title}</h3>
      <p className="text-stone-600 text-sm leading-relaxed">{desc}</p>
    </div>
  );
}
