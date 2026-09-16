# Surge PIN pad / staff sign-in — code-grounded feature inventory

Read-only analysis of the repo at `/Users/aathis/Documents/GitHub/pos-platform`.
Every row below is traced to code that was actually read. Where a claim depends on a
Postgres function that is **not** checked into this repo, that is stated explicitly.

## The two surfaces

| | Web | iPad (React Native / Expo) |
|---|---|---|
| PIN entry component | `app/app/pos/register-client.tsx:2674-2705` (modal inside the register) — plus a **second, separate** pad at `app/app/clock/clock-client.tsx:120-161` | `mobile/app/sign-in.tsx:77-87` (full-screen step 3), keys from `mobile/src/design/NumPad.tsx:8-34` |
| Session writer | `app/app/pos/staff-session.ts:27-90` (`setActiveStaff`, server action) | `mobile/src/state/session.tsx:168-182` (`setStaffByPin`, client-side) |
| Manager-approval pad | `app/app/pos/register-client.tsx:2707-2759` | **none** |

There is no dedicated "staff sign-in screen" on web — the PIN pad is a `max-w-xs`
modal layered over the register (`register-client.tsx:2675-2676`). The iPad has a
real sign-in screen, but it is step 3 of a 3-step bootstrap (email/password → pick
location → PIN), not a persistent lock screen.

---

## Feature table

### 1. Entry and layout

| Feature | Web | iPad | file:line | Notes |
|---|---|---|---|---|
| Dedicated full-screen sign-in surface | No — modal over the register | Yes — full-screen `SafeAreaView` | `app/app/pos/register-client.tsx:2675`; `mobile/app/sign-in.tsx:42-44` | Web pad floats at `max-w-xs` on a `bg-black/50` scrim |
| Keypad grid | 3×4 | 3×4 | `register-client.tsx:2686-2701`; `mobile/src/design/NumPad.tsx:9-14` | Both phone-order (1 top-left) |
| Bottom row keys | `Del` · `0` · `Enter` | *(blank)* · `0` · `⌫` | `register-client.tsx:2692-2700`; `NumPad.tsx:13` | iPad has no submit key on the pad — a separate "Continue" button |
| Separate `Clear` (wipe all) key | Only on the **clock** pad, not the register pad | No | `app/app/clock/clock-client.tsx:132` | Register pad has `Del` only |
| Staff avatars / name tiles to pick from | No — blind PIN | No — blind PIN | `register-client.tsx:2674-2705`; `mobile/app/sign-in.tsx:77-87` | Neither implementation offers a "who are you" tile grid |
| Business / location name on the PIN surface | No (behind the modal, top bar `register-client.tsx:3184`) | Yes — `s.businessName` as the card heading | `mobile/app/sign-in.tsx:79` | |
| Logo / wordmark | No | Yes — "SURGE" mark | `mobile/app/sign-in.tsx:45-50` | |
| Live clock on the PIN surface | No | No | — | Searched; no time render on either pad |
| PIN length | Variable, 4–6 | Variable, 4–6 | `staff-session.ts:30`; `session.tsx:171` | `/^[0-9]{4,6}$/` on both |
| Client caps entry length | 6 | 6 | `register-client.tsx:1620`; `mobile/app/sign-in.tsx:39` | |
| Auto-submit on Nth digit | No | No | `register-client.tsx:1627-1643`; `mobile/app/sign-in.tsx:84` | Web needs `Enter`; iPad needs `Continue` (disabled until `pin.length >= 4`) |
| Masking | `•` per digit, count visible | `•` per digit, count visible, padded to 4 with `·` | `register-client.tsx:2684`; `mobile/app/sign-in.tsx:81` | Both leak PIN length to a shoulder-surfer |
| Placeholder when empty | Literal text "PIN" | `····` | `register-client.tsx:2684`; `sign-in.tsx:81` | |
| Backspace | `Del` key, one digit | `⌫` key, one digit | `register-client.tsx:1623-1625`; `sign-in.tsx:38` | |
| Clear-on-error | Yes, wipes entry | Yes, wipes entry | `register-client.tsx:1637`; `sign-in.tsx:33` | |
| Physical keyboard entry | **No** — no `keydown` handler on the pad | n/a | `register-client.tsx` (no `onKeyDown` in the modal; only `1674`, `2774`, `2910` elsewhere) | Buttons are tab-focusable, so Tab+Space works; typing `4` does nothing |
| Touch target height | 48 px (`h-12`) register pad; 56 px (`h-14`) clock pad | 56 px (`touch.min + 8`) | `register-client.tsx:2688`; `clock-client.tsx:126`; `NumPad.tsx:41`, `packages/design-tokens/src/index.ts:122-125` | |
| Error text | Red `<p>` under the pad | Red `<Text>` above the pad | `register-client.tsx:2702`; `sign-in.tsx:82` | |
| Error distinguishes wrong-PIN from no-such-user | No (correct) | No (correct) | `staff-session.ts:69`; `session.tsx:175` | Web: `"PIN not recognized. N attempt(s) left."` iPad: `"PIN not recognized."` |
| Raw DB error leaked to the operator | No | **Yes** — `return { error: error.message }` | `staff-session.ts:57` vs `session.tsx:173` | Web maps to "Could not verify PIN."; iPad surfaces the Postgres message verbatim |
| Shake animation on wrong PIN | No | No | — | No `shake` keyframe anywhere in the repo |
| Haptic feedback | n/a | **No** | — | No `Haptics` / `Vibration` import anywhere in `mobile/` |
| Backdrop tap dismisses the pad | Yes | n/a (no dismiss — it *is* the screen) | `register-client.tsx:2675` | |
| Cancel button | Yes | "Switch location" only | `register-client.tsx:2679-2681`; `sign-in.tsx:85` | |

### 2. Who can sign in, and what a successful entry establishes

| Feature | Web | iPad | file:line | Notes |
|---|---|---|---|---|
| Storage column | `staff_members.pin_hash` | same | `app/app/settings/staff-data.ts:41-43, 58` | Column name is the only in-repo evidence of hashing |
| Comparison code | `supabase.rpc("verify_staff_member_pin", { p_business_id, p_pin })` | identical RPC | `staff-session.ts:51-54`; `mobile/src/state/session.tsx:172` | **The RPC body is NOT in this repo.** No `.sql` under `supabase/migrations/` defines `verify_staff_member_pin`, `set_staff_member_pin`, or `create_staff_member` |
| PIN set / reset code | `supabase.rpc("set_staff_member_pin", { p_staff_id, p_pin })` | n/a (web-only) | `app/app/settings/staff-actions.ts:142` | |
| Where the comparison runs | Postgres (server) | Postgres (server) | as above | Neither client ever receives a PIN or hash |
| Does the PIN cross the network from the client | Yes → Next.js server action → Postgres | Yes → **directly to Supabase PostgREST with the anon key** | `register-client.tsx:1633`; `mobile/src/lib/supabase.ts:8`, `session.tsx:172` | On iPad the RPC is callable by any authenticated user, from any HTTP client |
| Lookup shape | `(business_id, pin) → {id, name, role}` | same | `staff-session.ts:51-59`; `session.tsx:172-176` | PIN alone identifies the person → implies per-business PIN uniqueness |
| Identity established | httpOnly cookie `surge_active_staff` | AsyncStorage key `surge_device_staff` (plaintext JSON `{businessId, staff:{id,name,role}}`) | `staff-session.ts:83-88`; `session.tsx:37, 178` | |
| Cookie/token integrity | HMAC-SHA256 over `businessId:staffId`, keyed on `SUPABASE_SERVICE_ROLE_KEY`; fails closed if unset | **None** — plain JSON, no signature | `lib/services/active-staff-cookie.ts:20-49`; `session.tsx:178` | |
| Lifetime / expiry | `maxAge: 60*60*12` = 12 h, `sameSite: lax`, `path: /`, `httpOnly` | **No expiry at all** — persists until Switch staff / Sign out / auto-lock | `staff-session.ts:83-88`; `session.tsx:185-188` | |
| Server row created on sign-in | No — cookie only | No | `staff-session.ts:83`; `session.tsx:177-178` | No `pos_sessions` table; PIN sign-in leaves no audit record |
| `staff_members` ↔ `business_members` / `auth.users` | `staff_members.user_id` (nullable FK → `auth.users`), unique per business where not null | same schema, unused by mobile | `supabase/migrations/0100_link_staff_members_to_users.sql:22-35`; `app/app/settings/staff-link-actions.ts:1-19` | |
| Effect of `user_id = NULL` on PIN sign-in | **None.** The PIN path never reads `user_id` | **None** | `staff-session.ts:51-89`; `session.tsx:172-179`; `lib/services/permissions-server.ts:39-41` | With 0/6 staff linked: audit rows carry `staff_id`, dashboard rows carry `auth.uid()`, and nothing joins them (`0100_...sql:5-14`) |
| `posAuthorize` — PIN session present | Staff permission matrix decides; lacking the permission is **not** fatal, sets `needsApproval: true` | Not used by mobile | `lib/services/pos-action-guard.ts:83-90` | Caller chooses to demand an approver PIN or refuse |
| `posAuthorize` — no PIN session | Falls back to `business_members.role` via `canAccess`; lacking the permission **is** fatal → `"Sign in at the PIN pad to do that."` | n/a | `pos-action-guard.ts:92-102` | Fixes an earlier fail-open; see `pos-action-guard.ts:9-26` |
| `posAuthorize` call sites | drawer open/close-day, refund, reopen, void ×2, delete-item-prepay | none | `drawer/actions.ts:66,372`; `sales/refund-actions.ts:139`; `sales/reopen-actions.ts:43`; `actions.ts:1060`; `ticket-actions.ts:169,847` | |
| `posActor` / `posCan` / `verifyApproverPin` | **Dead code** — zero call sites | n/a | `app/app/pos/pos-access.ts:12,19,27` | Named as a starting point, but nothing imports them |
| Sale attribution enforced server-side | Yes — a staffed business cannot close a sale with no cashier | n/a (payments off) | `app/app/pos/actions.ts:262-296` | Uses `readActiveStaffId` correctly |
| Role used for register permissions | `staff_members.role` + `role_id → roles.permissions` + `permission_overrides` | `staff.role` string only, client-side navigation gating | `lib/services/permissions-server.ts:34-79`; `mobile/src/lib/access.ts:30-55, 121-131` | |

### 3. Security posture

| Feature | Web | iPad | file:line | Notes |
|---|---|---|---|---|
| Rate limit / lockout on the **cashier** PIN | Yes — 5 consecutive fails → 60 s freeze, state in httpOnly cookie `surge_pin_fails` | **None** | `staff-session.ts:14-16, 34-48, 61-70`; `session.tsx:168-182` | Web lockout is per-device (cookie), so a second browser/incognito resets it |
| Rate limit on the **manager-approval** PIN | **None** | n/a (no such flow) | `app/app/pos/approval-actions.ts:6-23` | `verifyManagerPin` has no throttle — 4-digit space is brute-forceable at will |
| Rate limit on the **clock** PIN | **None** | n/a | `app/app/clock/time-actions.ts:15-34` | |
| Rate limit on `verifyInSaleApprovals` / `/api/v1/approvals/verify` | **None** | **None** | `lib/services/approval-gate.ts:39-46`; `app/api/v1/approvals/verify/route.ts:43-52` | |
| Configurable lockout policy | Declared but **never read** | — | `lib/services/config/registry.ts:100-103` | `security.pin_min_len`, `security.pin_max_len`, `security.lockout_fails`, `security.lockout_sec` have zero read sites |
| PIN uniqueness enforced | Assumed yes, DB-side | Assumed yes, DB-side | `app/app/settings/staff-actions.ts:48-52` maps `"PIN already in use"` | The constraint itself is not in this repo |
| Minimum PIN length | 4 (hardcoded regex in 6 places) | 4 | `staff-session.ts:30`, `pos-access.ts:30`, `approval-actions.ts:9`, `permissions-server.ts:101`, `approval-gate.ts:39`, `time-actions.ts:19`; `session.tsx:171` | |
| Weak-PIN rejection (0000, 1234, repeats) | **None** | **None** | `app/app/settings/staff-actions.ts:62,135`; `staff-card.tsx:101,177` | The Add-staff PIN field's placeholder is literally `"0000"` (`staff-card.tsx:413`) |
| Idle auto-lock | Yes — 90 s, hardcoded, **suppressed while a check is open** | Yes — owner-configurable (Never/2/5/10/30 min, default 10), plus lock after ≥2 min backgrounded | `register-client.tsx:1652-1681`; `mobile/app/_layout.tsx:57-98`, `mobile/src/lib/device-profile.ts:14, 18-27` | Kitchen-station iPads never lock (`_layout.tsx:62`) |
| Idle lock is configurable by the merchant | No | Yes, in Device settings | `register-client.tsx:1662`; `mobile/app/device-settings.tsx` | |
| Survives page reload | Cookie survives (12 h) — **but the UI forgets, see defect D1** | n/a | `staff-session.ts:83-88` vs `staff-session.ts:98-113` | |
| Survives browser restart | Yes — persistent cookie, 12 h | n/a | `staff-session.ts:87` | |
| Survives app restart | n/a | Yes — AsyncStorage, indefinitely | `session.tsx:64-71` | Restored only if the stored `businessId` matches the picked one |
| Survives backgrounding | n/a | Yes if away < 2 min; locks if ≥ 2 min | `mobile/app/_layout.tsx:71-79` | |
| Manager approval — how it is granted | Manager types their PIN into a second pad; verified server-side | **Does not exist** | `register-client.tsx:2707-2759`, `1692-1732`; `approval-actions.ts:14-22` | |
| Approval creates a session? | **No** — one-shot grant only | n/a | `register-client.tsx:1709-1714` | PIN is held in `approverPinRef` and re-sent with `createOrder` for server re-verification (`register-client.tsx:1809, 2279`) |
| Approval re-verified server-side | Yes — `verifyInSaleApprovals` re-derives cashier authority and re-checks the approver PIN against the required permission | Endpoint exists, unused by the app | `lib/services/approval-gate.ts:21-74`; `app/app/pos/actions.ts:657+` | |
| Async approval (no manager present) | Yes — `sendForApproval` posts to the approvals queue, register polls | No | `app/app/approvals/actions.ts:83-127, 176-192`; `register-client.tsx:2747-2756` | Void only |
| Approval acceptance role | `verifyManagerPin` requires `role === "manager"` exactly | n/a | `approval-actions.ts:19` | Excludes `owner` — see defect D4 |

### 4. Adjacent features

| Feature | Web | iPad | file:line | Notes |
|---|---|---|---|---|
| Clock in / out by PIN | Yes — separate page `/app/clock` with its own pad | Yes — `/clock`, no PIN, acts as the already-signed-in staff | `app/app/clock/clock-client.tsx:48-67`; `mobile/app/clock.tsx:52-67` | Two different models: web re-authenticates per punch, iPad trusts the device session |
| Clock in/out **from the register PIN pad** | No | No | — | Web clock lives at `/app/clock`; iPad clock at `/clock` behind Staff tools |
| Break start / end | Yes | Yes | `clock-client.tsx:85-97`; `mobile/app/clock.tsx:93-102` | |
| Off-schedule clock-in blocked + manager override | Yes | **No** | `app/app/clock/time-actions.ts:46-86`; `clock-client.tsx:140-157` | Web-only D1 feature |
| Clock page gated to full-service | Yes — redirects to `/app` otherwise | Aux route, allowed whenever Floor is | `app/app/clock/page.tsx:12`; `mobile/src/lib/access.ts:20, 36` | |
| Switch user / fast user switching | Yes — "Switch" link reopens the pad | Yes — "Switch staff" in the Staff tools sheet | `register-client.tsx:3194`; `mobile/app/floor.tsx:524` | |
| Explicit sign-out of the PIN session | Yes | Yes (Switch staff = `clearStaff`) | `register-client.tsx:1645-1650, 3195`; `session.tsx:185-188` | |
| "Who is on shift" display | Yes — on `/app/clock`, live dot + elapsed | Yes — on `/clock`, realtime-subscribed roster | `clock-client.tsx:163-182`; `mobile/app/clock.tsx:108-116`, `mobile/src/lib/reads.ts:690-708` | Neither shows it on the PIN pad itself |
| Signed-in-as indicator | "Ringing as {name}" in the top bar | Name chip in the floor header + Staff tools sheet | `register-client.tsx:3191-3193`; `mobile/app/floor.tsx:343-350, 507-515` | |
| Warning when nobody is signed in | Yes — amber `No cashier — Enter PIN` chip | n/a (cannot pass the gate without a PIN) | `register-client.tsx:3197-3201`; `mobile/app/_layout.tsx:32, 39` | |
| Offline sign-in | **No** — `setActiveStaff` is a server action | **No** — `verify_staff_member_pin` is a network RPC | `staff-session.ts:27`; `session.tsx:172` | iPad *restores* a prior session offline from AsyncStorage; web restores from the cookie but the UI can't read it (D1) |
| Offline detection | `useOnlineStatus` — heartbeat `HEAD /favicon.ico` every 30 s, never trusts `navigator.onLine` | `notify()` banner on fetch failure | `app/app/pos/use-online.ts:12-44`; `mobile/src/lib/api.ts:56-59` | Offline banner tells staff to keep building the check; firing/payment resume online (`register-client.tsx:3175-3180`) |
| Demo mode | Training mode banner; sales don't count | Dev-only demo restaurant toggle | `app/app/pos/page.tsx:248-249, 366-371`; `mobile/src/lib/demo/state.ts:14, 23-28` | |
| Demo mode bypasses the PIN | No | **No** — `setStaffByPin` is not shimmed; a real PIN against the real DB is still required | `mobile/src/state/session.tsx:172` (no `demoOn()` branch, unlike `reads.ts:691`) | Demo mode is unusable without live staff PINs |
| Training mode exempts approval gate | Yes | n/a | `lib/services/approval-gate.ts:34` | |

### 5. Accessibility and hardware

| Feature | Web | iPad | file:line | Notes |
|---|---|---|---|---|
| Screen-reader label on digit keys | Implicit — button text is the digit | Implicit — `<Text>` child is the digit, `accessibilityRole="button"` | `register-client.tsx:2687-2691`; `NumPad.tsx:20-28` | Adequate for digits |
| Screen-reader label on backspace | `"Del"` (reads OK) | `"⌫"` — **no `accessibilityLabel`** | `register-client.tsx:2692-2694`; `NumPad.tsx:27` | VoiceOver announces the raw glyph or nothing |
| Screen-reader label on the entry display | None — masked `•` string only, no `aria-live`, no digit count | None — masked string only | `register-client.tsx:2683-2685`; `sign-in.tsx:81` | A blind user gets no confirmation a keypress registered |
| Error announced to AT | No `role="alert"` / `aria-live` | No `accessibilityLiveRegion` | `register-client.tsx:2702`; `sign-in.tsx:82` | |
| Dialog semantics / focus trap | **None** — raw `<div>`, no `role="dialog"`, no `aria-modal`, no autofocus, no focus trap, no Escape handler | n/a | `register-client.tsx:2674-2705` | Keyboard focus stays behind the modal |
| Focus order | DOM order: heading → Cancel → 1..9 → Del → 0 → Enter | Same visual order | `register-client.tsx:2677-2700` | Cancel comes before the pad |
| Keypad contrast | Theme `foreground` on `card` with `border-border` | `#F8FAFC` on `#1C2132` (~16:1) | `register-client.tsx:2688`; `NumPad.tsx:44-50`, `packages/design-tokens/src/index.ts:18, 23` | Both comfortably AA |
| Error-text contrast | `text-red-600` on card | `color.late` `#EF4444` on `#151927` (~4.3:1) | `register-client.tsx:2702`; `sign-in.tsx:114`, tokens `:33` | iPad error text is borderline for AA normal text |
| Orientation | Responsive; `max-w-xs` modal centred, works either way | **Landscape locked** app-wide | `register-client.tsx:2675-2676`; `mobile/app.json:7` | |
| iPad 8th gen (10.2", 2160×1620 → 1080×810 pt landscape) | n/a | Sign-in card is fixed `width: 380` centred; pad + Continue + device toggle all fit in 810 pt | `mobile/app.json:7, 17-21`; `sign-in.tsx:111` | `supportsTablet: true`; no per-size branching anywhere in `sign-in.tsx` |
| Base font size | Tailwind defaults (`text-lg` keys) | 26 pt keys, 16 pt body, nothing below 12 | `register-client.tsx:2688`; tokens `:82-89`, `NumPad.tsx:50` | iPad type scale is explicitly sized for arm's-length use (tokens `:80-82`) |

---

## Gaps and defects I found

**D1 — `getActiveStaff()` is broken: it never verifies the signed cookie, so it always returns null.**
`app/app/pos/staff-session.ts:100` reads the raw cookie value and passes it straight into
`staffPermissionsById` as a staff id:

```ts
const id = cookieStore.get(ACTIVE_STAFF_COOKIE)?.value;   // "<uuid>.<base64url-sig>"
if (!id) return null;
...
const perms = await staffPermissionsById(supabase, business.id, id);
```

But `setActiveStaff` writes `makeActiveStaffCookie(business.id, staff.id)`, which is
`"<staffId>.<sig>"` (`lib/services/active-staff-cookie.ts:28-31`). Every other reader in
the codebase calls `readActiveStaffId()` first to strip and verify the signature
(`pos-action-guard.ts:61`, `permissions-server.ts:118`, `actions.ts:159,267`,
`split-actions.ts:139`, `refund-actions.ts:25`, `reopen-actions.ts:22`).
`staff-session.ts` is the only one that does not, so the query becomes
`.eq("id", "<uuid>.<sig>")` against a uuid column — no row, `staffPermissionsById`
returns null (`permissions-server.ts:39-43`), and `getActiveStaff()` returns null
unconditionally.

Consequences, all traced to real call sites:
- `app/app/pos/page.tsx:98` passes `activeStaff = null` into the register on every render,
  so `register-client.tsx:368` seeds `staff` as null. **Reloading the POS page always shows
  "No cashier — Enter PIN" and forces a re-PIN**, even though the cookie is valid for 12 h
  and the money path still honours it.
- `app/app/approvals/actions.ts:37,93,138` therefore always record
  `requested_by: null, requested_by_name: null` — **every approval request and manager call
  is anonymous**, and the manager-call de-dupe at `approvals/actions.ts:147`
  (`.eq("requested_by", "")`) is nonsense.
- `app/app/pos/ticket-actions.ts:5` and `pos-access.ts:6` consume the same broken value.

**D2 — the iPad can act as any staff member without a PIN.**
`app/api/v1/_lib/context.ts:68-80` accepts the acting identity from a plain
`X-Surge-Staff` header and validates only that the id exists and `is_active` for that
business. No signature, no PIN, no proof of possession. Any authenticated member of the
business — from the app, from `curl`, from a tampered build — can set that header to the
owner's `staff_members.id` and have every `/api/v1` route (clock, fire, KDS bump, fulfil,
ticket append, approvals/verify) attribute the action to them. Note that
`lib/services/active-staff-cookie.ts:3-8` documents this exact attack as the reason the
*web* cookie is HMAC-signed:

> "a scripted client can't forge it to impersonate a higher-privileged staff member
> (every staff id is shipped to the client via staffList …)".

The native path has no equivalent protection. Concretely, `mobile/app/clock.tsx:56` →
`api.ts:140-147` means anyone can clock a colleague in or out.

**D3 — no lockout anywhere except the web cashier pad.**
`app/app/pos/staff-session.ts:14-16, 34-48, 61-70` is the *only* throttle in the codebase
(5 fails → 60 s). Every other PIN entry point has none:
- `mobile/src/state/session.tsx:168-182` — the iPad sign-in. Unlimited attempts, and the
  RPC is called directly against PostgREST with the anon key, so a script can exhaust the
  entire 4-digit space without touching the app.
- `app/app/pos/approval-actions.ts:6-23` — `verifyManagerPin`. Unlimited.
- `app/app/clock/time-actions.ts:15-34` — `clockToggle`. Unlimited.
- `lib/services/approval-gate.ts:39-46` and `app/api/v1/approvals/verify/route.ts` — unlimited.

Even the one throttle that exists is per-browser-cookie, so clearing cookies or opening a
private window resets it. There is no server-side attempt counter and no per-staff account
lock.

**D4 — four different, inconsistent definitions of "who may approve".**
- `approval-actions.ts:19` → `row.role !== "manager"` (rejects an **owner**).
- `actions.ts:182` (`getManagerByPin`) → same, rejects owner.
- `pos-access.ts:44` → accepts `owner` or `manager` (but is dead code).
- `approval-gate.ts:54, 66` → `isManagerRole` accepts owner, *or* any role holding the
  specific permission.
- `permissions-server.ts:95-111` (`approverByPin`) → permission-based only.

The register's on-screen approval pad goes through `verifyManagerPin`, so **an owner's PIN
is rejected at the approval modal** while the server-side gate that re-verifies the same
PIN would have accepted it (`approval-gate.ts:51-54` explicitly calls this out as a bug it
is working around). `staff-actions.ts:23,71` prevents assigning the `owner` role to a staff
record at all, which masks the issue for most tenants but not for legacy rows.

**D5 — merchant-facing PIN security settings are decorative.**
`lib/services/config/registry.ts:100-103` exposes `security.pin_min_len`,
`security.pin_max_len`, `security.lockout_fails` ("PIN attempts before lockout") and
`security.lockout_sec` in the Access & roles settings section, gated behind
`manage_settings`. **None of the four keys is read anywhere in the codebase.** Length is a
hardcoded `/^[0-9]{4,6}$/` in seven places; lockout is a hardcoded `5` / `60` in one.
An owner who tightens these gets a saved value and no behaviour change.

**D6 — no weak-PIN rejection at all.**
`staff-actions.ts:62` and `:135` validate only `/^[0-9]{4,6}$/`. `0000`, `1111`, `1234`,
and a PIN equal to the staff member's birth year are all accepted. The Add-staff input's
placeholder is literally `"0000"` (`staff-card.tsx:413`), which actively suggests it. With
4-digit PINs, no lockout on most paths (D3), and PINs that must be unique per business
(so each guess tests the whole roster at once), a 6-person venue is guessable in the low
hundreds of attempts.

**D7 — the web register never auto-locks while a check is open.**
`register-client.tsx:1666-1669` deliberately returns without locking when `cart.length > 0`:

```ts
// P2: NEVER blank the cashier while a check is open — that drops
// attribution mid-sale (and would disable the permission gate).
if (cartLenRef.current > 0) return;
```

A till left with one item in the cart stays signed in as that cashier indefinitely. The
comment justifies it on attribution grounds, but the practical effect is that the most
common real-world state of a busy till is the one state that never locks. The iPad has no
such carve-out (`_layout.tsx:62` arms whenever a staff member is signed in).

**D8 — web idle timeout is 90 s and not configurable; iPad default is 10 minutes.**
`register-client.tsx:1662` (`IDLE_LOGOUT_MS = 90_000`) vs
`mobile/src/lib/device-profile.ts:25` (`DEFAULT_LOCK_MIN = 10`). A 6.7× difference in
exposure window between two surfaces of the same product, with the web value hardcoded and
the iPad value merchant-tunable including "Never" (`device-profile.ts:19`).

**D9 — the iPad stores the staff identity and role as unsigned plaintext JSON with no expiry.**
`session.tsx:178` writes `{businessId, staff:{id, name, role}}` to AsyncStorage and
`:66-71` restores it verbatim. The `role` string then drives `seesAllTables`
(`access.ts:59`), `canBumpKds` (`:73`), `isManager` → Device settings (`floor.tsx:520`,
`device-settings.tsx:35`) and the whole surface allow-list (`_layout.tsx:33-34`). On a
jailbroken or debug-buildable device that store is editable. RLS remains the real data
boundary, but the client-side role gate is trivially defeated, and there is no expiry —
the identity persists across restarts forever until an explicit lock or switch.

**D10 — no manager-approval mechanism on the iPad at all.**
`mobile/src/state/cart.ts:8-10` says so outright:

> "manager-approval gating is intentionally NOT applied in this payments-off pilot — it
> MUST be added when tender is wired (discounts are an abuse vector)."

`mobile/src/lib/api.ts:79-83` exports `verifyApprovals()` and
`app/api/v1/approvals/verify/route.ts` implements it, but nothing in `mobile/app/` calls
it. Per-line discounts (`cart.ts:11`) apply with no gate whatsoever.

**D11 — the iPad leaks raw Postgres errors to the operator.**
`session.tsx:173`: `if (error) return { error: error.message };`, rendered directly at
`sign-in.tsx:82`. Web deliberately does not (`staff-session.ts:56-57` logs and returns a
generic string).

**D12 — `app/app/pos/pos-access.ts` is entirely dead code.**
`posActor` (`:12`), `posCan` (`:19`) and `verifyApproverPin` (`:27`) have zero importers.
It is also the only place implementing the "owner or manager may approve" rule correctly
(D4), and it depends on `getActiveStaff()`, which is broken (D1) — so if it were wired up
today it would authorize everything as the web member role.

**D13 — three near-duplicate PIN pads with drifting behaviour.**
`register-client.tsx:2686-2701` (cashier), `register-client.tsx:2731-2746` (manager),
`clock-client.tsx:124-133` (clock) are three hand-rolled 3×4 grids in two files. They
differ in key height (48 vs 48 vs 56 px), in whether a `Clear` key exists (no/no/yes), in
backspace glyph (`Del`/`Del`/`⌫`), and in throttling (throttled/unthrottled/unthrottled).
The iPad has a shared `NumPad` component; the web has none.

**D14 — masking reveals PIN length on both.**
`register-client.tsx:2684` (`pinEntry.replace(/./g, "•")`) and `sign-in.tsx:81`
(`"•".repeat(pin.length)`) both render exactly as many dots as digits entered. Combined
with variable 4–6 length, an observer learns each colleague's PIN length for free.

**D15 — demo mode still requires a live PIN.**
`mobile/src/lib/reads.ts:691` and the rest of `reads.ts`/`api.ts` branch on `demoOn()` to
serve the in-memory demo restaurant, but `session.tsx:172` does not. The demo build's
sign-in step still hits the real `verify_staff_member_pin` against the real Supabase
project, so the "show it to a prospect without a database full of stale test rows"
promise at `demo/state.ts:1-10` breaks at the very first screen.

---

## What I could not determine from code

1. **Whether PINs are actually hashed, and with what.** The column is named `pin_hash`
   (`app/app/settings/staff-data.ts:41`), but `verify_staff_member_pin`,
   `set_staff_member_pin` and `create_staff_member` are Postgres functions with no
   definition anywhere in `supabase/migrations/` (0001–0100 all checked). Whether they use
   `crypt()`/bcrypt, a plain `digest()`, or a plaintext comparison — and whether the
   comparison is constant-time — requires reading the live database.
2. **Whether a DB uniqueness constraint on PINs exists.** `staff-actions.ts:48-52` maps a
   `"PIN already in use"` error string, which implies one, but the constraint (and whether
   it is per-business or global, and whether it is on the hash or the plaintext) is not in
   the repo.
3. **Whether `staff_members` itself is created with RLS, and what grants
   `verify_staff_member_pin` carries.** The table's `CREATE TABLE` is not in the migrations
   directory. The mobile client calls the RPC with the publishable/anon key
   (`mobile/app.json:41`, `mobile/src/lib/supabase.ts:8`), so it must be granted to
   `authenticated` at minimum — but whether it is `SECURITY DEFINER`, whether it rate-limits
   internally, and whether `pin_hash` is readable by a non-service role all need a live
   `psql` session.
4. **Actual rendered contrast ratios on web.** The register pad uses semantic Tailwind
   tokens (`border-border`, `bg-accent`, `text-red-600`) whose resolved values depend on the
   active theme; I read the classes, not the computed colours.
5. **VoiceOver / screen-reader behaviour in practice** — in particular what iOS announces
   for the unlabelled `⌫` key (`NumPad.tsx:27`) and whether the masked-dot `<Text>` is
   reachable at all.
6. **Real layout on a 10.2" iPad 8th gen.** The fixed `width: 380` sign-in card
   (`sign-in.tsx:111`) plus brand block, pad, Continue, Switch-location and the device
   Register/Kitchen toggle should fit 810 pt of landscape height, but that is arithmetic on
   style constants, not a measured render.
7. **Whether the 12-hour cookie and the never-expiring AsyncStorage entry are cleared by
   anything else** — e.g. a Supabase auth token refresh failure, or a business switch on
   web (`lib/services/switch-business.ts` was not read in depth).
8. **Whether D1 is a recent regression or has always been present**, and therefore whether
   any production data has anonymous `approval_requests` rows. That needs git history and a
   database query.
