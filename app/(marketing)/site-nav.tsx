"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Menu,
  X,
  ChevronDown,
  ArrowUpRight,
  Utensils,
  Coffee,
  ShoppingBag,
  MapPin,
  Tablet,
  ListChecks,
  BookOpen,
  MessagesSquare,
} from "lucide-react";
import { SurgeIcon } from "@/components/brand/surge-logo";

const groups = [
  {
    label: "Solutions",
    items: [
      {
        label: "Restaurants",
        href: "/pos-for-restaurants",
        body: "From the floor to the kitchen.",
        icon: Utensils,
      },
      {
        label: "Cafes & quick service",
        href: "/solutions/cafes",
        body: "Keep the counter moving.",
        icon: Coffee,
      },
      {
        label: "Retail & shops",
        href: "/pos-for-retail",
        body: "Your products, stock and people.",
        icon: ShoppingBag,
      },
      {
        label: "Multiple locations",
        href: "/solutions/multi-location",
        body: "Keep each business in view.",
        icon: MapPin,
      },
    ],
  },
  {
    label: "Resources",
    items: [
      {
        label: "Tablets & hardware",
        href: "/pos-hardware",
        body: "A setup that suits your space.",
        icon: Tablet,
      },
      {
        label: "Setup & support",
        href: "/setup-and-support",
        body: "Get the essentials in place.",
        icon: ListChecks,
      },
      {
        label: "Business guides",
        href: "/guides",
        body: "Clear answers to useful questions.",
        icon: BookOpen,
      },
      {
        label: "Contact us",
        href: "/contact",
        body: "Let’s talk about your business.",
        icon: MessagesSquare,
      },
    ],
  },
];
export function SiteNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const toggle = useRef<HTMLButtonElement>(null);
  const header = useRef<HTMLElement>(null);
  function closeDropdowns() {
    header.current
      ?.querySelectorAll("details[open]")
      .forEach((item) => item.removeAttribute("open"));
  }
  function closeNavigation() {
    setOpen(false);
    closeDropdowns();
  }
  useEffect(() => {
    function escape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      const dropdown =
        header.current?.querySelector<HTMLDetailsElement>("details[open]");
      if (dropdown) {
        dropdown.open = false;
        dropdown.querySelector("summary")?.focus();
      }
      if (open) {
        setOpen(false);
        toggle.current?.focus();
      }
    }
    function outside(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !header.current?.contains(event.target)
      )
        closeDropdowns();
    }
    document.addEventListener("keydown", escape);
    document.addEventListener("pointerdown", outside);
    return () => {
      document.removeEventListener("keydown", escape);
      document.removeEventListener("pointerdown", outside);
    };
  }, [open]);
  // `surge-site` is on the element itself rather than on a wrapper: this
  // header is `position: sticky`, and a wrapper div would become its
  // containing block and stop it travelling.
  return (
    <header className="s-header surge-site" ref={header}>
      <div className="s-announcement">
        <span className="s-announcement-dot" aria-hidden="true" /> Meet your
        next POS.{" "}
        <Link href="/pricing" onClick={closeNavigation}>
          Explore the free pilot
        </Link>{" "}
        <span aria-hidden="true">↗</span>
      </div>
      <div className="s-wrap s-nav">
        <Link
          href="/"
          aria-label="Surge home"
          className="s-brand"
          onClick={closeNavigation}
        >
          <SurgeIcon tone="light" size={32} title={null} />
          Surge
        </Link>
        <nav aria-label="Main navigation" className="s-nav-links">
          <Link
            href="/pos"
            aria-current={pathname === "/pos" ? "page" : undefined}
            onClick={closeNavigation}
          >
            Product
          </Link>
          {groups.map((group) => (
            <details
              className="s-nav-dropdown"
              name="surge-navigation"
              key={group.label}
              onBlur={(event) => {
                if (
                  event.relatedTarget instanceof Node &&
                  !event.currentTarget.contains(event.relatedTarget)
                )
                  event.currentTarget.open = false;
              }}
            >
              <summary>
                {group.label}
                <ChevronDown size={13} aria-hidden="true" />
              </summary>
              <div className="s-dropdown-panel">
                <span className="s-dropdown-heading">
                  {group.label === "Solutions"
                    ? "BUILT AROUND YOUR BUSINESS"
                    : "PLAN YOUR NEXT STEP"}
                </span>
                <div>
                  {group.items.map(({ label, href, body, icon: Icon }) => (
                    <Link
                      key={href}
                      href={href}
                      aria-current={pathname === href ? "page" : undefined}
                      onClick={closeNavigation}
                    >
                      <span className="s-dropdown-icon">
                        <Icon size={20} strokeWidth={1.5} aria-hidden="true" />
                      </span>
                      <span>
                        <strong>{label}</strong>
                        <small>{body}</small>
                      </span>
                      <ArrowUpRight size={15} aria-hidden="true" />
                    </Link>
                  ))}
                </div>
                <Link
                  className="s-dropdown-footer"
                  href={
                    group.label === "Solutions" ? "/pos" : "/switching-to-surge"
                  }
                  onClick={closeNavigation}
                >
                  {group.label === "Solutions"
                    ? "Explore the full POS"
                    : "Thinking about switching?"}
                  <ArrowUpRight size={14} aria-hidden="true" />
                </Link>
              </div>
            </details>
          ))}
          <Link
            href="/pricing"
            aria-current={pathname === "/pricing" ? "page" : undefined}
            onClick={closeNavigation}
          >
            Pricing
          </Link>
        </nav>
        <div className="s-nav-actions">
          <Link href="/login">Sign in</Link>
          <Link href="/book" className="s-button">
            Book a demo <ArrowUpRight size={15} aria-hidden="true" />
          </Link>
        </div>
        <button
          ref={toggle}
          type="button"
          className="s-menu-toggle"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls="mobile-navigation"
          onClick={() => setOpen(!open)}
        >
          {open ? (
            <X size={20} aria-hidden="true" />
          ) : (
            <Menu size={20} aria-hidden="true" />
          )}
        </button>
      </div>
      <nav
        id="mobile-navigation"
        aria-label="Mobile navigation"
        className="s-wrap s-mobile-nav"
        hidden={!open}
      >
        <div className="s-mobile-primary">
          {[
            ["Product", "/pos"],
            ["Pricing & free pilot", "/pricing"],
          ].map(([label, href]) => (
            <Link key={href} href={href} onClick={closeNavigation}>
              {label}
              <ArrowUpRight size={15} aria-hidden="true" />
            </Link>
          ))}
        </div>
        {groups.map((group) => (
          <div className="s-mobile-group" key={group.label}>
            <span>{group.label}</span>
            {group.items.map(({ label, href }) => (
              <Link
                key={href}
                href={href}
                aria-current={pathname === href ? "page" : undefined}
                onClick={closeNavigation}
              >
                {label}
              </Link>
            ))}
          </div>
        ))}
        <div className="s-mobile-actions">
          <Link href="/login" onClick={closeNavigation}>
            Sign in
          </Link>
          <Link className="s-button" href="/book" onClick={closeNavigation}>
            Book a demo <ArrowUpRight size={15} aria-hidden="true" />
          </Link>
        </div>
      </nav>
    </header>
  );
}
