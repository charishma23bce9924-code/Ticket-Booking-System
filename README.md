# SeatSure — Ticket Booking System

A full-stack ticket booking platform for movies and concerts with a visual seat
map, auto-releasing seat holds, a self-service waitlist with automatic seat
reassignment, and QR-coded email tickets.

**Stack:** Node.js + Express + Prisma (SQLite by default, Postgres-ready) + Socket.io on the
backend; React + Vite + Tailwind on the frontend.

---

## 1. Project Structure

```
ticket-booking-system/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma        # DB schema (see section 4)
│   │   └── seed.js              # Demo admin/organiser/customer + venue + event
│   ├── src/
│   │   ├── controllers/         # Business logic (auth, venue, event, seat, booking, waitlist)
│   │   ├── routes/              # Express route definitions
│   │   ├── middleware/          # JWT auth + role guards
│   │   ├── jobs/expiry.js       # Cron sweep: seat hold TTL + waitlist offer cascade
│   │   ├── sockets/index.js     # Socket.io room join + broadcast helpers
│   │   ├── utils/               # prisma client, auth (JWT/bcrypt), email+QR, ref generator
│   │   └── server.js            # App entrypoint
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── pages/                # Home, Login, Register, Events, EventDetail,
│   │   │                         # MyBookings, WaitlistClaim, OrganiserDashboard, AdminDashboard
│   │   ├── components/           # NavBar, SeatMap, CountdownTimer
│   │   ├── context/AuthContext.jsx
│   │   ├── lib/                  # api.js (axios), socket.js (socket.io-client)
│   │   └── App.jsx / main.jsx
│   ├── .env.example
│   └── package.json
└── README.md   (this file)
```

---

## 2. Local Setup (VS Code)

### Prerequisites
- Node.js 18+ and npm
- Two terminals (or use VS Code's split terminal) — one for backend, one for frontend

### Backend

```bash
cd backend
npm install
cp .env.example .env          # already done for you in the zip; edit if needed
npx prisma generate
npx prisma migrate dev --name init   # creates dev.db (SQLite) and applies schema
npm run prisma:seed                  # optional but recommended: creates demo users/venue/event
npm run dev                          # starts on http://localhost:5000
```

> **Note:** `npx prisma generate` / `migrate` download a small query-engine binary
> the first time. This requires normal internet access (it was blocked only in the
> sandboxed environment this was built in — it will work fine on your machine).

Demo accounts created by the seed script (password for all: `password123`):
| Role | Email |
|---|---|
| Admin | admin@demo.com |
| Organiser | organiser@demo.com |
| Customer | customer@demo.com |

### Frontend

```bash
cd frontend
npm install
cp .env.example .env          # already done for you; points at localhost:5000
npm run dev                   # starts on http://localhost:5173
```

Open `http://localhost:5173`. Log in with one of the demo accounts, or register your own.

### Email (optional, for real delivery)
By default, if no SMTP credentials are set, the backend uses a `jsonTransport`
that logs the "sent" email (including the QR data URL) to the backend console
instead of actually sending it — so booking flows fully work out of the box
with zero email setup.

To get real emails for free, sign up at [ethereal.email](https://ethereal.email)
(auto-generates a disposable SMTP inbox) and put the credentials in `backend/.env`:
```
SMTP_HOST=smtp.ethereal.email
SMTP_PORT=587
SMTP_USER=<your ethereal user>
SMTP_PASS=<your ethereal pass>
```
Then view "sent" mail at https://ethereal.email/messages.

---

## 3. Deploying

### GitHub
```bash
cd ticket-booking-system
git init
git add .
git commit -m "Initial commit: ticket booking system"
git branch -M main
git remote add origin <your-repo-url>
git push -u origin main
```
`.gitignore` files are included in both `backend/` and `frontend/` (excludes `node_modules`,
`.env`, `dev.db`, `dist/`).

### Backend — Render (recommended, free tier)
1. New Web Service → connect your GitHub repo → root directory `backend`
2. Build command: `npm install && npx prisma generate && npx prisma migrate deploy`
3. Start command: `npm start`
4. Add environment variables from `.env.example` (set `DATABASE_URL` to a Render/Railway
   Postgres instance for production — SQLite doesn't persist reliably on most free hosts
   since disks are ephemeral; swap `provider = "sqlite"` → `"postgresql"` in `schema.prisma`)
5. Set `CLIENT_URL` to your deployed frontend URL (for CORS + Socket.io)

### Frontend — Vercel
1. New Project → import repo → root directory `frontend`
2. Framework preset: Vite
3. Env vars: `VITE_API_URL=https://<your-backend>.onrender.com/api`,
   `VITE_SOCKET_URL=https://<your-backend>.onrender.com`
4. Deploy

(Railway works the same way for the backend if you prefer it over Render.)

---

## 4. Database Schema

Core tables (see `backend/prisma/schema.prisma` for full definitions):

- **User** — `id, name, email, passwordHash, role[CUSTOMER|ORGANISER|ADMIN]`
- **Venue** — `id, name, address, rows, cols, createdBy` (admin-owned)
- **Seat** — master layout per venue: `id, venueId, rowLabel, colNumber, category` (unique per venue+row+col)
- **Event** — `id, title, type, venueId, organiserId, dateTime` + related `CategoryPrice[]`
- **CategoryPrice** — `eventId, category, price` (per-event, per-category pricing)
- **ShowSeat** — **the live seat state**, one row per `(eventId, seatId)`:
  `status[AVAILABLE|HELD|BOOKED], holdToken, holdExpiresAt, version`
- **Booking** — `id, bookingRef, userId, eventId, status[CONFIRMED|CANCELLED|EXPIRED], totalAmount, qrCodeDataUrl`
- **BookingSeat** — join table: `bookingId, showSeatId, priceAtBooking`
- **WaitlistEntry** — `eventId, userId, category, status[WAITING|OFFERED|CLAIMED|EXPIRED|CANCELLED], position, offeredShowSeatId, offerToken, offerExpiresAt`

Key design choice: **`Seat` is the static venue layout; `ShowSeat` is the per-event
live status.** This lets the same physical seat be `AVAILABLE` for one showtime
and `BOOKED` for another, without duplicating the venue layout.

---

## 5. API Documentation

Base URL: `http://localhost:5000/api`. Authenticated routes require
`Authorization: Bearer <jwt>`.

### Auth
| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/auth/register` | — | `{name, email, password, role?}` → `{token, user}` |
| POST | `/auth/login` | — | `{email, password}` → `{token, user}` |
| GET | `/auth/me` | ✔ | Current user profile |

### Venues (Admin)
| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/venues` | Admin | `{name, address, rows, cols, categoryMap[]}` — generates seat grid |
| GET | `/venues` | — | List venues |
| GET | `/venues/:id` | — | Venue + full seat layout |

### Events (Organiser)
| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/events` | Organiser/Admin | `{title, type, venueId, dateTime, pricing[]}` — materializes ShowSeats |
| GET | `/events` | — | List/filter events (`?type=&q=&from=&to=`) |
| GET | `/events/:id` | — | Event detail |
| GET | `/events/:id/seatmap` | — | Live seat map (status per seat) |
| GET | `/events/:id/summary` | Organiser (owner)/Admin | Booking count + revenue |

### Seats
| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/seats/hold` | Customer | `{eventId, showSeatIds[]}` → `{holdToken, expiresAt, seats[]}`. Atomic, all-or-nothing. |
| POST | `/seats/release` | Customer | `{eventId, showSeatIds[], holdToken}` — explicit release (checkout abandonment) |

### Bookings
| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/bookings` | Customer | `{eventId, showSeatIds[], holdToken}` → confirms booking, generates QR, sends email |
| GET | `/bookings/my` | Customer | Booking history |
| POST | `/bookings/:id/cancel` | Customer (owner)/Admin | Cancels; frees/offers seats to waitlist |

### Waitlist
| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/waitlist/join` | Customer | `{eventId, category}` — only allowed when category is sold out |
| GET | `/waitlist/my` | Customer | This user's waitlist entries |
| GET | `/waitlist/offer/:token` | Customer | Fetch details of a claim offer (from email link) |

### Realtime (Socket.io)
- Client emits `joinEvent(eventId)` / `leaveEvent(eventId)` to subscribe to a seat map's room
- Server emits `seatUpdate(showSeat)` to `event:<eventId>` room whenever a seat's status changes
  (hold placed, released, booked, expired, or offered to waitlist)

---

## 6. System Design Write-Up (Seat Hold, Concurrency, Waitlist)

### Seat Hold & TTL Mechanism
Each seat's live status lives on `ShowSeat` (one row per seat *per event*), not
on the master `Seat` table — so the same physical seat can be available for one
showtime and booked for another. When a customer selects seats and requests a
hold, the API stamps the matching `ShowSeat` rows with `status='HELD'`, a
per-request `holdToken` (UUID), and `holdExpiresAt = now + SEAT_HOLD_TTL_MINUTES`
(configurable via `.env`, default 10 minutes). The frontend shows a live
countdown built from `holdExpiresAt`. TTL expiry is enforced at the database
level, not just in the client: a `node-cron` job runs every 30 seconds and
sweeps every `ShowSeat` where `status='HELD' AND holdExpiresAt < now()`, flipping
it back to `AVAILABLE` and broadcasting the change over Socket.io. This means a
seat is reclaimed even if the customer simply closes the tab and the frontend
never calls the explicit `/seats/release` endpoint — the "abandoned checkout"
case is covered unconditionally by the server-side sweep, with the client-side
release call as a faster, opportunistic path.

### Concurrency Prevention
The critical risk is two customers racing to hold or book the same seat. This
is solved without pessimistic row locks by using **conditional atomic updates**:
every seat-state transition is expressed as
`UPDATE ShowSeat SET status = 'X', ... WHERE id = ? AND status = 'PRECONDITION'`,
executed via Prisma's `updateMany`. The database evaluates the `WHERE` clause
and applies the write as a single atomic statement — there is no read-then-write
gap where two concurrent requests could both observe `AVAILABLE` and both
proceed. If request B loses the race, its `updateMany` call affects zero rows
(`count === 0`), which the controller treats as a hard failure and rejects with
409 Conflict, telling the customer to refresh. The same pattern secures the
booking step: converting `HELD → BOOKED` additionally requires
`holdToken` to match and `holdExpiresAt > now()`, so a booking can't be
completed on a hold that has since expired or belonged to someone else. A
multi-seat request (holding or booking several seats at once) is wrapped in a
single Prisma `$transaction`: if any one seat in the batch fails its conditional
update, the whole transaction throws and rolls back, so a customer never ends up
holding 2 of the 3 seats they asked for. Every seat carries an incrementing
`version` counter on each transition as an additional optimistic-concurrency
audit trail.

### Waitlist Auto-Assignment Flow
Waitlist entries are queued **per event, per seat category** (`Premium`,
`Standard`, etc.), with a `position` integer assigned FIFO at join time.
Customers can only join when that category is genuinely sold out (checked
server-side against live `ShowSeat` counts) to prevent queue-jumping around
seats that are simply momentarily held. When a booking is cancelled, the
freed `ShowSeat`s are *not* simply flipped to `AVAILABLE`; the cancellation
handler first calls `offerSeatToNextInWaitlist(eventId, showSeat)`, which looks
up the lowest-`position` `WAITING` entry in that seat's category. If one
exists, the seat is put into a special `HELD` state carrying the entry's own
`offerToken` (instead of a normal hold), the `WaitlistEntry` moves to
`OFFERED` with a `offerExpiresAt` timestamp (`WAITLIST_OFFER_TTL_MINUTES`,
default 15), and an email is sent with a claim link
(`/waitlist/claim/:token`). If no one is waiting, the seat is released to
`AVAILABLE` as normal.

### Time-Limited Offer Handling
The claim link resolves to a page that fetches offer details via
`GET /waitlist/offer/:token` (validated against the requesting user and
expiry) and then calls the *same* `POST /bookings` endpoint used for normal
purchases, passing the `offerToken` in place of a regular `holdToken` — so all
the same atomic `HELD→BOOKED` concurrency protection applies uniformly to
waitlist claims. If the customer completes the booking, the corresponding
`WaitlistEntry` is marked `CLAIMED`. If they don't act in time, the same
30-second cron sweep that expires ordinary holds also detects expired waitlist
offers (by checking whether the expired `HELD` seat's `holdToken` matches an
`OFFERED` entry), marks that entry `EXPIRED`, and **cascades**: it immediately
re-invokes `offerSeatToNextInWaitlist` for the next person in the same
category's queue, repeating until either someone claims the seat or the queue
is empty (at which point the seat is finally released to plain `AVAILABLE`).
This keeps the system fully self-healing with no manual admin intervention
needed to keep sold-out shows filled.

*(~800 words)*
