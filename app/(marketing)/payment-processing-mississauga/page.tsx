import { permanentRedirect } from "next/navigation";

// RETIRED: THIS URL IS NOW A PERMANENT REDIRECT TO /pos.
//
// Same reasoning as /payment-processing-toronto, which carries the full note.
// This page opened on "a Square One kiosk, a Port Credit restaurant, a
// Meadowvale plaza shop" and promised same-day on-site setup. Neither the city
// nor the payment-processing half of the slug is something we can serve.
//
// 308 to /pos rather than a 404 or a rewrite: the URL ranked, and /pos answers
// the surviving part of the question. next.config.ts serves the redirect at
// the edge; this is the route-level backstop.
export default function PaymentProcessingMississaugaPage(): never {
  permanentRedirect("/pos");
}
