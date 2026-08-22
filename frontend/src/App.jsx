import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import NavBar from './components/NavBar';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Events from './pages/Events';
import EventDetail from './pages/EventDetail';
import MyBookings from './pages/MyBookings';
import MyWaitlist from './pages/MyWaitlist';
import WaitlistClaim from './pages/WaitlistClaim';
import OrganiserDashboard from './pages/OrganiserDashboard';
import AdminDashboard from './pages/AdminDashboard';
import { useAuth } from './context/AuthContext';

function Protected({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="max-w-4xl mx-auto px-4 py-10 text-stone-500">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/events" element={<Events />} />
          <Route path="/events/:id" element={<EventDetail />} />
          <Route path="/waitlist/claim/:token" element={<Protected><WaitlistClaim /></Protected>} />
          <Route path="/my-bookings" element={<Protected><MyBookings /></Protected>} />
          <Route path="/my-waitlist" element={<Protected><MyWaitlist /></Protected>} />
          <Route
            path="/organiser"
            element={<Protected roles={['ORGANISER', 'ADMIN']}><OrganiserDashboard /></Protected>}
          />
          <Route
            path="/admin"
            element={<Protected roles={['ADMIN']}><AdminDashboard /></Protected>}
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <footer className="text-center text-xs text-stone-500 py-6 border-t border-stone-200">
        SeatSure — Ticket Booking System Demo
      </footer>
    </div>
  );
}
