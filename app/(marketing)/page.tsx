import Link from "next/link";
import { ArrowRight, Tablet, LayoutGrid, Utensils, Users } from "lucide-react";
import {
  Hero,
  Photo,
  SectionHeading,
  FeatureGrid,
  Checklist,
  Faq,
  ClosingCta,
  PaymentsPreview,
  Action,
  pageMetadata,
} from "./design";
import { ProductPreview } from "./product-preview";
import { GettingStarted, ExploreNext } from "./next-steps";
export const metadata = pageMetadata(
  "Point of sale. Room to do more.",
  "A thoughtful POS for restaurants, cafes and retail. Bring your menu, orders, inventory and team together. Explore the free pilot.",
  "/",
);
const industries = [
  {
    title: "Restaurants",
    photo: "service" as const,
    href: "/pos-for-restaurants",
    body: "From the first table to the last ticket. Keep service moving.",
  },
  {
    title: "Cafes & quick service",
    photo: "cafe" as const,
    href: "/solutions/cafes",
    body: "Your regulars, their usual, and a counter that keeps up.",
  },
  {
    title: "Retail & shops",
    photo: "retail" as const,
    href: "/pos-for-retail",
    body: "Stay close to your customers. Stay on top of your stock.",
  },
];
export default function Home() {
  return (
    <>
      <Hero
        eyebrow="Point of sale, with people in mind"
        title={"Your business.\nIn good hands."}
        description="A thoughtfully simple POS for the people behind great restaurants, cafes and shops. Bring your counter, team and daily operations together."
        photo="owner"
        caption="Built around the people who make a business work."
        showcase
      />
      <div className="s-wrap s-ribbon">
        <span>
          <Tablet size={18} aria-hidden="true" />A lighter setup
        </span>
        <span>
          <LayoutGrid size={18} aria-hidden="true" />
          Your menu, your way
        </span>
        <span>
          <Utensils size={18} aria-hidden="true" />
          Floor to kitchen
        </span>
        <span>
          <Users size={18} aria-hidden="true" />
          One connected team
        </span>
      </div>
      <section className="s-wrap s-section">
        <SectionHeading
          eyebrow="However you serve"
          title="Different businesses. The same attention to detail."
          description="Choose the tools that fit your day, whether it starts with a morning rush or ends with a full dining room."
        />
        <div className="s-industry-grid">
          {industries.map((item) => (
            <Link key={item.href} href={item.href} className="s-industry" data-reveal>
              <Photo name={item.photo} sizes="(min-width: 900px) 33vw, 100vw" />
              <h3>
                {item.title}
                <ArrowRight size={20} aria-hidden="true" />
              </h3>
              <p>{item.body}</p>
            </Link>
          ))}
        </div>
      </section>
      <div className="s-surface">
        <section className="s-wrap s-section">
          <SectionHeading
            eyebrow="The details, taken care of"
            title="Less to juggle. More room to run."
          />
          <FeatureGrid
            items={[
              {
                icon: "menu",
                detail: "Categories · Modifiers · Availability",
                title: "A menu that feels like yours",
                body: "Organize categories, set modifiers and manage availability without rebuilding the whole menu.",
              },
              {
                icon: "floor",
                detail: "Tables · Seats · Kitchen tickets",
                title: "A clear view of service",
                body: "Keep tables, orders and kitchen tickets connected, with the context your team needs.",
              },
              {
                icon: "stock",
                detail: "Inventory · Purchasing · Adjustments",
                title: "Know what’s on hand",
                body: "Bring inventory, purchasing and stock adjustments into the same daily workflow.",
              },
              {
                icon: "team",
                detail: "Roles · Shifts · Time tracking",
                title: "Give everyone their place",
                body: "Set staff permissions and manage shifts, time tracking and responsibilities.",
              },
              {
                icon: "reports",
                detail: "Sales · Item performance · Exports",
                title: "Look beyond the receipt",
                body: "Use reports and exports to understand your sales, popular items and daily operations.",
              },
              {
                icon: "locations",
                detail: "Location access · Local workflows",
                title: "Keep each location in view",
                body: "Move between locations with the right permissions and keep each business’s work organized.",
              },
            ]}
          />
        </section>
      </div>
      <ProductPreview />
      <section className="s-wrap s-section s-split" data-reveal>
        <Photo name="team" />
        <div>
          <p className="s-eyebrow">Built for the team behind it all</p>
          <h2>Good service starts on your side of the counter.</h2>
          <p>
            Give your team a clear place to work, from a compact tablet at the
            counter to a handheld device on the floor. We’ll talk through your
            devices and workflow before setup.
          </p>
          <Checklist
            items={[
              "A familiar place for everyday tasks",
              "Roles and permissions for your team",
              "Help planning your menu and setup",
            ]}
          />
          <div className="s-actions">
            <Action href="/setup-and-support" secondary>
              Find your setup
            </Action>
          </div>
        </div>
      </section>
      <GettingStarted />
      <PaymentsPreview />
      <Faq
        items={[
          {
            q: "Can I try Surge with my business?",
            a: "Yes. Apply for the free POS pilot and tell us about your business. We’ll confirm fit, device requirements and setup availability before you start.",
          },
          {
            q: "Do I need to change my payment processor?",
            a: "No. Your existing processor remains separate during the pilot. Surge card processing and payment terminals are coming soon and are not available today.",
          },
          {
            q: "Can I use a tablet or iPad mini?",
            a: "Surge is designed around a flexible tablet setup. Tell us the device model, operating system and peripherals you have so we can confirm compatibility before you buy or change anything.",
          },
          {
            q: "Is Surge available in my country?",
            a: "Surge serves an international audience. Share your country, time zone and business needs so we can confirm pilot and support availability for your setup.",
          },
        ]}
      />
      <ExploreNext />
      <ClosingCta />
    </>
  );
}
