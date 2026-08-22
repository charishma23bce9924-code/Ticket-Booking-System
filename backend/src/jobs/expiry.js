const cron = require('node-cron');
const prisma = require('../utils/prisma');
const { broadcastSeatUpdate } = require('../sockets');

/**
 * Runs every 30 seconds. This is the database-level TTL enforcement layer:
 * even if a client never calls the explicit "release" endpoint (e.g. they
 * just close the tab), any HELD showSeat whose holdExpiresAt has passed is
 * swept up here and freed. Two cases:
 *
 * 1. A plain customer hold expired (no one was waiting) -> seat goes back
 *    to AVAILABLE.
 * 2. A waitlist OFFER expired (customer didn't claim in time) -> the
 *    corresponding WaitlistEntry is marked EXPIRED and the seat is offered
 *    to the NEXT person in that category's queue (cascading), or released
 *    to AVAILABLE if the queue is empty.
 */
function startExpiryJob() {
  cron.schedule('*/30 * * * * *', async () => {
    try {
      await sweepExpiredHolds();
    } catch (err) {
      console.error('Expiry sweep failed:', err);
    }
  });
  console.log('Expiry sweep job scheduled (every 30s)');
}

async function sweepExpiredHolds() {
  const now = new Date();
  const expiredSeats = await prisma.showSeat.findMany({
    where: { status: 'HELD', holdExpiresAt: { lt: now } },
    include: { seat: true },
  });

  for (const showSeat of expiredSeats) {
    // Was this hold actually a waitlist offer?
    const waitlistEntry = await prisma.waitlistEntry.findFirst({
      where: { offeredShowSeatId: showSeat.id, status: 'OFFERED', offerToken: showSeat.holdToken },
    });

    if (waitlistEntry) {
      await prisma.waitlistEntry.update({
        where: { id: waitlistEntry.id },
        data: { status: 'EXPIRED' },
      });
      // Free the seat first so the cascade's conditional queries are consistent
      await prisma.showSeat.update({
        where: { id: showSeat.id },
        data: { status: 'AVAILABLE', holdToken: null, holdExpiresAt: null, version: { increment: 1 } },
      });
      // Cascade: offer to the next person in the queue, if any
      // (lazy import avoids circular require at module load time)
      const { offerSeatToNextInWaitlist } = require('../controllers/waitlistController');
      const refreshed = await prisma.showSeat.findUnique({ where: { id: showSeat.id } });
      const offered = await offerSeatToNextInWaitlist(showSeat.eventId, refreshed);
      if (!offered) {
        broadcastSeatUpdate(showSeat.eventId, refreshed);
      }
    } else {
      const updated = await prisma.showSeat.update({
        where: { id: showSeat.id },
        data: { status: 'AVAILABLE', holdToken: null, holdExpiresAt: null, version: { increment: 1 } },
      });
      broadcastSeatUpdate(showSeat.eventId, updated);
    }
  }

  if (expiredSeats.length) {
    console.log(`Expiry sweep: released ${expiredSeats.length} seat(s)`);
  }
}

module.exports = { startExpiryJob, sweepExpiredHolds };
