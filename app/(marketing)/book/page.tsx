import { BookWizard } from "./book-wizard";
import { pageMetadata, Photo, Checklist } from "../design";
import { JsonLd, breadcrumb } from "../jsonld";
export const metadata = pageMetadata(
  "Book a free POS demo",
  "Request a free 15-minute walkthrough of Surge POS, tailored to your business. Explore the menu, register, floor and kitchen workflows.",
  "/book",
);
export default function BookPage() {
  return (
    // marketing.css is scoped under .surge-site, and this element is the
    // scope. It used to be the marketing layout wrapper, which put the home
    // page inside it too.
    <div className="surge-site">
      <section className="s-wrap">
      <JsonLd data={breadcrumb("Book a demo", "/book")} />
      <div className="s-page-intro">
        <p className="s-eyebrow">See it for yourself</p>
        <h1>
          Your business.
          <br />
          Let’s walk through it.
        </h1>
        <p className="s-lede">
          A free 15-minute demo, built around the way you work. Bring your
          everyday questions and we’ll take you through the POS.
        </p>
      </div>
      <div className="s-form-layout">
        <div>
          <Photo name="owner" eager />
          <p className="s-small">
            A practical conversation about your menu, team and setup.
          </p>
        </div>
        <div className="s-book-panel">
          <p className="s-eyebrow">Your walkthrough</p>
          <h2>Make those 15 minutes useful.</h2>
          <Checklist
            items={[
              "Show us how your business runs",
              "Explore the register and menu builder",
              "Talk through your devices and workflow",
              "Ask about pilot and support availability",
            ]}
          />
          <BookWizard />
          <p className="s-small">
            No commitment. We’ll confirm a suitable time with you.
          </p>
          <div className="s-note">
            <strong>POS today. Payments coming soon.</strong>
            <p>
              The demo covers the POS software. Surge card processing and
              payment terminals are in development.
            </p>
          </div>
        </div>
      </div>
      </section>
    </div>
  );
}
