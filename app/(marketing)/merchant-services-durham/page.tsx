import { permanentRedirect } from "next/navigation";

// RETIRED: THIS URL IS NOW A PERMANENT REDIRECT TO /pos.
//
// Same reasoning as /payment-processing-toronto, which carries the full note.
// This one was the closest of the three to defensible — "merchant services" is
// broad enough that a point of sale genuinely is one — but the page said
// "set up in person by someone who lives here" and named Pickering, Ajax,
// Whitby and Oshawa in the H1 and the intro. That is a residency claim, not a
// keyword, and it is the one sentence on the old site that an international
// buyer would have been most misled by.
//
// 308 to /pos. next.config.ts serves it at the edge; this is the backstop.
export default function MerchantServicesDurhamPage(): never {
  permanentRedirect("/pos");
}
