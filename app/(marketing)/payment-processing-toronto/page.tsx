import { permanentRedirect } from "next/navigation";

// RETIRED: THIS URL IS NOW A PERMANENT REDIRECT TO /pos.
//
// The page that was here led with "A point of sale for Toronto — payment
// processing coming soon", and named King West, Scarborough and Kensington
// Market in its opening line. It was doubly wrong for where the company is
// going: named for one city, and named for payment processing, which we do not
// do. Both halves of the query it ranked for are things we cannot serve.
//
// NOT DELETED — REDIRECTED. The URL had rankings and inbound context, and a
// 404 throws that away. /pos is the closest surviving CONTENT match: the same
// visitor, wanting a system for their counter, minus the geography. It is not
// /pricing, because a redirect landing straight on the sign-up page reads as a
// funnel rather than an answer; /pos links to /pricing twice.
//
// TWO MECHANISMS ON PURPOSE. next.config.ts carries the same three redirects,
// which is what actually serves the 308 — it runs at the edge before routing,
// so this component never renders in practice. This file is the backstop: it
// keeps the redirect attached to the route itself, so the URL cannot quietly
// start serving a city landing page again if the config is ever edited.
// `permanentRedirect` is 308, matching `permanent: true` in the config.
//
// The route is also gone from app/sitemap.ts and from the footer link group in
// app/(marketing)/layout.tsx — a sitemap should never list a redirect, and an
// internal link to a 308 spends crawl budget on a hop.
export default function PaymentProcessingTorontoPage(): never {
  permanentRedirect("/pos");
}
