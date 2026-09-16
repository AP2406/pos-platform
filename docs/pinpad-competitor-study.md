# Staff PIN pad / employee sign-in — a competitor study

**Researched:** 10 September 2026. **Method:** public vendor support documentation,
help-centre screenshots, App Store / Play Store listings, and vendor-supplied
screenshots on Software Advice. **No merchant account was signed into and no
credentials were used.** Every claim below is tied to a URL and to either text I
actually fetched from that page or something visible in an image I actually
rendered and looked at.

**A note on TouchBistro.** The earlier dashboard study (`docs/competitor-dashboard-study.md`)
found `help.touchbistro.com` behind a customer login. **That is no longer true as of
this session** — the help centre is fully public, it is Salesforce-rendered (so plain
HTTP fetches return an empty "Loading" shell and it must be read in a real browser),
and it carries real annotated product screenshots on a public CDN at
`cdn.help.touchbistro.com`. This is now the single best source in the study.
TouchBistro is consequently the *best*-evidenced vendor here, not the worst.

**A note on Square.** The opposite. Square documents the passcode *system* in more
depth than anyone, and shows the *screen* nowhere. Square's help centre has no
screenshots of it; the App Store assets are stylised isometric renders; the Play
listing is the handheld app; Software Advice's Square for Restaurants gallery has six
screenshots and none is the sign-in screen. **Every row in the matrix describing what
Square's passcode screen looks like is therefore "unverified", and that is the finding,
not a gap in the research.**

**Reading the matrix.** `✓` verified present. `✗` verified absent — for rows about
on-screen appearance this means "absent from the capture(s) I examined", which is
weaker than "the product does not have it". `~` partial or conditional, explained in
the notes. `unverified` means I could not establish it either way; it is never a
polite `✗`.

---

## Part 1 — Feature matrix

### 1.1 The sign-in screen itself

| # | Capability | TouchBistro | Square (Restaurants) | Toast | Lightspeed |
|---|---|---|---|---|---|
| 1 | Dedicated full-screen sign-in surface | ✓ | unverified | ✓ | ✓ |
| 2 | It is a persistent **lock screen** the app returns to, not a one-time bootstrap step | ✓ | ✓ | ✓ | ✓ |
| 3 | Named staff list / tiles to pick from (vs. blind PIN entry) | ✗ | unverified | ✗ | ✓ |
| 4 | Staff **photo** on the tile | ✗ | unverified | ✗ | ~ L-Series ✓ / K-Series ✗ |
| 5 | Role or job badge on the staff tile | ✗ | unverified | ✗ | ✓ |
| 6 | Searchable staff list | ✗ | unverified | ✗ | ✓ (K) |
| 7 | Sort control on the staff list | ✗ | unverified | ✗ | ✓ (K) |
| 8 | Business name on the sign-in screen | ✓ | unverified | ✗ | ✓ |
| 9 | Vendor logo / wordmark on it | ✓ | unverified | ✗ | ✓ |
| 10 | Live clock on the sign-in / time-clock screen | ✗ | unverified | ✓ merchant-toggleable | unverified |
| 11 | Device name on it | ✗ | unverified | ✗ | ✓ |
| 12 | App / server **version string** on it | ✗ | unverified | ✗ | ✓ |
| 13 | Wi-Fi SSID + IP address on it | ✗ | unverified | ✗ | ✓ (K) |
| 14 | Device role (active/passive, register/KDS) shown on it | ✗ | unverified | ✗ | ✓ (K) |
| 15 | Something viewable **before** authenticating | ✓ "View menu" | unverified | ✗ | ✓ floor plan |
| 16 | Sign-in screen changes state with the trading day | ✗ | unverified | ~ hourly vs. salaried | ✓ sales-period aware |
| 17 | "Who's on shift" / roster on the sign-in screen | ✗ | unverified | ✗ | ~ eligible-to-clock lists only |
| 18 | Offline indicator visible on the device | unverified | unverified | ✓ yellow banner | unverified |
| 19 | Hardware (printer / card reader) status in the app chrome | unverified | ✓ on the order screen | unverified | unverified |

### 1.2 Keypad mechanics

| # | Capability | TouchBistro | Square | Toast | Lightspeed |
|---|---|---|---|---|---|
| 20 | 3×4 keypad, phone order (1 top-left) | ✓ | unverified | ✓ 4-col variant | ✓ |
| 21 | Explicit confirm / submit key on the pad | ✓ green ✓ | unverified | ✓ `Go` | ✗ none present |
| 22 | Auto-submit on the Nth digit | ✗ | unverified | ✗ | ~ implied, see notes |
| 23 | Backspace key | ✓ | unverified | ✓ | ✓ |
| 24 | Separate **clear-all** key distinct from backspace | ✗ | unverified | ✓ | ✗ |
| 25 | Colour-coded destructive/confirm keys | ✓ red ⌫ / green ✓ | unverified | ✗ | ✗ |
| 26 | Masking style visible in any capture | unverified | unverified | unverified | ✓ 4 dots |
| 27 | A second, differently-styled keypad elsewhere in the same product | ✓ | unverified | unverified | unverified |

### 1.3 Credentials and sign-in model

| # | Capability | TouchBistro | Square | Toast | Lightspeed |
|---|---|---|---|---|---|
| 28 | Account login (email + password) sits behind the PIN | ✓ Cloud accts | ✓ | ✓ device-level | unverified |
| 29 | **Device code** / device-level auth instead of email+password | ✓ | ✓ | ✗ | unverified |
| 30 | PIN length | ~ 4 (Cloud) / **min 1** (POS platform) | 4, fixed | **3–8, variable** | 4–6 (K) / 4 (L) |
| 31 | PIN uniqueness enforced by the system | ✓ stated | unverified | ✓ stated, per location | unverified |
| 32 | Weak-PIN rejection (0000, 1234, repeats) | unverified | unverified | unverified | unverified |
| 33 | PIN auto-generated / "Generate" affordance | ✓ | ✓ | unverified | unverified |
| 34 | Staff can change their **own** PIN | ✗ | unverified | ✓ via MyToast | unverified |
| 35 | Lockout / rate-limiting on the POS PIN | unverified | unverified | ✗ none documented | unverified |
| 36 | QR-code sign-in | ✓ | ✗ | unverified | ✓ |
| 37 | NFC badge sign-in | ✗ | ✓ | ✓ Toast Access Card | unverified |
| 38 | Magstripe swipe-card sign-in | ✗ | ✗ | ✓ | ~ L-Series, discontinued |
| 39 | iButton / Dallas-key fob | ✗ | ✗ | unverified | ✓ (K) |
| 40 | A card/badge can **fully replace** the PIN | ✗ | ✗ | ✓ | unverified |
| 41 | Alphanumeric password as a POS login method | ✗ | ✗ | ✗ | ✓ (L) |
| 42 | "No authentication" — tap your name and you're in | ✗ | ✗ | ✗ | ✓ (K) |
| 43 | Biometric (Face ID / Touch ID) for the **staff** PIN | ✗ | ✗ | ✗ | unverified |
| 44 | Job / staff-type picker after the PIN | ✓ | ✓ Switch Job | ✓ | unverified |

Row 43: verified absent for Toast (biometrics are documented for Toast Web browser
login only) and effectively so for Square (passkeys are account-owner sign-in, and
Square explicitly warns against creating them on shared devices). No vendor puts
biometrics on a shared-terminal staff PIN.

### 1.4 Session, switching and locking

| # | Capability | TouchBistro | Square | Toast | Lightspeed |
|---|---|---|---|---|---|
| 45 | Fast user switch without a full sign-out | ✓ | ✓ | ✓ | ✓ |
| 46 | The switch control is **persistent on the working screen** | ✓ `Darko: Switch` | ✓ `Log Out LN` | ✓ `Switch User` | unverified |
| 47 | That control names the current user | ✓ full name | ✓ initials | unverified | unverified |
| 48 | Idle auto-lock back to the PIN screen | ✓ | ✓ | ✓ | unverified |
| 49 | Idle auto-lock is merchant-configurable | ✓ incl. "Never" | ✓ | ✓ incl. "Never" | unverified |
| 50 | Auto-lock scope | global, all iPads | per **mode** | per **device** | unverified |
| 51 | Documented auto-lock durations | ✗ not published | ✗ not published | ✗ not published | unverified |
| 52 | Re-lock **after each sale / bill** | ✓ `Logout After Paying Bill` | ✓ `After each sale` | unverified | unverified |
| 53 | Re-lock **after sending an order** to the kitchen | ✓ `Return After Printing` | unverified | unverified | unverified |
| 54 | KDS / kitchen devices exempt from auto-lock | unverified | unverified | ✓ | unverified |
| 55 | Remote force-logout of every other terminal | ✓ | unverified | unverified | unverified |

### 1.5 Clock-in and shift state

| # | Capability | TouchBistro | Square | Toast | Lightspeed |
|---|---|---|---|---|---|
| 56 | Clock **in** from the PIN screen itself | ✓ | ✓ | ✓ | ✓ |
| 57 | Clock **out** from the PIN screen itself | ✓ same button | ~ via Log out | ✓ | ✓ |
| 58 | Break start / end from the PIN screen | unverified | ~ via a clock icon | ✓ | unverified |
| 59 | Live break-minutes counter rendered on the button | ✗ | ✗ | ✓ | ✗ |
| 60 | Signing in and clocking in are **separate** actions | ✓ | ✓ | ✓ | ✓ |
| 61 | Being clocked in is a **precondition** for signing in | ✗ | ✗ | ✗ | ✓ |
| 62 | Off-schedule clock-in blocked, with manager override | ✓ | unverified | ✓ | unverified |
| 63 | Break-waiver legal agreement presented at clock-in | ✗ | ✗ | ✓ | ✗ |
| 64 | Paper chit printed on clock in/out | ✓ optional | unverified | unverified | unverified |

### 1.6 Manager override

| # | Capability | TouchBistro | Square | Toast | Lightspeed |
|---|---|---|---|---|---|
| 65 | Manager approval by PIN for restricted actions | ✓ | ✓ | ✓ | ✓ |
| 66 | It is **one-shot**, not a granted session | ✓ | unverified | ✓ | ✓ "temporarily" |
| 67 | The gated action list is **published** | ✓ 9 named toggles | ✗ | ~ per-permission | ✗ |
| 68 | Merchant can toggle the gated actions individually | ✓ | ✓ | ~ by permission | unverified |
| 69 | Security **preset levels** (low / medium / high) | ✓ | ✗ | ✗ | ✗ |
| 70 | A middle "warn but allow" tier between ignore and manager-required | ✓ | unverified | unverified | unverified |
| 71 | Manager can approve by presenting a QR code instead of typing | ✓ | ✗ | ✗ | ✗ |
| 72 | Manager can approve by swiping a card instead of typing | ✗ | unverified | ✓ | unverified |
| 73 | A lock icon marks actions that will need approval | unverified | unverified | unverified | ✓ (L) |

### 1.7 Offline

| # | Capability | TouchBistro | Square | Toast | Lightspeed |
|---|---|---|---|---|---|
| 74 | **PIN sign-in with no internet** | unverified | unverified | ✗ documented | unverified |
| 75 | **User switch** with no internet | unverified | unverified | ✓ documented | unverified |
| 76 | Clock **in** offline | unverified | unverified | ✓ | unverified |
| 77 | Clock **out** offline | unverified | unverified | ✗ documented | unverified |
| 78 | Taking and closing orders offline | ✓ | ~ payments only | ✓ | unverified |
| 79 | Vendor documents offline behaviour of the sign-in surface at all | ✗ | ✗ | ✓ | ✗ |

Row 74/75 is the most consequential cell in the study and Toast is the only vendor
that answers it. See §2.3.

### 1.8 Multi-location and device roles

| # | Capability | TouchBistro | Square | Toast | Lightspeed |
|---|---|---|---|---|---|
| 80 | Switch location from the device | unverified | ~ blocked on Register w/ device code | unverified | unverified |
| 81 | Name a device | ✓ | ✓ | ✓ | ✓ |
| 82 | Device **type** chosen at pairing (POS / KDS / Kiosk) | unverified | ✓ | unverified | unverified |
| 83 | Landing screen after PIN configurable **per device** | unverified | ~ via modes | ✓ 6 options | ~ configuration per device |
| 84 | Settings are per-device rather than account-global | ✗ explicitly global | ✓ per mode | ✓ per device | ✓ per device |

---

## Part 2 — Per-vendor detail

### 2.1 TouchBistro (iPad POS)

**Sources**
- Passcode + clock-in screen: <https://help.touchbistro.com/s/article/How-Do-I-Clock-In?language=en_US>
  — images `https://cdn.help.touchbistro.com/end57image014.png` (995×1210),
  `https://cdn.help.touchbistro.com/schedenforce001.jpg` (938×552),
  `https://cdn.help.touchbistro.com/login.png` (975×571),
  `https://cdn.help.touchbistro.com/chapter10image008.png` (999×353)
- Security settings: <https://help.touchbistro.com/s/article/security-settings?language=en_US>
- Advanced settings: <https://help.touchbistro.com/s/article/advanced-settings?language=en_US>
- Staff accounts, Cloud platform: <https://help.touchbistro.com/s/article/How-To-Set-Up-User-Accounts-for-Staff-for-Cloud-and-POS-Login?language=en_US>
- Staff accounts, POS platform: <https://help.touchbistro.com/s/article/list-of-staff?language=en_US>
- Offline capability table: "What Can You Do with TouchBistro POS If Your Internet Goes down?",
  reachable from <https://help.touchbistro.com/s/global-search/internet%20goes%20down>
- Server basics (fast switch, transfer): <https://help.touchbistro.com/s/article/server-guide-the-basics-of-touchbistro-for-servers?language=en_US>
- Landscape/portrait product shot: `https://gdm-catalog-fmapi-prod.imgix.net/ProductScreenshot/19360ba5-9cda-46cf-81c5-277b6b1e547c.png`
  via <https://www.softwareadvice.com/restaurant/touchbistro-profile/>

**The screen.** Full-bleed dark teal-navy field with a large tone-on-tone TouchBistro
chef-hat watermark bleeding off the right edge. The venue name — `TouchBistro Sample
Cafe` — is centred at the top in white, light weight, and is the only text above the
pad. Below it, a single centred white card:

- a header row: placeholder text `Enter passcode` on the left, a **QR-code icon** on
  the right;
- a **3×4 keypad**, `1-9` in phone order, keys are pale blue-grey with large thin
  numerals;
- bottom row: a **red** backspace (a circled left chevron) · `0` · a **green** circled
  checkmark. Both colour-coded, and the green check is the submit key;
- a full-width `Clock in/out` bar attached beneath the pad, inside the same card.

Under the card the background curves into a white band carrying `View menu`, and below
that the TouchBistro wordmark. So: **anyone can read the menu without a passcode**, and
**clock-in is a peer of sign-in on the pad itself, not a separate destination**.

**Layout / width.** The capture I have (`end57image014.png`) is portrait-proportioned
and the card occupies roughly a third of the frame width, horizontally centred, with the
watermark filling the empty right side. The landscape capture I have
(`login.png`, 975×571) shows the same venue-name-over-centred-card composition with a
`Select Staff Type` sheet over it. TouchBistro rotates — its own advanced-settings page
refers to "changing between Portrait and Landscape" — and the vendor floor-plan
screenshot on Software Advice is portrait. **I could not obtain a confirmed full-width
landscape capture of the passcode screen, so I cannot state how much of a landscape
iPad the card leaves empty.** What I can say is that the composition is the same
centred-card-on-a-decorated-field pattern, and that TouchBistro spends the leftover
space on a brand watermark rather than on information.

**PIN rules — and they differ by platform, which is worth knowing.**
On the **Cloud-based platform** the passcode "is automatically generated although you
can manually customize it to a preferred 4-digit passcode. The code must be unique for
the venue", with a `Generate Passcode` button. On the older **POS-based platform**:
"The passcode must be unique. Passcodes can be a minimum of **1 number**, although for
security purposes, you should create passcodes at least 4 numbers in length. Some
payment integrations also require 4 number passcodes." A one-digit staff passcode is a
supported configuration. Staff cannot rotate their own — the help article
"How to Change Your Password" reads, in the portion exposed by the help centre's own
search index, "…passcode but you cannot modify it. To change it, get your administrator
to generate a new one…".

**QR codes, and the best idea in the study.** After setting a passcode an admin can
generate a QR code, printed to the receipt printer or emailed. It is an alternative
clock in/out method — *and* the docs say: "**Managers can also use this QR code to help
them more quickly issue approvals during the ordering process (e.g., voids or
discounts).**" The manager-confirmation modal confirms it in the UI: "Enter a manager
passcode or present a manager's QR Code to continue." A manager can therefore approve a
void by holding a card up to the camera instead of typing a passcode in front of a
server who is watching. It can be regenerated without changing the passcode.

**Manager override.** Invoked as a modal titled `Manager Confirmation` with an `X`
top-left to decline. It carries **its own keypad, styled differently from the sign-in
keypad** — light grey rounded keys, `⌫` · `0` · a **navy** checkmark, versus the sign-in
pad's red/green. Two keypads, two visual languages, one product. The gated actions are
individually toggleable and, unusually, **published by name**: Void Items, Delete Items,
Discount Items, Open Cash Drawer, Transfer Tables Between Staff, Transfer
Tabs/Deliveries/Takeout, Transfer Seats/Parties, Change Gratuity, Open Restaurant. Two
further settings — Unsent Item Handling and Unselected Modifier Warning — have a
three-way `Ignore / Warn / Manager Required` scale rather than a boolean. Above all of
it sits a **`Low` / `Medium` / `High` preset** ("Low sets all to disabled", "Medium
(recommended settings)", "High sets all to enabled").

**Schedule enforcement.** Clocking in outside a scheduled shift produces an error modal
then the Manager Confirmation pad. The error copy is bad and worth quoting as an
anti-pattern: *"Something went wrong / We're unable to process your clock-in. Please try
again or contact our support team for assistance. Error: Not scheduled to work or
7shifts scheduling integration role name does not match."* A policy decision is dressed
as a crash, the remedy offered is "contact support", and the actual remedy — get a
manager — is only revealed on the next screen.

**Fast switching.** Persistent, on the working screen, and named: the floor plan's
bottom-left corner reads `Darko: Switch` (and `Admin: Switch` in the vendor screenshot).
The clock-in article's instruction is "If you are on the floor plan screen and do not
see your name in the bottom left, tap it." There is also a bulk operation, `Options |
Transfer All Orders to Staff`, for handing a whole section over at shift change, and a
`Log Out All Other iPads` action on the Pro Server gated by the Admin passcode.

**Auto-lock.** `Admin | Admin Settings | Advanced | Automatically Log Users out after`:
"If TouchBistro detects a period of inactivity, it will automatically log the user out
and require a new login. You can set the inactivity time or set it to **Never**. Use
Never with caution, as it might make TouchBistro vulnerable to unauthorized use." The
selectable durations are not published. Two further re-lock triggers exist: `Logout
After Paying Bill` ("always force the user to log back in after closing a table") and
`Return After Printing`, which can send the user to the login screen after an order goes
to the kitchen. **All of these are account-global**: "If you have more than one iPad,
settings here will apply to all iPads. These are not local settings."

**Offline.** The offline capability table says take/close orders, cash payments, offline
card payments, kitchen tickets, KDS and receipt printing all work; menu editing, iPad
reports, staff management, cloud reports, online orders, floor-plan editing, loyalty and
gift cards do not. **It says nothing about signing in or clocking in.** Since orders can
be taken, staff evidently remain able to operate, but whether a *new* passcode sign-in
succeeds with the internet down is not documented. Unverified.

**Notable — good.** Manager approval by QR code. Publishing the exact list of
manager-gated actions. The Low/Medium/High security preset — a merchant who does not
want to reason about nine toggles gets a defensible default in one tap. `View menu`
before authenticating. Clock in/out living on the pad rather than behind it. The named
`Darko: Switch` control, which tells you who is ringing and offers to change it in the
same object.

**Notable — dated or bad.** A **1-digit minimum passcode** on the POS platform.
Two visually inconsistent keypads. A generic "Something went wrong" for a scheduling
policy decision, complete with a leaked integration-internals string. Auto-lock that is
global across every iPad rather than per-device, so the kitchen tablet and the bar till
get the same timeout. Staff who cannot rotate their own passcode.

### 2.2 Square for Restaurants (iPad POS)

**Sources**
- Passcodes: <https://squareup.com/help/us/en/article/8357-require-passcodes-at-point-of-sale>
- Permission sets: <https://squareup.com/help/us/en/article/5822-employee-permissions>
- Team member badges: <https://squareup.com/help/us/en/article/7918-get-started-with-team-member-badges>
- Device codes: <https://squareup.com/help/us/en/article/8339-set-up-device-codes>
- Modes: <https://squareup.com/help/us/en/article/8114-create-and-manage-device-profiles>,
  <https://squareup.com/help/us/en/article/8458-use-modes-with-square-point-of-sale>
- Clock in/out: <https://squareup.com/help/us/en/article/8395-clock-in-and-out-for-team-members>
- Offline payments: <https://squareup.com/help/us/en/article/7777-process-card-payments-with-offline-mode>
- Multi-location: <https://squareup.com/help/us/en/article/5580-manage-multiple-locations-with-square>
- Restaurants check actions: <https://squareup.com/help/us/en/article/8166-comp-void-and-reassign-checks-with-square-for-restaurants>
- Landscape product screenshot: `https://gdm-catalog-fmapi-prod.imgix.net/ProductScreenshot/8b971a48-db98-4e61-84a7-4a0fe620625a.png` (1400×1049)
  via <https://www.softwareadvice.com/restaurant/square-for-restaurants-profile/>

**The screen — could not verify.** I could not find a single public image of Square's
passcode screen. Not in the help centre (which article 8357 illustrates with a YouTube
video, `https://www.youtube.com/embed/be7suLQUWfw`, titled *Use Passcodes with Square
Point of Sale* — I confirmed the video exists via its thumbnail but could not read
frames from it), not in the App Store gallery, not on Software Advice or Capterra.
**Keypad layout, digit order, masking, auto-submit-vs-confirm, and whether the screen
shows a business name, clock, logo, location or offline state are all unverified for
Square.** Given how completely Square documents the passcode *model*, this is a
striking omission.

**What I can verify about the surrounding chrome**, from a vendor-supplied landscape
screenshot (1400×1049): the strip under the iPad status bar reads `POS1 – Lauren N.`
top-left, `Reader Ready` centred, `Printer Connected` top-right. Bottom-left of the app
is **`Log Out LN`** — the log-out button carries the signed-in user's *initials*. So
Square, like TouchBistro, keeps a persistent, user-identified switch control in the
bottom-left corner, and it surfaces card-reader and printer state in the same strip as
the operator's identity. (This screenshot is vendor-supplied and its styling looks
older than current Square for Restaurants; treat the chrome as indicative rather than
current.)

**Three kinds of passcode**, which is the cleanest model of the four: an **owner**
passcode (highest permissions), a **team** passcode (shared across everyone on the
single team permission set — and explicitly "does not support the ability to track time,
sales, or activity by team member"), and **personal** passcodes ("a unique, 4-digit
passcode"). Custom permission sets deliberately "do not have a unique passcode".
Passcodes can be typed or generated at random.

Note a documentation conflict worth flagging: one Square staff post claims team
passcodes are unavailable on Square for Restaurants and personal passcodes are required;
another Square staffer, three days later on a thread specifically about the Restaurants
POS, says the opposite. No current help article carves Restaurants out. **Treat
"Restaurants requires personal passcodes" as unverified.**

**Fixed 4 digits.** The only vendor here with no length flexibility. Uniqueness is
described ("a unique, 4-digit passcode") but never stated as an enforced validation
rule, and no article documents rejection of a duplicate, rejection of a weak code, or
any lockout or rate-limit after failed attempts. All unverified.

**Auto-lock.** Configurable, and this is done well: `Require passcode` is not a single
switch but a set — a timeout duration, plus **`After each sale`**, plus a list of
individual tasks that demand a passcode. It lives on the **mode** (Settings > Device
Management > Modes > Security), so a merchant configures a *class* of terminal once and
every device on that mode inherits it — a better unit than TouchBistro's account-global
setting and arguably better than Toast's per-device one. Durations are not published.

**Badges.** Physical NFC team-member badges: tap on the passcode screen to sign in, and
"Team members can see confirmation they are signed in and can also select **Clock in**
on the screen to track their hours." Requires a Square Reader for contactless and chip;
works on Square Stand and Register; **not compatible with Square Terminal**; gated
behind Square for Restaurants Plus/Premium or Advanced Access. A badge supplements the
4-digit passcode rather than replacing it — team members "can still use a four-digit
passcode to sign in and clock in and out if they have a badge" — and badges do not work
for the Square Team app.

**Device codes.** An alphanumeric code that authenticates the *device* instead of an
email and password, so staff never handle owner credentials. At pairing you choose the
device type — **Point of sale / Kitchen display system / Kiosk** — the location, a mode,
and a name. Unused codes expire after 48 hours; resetting one signs the paired device
out. Note the trade-off Square documents: "you cannot switch locations if you're signed
in to Square Register with the use of a device code."

**Clock-in.** A separate action on the sign-in screen, not a side effect of it: "From
your Square Point of Sale screen login screen, enter your passcode and select **Clock
In**." Clock-out is `Log out` > `Clock in/out` > passcode > `End Shift`. Breaks and
`Switch Job` are reached via a clock icon (bottom-right on Register, in the Checkout tab
elsewhere). Two details worth stealing: **automatic clock-out** after a configurable
period past the end of a scheduled shift, and the fact that a team member who signs in
with their own *email* is never asked for a passcode to clock in or out.

**Manager override.** Real but under-documented. Article 8357 says "select the tasks you
want to require a passcode to perform" and **never prints the task list**. Verified
concrete instances: moving another team member's check ("you'll need to enter a passcode
or have the appropriate permission"), a per-discount `Require a passcode` toggle, and an
off-hours time-based-menu block where "Manager passcode override required". Whether an
override is one-shot or grants a session is unverified.

**Offline.** Square documents offline *payments* exhaustively and offline *sign-in* not
at all. The one hard, repeated rule is about the opposite direction — with pending
offline payments, "do not do any of the following: Sign out of the Square POS apps /
Delete the Square POS apps / Switch modes / Switch locations / Factory reset", and
"Pending offline payments will be permanently lost and the funds won't be captured".
There is no documented restriction on switching team members offline, and no statement
that passcode entry works offline. Unverified either way. Square's own marketing FAQ
says "Square POS requires both an internet connection and compatible hardware", which is
not encouraging but is not a statement about authentication.

**Notable — good.** The three-passcode model, and specifically being honest in the docs
that a shared team passcode buys convenience at the cost of all per-person attribution.
`Require passcode` as a *set* of triggers — timeout, after each sale, per-task — rather
than one timeout. Attaching security settings to a **mode** so a fleet is configured
once. Device codes with an explicit device *type* at pairing. Automatic clock-out at
end of shift. Not asking for a passcode from someone who signed in with their own email.

**Notable — dated or bad.** A **fixed 4-digit** passcode in 2026. Publishing "select the
tasks you want to require a passcode to perform" without publishing the tasks. Badges
gated behind a paid tier and specific hardware, and silently unsupported on Terminal.
And the documentation gap itself: a merchant cannot see what their staff's sign-in
screen looks like before buying.

### 2.3 Toast — brief

Only what Toast does that TouchBistro and Square do not.

**Offline sign-in, and it is the one vendor that answers the question.**
<https://support.toasttab.com/en/article/Using-Toast-in-Offline-Mode> — I verified this
text in the live page: "Do not log out of the Toast app or uninstall the Toast app.
**You may still use Switch User. Without an internet connection, no one can log back
into the app**…". So Toast draws the exact line that matters: an already-signed-in
device can hand off between staff offline; a signed-out device is a brick until
connectivity returns. Alongside it: "Yes, employees can clock in and out while in
Offline Mode" — but clock-**out** is separately listed as blocked ("During Offline Mode,
your team is unable to: Close checks / Declare cash tips / Reconcile cash and tips /
**Clock out**"), which is an internal contradiction in Toast's own FAQ. And: "After
about 40 seconds without a connection, you'll see a yellow Offline Mode banner across
the top of each affected device."

**Variable 3–8 digit PIN with enforced per-location uniqueness.** "a unique
three-to-eight digit number assigned to each employee"; "Each POS access code must be
unique — no two employees at the same location can share the same code"
(<https://support.toasttab.com/en/article/Find-or-Edit-an-Employee-s-POS-Access-Code>).
Toast even documents the collision failure mode — "Wrong employee's name appears at
clock-in → Two employees share the same POS access code". Staff can rotate their own
code through MyToast, after which the field greys out for managers in Toast Web.

**The pad routes to two destinations.** The screen reads `Swipe card or enter your
passcode`; keys `1-9`; bottom row `⊗` (clear) · `0` · `⌫` (backspace); and a **fourth
column** on the right holding two stacked keys, `Timeclock` (hourglass) and `Go`
(blue, highlighted). Same passcode, two doors, and Toast's own troubleshooting table
lists "User selected Go instead of Timeclock when logging in" as a known error — the
cost of the design, documented by its author.
Image: `https://dwvhey99m5tyy.cloudfront.net/images/ka2PV000000RRAbYAO/0EMPV00000DjcRR` (624×470).

**Breaks run through the passcode screen with live state on the button** — "The number
in parentheses next to **End Break** is the number of minutes the break has been
active". And a **break-waiver agreement** is presented at clock-in, with the answer
locked once given.

**A merchant-toggleable clock on the time-clock screen** (`Front of house > Order screen
setup > UI options > Time Clock > Show Time?`).

**`Primary Mode` per device** — the same PIN lands on Table Service, Quick Order,
Payment Terminal, Pending Orders, Kitchen Display/Expo or Orders Hub depending on how
that device was configured.

**Screen Timeout is per-device and honest about the trade-off**: "Customize the time in
minutes/seconds Toast will wait before returning to the passcode login screen. Shorter
times are typically more secure. You can still select switch user and manually log
yourself out before the timeout." A KDS device is exempt and never returns to the lock
screen.

**Swipe cards that can fully replace the passcode**, with an interlock: you cannot
select "Disable POS access code login at this location" unless a swipe card is
configured. One card, one employee, enforced.

Toast does **not** put biometrics on the POS pad — its biometrics article is explicitly
about bypassing email+password on **Toast Web** in a browser. And Toast documents no
lockout or rate-limit on the POS access code; the only lockout it documents (5 failures
in an hour) is for Toast Web accounts.

### 2.4 Lightspeed — brief

**Lightspeed is the only vendor here that does not do blind PIN entry**, and it is the
most interesting sign-in surface in the category.

**K-Series** (<https://k-series-support.lightspeedhq.com/hc/en-us/articles/360050329234-Using-the-Home-screen>).
The sign-in surface is a named "Home screen" and the docs are explicit that it doubles
as the lock screen: "The Home screen is where users log in… **The Home screen is the
main lock screen** in Lightspeed Restaurant, which the app returns to after a user logs
out." In the vendor screenshot (1400×1050, landscape) it is a black full-bleed screen
with `About` top-left, the device name `Lightspeed K Series` centred in the top bar,
the Lightspeed logo, the line "Welcome! Tap an active user, view the floor plan or
clock in/out.", a **`Sort by`** control top-right with two icon buttons (alphabetical
and clock), a grid of **staff tiles** carrying a name and a role chip (`MANAGERS`), and
three full-width blue buttons pinned along the bottom: **`Clock in/out` · `View floor
plan` · `Scan QR code`**. Image:
`https://k-series-support.lightspeedhq.com/hc/article_attachments/34054928933531`.

PIN entry is an **overlay after you pick a person**: "Please enter your PIN code", four
dot placeholders, `1-9`, and a bottom row of only `0` and `<` — **there is no confirm
key on the pad at all**, over a dimmed, searchable staff list (Kay, Manager, Mary,
Michael, Ray). The absence of a submit key strongly implies auto-submit, but since the
documented PIN length is variable (4–6 digits) I could not reconcile that and am
marking auto-submit as inferred, not verified. Image:
`https://k-series-support.lightspeedhq.com/hc/article_attachments/47203237493915`.

Three auth modes per user, including **none**: "If your user profile has a PIN code, tap
your name and then enter the code… If your user profile has a QR code, tap Scan QR
code… **If your user profile has no authentication set up, tap your name to log in.**"
The user record also carries an **iButton ID** field "for businesses using a Dallas key".

The lock screen is also a **device diagnostics panel** — business name, device name,
the configuration in use, whether the device is in sharing mode, the app name and
version number, the Wi-Fi network name and IP address, and whether the device is an
active or passive POS. All readable before anyone authenticates.

Two structural ideas nobody else has: **being clocked in is a precondition for logging
in** ("Only clocked-in users can log in"), and the lock screen is a **state machine over
the trading day** — when the sales period is closed the only options are clock in/out
and open a sales period. Also: at clock-out, open orders are handed to another
clocked-in user and "the selected user inputs their credential to authorize the
transfer" — a second-party PIN prompt that is not a manager override.

**L-Series** (<https://resto-support.lightspeedhq.com/hc/en-us/articles/226306927-Logging-in-to-Restaurant-POS>)
goes further: a `USER LOGIN | PIN LOGIN` segmented toggle and a grid of **eleven staff
photo tiles** — "**Tap your user image.**" — with names and roles beneath (`Leah -
Manag…`, `Cashier`, `Heather - Ser…`, `Amelie - Server`, `Gus - Server`, `Sam -
Barten…`, `Steve - Busser`, `Mary`, `Larry`, `Kate`, `Bob`), filling the full landscape
width six tiles across. The app and server version strings sit behind an ⓘ in the
top-left corner, `Help Center` top-right, and `Restaurant Manager` / `Tools` along the
bottom. Two tiles carry a **green underline bar**, which I believe marks who is clocked
in but could not confirm from documentation. L-Series also supports an **alphanumeric
password** as a login method, and login cards ("Lightspeed no longer sells login
cards. Existing login cards will continue to work"). Elevated permissions are one-shot
and signposted: "Select an action that you don't have permission to perform, **indicated
by a lock icon**." Image:
`https://resto-support.lightspeedhq.com/hc/article_attachments/1260801522650` (5208×3850).

Lightspeed documents **nothing** about offline sign-in on either series.

---

## Part 3 — Where this leaves Surge

Cross-referenced against `docs/pinpad-surge-inventory.md`. Only differences that the
evidence above actually supports.

**Conventions we are outside of.**

1. **Sign-in as a bootstrap step rather than a lock screen (row 2).** All four vendors
   treat the PIN surface as the screen the app *returns to*. Our iPad sign-in is step 3
   of email/password → location → PIN. Our web has no sign-in screen at all — a
   `max-w-xs` modal over the register. Nobody else ships a PIN modal.
2. **Clock-in on the pad (row 56).** All four. Ours is on neither pad — web sends you to
   `/app/clock` with a *third* keypad, iPad to `/clock` behind Staff tools.
3. **Manager override existing at all on the iPad (row 65).** All four vendors have it.
   We have none on iPad (D10).
4. **Configurable auto-lock (row 49).** TouchBistro, Square and Toast all let the
   merchant set it, all offer an equivalent of "Never", and all warn about it. Our iPad
   matches this. Our web is a hardcoded 90 s that is also suppressed whenever a check is
   open (D7/D8) — which is the opposite of everyone else's posture.
5. **PIN length floor.** Our 4–6 variable is defensible: Toast is 3–8, Lightspeed 4–6,
   TouchBistro 4 (Cloud) or 1 (legacy), Square fixed 4. We are mid-range, not eccentric.
6. **Weak-PIN rejection (row 32).** Nobody documents it. D6 is a real defect but it is
   not a competitive gap — it is an opportunity nobody has taken.
7. **Lockout (row 35).** Also undocumented by all four. Our D3 is not visibly worse than
   the category; it is just undefended.

**Things worth stealing, in order of evidence strength.**

- **A persistent, user-named switch control on the working screen.** TouchBistro's
  `Darko: Switch` and Square's `Log Out LN` are the same idea in the same corner. We
  have `Ringing as {name}` plus a separate "Switch" link on web and a "Switch staff"
  buried in a Staff-tools sheet on iPad. Merging identity and the switch affordance into
  one bottom-left object is a two-vendor convention.
- **Clock in/out as a key on the pad**, TouchBistro-style, or as a second destination
  key, Toast-style. This deletes our third keypad (D13) rather than restyling it.
- **`Require passcode` as a set, not a duration.** Square's timeout + after-each-sale +
  per-task list, attached to a device *mode*. Our `security.*` config keys already exist
  and are never read (D5); this is the shape they should have had.
- **Manager approval by QR code** (TouchBistro). The only genuinely novel idea in the
  category and it directly addresses shoulder-surfing at the pass.
- **A Low/Medium/High security preset** (TouchBistro) over our per-permission matrix.
- **Filling the empty two-thirds with device state**, Lightspeed-style: device name,
  version, network, role. Our card is 380 pt of a 1080 pt landscape screen — measured
  from `surge/ipad-signin-step3-pinpad.png` — and we already render a "This iPad is a:
  Register | Kitchen screen" selector in that dead space. Lightspeed shows it is normal
  to put the whole device identity there: name, configuration, app version, Wi-Fi SSID,
  IP, and active/passive role, all pre-auth. That is the single cheapest way to make an
  empty screen look deliberate, and it is genuinely useful to whoever is standing in
  front of a terminal that will not connect.
- **Staff tiles.** Lightspeed is the only vendor doing it, so this is a differentiator
  rather than a convention — but it is worth noting that L-Series tiles appear to carry
  a clocked-in indicator, which would fold our roster and our sign-in into one screen.

**Things not to copy.** Toast's `Go`/`Timeclock` split, which its own docs list as a
recurring user error. TouchBistro's 1-digit minimum, its two mismatched keypads (we
already have three — D13), and its "Something went wrong" for a policy refusal.
Square's fixed 4 digits. Lightspeed's no-authentication login mode.

---

## Part 4 — Screenshot evidence

The workspace shell has no outbound network access (all egress is blocked by an
allowlist proxy), so **vendor image files could not be written to
`docs/pinpad-screens/touchbistro/` and `docs/pinpad-screens/square/`**. Those
directories exist but are empty. Instead there is
**`docs/pinpad-screens/index.html`** — open it in a browser and it loads every image
referenced here, captioned, straight from the vendors' own CDNs, exactly as
`docs/competitor-screens/index.html` does for the dashboard study.

`docs/pinpad-screens/surge/ipad-signin-step3-pinpad.png` already existed in that folder
(2160×1620, our own device capture). I have put it at the **top** of `index.html` so the
comparison sits on one page. From that capture I could measure our card directly: it
spans **≈35% of the screen width** — 380 pt of 1080 pt — and roughly two thirds of the
display is empty. That confirms the figure in `docs/pinpad-surge-inventory.md`.

Direct URLs, all of which I rendered and looked at:

**TouchBistro**
| Image | Size | Shows |
|---|---|---|
| `https://cdn.help.touchbistro.com/end57image014.png` | 995×1210 | The passcode screen: venue name, QR icon, 3×4 pad, red ⌫ / 0 / green ✓, `Clock in/out` bar, `View menu` |
| `https://cdn.help.touchbistro.com/schedenforce001.jpg` | 938×552 | "Something went wrong" clock-in error → `Manager Confirmation` modal with its own, differently-styled keypad |
| `https://cdn.help.touchbistro.com/login.png` | 975×571 | `Select Staff Type` sheet (Bartender / Waiter / Host) over the passcode screen |
| `https://cdn.help.touchbistro.com/chapter10image008.png` | 999×353 | Floor-plan bottom bar with `Darko: Switch` highlighted |
| `https://gdm-catalog-fmapi-prod.imgix.net/ProductScreenshot/19360ba5-9cda-46cf-81c5-277b6b1e547c.png` | large | Full floor plan, `Admin: Switch` bottom-left, `TouchBistro Lite \| Main Floor` |

**Square** — no image of the passcode screen exists publicly, see §2.2.
| Image | Size | Shows |
|---|---|---|
| `https://gdm-catalog-fmapi-prod.imgix.net/ProductScreenshot/8b971a48-db98-4e61-84a7-4a0fe620625a.png` | 1400×1049 | Order screen chrome: `POS1 – Lauren N.` / `Reader Ready` / `Printer Connected`, and `Log Out LN` bottom-left |
| `https://is1-ssl.mzstatic.com/image/thumb/PurpleSource221/v4/36/e0/3e/36e03e10-0cd6-2d89-8206-0b1ce468bff1/USEN_-_Thumbnail_01__U00282048x2732_U0029.jpg/1056x1408bb.jpg` | 2048×2732 native | App Store render; `Log out` visible as a bottom-nav item. Stylised, not layout evidence |
| `https://i.ytimg.com/vi/be7suLQUWfw/maxresdefault.jpg` | 1280×720 | Title card of Square's own *Use Passcodes with Square Point of Sale* video, embedded in article 8357 |

**Toast**
| Image | Size | Shows |
|---|---|---|
| `https://dwvhey99m5tyy.cloudfront.net/images/ka2PV000000RRAbYAO/0EMPV00000DjcRR` | 624×470 | The passcode screen: `Swipe card or enter your passcode`, 1-9, `⊗ / 0 / ⌫`, and a 4th column with `Timeclock` and blue `Go` |

**Lightspeed**
| Image | Size | Shows |
|---|---|---|
| `https://k-series-support.lightspeedhq.com/hc/article_attachments/34054928933531` | 1400×1050 | K-Series Home/lock screen: device name, staff tile with role chip, `Sort by`, and `Clock in/out \| View floor plan \| Scan QR code` |
| `https://k-series-support.lightspeedhq.com/hc/article_attachments/47203237493915` | 1400×1050 | K-Series PIN overlay: 4 dots, 1-9, `0` and `<` only, over a searchable staff list |
| `https://resto-support.lightspeedhq.com/hc/article_attachments/1260801522650` | 5208×3850 | L-Series `USER LOGIN \| PIN LOGIN` with 11 staff **photo** tiles, version strings top-left |

Toast image `https://dwvhey99m5tyy.cloudfront.net/images/ka2PV000000SqdBYAS/0EM4W0000088o09`
(alt text "Toast device login screen with timeclock button circled") is cited in Toast's
clock-in article but I did not render it; it is in `index.html` for completeness and
flagged there as unviewed.

---

## Part 5 — Things I could not verify

**Square, the big one.** Every visual property of the passcode screen: keypad presence,
digit order, key size, bottom-row composition, masking style, auto-submit vs. confirm
tap, and whether the screen carries a business name, logo, clock, location name, device
name, offline indicator or version string. No public image exists that I could find, and
Square's help articles carry no screenshots.

**Offline sign-in for three of four vendors.** TouchBistro's offline capability table
covers orders, payments and printing and is silent on authentication. Square documents
offline *payments* thoroughly and offline *sign-in* not at all — and note that the
documented prohibitions ("do not sign out / switch modes / switch locations") are about
the account session, not the staff passcode, so they neither confirm nor deny that a
passcode works offline. Lightspeed documents nothing on either series. Only Toast
answers the question.

**Lockout / rate-limiting on the POS PIN for all four.** Toast documents a lockout for
Toast Web browser accounts only and, for an invalid POS passcode, says merely "Try
entering your passcode again." Nothing found for the other three.

**Weak-PIN rejection for all four.** No vendor documents rejecting `0000`, `1234` or
repeated digits.

**PIN uniqueness enforcement for Square and Lightspeed.** Both use the word "unique"
descriptively; neither states it as a validation rule. TouchBistro and Toast do state it.

**Auto-lock durations.** All four make it configurable; none publishes the option list.

**Whether a manager override grants a session or a single action, for Square.**
Verified one-shot for TouchBistro (a per-action confirmation modal), Toast and
Lightspeed ("temporarily grant a user access to an order action"). Square never says.

**Square's `Require passcode` task list.** Article 8357 says the list exists and never
prints it. Whether comps, voids, refunds or cash-drawer opens appear in it is unknown.
Article 8166 gates comp and void by *permission* with no passcode prompt documented.

**Whether Square for Restaurants forbids the shared team passcode.** Two Square staff
answers contradict each other three days apart and no help article settles it.

**TouchBistro's passcode screen in confirmed landscape at full width.** The captures
I have are portrait-proportioned or cropped, so I cannot state how much of a landscape
iPad the centred card leaves empty — which is precisely the measurement that would make
the comparison to our own 380pt-card-on-1080pt-screen exact.

**TouchBistro's auto-lock option list, and whether any offline indicator appears on its
passcode screen.**

**Lightspeed K-Series auto-lock, offline behaviour, PIN uniqueness, and whether its
tiles ever carry photos.** L-Series is explicit about photos ("tap your user image");
K-Series consistently says "tap their name" and the one screenshot I have shows a text
tile. Do not claim photo tiles for K-Series.

**The meaning of the green underline on two L-Series tiles.** Almost certainly a
clocked-in marker; not documented.

**Whether Lightspeed's PIN pad auto-submits.** No confirm key is present in the
screenshot, which implies it, but the documented 4–6 digit variable length argues
against it. Unresolved.

**Interaction behaviour everywhere** — focus, error animation, haptics, what happens on
the Nth wrong attempt. Static screenshots cannot show it and no vendor documents it.

**Toast's own internal contradiction on offline clock-out**, which I verified exists in
the live page but cannot resolve: the FAQ says employees can clock in and out offline,
and the capability list says they cannot clock out.
