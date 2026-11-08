# Cinema Stripe Checkout — teaching repository

A commented Vite + React and Node.js/Express example for an English-language project course. Customers select cinema seats, are redirected to Stripe Checkout in test mode, and receive a confirmed booking only after a signed Stripe webhook reaches the server.

## Quick start

```bash
npm install
cp server/.env.example server/.env
```

Put your `sk_test_...` secret in `server/.env`; never put it in React code or Git. Then use three terminals:

```bash
# API, http://localhost:4242
npm run dev:server

# Vite client, http://localhost:5173
npm run dev:client

# local webhook forwarding; copy its whsec_ value to server/.env and restart API
stripe listen --forward-to localhost:4242/api/stripe/webhook
```

For a successful test checkout, use Stripe's test card `4242 4242 4242 4242`, a future expiry date, any CVC, and any postal code.

## Why this structure matters

- `client/src/App.jsx` is a commented React booking UI. It asks the API to start checkout, then follows the URL returned by Stripe.
- `client/src/api.js` contains every browser-to-server call. There is no Stripe secret key in the client.
- `server/server.js` validates each requested seat, calculates the amount from trusted screening data, creates the Checkout Session, and verifies Stripe webhooks.
- `server/store.js` models the `pending_payment → paid/expired` state transition. It is intentionally in-memory for teaching; replace it with transactions in a real database.

The most important rule is that the success page does **not** mark a booking paid. The signed `checkout.session.completed` webhook does. The handler also remembers event IDs because Stripe can retry webhook delivery.

## Verify

```bash
npm run build
```

The required implementation is Hosted Checkout. Useful extensions include real persistence, seat-hold expiry, authentication, an admin dashboard, and refund handling. Before live payments, add HTTPS, authentication and authorization, input validation, protected deployment secrets, logging, rate limiting, refund/cancellation policy, and a security review.

See Stripe's current [Testing](https://docs.stripe.com/testing), [Checkout](https://docs.stripe.com/payments/checkout), and [Webhook](https://docs.stripe.com/webhooks) documentation.
