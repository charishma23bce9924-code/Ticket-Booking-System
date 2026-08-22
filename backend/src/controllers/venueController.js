const prisma = require('../utils/prisma');

// Admin creates a venue with a grid layout and category zones
// categoryMap: e.g. [{ rowLabel: 'A', category: 'Premium' }, { rowLabel: 'B', category: 'Standard' }]
async function createVenue(req, res) {
  try {
    const { name, address, rows, cols, categoryMap } = req.body;
    if (!name || !address || !rows || !cols) {
      return res.status(400).json({ error: 'name, address, rows, cols are required' });
    }

    const venue = await prisma.venue.create({
      data: { name, address, rows, cols, createdBy: req.user.id },
    });

    const rowLabels = Array.from({ length: rows }, (_, i) => String.fromCharCode(65 + i));
    const seatsData = [];
    for (const rowLabel of rowLabels) {
      const catEntry = categoryMap?.find((c) => c.rowLabel === rowLabel);
      const category = catEntry ? catEntry.category : 'Standard';
      for (let col = 1; col <= cols; col++) {
        seatsData.push({ venueId: venue.id, rowLabel, colNumber: col, category });
      }
    }
    await prisma.seat.createMany({ data: seatsData });

    const fullVenue = await prisma.venue.findUnique({
      where: { id: venue.id },
      include: { seats: true },
    });
    return res.status(201).json(fullVenue);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to create venue' });
  }
}

async function listVenues(req, res) {
  const venues = await prisma.venue.findMany({ include: { seats: false } });
  return res.json(venues);
}

async function getVenue(req, res) {
  const venue = await prisma.venue.findUnique({
    where: { id: req.params.id },
    include: { seats: true },
  });
  if (!venue) return res.status(404).json({ error: 'Venue not found' });
  return res.json(venue);
}

module.exports = { createVenue, listVenues, getVenue };
