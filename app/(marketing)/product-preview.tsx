"use client";
import { useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import {
  ArrowRight,
  LayoutGrid,
  ListOrdered,
  SlidersHorizontal,
  BarChart3,
  Search,
  ChevronDown,
  Check,
  Coffee,
  Salad,
  Sandwich,
  GlassWater,
  Utensils,
  Clock3,
} from "lucide-react";
import { SurgeIcon } from "@/components/brand/surge-logo";

const tabs = [
  {
    label: "Orders",
    icon: ListOrdered,
    title: "The little details stay with the order.",
    body: "Keep items, modifiers and table context together. Give the kitchen a clear ticket and your team a familiar place to work.",
    tags: ["Order notes", "Modifiers", "Kitchen routing"],
  },
  {
    label: "Menu builder",
    icon: SlidersHorizontal,
    title: "A menu that keeps up with your day.",
    body: "Group your menu the way your team thinks. Put prices, reusable extras and item availability in one clear workspace.",
    tags: ["Categories", "Modifier groups", "Availability"],
  },
  {
    label: "Floor plan",
    icon: LayoutGrid,
    title: "A better feel for the whole room.",
    body: "See tables and service status in context. Keep seats, courses and order details close as your team moves through service.",
    tags: ["Table layout", "Seats & guests", "Service status"],
  },
  {
    label: "Reports",
    icon: BarChart3,
    title: "Close the day with a clearer picture.",
    body: "Review sales and popular items, understand the shape of service and export the detail you need for your next decision.",
    tags: ["Sales overview", "Item performance", "Exports"],
  },
];
const menu = [
  { name: "House burger", category: "Kitchen", price: "18.00", icon: Sandwich },
  { name: "Garden salad", category: "Kitchen", price: "12.00", icon: Salad },
  { name: "Flat white", category: "Bar", price: "4.50", icon: Coffee },
  { name: "Iced tea", category: "Bar", price: "4.00", icon: GlassWater },
];

function OrdersScreen() {
  return (
    <div className="s-register-layout">
      <div>
        <div className="s-ui-search">
          <Search size={13} aria-hidden="true" /> Find an item
        </div>
        <div className="s-ui-categories">
          <span className="is-selected">All items</span>
          <span>Food</span>
          <span>Drinks</span>
        </div>
        <div className="s-register-items">
          {menu.map(({ name, category, price, icon: Icon }) => (
            <div className="s-register-item" key={name}>
              <div className="s-item-art">
                <Icon size={31} strokeWidth={1.15} aria-hidden="true" />
              </div>
              <strong>{name}</strong>
              <div>
                <small>{category}</small>
                <span>{price}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="s-ui-hint">
          <Utensils size={12} aria-hidden="true" /> The right details, from
          counter to kitchen.
        </div>
      </div>
      <div className="s-ticket-detail">
        <div className="s-ticket-heading">
          <span>TABLE 04</span>
          <span>2 guests</span>
        </div>
        <strong className="s-ticket-title">Current order</strong>
        <small>Order #1042 · Dine in</small>
        <div className="s-ticket-lines">
          <div>
            <span>
              <b>1</b> House burger<small>No onions · Fries</small>
            </span>
            <strong>18.00</strong>
          </div>
          <div>
            <span>
              <b>1</b> Garden salad<small>Dressing on the side</small>
            </span>
            <strong>12.00</strong>
          </div>
          <div>
            <span>
              <b>2</b> Iced tea
            </span>
            <strong>8.00</strong>
          </div>
        </div>
        <div className="s-ticket-total">
          <span>Subtotal</span>
          <strong>38.00</strong>
        </div>
        <div className="s-ticket-note">
          <Clock3 size={12} aria-hidden="true" /> Take your time with the mains
        </div>
        <div className="s-ui-confirm">
          <Check size={13} aria-hidden="true" /> Sent to kitchen
        </div>
      </div>
    </div>
  );
}

function MenuScreen() {
  return (
    <div className="s-menu-editor">
      <div>
        <div className="s-ui-section-label">
          <strong>Main menu</strong>
          <span>4 items</span>
        </div>
        <div className="s-ui-categories">
          <span className="is-selected">All items</span>
          <span>Food</span>
          <span>Drinks</span>
        </div>
        <div className="s-catalog-head">
          <span>ITEM</span>
          <span>PRICE</span>
        </div>
        {[
          ["House burger", "Sides · Extras", "18.00", true],
          ["Garden salad", "Dressings", "12.00", true],
          ["Flat white", "Size · Milk", "4.50", true],
          ["Seasonal special", "Daily menu", "16.00", false],
        ].map(([name, detail, price, available], i) => (
          <div
            className={`s-catalog-row${i === 0 ? " is-selected" : ""}`}
            key={String(name)}
          >
            <div>
              <strong>{name}</strong>
              <small>{detail}</small>
              <span className={`s-availability${available ? "" : " is-off"}`}>
                {available ? "Available" : "Sold out"}
              </span>
            </div>
            <span>{price}</span>
          </div>
        ))}
      </div>
      <aside className="s-modifier-editor">
        <span className="s-ui-overline">ITEM DETAILS</span>
        <strong>House burger</strong>
        <p>Make it easy to get the order right.</p>
        <div className="s-editor-field">
          <small>Category</small>
          <span>
            Food <ChevronDown size={12} aria-hidden="true" />
          </span>
        </div>
        <div className="s-editor-field">
          <small>Price</small>
          <span>18.00</span>
        </div>
        <div className="s-ui-section-label">
          <strong>Choose a side</strong>
          <span>Required · 1</span>
        </div>
        <div className="s-modifier-option">
          <span>Fries</span>
          <span>Included</span>
        </div>
        <div className="s-modifier-option">
          <span>Side salad</span>
          <span>+2.00</span>
        </div>
        <div className="s-ui-confirm">
          <Check size={13} aria-hidden="true" /> Available on the menu
        </div>
      </aside>
    </div>
  );
}

function FloorScreen() {
  const occupied = [true, false, true, true, false, false, true, false];
  return (
    <div className="s-floor-layout">
      <div>
        <div className="s-ui-section-label">
          <strong>
            Main floor <ChevronDown size={12} aria-hidden="true" />
          </strong>
          <span>8 tables</span>
        </div>
        <div className="s-floor-legend">
          <span>
            <i /> In service
          </span>
          <span>
            <i /> Available
          </span>
        </div>
        <div className="s-floor-canvas">
          <span className="s-floor-zone">DINING ROOM</span>
          <div className="s-floor-tables">
            {occupied.map((busy, index) => (
              <div
                className={`s-floor-table${busy ? " is-occupied" : ""}${index === 3 ? " is-selected" : ""}`}
                key={index}
              >
                <strong>{String(index + 1).padStart(2, "0")}</strong>
                <small>
                  {busy ? (index === 3 ? "2 guests" : "4 guests") : "Available"}
                </small>
              </div>
            ))}
          </div>
          <span className="s-floor-entrance">ENTRY</span>
        </div>
      </div>
      <aside className="s-table-detail">
        <span className="s-availability">In service</span>
        <strong className="s-ticket-title">Table 04</strong>
        <p>2 guests · Main floor</p>
        <dl>
          <div>
            <dt>Order</dt>
            <dd>#1042</dd>
          </div>
          <div>
            <dt>Seated</dt>
            <dd>18 minutes ago</dd>
          </div>
          <div>
            <dt>Current course</dt>
            <dd>Mains</dd>
          </div>
        </dl>
        <div className="s-table-mini-ticket">
          <strong>At this table</strong>
          <span>1 × House burger</span>
          <span>1 × Garden salad</span>
          <span>2 × Iced tea</span>
        </div>
        <div className="s-ui-confirm">
          <Utensils size={13} aria-hidden="true" /> Kitchen ticket sent
        </div>
      </aside>
    </div>
  );
}

function ReportsScreen() {
  const periods = [
    ["10am", 18],
    ["12pm", 26],
    ["2pm", 14],
    ["4pm", 20],
    ["6pm", 30],
    ["8pm", 16],
  ] as const;
  return (
    <div className="s-reports-screen">
      <div className="s-ui-section-label">
        <strong>Daily overview</strong>
        <span>
          Sample day <ChevronDown size={12} aria-hidden="true" />
        </span>
      </div>
      <div className="s-report-metrics">
        {[
          ["Sales before tax", "3,720.00"],
          ["Orders", "124"],
          ["Average order", "30.00"],
        ].map(([label, value]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <div className="s-report-detail">
        <div className="s-report-chart">
          <strong>Orders by service period</strong>
          <div
            className="s-bars"
            role="img"
            aria-label="Sample orders: 10am 18, 12pm 26, 2pm 14, 4pm 20, 6pm 30, 8pm 16."
          >
            {periods.map(([time, count]) => (
              <div key={time}>
                <small>{count}</small>
                <i style={{ height: `${count * 3}px` }} />
                <span>{time}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="s-top-items">
          <strong>Popular items</strong>
          <span>
            ITEM <span>QTY</span>
          </span>
          {[
            ["House burger", "32"],
            ["Flat white", "24"],
            ["Garden salad", "18"],
          ].map(([name, count], index) => (
            <div key={name}>
              <span>
                <small>0{index + 1}</small>
                {name}
              </span>
              <b>{count}</b>
            </div>
          ))}
          <p>A useful starting point for your next service.</p>
        </div>
      </div>
    </div>
  );
}

export function ProductPreview() {
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next: number;
    if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
    else if (event.key === "ArrowLeft")
      next = (index + tabs.length - 1) % tabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    else return;
    event.preventDefault();
    setActive(next);
    refs.current[next]?.focus();
  }
  return (
    <section className="s-workspace s-wrap s-section" id="workspace">
      <div className="s-heading-row">
        <div className="s-section-heading" data-reveal>
          <p className="s-eyebrow">A closer look at the everyday</p>
          <h2>
            Busy behind the scenes.
            <br />
            Clear on your screen.
          </h2>
          <p>Explore a few of the workflows that bring the day together.</p>
        </div>
        <Link href="/book" className="s-text-link">
          See Surge in a demo <ArrowRight size={17} aria-hidden="true" />
        </Link>
      </div>
      <div className="s-workspace-shell" data-reveal>
        <div
          className="s-tabs s-workspace-tabs"
          role="tablist"
          aria-label="Explore POS workflows"
        >
          {tabs.map(({ label, icon: Icon }, index) => (
            <button
              key={label}
              ref={(element) => {
                refs.current[index] = element;
              }}
              id={`preview-tab-${index}`}
              role="tab"
              type="button"
              aria-selected={active === index}
              aria-controls="product-panel"
              tabIndex={active === index ? 0 : -1}
              onClick={() => setActive(index)}
              onKeyDown={(event) => onKeyDown(event, index)}
            >
              <Icon size={17} strokeWidth={1.6} aria-hidden="true" />
              <span>{label}</span>
            </button>
          ))}
        </div>
        <div
          id="product-panel"
          role="tabpanel"
          aria-labelledby={`preview-tab-${active}`}
          tabIndex={0}
        >
          <div className="s-workspace-layout" key={active}>
            <div className="s-workspace-copy">
              <span className="s-workspace-number">
                0{active + 1} / THE WORKSPACE
              </span>
              <h3>{tabs[active].title}</h3>
              <p>{tabs[active].body}</p>
              <ul>
                {tabs[active].tags.map((tag) => (
                  <li key={tag}>
                    <Check size={14} aria-hidden="true" />
                    {tag}
                  </li>
                ))}
              </ul>
              <Link href="/pos" className="s-text-link">
                Explore the POS <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
            <div className="s-device">
              <div className="s-device-camera" />
              <div className="s-device-screen">
                <div className="s-device-top">
                  <div>
                    <SurgeIcon size={24} tone="light" title={null} />
                    <strong>Surge</strong>
                    <span>/ {tabs[active].label}</span>
                  </div>
                  <span className="s-sample-badge">Sample data</span>
                </div>
                {active === 0 && <OrdersScreen />}
                {active === 1 && <MenuScreen />}
                {active === 2 && <FloorScreen />}
                {active === 3 && <ReportsScreen />}
              </div>
            </div>
          </div>
          <p className="s-workspace-disclaimer">
            Illustrative product preview · Sample business and amounts · Final
            layouts may vary
          </p>
        </div>
      </div>
    </section>
  );
}
