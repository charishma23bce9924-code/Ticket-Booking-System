import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { waitForGoogleIdentity } from '../lib/googleIdentity';

export default function Register() {
  const { register, googleLogin } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'CUSTOMER' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleReady, setGoogleReady] = useState(true);
  const googleBtnRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    waitForGoogleIdentity()
      .then((google) => {
        if (cancelled) return;
        google.accounts.id.initialize({
          client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
          callback: async (response) => {
            setError('');
            setLoading(true);
            try {
              await googleLogin(response.credential, form.role);
              navigate('/events');
            } catch (err) {
              setError(err.friendlyMessage || err.response?.data?.error || 'Google Sign Up failed. Please try again.');
            } finally {
              setLoading(false);
            }
          }
        });

        google.accounts.id.renderButton(googleBtnRef.current, {
          theme: 'filled_blue',
          size: 'large',
          text: 'signup_with',
          shape: 'rectangular',
          logo_alignment: 'left',
          width: googleBtnRef.current?.offsetWidth || 350,
        });
      })
      .catch(() => {
        if (!cancelled) setGoogleReady(false);
      });
    return () => { cancelled = true; };
  }, [googleLogin, navigate, form.role]);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(form.name, form.email, form.password, form.role);
      navigate('/events');
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto mt-16 px-4">
      <div className="card p-8">
        <h1 className="text-2xl font-bold mb-1">Create your account</h1>
        <p className="text-stone-600 text-sm mb-6">Book tickets or organise your own events.</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Full Name</label>
            <input className="input" value={form.name} onChange={(e) => update('name', e.target.value)} required />
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" value={form.email} onChange={(e) => update('email', e.target.value)} required />
          </div>
          <div>
            <label className="label">Password</label>
            <input className="input" type="password" value={form.password} onChange={(e) => update('password', e.target.value)} required minLength={6} />
          </div>
          <div>
            <label className="label">I am a...</label>
            <select className="input" value={form.role} onChange={(e) => update('role', e.target.value)}>
              <option value="CUSTOMER">Customer</option>
              <option value="ORGANISER">Organiser</option>
            </select>
          </div>
          {error && <p className="text-rose-400 text-sm">{error}</p>}
          <button className="btn-primary w-full" disabled={loading}>{loading ? 'Creating account...' : 'Sign Up'}</button>
        </form>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-stone-200"></div>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-stone-100 px-2 text-stone-600">Or continue with</span>
          </div>
        </div>

        <div className="w-full flex justify-center">
          <div ref={googleBtnRef} className="w-full"></div>
          {!googleReady && (
            <p className="text-xs text-stone-500">Google Sign-In couldn't load — check your connection and refresh.</p>
          )}
        </div>
        <p className="text-sm text-stone-600 mt-6">
          Already have an account? <Link to="/login" className="text-brand-700 hover:underline">Log in</Link>
        </p>
      </div>
    </div>
  );
}
