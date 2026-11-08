import { useEffect, useMemo, useState } from 'react';
import { getBooking, getScreenings, startCheckout } from './api';

function formatMoney(cents, currency) {
  return new Intl.NumberFormat('en-IE', { style: 'currency', currency }).format(cents / 100);
}

function BookingStatusPage({ page }) {
  const bookingId = new URLSearchParams(window.location.search).get('booking_id');
  const [booking, setBooking] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!bookingId) return;

    // The success page only reads state. It never announces a payment itself.
    getBooking(bookingId).then(setBooking).catch((reason) => setError(reason.message));
  }, [bookingId]);

  const heading = page === 'success' ? 'Thank you — checking your booking' : 'Checkout cancelled';
  return <main className="card status-page">
    <p className="eyebrow">Example Cinema</p>
    <h1>{heading}</h1>
    {page === 'success' && <p>Payment confirmation is received securely by the server through a Stripe webhook.</p>}
    {page === 'cancel' && <p>Your seats are held temporarily. They will be released if payment is not completed before the hold expires.</p>}
    {booking && <p className="status">Booking status: <strong>{booking.status}</strong> · Seats: {booking.seatIds.join(', ')}</p>}
    {error && <p className="error">{error}</p>}
    <a className="button-link" href="/">Back to screenings</a>
  </main>;
}

function BookingPage() {
  const [screening, setScreening] = useState(null);
  const [selectedSeatIds, setSelectedSeatIds] = useState([]);
  const [email, setEmail] = useState('student@example.com');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isStartingCheckout, setIsStartingCheckout] = useState(false);

  useEffect(() => {
    getScreenings()
      .then((screenings) => setScreening(screenings[0]))
      .catch((reason) => setError(reason.message))
      .finally(() => setIsLoading(false));
  }, []);

  const unavailableSeatIds = useMemo(() => new Set(screening?.unavailableSeatIds || []), [screening]);

  function toggleSeat(seatId) {
    if (unavailableSeatIds.has(seatId) || isStartingCheckout) return;

    setSelectedSeatIds((current) => (
      current.includes(seatId)
        ? current.filter((id) => id !== seatId)
        : [...current, seatId]
    ));
  }

  async function handlePayment() {
    try {
      setError('');
      setIsStartingCheckout(true);

      // React sends only the customer choice. The server validates it and
      // calculates the amount before it asks Stripe to create a session.
      const { url } = await startCheckout({
        screeningId: screening.id,
        seatIds: selectedSeatIds,
        email
      });

      // This leaves our app for Stripe's hosted payment form.
      window.location.assign(url);
    } catch (reason) {
      setError(reason.message);
      setIsStartingCheckout(false);

      // A 409 may mean another customer selected a seat first. Reloading data
      // is a simple teaching-project response; production UX can be smoother.
      getScreenings().then((screenings) => setScreening(screenings[0])).catch(() => {});
    }
  }

  if (isLoading) return <main className="card"><p>Loading screening…</p></main>;
  if (!screening) return <main className="card"><h1>Unable to load a screening</h1><p className="error">{error}</p></main>;

  const totalCents = selectedSeatIds.length * screening.ticketPriceCents;

  return <main className="card">
    <p className="eyebrow">Example Cinema · Test payments only</p>
    <h1>{screening.title}</h1>
    <p>{new Date(screening.startsAt).toLocaleString('en-IE', { dateStyle: 'full', timeStyle: 'short' })}</p>
    <p>One ticket: <strong>{formatMoney(screening.ticketPriceCents, screening.currency)}</strong></p>

    <h2>1. Select seats</h2>
    <p className="hint">Dark seats are unavailable. Your selection is validated again by the server.</p>
    <div className="seat-grid" aria-label="Seat selection">
      {screening.seats.map((seatId) => {
        const unavailable = unavailableSeatIds.has(seatId);
        const selected = selectedSeatIds.includes(seatId);
        return <button
          key={seatId}
          className={`seat ${selected ? 'selected' : ''}`}
          disabled={unavailable || isStartingCheckout}
          aria-pressed={selected}
          onClick={() => toggleSeat(seatId)}
        >{seatId}</button>;
      })}
    </div>

    <h2>2. Enter email</h2>
    <label htmlFor="email">Ticket confirmation email</label>
    <input id="email" type="email" value={email} disabled={isStartingCheckout} onChange={(event) => setEmail(event.target.value)} />

    <h2>3. Pay in Stripe test mode</h2>
    <p>Selected: {selectedSeatIds.length ? selectedSeatIds.join(', ') : 'no seats yet'} · Total: <strong>{formatMoney(totalCents, screening.currency)}</strong></p>
    <button className="pay-button" disabled={!selectedSeatIds.length || isStartingCheckout} onClick={handlePayment}>
      {isStartingCheckout ? 'Opening Stripe Checkout…' : 'Proceed to test payment'}
    </button>
    {error && <p className="error" role="alert">{error}</p>}
  </main>;
}

export default function App() {
  const path = window.location.pathname;
  if (path === '/success') return <BookingStatusPage page="success" />;
  if (path === '/cancel') return <BookingStatusPage page="cancel" />;
  return <BookingPage />;
}
