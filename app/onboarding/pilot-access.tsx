import { SurgeLogo } from "@/components/brand/surge-logo";
import { CONTACT_EMAIL, WHATSAPP_DISPLAY, WHATSAPP_PILOT_HREF } from "@/lib/brand/contact";

/**
 * What a signed-in visitor with no business sees now that they cannot make one.
 *
 * The tone matters more than usual. This person got all the way through Google
 * sign-in believing they were signing up, and is now being told they are not.
 * A bare "access denied" would read as a fault in the product at the exact
 * moment they have the least reason to give it another chance. So: say it is
 * deliberate, say what the pilot is, and give two ways to reach a person — one
 * that works at 2am and one that gets a reply in minutes.
 *
 * WhatsApp is listed first on purpose. A restaurant owner reads WhatsApp; email
 * to a place they have not bought from yet tends to sit.
 */
export function PilotAccess({ email }: { email: string | null }) {
  return (
    <div className="w-full max-w-md">
      <div className="lg:hidden mb-8">
        <SurgeLogo className="h-[52px] w-[176px]" />
      </div>

      <h1 className="text-2xl font-semibold tracking-tight">
        Surge is invitation-only right now
      </h1>
      <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
        We&apos;re running a free pilot programme with a small number of independent
        restaurants, cafés and shops, so we can set each one up properly and stay
        close to how it goes. New accounts are opened by us rather than created
        here.
      </p>
      <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
        Get in touch and we&apos;ll talk about your business. If it&apos;s a fit we&apos;ll set
        you up on a video call — full point of sale, free for the pilot.
      </p>

      <div className="mt-7 space-y-2.5">
        <a
          href={WHATSAPP_PILOT_HREF}
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 h-12 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="w-4 h-4">
            <path d="M12.04 2c-5.46 0-9.9 4.44-9.9 9.9 0 1.75.46 3.45 1.32 4.95L2 22l5.28-1.38a9.87 9.87 0 0 0 4.76 1.21h.01c5.46 0 9.9-4.44 9.9-9.9 0-2.64-1.03-5.13-2.9-7A9.82 9.82 0 0 0 12.04 2Zm0 1.67c2.2 0 4.27.86 5.83 2.42a8.2 8.2 0 0 1 2.41 5.82c0 4.54-3.7 8.23-8.24 8.23a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.05-.2-.31a8.18 8.18 0 0 1-1.26-4.36c0-4.54 3.7-8.24 8.24-8.24Zm-2.6 4.1c-.16 0-.42.06-.64.3-.22.24-.84.82-.84 2s.86 2.32.98 2.48c.12.16 1.69 2.58 4.1 3.62.57.25 1.02.4 1.37.5.58.19 1.1.16 1.52.1.46-.07 1.43-.59 1.63-1.15.2-.56.2-1.04.14-1.14-.06-.1-.22-.16-.46-.28-.24-.12-1.43-.7-1.65-.78-.22-.08-.38-.12-.54.12s-.62.78-.76.94c-.14.16-.28.18-.52.06-.24-.12-1.02-.37-1.94-1.2-.72-.64-1.2-1.43-1.34-1.67-.14-.24-.02-.37.1-.49.11-.11.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.54-1.3-.74-1.78-.19-.46-.39-.4-.54-.41h-.45Z" />
          </svg>
          WhatsApp {WHATSAPP_DISPLAY}
        </a>
        <a
          href={"mailto:" + CONTACT_EMAIL + "?subject=" + encodeURIComponent("Surge pilot programme")}
          className="flex w-full items-center justify-center gap-2 rounded-md border border-border px-4 h-12 text-sm font-medium hover:bg-accent"
        >
          Email {CONTACT_EMAIL}
        </a>
      </div>

      {/* They are signed in, which is confusing when the page says they cannot
          get in. Name the account they are signed in as, and give them the way
          out — otherwise the only control on the screen is the back button. */}
      <p className="mt-7 text-xs text-muted-foreground">
        {email ? (
          <>
            You&apos;re signed in as <span className="text-foreground">{email}</span>. If you
            already have a Surge account under a different address,{" "}
          </>
        ) : (
          <>If you already have a Surge account, </>
        )}
        <a href="/login" className="underline underline-offset-2 hover:text-foreground">
          sign in with that one
        </a>
        .
      </p>
    </div>
  );
}
