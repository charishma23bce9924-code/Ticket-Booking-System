const prisma = require('../utils/prisma');
const { generateBookingRef } = require('../utils/ref');
const { generateQRCodeDataUrl, sendBookingConfirmationEmail } = require('../utils/email');
const { broadcastSeatUpdate } = require('../sockets');
const { offerSeatToNextInWaitlist, markClaimed } = require('./waitlistController');

/**
 * Confirm a booking from previously-held seats.
 * Converts each HELD showSeat (matching holdToken, not expired) to BOOKED
 * inside a transaction — if any seat's hold has expired or doesn't match,
 * the whole booking fails atomically (no partial bookings).
 */
async function createBooking(req, res) {
  const { eventId, showSeatIds, holdToken } = req.body;
  if (!eventId || !Array.isArray(showSeatIds) || showSeatIds.length === 0 || !holdToken) {
    return res.status(400).json({ error: 'eventId, showSeatIds[], holdToken are required' });
  }

  try {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: { pricing: true },
    });
    if (!event) return res.status(404).json({ error: 'Event not found' });

    const bookingRef = generateBookingRef();

    const { booking, showSeats } = await prisma.$transaction(async (tx) => {
      const seats = [];
      let total = 0;
      const bookingSeatData = [];

      for (const showSeatId of showSeatIds) {
        const now = new Date();
        // Atomic conditional transition HELD(by this token, not expired) -> BOOKED
        const updateResult = await tx.showSeat.updateMany({
          where: {
            id: showSeatId,
            eventId,
            status: 'HELD',
            holdToken,
            holdExpiresAt: { gt: now },
          },
          data: { status: 'BOOKED', holdToken: null, holdExpiresAt: null, version: { increment: 1 } },
        });
        if (updateResult.count === 0) {
          throw new Error(`HOLD_EXPIRED_OR_INVALID:${showSeatId}`);
        }
        const ss = await tx.showSeat.findUnique({ where: { id: showSeatId }, include: { seat: true } });
        seats.push(ss);
        const price = event.pricing.find((p) => p.category === ss.seat.category)?.price || 0;
        total += price;
        bookingSeatData.push({ showSeatId: ss.id, priceAtBooking: price });
      }

      const createdBooking = await tx.booking.create({
        data: {
          bookingRef,
          userId: req.user.id,
          eventId,
          totalAmount: total,
          status: 'CONFIRMED',
          seats: { create: bookingSeatData },
        },
      });

      return { booking: createdBooking, showSeats: seats };
    });

    // Generate QR + send email (outside transaction; booking is already committed)
    const qrDataUrl = await generateQRCodeDataUrl({ bookingRef: booking.bookingRef, eventId });
    await prisma.booking.update({ where: { id: booking.id }, data: { qrCodeDataUrl: qrDataUrl } });

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    const seatLabels = showSeats.map((ss) => `${ss.seat.rowLabel}${ss.seat.colNumber}`);
    sendBookingConfirmationEmail({
      to: user.email,
      name: user.name,
      bookingRef: booking.bookingRef,
      eventTitle: event.title,
      seatLabels,
      qrDataUrl,
    }).catch((e) => console.error('Email send failed:', e.message));

    showSeats.forEach((ss) => broadcastSeatUpdate(eventId, ss));

    // If this booking was completed using a waitlist offer token, mark that entry CLAIMED
    markClaimed(holdToken).catch(() => {});

    return res.status(201).json({
      bookingId: booking.id,
      bookingRef: booking.bookingRef,
      totalAmount: booking.totalAmount,
      seats: seatLabels,
      qrCodeDataUrl: qrDataUrl,
    });
  } catch (err) {
    if (err.message?.startsWith('HOLD_EXPIRED_OR_INVALID')) {
      return res.status(409).json({
        error: 'Your seat hold expired or is invalid. Please reselect your seats.',
        seatId: err.message.split(':')[1],
      });
    }
    console.error(err);
    return res.status(500).json({ error: 'Failed to create booking' });
  }
}

async function myBookings(req, res) {
  const bookings = await prisma.booking.findMany({
    where: { userId: req.user.id },
    include: { event: { include: { venue: true } }, seats: { include: { showSeat: { include: { seat: true } } } } },
    orderBy: { createdAt: 'desc' },
  });
  return res.json(bookings);
}

/**
 * Cancel a booking. Frees the seats (BOOKED -> AVAILABLE) then, for each
 * freed seat's category, offers it to the next customer in that category's
 * waitlist queue (if any) rather than leaving it simply available.
 */
async function cancelBooking(req, res) {
  const booking = await prisma.booking.findUnique({
    where: { id: req.params.id },
    include: { seats: { include: { showSeat: { include: { seat: true } } } }, event: true },
  });
  if (!booking) return res.status(404).json({ error: 'Booking not found' });
  if (booking.userId !== req.user.id && req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Not your booking' });
  }
  if (booking.status !== 'CONFIRMED') {
    return res.status(400).json({ error: 'Booking is not active' });
  }

  await prisma.booking.update({ where: { id: booking.id }, data: { status: 'CANCELLED', cancelledAt: new Date() } });

  for (const bs of booking.seats) {
    const showSeat = bs.showSeat;
    // Try to offer to waitlist first; if no one is waiting, mark AVAILABLE
    const offered = await offerSeatToNextInWaitlist(booking.eventId, showSeat);
    if (!offered) {
      const updated = await prisma.showSeat.update({
        where: { id: showSeat.id },
        data: { status: 'AVAILABLE', holdToken: null, holdExpiresAt: null, version: { increment: 1 } },
      });
      broadcastSeatUpdate(booking.eventId, updated);
    }
  }

  return res.json({ message: 'Booking cancelled', bookingId: booking.id });
}

module.exports = { createBooking, myBookings, cancelBooking };
