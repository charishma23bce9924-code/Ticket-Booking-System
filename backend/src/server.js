require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

// Process-level safety net: log unexpected errors instead of letting them
// crash the whole server. Route-level errors are already caught by
// asyncHandler + the Express error middleware below; this is a last-resort
// backstop for anything outside the request/response cycle (e.g. the cron
// job in jobs/expiry.js).
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Promise Rejection (server kept running):', reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception (server kept running):', err);
});

const authRoutes = require('./routes/authRoutes');
const venueRoutes = require('./routes/venueRoutes');
const eventRoutes = require('./routes/eventRoutes');
const seatRoutes = require('./routes/seatRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const waitlistRoutes = require('./routes/waitlistRoutes');

const { initSocket } = require('./sockets');
const { startExpiryJob } = require('./jobs/expiry');

const app = express();
const server = http.createServer(app);

const allowedOrigins = [
  process.env.CLIENT_URL || 'http://localhost:5173',
  'http://localhost:5173',
  'http://localhost:5174',
];

const io = new Server(server, {
  cors: { origin: allowedOrigins },
});

app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date() }));

app.use('/api/auth', authRoutes);
app.use('/api/venues', venueRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/seats', seatRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/waitlist', waitlistRoutes);

// 404
app.use((req, res) => res.status(404).json({ error: 'Route not found' }));

// Central error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

initSocket(io);
startExpiryJob();

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🎟️  Ticket booking API running on port ${PORT}`));

module.exports = { app, server };
