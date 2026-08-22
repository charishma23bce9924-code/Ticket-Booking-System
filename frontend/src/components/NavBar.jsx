import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export default function NavBar() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  return (
    <nav className="border-b border-stone-200 bg-stone-50/90 backdrop-blur sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 font-display text-xl tracking-tight text-stone-900">
          <span className="text-brand-600">🎟</span> SeatSure
        </Link>
        <div className="flex items-center gap-4 text-sm">
          <Link to="/events" className="hover:text-brand-700">Events</Link>
          {user && (
            <Link to="/my-bookings" className="hover:text-brand-700">My Bookings</Link>
          )}
          {user && (
            <Link to="/my-waitlist" className="hover:text-brand-700">My Waitlist</Link>
          )}
          {user?.role === 'ORGANISER' && (
            <Link to="/organiser" className="hover:text-brand-700">Organiser Dashboard</Link>
          )}
          {user?.role === 'ADMIN' && (
            <Link to="/admin" className="hover:text-brand-700">Admin Dashboard</Link>
          )}
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Toggle dark mode"
            className="w-8 h-8 flex items-center justify-center rounded-full border border-stone-300 hover:border-brand-400 transition-colors text-sm"
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          {!user ? (
            <>
              <Link to="/login" className="btn-secondary">Login</Link>
              <Link to="/register" className="btn-primary">Sign Up</Link>
            </>
          ) : (
            <div className="flex items-center gap-3">
              <span className="text-stone-600">Hi, {user.name.split(' ')[0]} · <span className="uppercase text-[10px] text-brand-700">{user.role}</span></span>
              <button
                className="btn-secondary"
                onClick={() => { logout(); navigate('/'); }}
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
