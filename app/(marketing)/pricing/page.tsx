import { pageMetadata, Checklist, Faq, ClosingCta } from "../design";
import { PageHero } from "../ui";
import { PilotForm } from "./pilot-form";
import { JsonLd, breadcrumb } from "../jsonld";
import { GettingStarted } from "../next-steps";
export const metadata = pageMetadata(
  "Pricing & the free POS pilot",
  "Try the full Surge POS during the free pilot. No card required. Tell us about your business so we can confirm fit and setup availability.",
  "/pricing",
);
export default function PricingPage() {
  return (
    <>
      <JsonLd data={breadcrumb("Pricing & free pilot", "/pricing")} />
      <PageHero
        crumb="The Surge pilot"
        title="Get to know your next POS."
        sub="Try the full POS during our free pilot. Put it to work with your team, tell us what could be better, and help shape what comes next."
      />
      <div className="s-wrap s-pilot-grid">
        <div>
          <div className="s-pilot-card">
            <span className="s-badge">Pilot program</span>
            <div className="s-pilot-price">Free.</div>
            <p>Full POS software during the pilot.</p>
            <Checklist
              items={[
                "Register, menus and modifiers",
                "Floor plan and kitchen display",
                "Inventory and purchasing",
                "Staff, permissions and time tracking",
                "Reports and daily operations",
              ]}
            />
            <p className="s-small">
              No card required to apply. Card processing and payment terminals
              are coming soon and are not included.
            </p>
          </div>
          <aside className="s-note">
            <strong>A clear starting point.</strong>
            <p>
              This is a limited pilot, not a published long-term price.
              Post-pilot pricing and an end date have not been announced. We’ll
              discuss the current terms and confirm setup availability before
              you begin.
            </p>
          </aside>
        </div>
        <div className="s-form-shell" id="apply">
          <PilotForm />
          <p className="s-form-help">
            International enquiry? Include your country and time zone in the
            notes so we can confirm fit and setup options.
          </p>
        </div>
      </div>
      <GettingStarted />
      <Faq
        items={[
          {
            q: "What does free mean here?",
            a: "The POS software is free during the pilot. Applying does not create a paid subscription. Devices, your existing payment processing and any other separate arrangements are not included in that statement.",
          },
          {
            q: "What happens after the pilot?",
            a: "Post-pilot pricing has not been published. Ask us about the current pilot terms and how any future change would be communicated before you start.",
          },
          {
            q: "Will you set up my business?",
            a: "We’ll talk through your menu, devices, country and workflow, then confirm what setup support is available for your pilot. On-site options depend on your location.",
          },
          {
            q: "Do I need new payment equipment?",
            a: "No Surge payment terminal is available today. Keep your existing processor separate and check device compatibility with us before purchasing hardware.",
          },
        ]}
      />
      <ClosingCta
        title="Prefer a walkthrough first?"
        description="See the menu, register and day-to-day workflows before deciding whether to apply."
      />
    </>
  );
}
