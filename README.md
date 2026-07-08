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

## Canonical hosts & public URLs

The app serves three domains — `surgetechpos.com` and `www.surgetechpos.com`
(marketing) and `app.surgetechpos.com` (the dashboard). Public/shareable URLs
are built from env vars, never from the request host, so a `*.vercel.app`
deployment URL can never leak into a link, canonical, email, or redirect.

Set both (server + client — `NEXT_PUBLIC_` so they're available in the browser):

- `NEXT_PUBLIC_SITE_URL` = `https://www.surgetechpos.com`
  — canonical marketing host. Used for booking/order/kiosk/menu/CFD links,
  marketing-email unsubscribe links, canonical/OG/sitemap (those are also
  hardcoded to www as a backstop).
- `NEXT_PUBLIC_APP_URL` = `https://app.surgetechpos.com`
  — the dashboard host. Used for the Supabase auth `redirectTo` and the
  `/auth/callback` redirect target.

A middleware host guard 308-redirects any `*.vercel.app` host to
`https://www.surgetechpos.com` + the same path/query (see `middleware.ts`).
