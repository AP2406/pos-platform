# Surge POS — native iOS app (Expo)

The floor-staff POS, built per `Surge-Native-iOS-POS-Blueprint.md`. **Not a fork of
the web app** — it shares one backend (Supabase) and one money-critical API with the
existing Next.js admin app. The web app stays live as the owner/admin surface.

## Layout (monorepo)

```
pos-platform/
  app/…            # Next.js web app (unchanged) + app/api/v1 shared API
  packages/
    design-tokens/ # @surge/design-tokens (§4) — shared, pure TS
    api-contracts/ # @surge/api-contracts (§2) — shared v1 request/response types
  mobile/          # THIS app (Expo). Not a Vercel workspace; installed on its own.
    app/           # expo-router screens
    src/design/    # §4 design-system components (Button, StatusChip, StatCard, …)
    src/lib/       # supabase client, v1 API client, config
```

`mobile` is intentionally **not** an npm workspace of the repo root, so the web
(Vercel) build never installs React Native deps. It consumes the shared packages
via `file:` deps + Metro `watchFolders` (see `metro.config.js`).

## Setup

```bash
cd mobile
npm install
npx expo install        # align native deps to this Expo SDK
```

Set config in `app.json` → `expo.extra` (or an `app.config.ts` reading env):
- `supabaseUrl`, `supabaseAnonKey` — same Supabase project as web.
- `apiBaseUrl` — where the v1 API is hosted (prod: `https://app.surgetechpos.com`).

## Run

```bash
npx expo start          # dev (Expo Go / dev client)
npm run typecheck       # tsc --noEmit
```

## What's wired so far (safe pass)

- Design system (§4): tokens + `Button` (gradient primary), `StatusChip`, `StatCard`,
  `MenuTile`, `CartLine`. Poppins + dark theme.
- API client (`src/lib/api.ts`): `getSession()` and verify-only `verifyApprovals()`
  against `/api/v1`. Auth via the Supabase access token + `X-Surge-Business` /
  `X-Surge-Staff` headers.
- Reads go direct via `supabase-js` (RLS).

## Not yet (deferred)

- **Money-write calls** (order / tender / refund / tab) — wait for the shared
  money-write endpoints, deferred until the live $1 txn+refund test clears.
- **First slice screens** (Floor + Register, blueprint §5) — next pass.
- **Printing** (Star/Epson native module), **EAS Build → TestFlight** — later slices.
