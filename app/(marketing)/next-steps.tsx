import Link from "next/link";
import { ArrowRight, ListChecks, Tablet, MessagesSquare } from "lucide-react";
import { SectionHeading } from "./design";

const steps = [
  {
    title: "Start with your business.",
    body: "Bring your menu or product list and show us how the day runs. We’ll use your everyday tasks to guide the conversation.",
    detail: "Your menu · Your service style",
    icon: MessagesSquare,
  },
  {
    title: "Make the setup make sense.",
    body: "Review your tablets, printers, team roles and country requirements. Confirm what fits before buying hardware or changing systems.",
    detail: "Devices · Permissions · Local needs",
    icon: Tablet,
  },
  {
    title: "Put the workflow to work.",
    body: "Walk through an order, a kitchen ticket and a daily report. Agree on the pilot scope and give your team room to get familiar.",
    detail: "Practice · Pilot · Feedback",
    icon: ListChecks,
  },
];

export function GettingStarted() {
  return (
    <section className="s-onboarding">
      <div className="s-wrap s-section">
        <div className="s-heading-row">
          <SectionHeading
            eyebrow="A considered start"
            title="From a first look to your first service."
            description="You know your business. We’ll help you work through the setup, one practical step at a time."
          />
          <Link href="/setup-and-support" className="s-text-link">
            How setup works <ArrowRight size={17} aria-hidden="true" />
          </Link>
        </div>
        <ol className="s-onboarding-grid">
          {steps.map(({ title, body, detail, icon: Icon }, index) => (
            <li key={title}>
              <div className="s-step-top">
                <span>0{index + 1}</span>
                <Icon size={22} strokeWidth={1.4} aria-hidden="true" />
              </div>
              <h3>{title}</h3>
              <p>{body}</p>
              <small>{detail}</small>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

const resources = [
  {
    href: "/pos-hardware",
    label: "YOUR SETUP",
    title: "Less hardware. More room.",
    body: "Think through counter tablets, handheld devices and the details around them.",
    icon: Tablet,
  },
  {
    href: "/switching-to-surge",
    label: "YOUR NEXT STEP",
    title: "Make the move thoughtfully.",
    body: "A practical checklist for your menu, data, devices and team.",
    icon: ListChecks,
  },
  {
    href: "/book",
    label: "YOUR QUESTIONS",
    title: "See it with your business in mind.",
    body: "Walk through the work you do every day and explore the free pilot.",
    icon: MessagesSquare,
  },
];

export function ExploreNext({ current }: { current?: string }) {
  return (
    <section className="s-explore-next">
      <div className="s-wrap s-section">
        <div className="s-heading-row">
          <SectionHeading
            eyebrow="A little more to explore"
            title="Make an informed next move."
          />
        </div>
        <div className="s-resource-grid">
          {resources
            .filter((item) => item.href !== current)
            .map(({ href, label, title, body, icon: Icon }) => (
              <Link className="s-resource-card" href={href} key={href}>
                <div className="s-resource-top">
                  <Icon size={23} strokeWidth={1.4} aria-hidden="true" />
                  <span>{label}</span>
                </div>
                <h3>{title}</h3>
                <p>{body}</p>
                <span className="s-resource-arrow" aria-hidden="true">
                  <ArrowRight size={19} />
                </span>
              </Link>
            ))}
        </div>
      </div>
    </section>
  );
}
