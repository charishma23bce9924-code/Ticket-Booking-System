const prisma = require('../utils/prisma');
const { hashPassword, comparePassword, signToken } = require('../utils/auth');

async function register(req, res) {
  try {
    let { name, email, password, role } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'name, email, password are required' });
    }
    email = email.trim().toLowerCase();
    name = name.trim();
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    const allowedRoles = ['CUSTOMER', 'ORGANISER', 'ADMIN'];
    const finalRole = allowedRoles.includes(role) ? role : 'CUSTOMER';

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: 'An account with this email already exists. Try logging in instead.' });

    const user = await prisma.user.create({
      data: { name, email, passwordHash: hashPassword(password), role: finalRole },
    });

    const token = signToken(user);
    return res.status(201).json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
}

async function login(req, res) {
  try {
    let { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }
    email = email.trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !comparePassword(password, user.passwordHash)) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    const token = signToken(user);
    return res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Login failed. Please try again.' });
  }
}

async function me(req, res) {
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user) return res.status(404).json({ error: 'User not found' });
  return res.json({ id: user.id, name: user.name, email: user.email, role: user.role });
}

const { OAuth2Client } = require('google-auth-library');
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

async function googleLogin(req, res) {
  try {
    const { idToken, role } = req.body;
    if (!idToken) {
      return res.status(400).json({ error: 'idToken is required' });
    }

    let payload;
    try {
      const ticket = await client.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } catch (err) {
      console.error('Google token verification failed:', err);
      return res.status(401).json({ error: 'Invalid Google token' });
    }

    const email = payload.email.trim().toLowerCase();
    if (payload.email_verified === false) {
      return res.status(401).json({ error: 'Google account email is not verified' });
    }
    const name = payload.name || email.split('@')[0];

    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Create user if not exists
      const dummyPassword = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      const allowedRoles = ['CUSTOMER', 'ORGANISER', 'ADMIN'];
      const finalRole = allowedRoles.includes(role) ? role : 'CUSTOMER';
      user = await prisma.user.create({
        data: {
          name,
          email,
          passwordHash: hashPassword(dummyPassword),
          role: finalRole,
        },
      });
    }

    const token = signToken(user);
    return res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    console.error('Google login error:', err);
    return res.status(500).json({ error: 'Google authentication failed' });
  }
}

module.exports = { register, login, me, googleLogin };
