This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Finix in-person (PAX terminal) payments

Card-present sales are pushed to an activated Finix cloud device (e.g. a PAX
A800). The terminal wakes and prompts for tap/insert; Surge polls the transfer
until it succeeds, then records the sale.

### Environment variables (server-only — never exposed to the client)

Reuses the existing Finix credentials plus one new var:

- `FINIX_USERNAME`, `FINIX_PASSWORD` — Basic-auth API credentials.
- `FINIX_ENVIRONMENT` — `live` or `sandbox` (selects the API base:
  `https://finix.live-payments-api.com` / `…sandbox…`).
- `FINIX_APPLICATION_ID`, `FINIX_MERCHANT_ID` — as used elsewhere.
- `FINIX_DEVICE_ID` — **new.** Default cloud device id (e.g. `DVs1oPfwRkLgFZqdgGvYyPca`).
  Used when a business has no per-location device set.
- `FINIX_WEBHOOK_SIGNING_KEY` — verifies inbound webhook signatures.

Per-location override: set `businesses.finix_device_id` (migration
`0086_finix_terminal.sql`) so each merchant/location can point at its own
terminal. `NULL` falls back to `FINIX_DEVICE_ID`.

### Endpoints

- `POST /api/terminal/sale` — `{ amountCents, idempotencyKey?, orderId? }` →
  pushes a `CARD_PRESENT_SALE` transfer to the device, returns `{ transferId }`.
- `GET  /api/terminal/sale/:transferId` — proxies the transfer state
  (`{ state, failure_code, failure_message, card }`); the register polls this.
- `POST /api/terminal/cancel` — cancels the active prompt on the device.
- `GET  /api/terminal/status` — device connection for the "Ready" badge.

### Registering the transfer/dispute webhook

State updates arrive at `POST /api/webhooks/finix`. Register it once per
environment (replace the base URL with your deployment):

```bash
curl -s -X POST https://finix.live-payments-api.com/webhooks \
  -u "$FINIX_USERNAME:$FINIX_PASSWORD" \
  -H "Content-Type: application/json" \
  -H "Finix-Version: 2022-02-01" \
  -d '{
    "url": "https://app.surgetechpos.com/api/webhooks/finix",
    "enabled_events": [
      "created", "updated"
    ]
  }'
```

Notes:
- Finix sends an empty test event on creation; the handler returns `200` so the
  webhook activates.
- Set `FINIX_WEBHOOK_SIGNING_KEY` (from the Finix dashboard/webhook) so the
  handler verifies the `Finix-Signature` header; unset = accepted unverified
  (dev only).
- The handler keeps `finix_payments` in sync on `transfer` state changes and
  upserts `finix_disputes` on chargebacks. Terminal sales are recorded in Surge
  by the register on `SUCCEEDED` (poll), so the webhook is the durable backstop.
