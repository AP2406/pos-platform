"use client";

import { LoginView } from "./login-view";
import type { LoginHero } from "./hero-panels";

/**
 * THE LEFT-PANEL SWITCH.
 *
 * Both approved variants are built (app/login/hero-panels.tsx); this is the one
 * line that chooses between them. Flip it to "photo" and redeploy — there is no
 * other edit, and no branch to merge.
 *
 * It defaults to "stats", for three reasons:
 *
 *  1. It is the variant that survives contact with reality. The photo comp was
 *     art-directed around one specific restaurant interior that we do not own
 *     and cannot ship. The nearest asset we DO own (public/jpg9.jpg) is a
 *     bright, white-walled coffee bar — a good photograph, but it needs a heavy
 *     scrim before a white lockup will sit on it, and a scrimmed photo is a
 *     compromise where the comp had a statement. "stats" is built from our own
 *     type, colour and geometry, so it looks the way it was drawn.
 *
 *  2. It shows the product. Everyone loading this page already has an account
 *     and is on their way to the dashboard; the panel's one job is to look like
 *     the thing behind the door. A room they are standing in does that less
 *     well than the screen they are about to open.
 *
 *  3. It costs nothing. /login is the single most-loaded admin route and this
 *     variant puts no image on its critical path.
 *
 * The reasons to prefer "photo" are real but seasonal — a campaign, a trade
 * show, a new set of licensed photography — which is exactly why it is a flag
 * and not a deletion.
 */
const HERO: LoginHero = "stats";

export default function LoginPage() {
  return <LoginView hero={HERO} />;
}
