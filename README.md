# Cinema Stripe Checkout — teaching repository

A commented Vite + React and Node.js/Express example for an English-language project course. Customers select cinema seats, are redirected to Stripe Checkout in test mode, and receive a confirmed booking only after a signed Stripe webhook reaches the server.

## 1. Prepare Stripe Dashboard first

1. Create a Stripe account at https://dashboard.stripe.com/register, or use the account provided by your instructor.
2. In the Dashboard account picker, open **Sandboxes**. Create or open the sandbox assigned to your group. Stay in the sandbox; do not use live mode for this course.
3. While that sandbox is open, go to https://dashboard.stripe.com/apikeys. Create or reveal a secret test key beginning with `sk_test_` and copy it immediately.
4. This project uses Stripe-hosted Checkout, so students do **not** need to put a publishable `pk_test_` key in React. The Node.js server needs the secret key.

## 2. Install and configure the project

```bash
npm install
cp server/.env.example server/.env
```

In Windows PowerShell, use this copy command instead:

```powershell
Copy-Item server\.env.example server\.env
```

Put the copied `sk_test_...` secret in `server/.env` as `STRIPE_SECRET_KEY`; never put it in React code or Git. Then use three terminals:

```bash
# API, http://localhost:4242
npm run dev:server

# Vite client, http://localhost:5173
npm run dev:client

# local webhook forwarding; copy its whsec_ value to server/.env and restart API
stripe listen --forward-to localhost:4242/api/stripe/webhook --events checkout.session.completed,checkout.session.async_payment_succeeded,checkout.session.expired
```

Before running `stripe listen`, install the Stripe CLI according to Stripe’s current instructions and run `stripe login`. When it asks for the environment, choose **Sandbox** and use the same Sandbox as the copied `sk_test_...` key. The command prints a signing secret beginning with `whsec_`. Copy it to `STRIPE_WEBHOOK_SECRET` in `server/.env`.

> **Restart required:** stop the API with `Ctrl+C` and run `npm run dev:server` again after editing `.env`. Node does not reliably reload environment-file changes while it is running.

`STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` are different values: the `sk_test_` key authenticates server-to-Stripe API calls, while the `whsec_` key verifies webhook signatures sent to this local endpoint.

For a successful test checkout, use Stripe's test card `4242 4242 4242 4242`, a future expiry date, any CVC, and any postal code.

## 3. First successful-payment check

After completing the test card payment, verify all three places:

| Place | Expected evidence |
| --- | --- |
| Browser | The success page eventually shows `Booking status: paid`. It polls while webhook delivery is pending. |
| Stripe CLI | A `checkout.session.completed` event is forwarded and receives HTTP `200`. |
| API terminal | `Booking ... is paid.` is printed. |

If the browser remains in `pending_payment`, inspect the Stripe CLI first. A `400` response usually means the `whsec_...` secret differs from the currently running `stripe listen` session; a connection error means the API is not listening at port 4242.

The Cancel button does not immediately release the seats in this teaching example. They remain held until the Checkout Session expires; implementing a visible hold timer and reliable release workflow is a later exercise.

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

## Student UAT evidence

Capture the following before submitting:

1. One successful test payment, including the CLI event and API log.
2. One cancelled or declined payment, and an explanation of why the booking did not become `paid`.
3. A two-browser seat conflict showing that the second request receives a conflict response.
4. A brief explanation of why `sk_test_...` and `whsec_...` must not be exposed in React.

The required implementation is Hosted Checkout. Useful extensions include real persistence, seat-hold expiry, authentication, an admin dashboard, and refund handling. Before live payments, add HTTPS, authentication and authorization, input validation, protected deployment secrets, logging, rate limiting, refund/cancellation policy, and a security review.

See Stripe's current [Testing](https://docs.stripe.com/testing), [Checkout](https://docs.stripe.com/payments/checkout), and [Webhook](https://docs.stripe.com/webhooks) documentation.
