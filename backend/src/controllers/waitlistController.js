const prisma = require('../utils/prisma');
const { generateToken } = require('../utils/ref');
const { sendWaitlistOfferEmail } = require('../utils/email');
const { broadcastSeatUpdate } = require('../sockets');

const OFFER_TTL_MIN = Number(process.env.WAITLIST_OFFER_TTL_MINUTES || 15);
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

/**
 * Customer joins the waitlist for a sold-out category on an event.
 * Position is FIFO (based on current queue length for that category).
 */
async function joinWaitlist(req, res) {
  const { eventId, category } = req.body;
  if (!eventId || !category) return res.status(400).json({ error: 'eventId and category are required' });

  // Guard: don't let someone join if seats are actually available in that category
  const availableCount = await prisma.showSeat.count({
    where: { eventId, status: 'AVAILABLE', seat: { category } },
  });
  if (availableCount > 0) {
    return res.status(400).json({ error: 'Seats are currently available in this category; no need to wait.' });
  }

  const existing = await prisma.waitlistEntry.findFirst({
    where: { eventId, userId: req.user.id, category, status: { in: ['WAITING', 'OFFERED'] } },
  });
  if (existing) return res.status(409).json({ error: 'You are already on the waitlist for this category' });

  const queueLength = await prisma.waitlistEntry.count({
    where: { eventId, category, status: 'WAITING' },
  });

  const entry = await prisma.waitlistEntry.create({
    data: { eventId, userId: req.user.id, category, position: queueLength + 1, status: 'WAITING' },
  });

  return res.status(201).json(entry);
}

/**
 * Called when a seat is freed (cancellation). Finds the next WAITING entry
 * (lowest position) for that seat's category, transitions it to OFFERED,
 * puts a time-limited hold on the seat with a claim token, and emails the
 * customer a claim link. Returns true if a waitlist offer was made.
 */
async function offerSeatToNextInWaitlist(eventId, showSeat) {
  const category = showSeat.category || (await prisma.seat.findUnique({ where: { id: showSeat.seatId } }))?.category;
  const seatCategory = category || (await resolveCategory(showSeat));

  const nextEntry = await prisma.waitlistEntry.findFirst({
    where: { eventId, category: seatCategory, status: 'WAITING' },
    orderBy: { position: 'asc' },
  });
  if (!nextEntry) return false;

  const offerToken = generateToken();
  const expiresAt = new Date(Date.now() + OFFER_TTL_MIN * 60 * 1000);

  await prisma.$transaction([
    prisma.showSeat.update({
      where: { id: showSeat.id },
      data: {
        status: 'HELD',
        holdToken: offerToken,
        holdExpiresAt: expiresAt,
        version: { increment: 1 },
      },
    }),
    prisma.waitlistEntry.update({
      where: { id: nextEntry.id },
      data: {
        status: 'OFFERED',
        offeredShowSeatId: showSeat.id,
        offerToken,
        offerExpiresAt: expiresAt,
      },
    }),
  ]);

  const updatedSeat = await prisma.showSeat.findUnique({ where: { id: showSeat.id }, include: { seat: true } });
  broadcastSeatUpdate(eventId, updatedSeat);

  const [user, event] = await Promise.all([
    prisma.user.findUnique({ where: { id: nextEntry.userId } }),
    prisma.event.findUnique({ where: { id: eventId } }),
  ]);
  const claimUrl = `${CLIENT_URL}/waitlist/claim/${offerToken}`;
  sendWaitlistOfferEmail({
    to: user.email,
    name: user.name,
    eventTitle: event.title,
    category: seatCategory,
    claimUrl,
    expiresAt,
  }).catch((e) => console.error('Waitlist offer email failed:', e.message));

  return true;
}

async function resolveCategory(showSeat) {
  const seat = await prisma.seat.findUnique({ where: { id: showSeat.seatId } });
  return seat?.category;
}

/**
 * Waitlisted customer views/claims their offer. Claiming here just returns
 * offer details for the frontend to proceed to booking confirmation using
 * the offerToken as the holdToken against POST /bookings.
 */
async function getOfferByToken(req, res) {
  const entry = await prisma.waitlistEntry.findFirst({
    where: { offerToken: req.params.token, status: 'OFFERED' },
    include: { event: { include: { venue: true } } },
  });
  if (!entry) return res.status(404).json({ error: 'Offer not found, already claimed, or expired' });
  if (entry.userId !== req.user.id) return res.status(403).json({ error: 'This offer is not for you' });
  if (new Date(entry.offerExpiresAt) < new Date()) {
    return res.status(410).json({ error: 'Offer has expired' });
  }
  return res.json({
    eventId: entry.eventId,
    eventTitle: entry.event.title,
    category: entry.category,
    showSeatId: entry.offeredShowSeatId,
    offerToken: entry.offerToken,
    offerExpiresAt: entry.offerExpiresAt,
  });
}

// Marks a waitlist entry CLAIMED once the booking is actually confirmed (called from bookingController flow via token match)
async function markClaimed(offerToken) {
  await prisma.waitlistEntry.updateMany({
    where: { offerToken, status: 'OFFERED' },
    data: { status: 'CLAIMED' },
  });
}

async function myWaitlistEntries(req, res) {
  const entries = await prisma.waitlistEntry.findMany({
    where: { userId: req.user.id },
    include: { event: true },
    orderBy: { createdAt: 'desc' },
  });
  return res.json(entries);
}

module.exports = {
  joinWaitlist,
  offerSeatToNextInWaitlist,
  getOfferByToken,
  markClaimed,
  myWaitlistEntries,
  OFFER_TTL_MIN,
};
