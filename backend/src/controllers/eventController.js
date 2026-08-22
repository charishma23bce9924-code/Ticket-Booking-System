const prisma = require('../utils/prisma');

// Organiser creates a movie/concert listing tied to a venue + date/time + per-category pricing.
// Also materializes a ShowSeat row (status=AVAILABLE) for every seat in the venue for this show.
async function createEvent(req, res) {
  try {
    const { title, type, description, venueId, dateTime, pricing } = req.body;
    if (!title || !type || !venueId || !dateTime || !pricing?.length) {
      return res.status(400).json({ error: 'title, type, venueId, dateTime, pricing[] are required' });
    }

    const venue = await prisma.venue.findUnique({ where: { id: venueId }, include: { seats: true } });
    if (!venue) return res.status(404).json({ error: 'Venue not found' });

    const event = await prisma.event.create({
      data: {
        title,
        type,
        description,
        venueId,
        organiserId: req.user.id,
        dateTime: new Date(dateTime),
        pricing: { create: pricing.map((p) => ({ category: p.category, price: p.price })) },
      },
    });

    await prisma.showSeat.createMany({
      data: venue.seats.map((seat) => ({ eventId: event.id, seatId: seat.id, status: 'AVAILABLE' })),
    });

    const full = await prisma.event.findUnique({
      where: { id: event.id },
      include: { pricing: true, venue: true },
    });
    return res.status(201).json(full);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to create event' });
  }
}

async function listEvents(req, res) {
  const { type, q, from, to, organiserId } = req.query;
  const where = {};
  if (type) where.type = type;
  if (q) where.title = { contains: q };
  if (organiserId) where.organiserId = organiserId;
  if (from || to) {
    where.dateTime = {};
    if (from) where.dateTime.gte = new Date(from);
    if (to) where.dateTime.lte = new Date(to);
  }
  const events = await prisma.event.findMany({
    where,
    include: { venue: true, pricing: true },
    orderBy: { dateTime: 'asc' },
  });
  return res.json(events);
}

async function getEvent(req, res) {
  const event = await prisma.event.findUnique({
    where: { id: req.params.id },
    include: { venue: true, pricing: true },
  });
  if (!event) return res.status(404).json({ error: 'Event not found' });
  return res.json(event);
}

// Returns the live seat map for an event: seat position/category + current status
async function getSeatMap(req, res) {
  const showSeats = await prisma.showSeat.findMany({
    where: { eventId: req.params.id },
    include: { seat: true },
  });
  const seats = showSeats.map((ss) => ({
    showSeatId: ss.id,
    rowLabel: ss.seat.rowLabel,
    colNumber: ss.seat.colNumber,
    category: ss.seat.category,
    status: ss.status,
    holdExpiresAt: ss.holdExpiresAt,
  }));
  return res.json({ eventId: req.params.id, seats });
}

// Organiser: booking summary + revenue for their event
async function getEventSummary(req, res) {
  const event = await prisma.event.findUnique({ where: { id: req.params.id } });
  if (!event) return res.status(404).json({ error: 'Event not found' });
  if (event.organiserId !== req.user.id && req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Not your event' });
  }

  const bookings = await prisma.booking.findMany({
    where: { eventId: event.id, status: 'CONFIRMED' },
    include: { seats: true, user: true },
  });

  const totalRevenue = bookings.reduce((sum, b) => sum + b.totalAmount, 0);
  const totalSeatsBooked = bookings.reduce((sum, b) => sum + b.seats.length, 0);

  return res.json({
    eventId: event.id,
    title: event.title,
    totalBookings: bookings.length,
    totalSeatsBooked,
    totalRevenue,
    bookings: bookings.map((b) => ({
      bookingRef: b.bookingRef,
      customer: b.user.name,
      seats: b.seats.length,
      amount: b.totalAmount,
      createdAt: b.createdAt,
    })),
  });
}

module.exports = { createEvent, listEvents, getEvent, getSeatMap, getEventSummary };
