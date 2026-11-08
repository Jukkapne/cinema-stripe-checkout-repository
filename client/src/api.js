// Keep all browser-to-server requests in one small module. This makes it clear
// which network calls the React UI performs and avoids Stripe secret keys here.
const API_URL = 'http://localhost:4242';

async function request(path, options) {
  const response = await fetch(API_URL + path, options);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'The server could not complete the request.');
  }

  return data;
}

export function getScreenings() {
  return request('/api/screenings');
}

export function getBooking(bookingId) {
  return request('/api/bookings/' + encodeURIComponent(bookingId));
}

export function startCheckout({ screeningId, seatIds, email }) {
  return request('/api/checkout-sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ screeningId, seatIds, email })
  });
}
