const prisma = require('../utils/prisma');
const { generateToken } = require('../utils/ref');
const { broadcastSeatUpdate } = require('../sockets');

const HOLD_TTL_MIN = Number(process.env.SEAT_HOLD_TTL_MINUTES || 10);

/**
 * Place a hold on one or more seats for an event.
 *
 * CONCURRENCY PROTECTION:
 * We use a conditional atomic update: `UPDATE ShowSeat SET status='HELD', ...
 * WHERE id = ? AND status = 'AVAILABLE'`. This is executed via Prisma's
 * `updateMany`, whose WHERE clause (including status='AVAILABLE') is evaluated
 * and applied atomically by the database in a single statement — there is no
 * read-then-write gap for two concurrent requests to both slip through.
 * If two customers race for the same seat, only one `updateMany` call will
 * affect a row (count === 1); the other will affect 0 rows and is rejected.
 * The whole multi-seat hold request runs inside a single DB transaction so
 * either all requested seats are held, or none are (all-or-nothing).
 */
async function holdSeats(req, res) {
  const { eventId, showSeatIds } = req.body;
  if (!eventId || !Array.isArray(showSeatIds) || showSeatIds.length === 0) {
    return res.status(400).json({ error: 'eventId and showSeatIds[] are required' });
  }

  const holdToken = generateToken();
  const expiresAt = new Date(Date.now() + HOLD_TTL_MIN * 60 * 1000);

  try {
    const result = await prisma.$transaction(async (tx) => {
      const heldSeats = [];
      for (const showSeatId of showSeatIds) {
        const updateResult = await tx.showSeat.updateMany({
          where: { id: showSeatId, eventId, status: 'AVAILABLE' },
          data: {
            status: 'HELD',
            holdToken,
            holdExpiresAt: expiresAt,
            version: { increment: 1 },
          },
        });
        if (updateResult.count === 0) {
          // Seat was not AVAILABLE (already held/booked, or doesn't exist) -> abort whole batch
          throw new Error(`SEAT_UNAVAILABLE:${showSeatId}`);
        }
        heldSeats.push(showSeatId);
      }
      return heldSeats;
    });

    const showSeats = await prisma.showSeat.findMany({
      where: { id: { in: result } },
      include: { seat: true },
    });
    showSeats.forEach((ss) => broadcastSeatUpdate(eventId, ss));

    return res.status(200).json({
      holdToken,
      expiresAt,
      seats: showSeats.map((ss) => ({
        showSeatId: ss.id,
        rowLabel: ss.seat.rowLabel,
        colNumber: ss.seat.colNumber,
        category: ss.seat.category,
        status: ss.status,
      })),
    });
  } catch (err) {
    if (err.message?.startsWith('SEAT_UNAVAILABLE')) {
      return res.status(409).json({
        error: 'One or more selected seats are no longer available. Please refresh and try again.',
        seatId: err.message.split(':')[1],
      });
    }
    console.error(err);
    return res.status(500).json({ error: 'Failed to hold seats' });
  }
}

/**
 * Release seats explicitly (checkout abandonment / user deselects seats).
 * Only releases seats that are currently HELD by the given holdToken —
 * prevents releasing someone else's hold.
 */
async function releaseSeats(req, res) {
  const { eventId, showSeatIds, holdToken } = req.body;
  if (!eventId || !Array.isArray(showSeatIds) || !holdToken) {
    return res.status(400).json({ error: 'eventId, showSeatIds[], holdToken are required' });
  }

  const result = await prisma.showSeat.updateMany({
    where: { id: { in: showSeatIds }, eventId, status: 'HELD', holdToken },
    data: { status: 'AVAILABLE', holdToken: null, holdExpiresAt: null, version: { increment: 1 } },
  });

  const showSeats = await prisma.showSeat.findMany({
    where: { id: { in: showSeatIds } },
    include: { seat: true },
  });
  showSeats.forEach((ss) => broadcastSeatUpdate(eventId, ss));

  return res.json({ released: result.count });
}

module.exports = { holdSeats, releaseSeats, HOLD_TTL_MIN };
