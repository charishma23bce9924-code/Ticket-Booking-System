const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const hash = (pw) => bcrypt.hashSync(pw, 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@demo.com' },
    update: {},
    create: { name: 'Admin User', email: 'admin@demo.com', passwordHash: hash('password123'), role: 'ADMIN' },
  });

  const organiser = await prisma.user.upsert({
    where: { email: 'organiser@demo.com' },
    update: {},
    create: { name: 'Olivia Organiser', email: 'organiser@demo.com', passwordHash: hash('password123'), role: 'ORGANISER' },
  });

  await prisma.user.upsert({
    where: { email: 'customer@demo.com' },
    update: {},
    create: { name: 'Chris Customer', email: 'customer@demo.com', passwordHash: hash('password123'), role: 'CUSTOMER' },
  });

  let venue = await prisma.venue.findFirst({ where: { name: 'Grand Cinema Hall' } });
  if (!venue) {
    venue = await prisma.venue.create({
      data: { name: 'Grand Cinema Hall', address: '123 Main St, Springfield', rows: 5, cols: 8, createdBy: admin.id },
    });
    const rowLabels = ['A', 'B', 'C', 'D', 'E'];
    const seatsData = [];
    for (const rowLabel of rowLabels) {
      const category = rowLabel === 'A' || rowLabel === 'B' ? 'Premium' : 'Standard';
      for (let col = 1; col <= 8; col++) {
        seatsData.push({ venueId: venue.id, rowLabel, colNumber: col, category });
      }
    }
    await prisma.seat.createMany({ data: seatsData });
    venue = await prisma.venue.findUnique({ where: { id: venue.id }, include: { seats: true } });
  }

  // Second venue: a concert hall, for variety in row/category layout
  let concertHall = await prisma.venue.findFirst({ where: { name: 'Starlight Concert Hall' } });
  if (!concertHall) {
    concertHall = await prisma.venue.create({
      data: { name: 'Starlight Concert Hall', address: '77 Symphony Ave, Springfield', rows: 6, cols: 10, createdBy: admin.id },
    });
    const rowLabels = ['A', 'B', 'C', 'D', 'E', 'F'];
    const seatsData = [];
    for (const rowLabel of rowLabels) {
      const category = ['A', 'B'].includes(rowLabel) ? 'VIP' : ['C', 'D'].includes(rowLabel) ? 'Premium' : 'Standard';
      for (let col = 1; col <= 10; col++) {
        seatsData.push({ venueId: concertHall.id, rowLabel, colNumber: col, category });
      }
    }
    await prisma.seat.createMany({ data: seatsData });
    concertHall = await prisma.venue.findUnique({ where: { id: concertHall.id }, include: { seats: true } });
  }

  const eventDefs = [
    {
      title: 'Interstellar: Re-Release',
      type: 'MOVIE',
      description: 'A special IMAX re-release screening.',
      venueId: venue.id,
      daysFromNow: 3,
      pricing: [{ category: 'Premium', price: 15 }, { category: 'Standard', price: 10 }],
    },
    {
      title: 'City Lights Rock Concert',
      type: 'CONCERT',
      description: 'An electrifying night of live rock music under the stars.',
      venueId: concertHall.id,
      daysFromNow: 5,
      pricing: [{ category: 'VIP', price: 80 }, { category: 'Premium', price: 50 }, { category: 'Standard', price: 30 }],
    },
    {
      title: 'The Magic Flute — Opera Night',
      type: 'CONCERT',
      description: "Mozart's beloved opera performed by the Springfield Philharmonic.",
      venueId: concertHall.id,
      daysFromNow: 10,
      pricing: [{ category: 'VIP', price: 120 }, { category: 'Premium', price: 75 }, { category: 'Standard', price: 45 }],
    },
    {
      title: 'Moonlight Sonata — Solo Piano Recital',
      type: 'CONCERT',
      description: 'An intimate evening of classical piano, featuring Beethoven, Chopin, and Debussy.',
      venueId: concertHall.id,
      daysFromNow: 7,
      pricing: [{ category: 'VIP', price: 60 }, { category: 'Premium', price: 40 }, { category: 'Standard', price: 25 }],
    },
    {
      title: 'Dune: Part Three',
      type: 'MOVIE',
      description: 'The epic conclusion, in IMAX.',
      venueId: venue.id,
      daysFromNow: 2,
      pricing: [{ category: 'Premium', price: 18 }, { category: 'Standard', price: 12 }],
    },
  ];

  for (const def of eventDefs) {
    const existing = await prisma.event.findFirst({ where: { title: def.title } });
    if (existing) continue;
    const created = await prisma.event.create({
      data: {
        title: def.title,
        type: def.type,
        description: def.description,
        venueId: def.venueId,
        organiserId: organiser.id,
        dateTime: new Date(Date.now() + def.daysFromNow * 24 * 60 * 60 * 1000),
        pricing: { create: def.pricing },
      },
    });
    const seats = await prisma.seat.findMany({ where: { venueId: def.venueId } });
    await prisma.showSeat.createMany({
      data: seats.map((s) => ({ eventId: created.id, seatId: s.id, status: 'AVAILABLE' })),
    });
  }

  console.log('Seed complete.');
  console.log('Login credentials:');
  console.log('  Admin:     admin@demo.com / password123');
  console.log('  Organiser: organiser@demo.com / password123');
  console.log('  Customer:  customer@demo.com / password123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
