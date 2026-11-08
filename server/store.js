/**
 * Teaching-only in-memory storage. Restarting the server resets it.
 *
 * A real cinema would use a database transaction so two server processes
 * cannot sell the same seat. This tiny module makes that rule visible without
 * hiding the payment-flow code behind database setup.
 */
const screenings = [{
  id: 'screening_01',
  title: 'The Example Film',
  startsAt: '2026-12-01T18:30:00',
  ticketPriceCents: 1250,
  currency: 'eur',
  seats: ['A1', 'A2', 'A3', 'A4', 'B1', 'B2', 'B3', 'B4']
}];

const bookings = new Map();

// Stripe can retry an event. Remember its ID so a duplicate has no new effect.
const processedStripeEventIds = new Set();

function getTakenSeatIds(screeningId) {
  return [...bookings.values()]
    .filter((booking) => booking.screeningId === screeningId)
    // pending_payment is a temporary seat hold; paid is a final sale.
    .filter((booking) => ['pending_payment', 'paid'].includes(booking.status))
    .flatMap((booking) => booking.seatIds);
}

function createPendingBooking({ id, screeningId, seatIds, email }) {
  const booking = { id, screeningId, seatIds, email, status: 'pending_payment', createdAt: new Date().toISOString() };
  bookings.set(id, booking);
  return booking;
}

module.exports = { screenings, bookings, processedStripeEventIds, getTakenSeatIds, createPendingBooking };
