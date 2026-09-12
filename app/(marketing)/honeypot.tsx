"use client";

import type { RefObject } from "react";
import { HONEYPOT_FIELD } from "@/lib/services/form-throttle";

// The honeypot field shared by /contact, /book and the pilot sign-up.
//
// NOT `display:none`, AND NOT the `hidden` attribute. Both are the first thing a
// form-filling bot checks — anything invisible by those two properties gets
// skipped, which is exactly backwards. The clip-rect below is the standard
// sr-only recipe: the input stays a real, laid-out element with a computed style
// of `display:block; visibility:visible`, so a naive DOM walker sees an ordinary
// text input called "website" and fills it. That is the whole trick.
//
// Why it is still invisible to a human AND to a screen reader:
//   - clipped to a 1px box out of the flow, so nothing renders and nothing shifts;
//   - aria-hidden on the wrapper, so label and input leave the accessibility
//     tree entirely. A bare sr-only field WOULD be announced, so aria-hidden is
//     not optional here;
//   - tabIndex -1, so it is unreachable by keyboard. aria-hidden on a focusable
//     element is an a11y violation — taking it out of the tab order is what
//     makes the pairing legal;
//   - autoComplete="off", and a field name browser password managers have no
//     mapping for, so Safari/Chrome autofill cannot turn a real visitor into a
//     false positive.
//
// READ BY REF, NOT BY STATE. These forms post a plain object rather than
// FormData, so the value has to be collected at submit time — and a ref reads
// the live DOM node, which also catches the common bot that assigns `.value`
// directly without dispatching the event React's onChange depends on.
//
// A visitor who defeats all of the above (CSS stripped, reader mode, some
// scraping proxy) and types into it is silently dropped. That is the accepted
// cost, and it is why this is one signal of three rather than the whole defence.
export function HoneypotField({ formId, inputRef }: { formId: string; inputRef: RefObject<HTMLInputElement | null> }) {
  const id = "hp-" + formId + "-" + HONEYPOT_FIELD;
  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        width: "1px",
        height: "1px",
        padding: 0,
        margin: "-1px",
        overflow: "hidden",
        clip: "rect(0, 0, 0, 0)",
        whiteSpace: "nowrap",
        border: 0,
      }}
    >
      <label htmlFor={id}>Website</label>
      <input id={id} name={HONEYPOT_FIELD} type="text" autoComplete="off" tabIndex={-1} ref={inputRef} defaultValue="" />
    </div>
  );
}
