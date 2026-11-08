require('dotenv').config({ path: `${__dirname}/.env` });

const crypto = require('crypto');
const cors = require('cors');
const express = require('express');
const Stripe = require('stripe');
const { screenings, bookings, processedStripeEventIds, getTakenSeatIds, createPendingBooking } = require('./store');

const app = express();
const port = Number(process.env.PORT || 4242);

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing STRIPE_SECRET_KEY. Copy server/.env.example to server/.env first.');
}

// The secret-key SDK is created only on the trusted Node.js server.
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/**
 * This route MUST be registered before express.json(). Stripe signs the raw
 * request bytes. Parsing JSON first changes those bytes and breaks verification.
 */
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), handleStripeWebhook);

app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }));
app.use(express.json());

// React may display this information, but the next route recalculates it.
app.get('/api/screenings', (req, res) => {
  res.json(screenings.map((screening) => ({ ...screening, unavailableSeatIds: getTakenSeatIds(screening.id) })));
});

// The success page reads status. It never sets `paid` itself.
app.get('/api/bookings/:bookingId', (req, res) => {
  const booking = bookings.get(req.params.bookingId);
  if (!booking) return res.status(404).json({ error: 'Booking not found.' });
  return res.json({ id: booking.id, status: booking.status, seatIds: booking.seatIds, screeningId: booking.screeningId });
});

/**
 * Start a hosted Checkout Session.
 *
 * The browser only proposes an ID, seats, and email. It never supplies a
 * trustworthy price. The server validates the requested seats, holds them,
 * and calculates Stripe's unit amount from its own screening record.
 */
app.post('/api/checkout-sessions', async (req, res) => {
  try {
    const { screeningId, seatIds, email } = req.body;
    if (!Array.isArray(seatIds) || seatIds.length === 0 || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ error: 'Choose seats and provide an email address.' });
    }
    if (new Set(seatIds).size !== seatIds.length) {
      return res.status(400).json({ error: 'A seat can be selected only once.' });
    }

    const screening = screenings.find((item) => item.id === screeningId);
    if (!screening) return res.status(404).json({ error: 'Screening not found.' });

    const hasUnknownSeat = seatIds.some((seatId) => !screening.seats.includes(seatId));
    const takenSeats = new Set(getTakenSeatIds(screening.id));
    const seatIsTaken = seatIds.some((seatId) => takenSeats.has(seatId));
    if (hasUnknownSeat || seatIsTaken) {
      return res.status(409).json({ error: 'One or more seats are no longer available. Refresh and try again.' });
    }

    // Do this before the redirect so two customers cannot both start checkout.
    const bookingId = crypto.randomUUID();
    const booking = createPendingBooking({ id: bookingId, screeningId, seatIds, email });

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: email,
      line_items: [{
        price_data: {
          currency: screening.currency,
          product_data: { name: `${screening.title} — cinema ticket` },
          // Stripe amounts are integer cents/minor units. It does not come from req.body.
          unit_amount: screening.ticketPriceCents
        },
        quantity: seatIds.length
      }],
      // Stripe sends this value back in webhook events; it links payment to our booking.
      metadata: { bookingId },
      success_url: `${process.env.CLIENT_URL}/success?booking_id=${bookingId}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.CLIENT_URL}/cancel?booking_id=${bookingId}`
    });

    booking.stripeCheckoutSessionId = session.id;
    return res.status(201).json({ url: session.url, bookingId });
  } catch (error) {
    console.error('Checkout Session creation failed:', error);
    return res.status(500).json({ error: 'Could not start checkout. See the API terminal for details.' });
  }
});

function markBookingPaid(session) {
  const booking = bookings.get(session.metadata?.bookingId);
  if (!booking) {
    console.error('The Stripe event refers to an unknown booking.');
    return;
  }
  // Safe on retries: paid is already the desired final state.
  if (booking.status === 'paid') return;
  booking.status = 'paid';
  booking.paidAt = new Date().toISOString();
  booking.stripePaymentIntentId = session.payment_intent;
  console.log(`Booking ${booking.id} is paid.`);
}

function handleStripeWebhook(req, res) {
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET);
  } catch (error) {
    console.error('Webhook signature check failed:', error.message);
    return res.status(400).send('Invalid webhook signature');
  }

  if (processedStripeEventIds.has(event.id)) return res.json({ received: true, duplicate: true });

  const session = event.data.object;
  if (event.type === 'checkout.session.completed' && session.payment_status === 'paid') markBookingPaid(session);
  // This covers delayed payment methods too, though the course uses a test card.
  if (event.type === 'checkout.session.async_payment_succeeded') markBookingPaid(session);
  if (event.type === 'checkout.session.expired') {
    const booking = bookings.get(session.metadata?.bookingId);
    if (booking && booking.status === 'pending_payment') booking.status = 'expired';
  }

  processedStripeEventIds.add(event.id);
  return res.json({ received: true });
}

app.listen(port, () => console.log(`Cinema API listening on http://localhost:${port}`));
