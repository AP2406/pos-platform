import type { ReactNode } from "react";

// FORM FIELD PRIMITIVES.
//
// These exist so that the accessibility decisions are made once instead of per
// form. The three marketing forms (/contact, /book, the pilot sign-up) each
// re-derived their own label, hint and error markup, and they do not agree with
// each other — one of them prints its error in Tailwind red-600, which is 4.0:1
// on white and fails AA at the size it renders.
//
// What is fixed here:
//   * THE LABEL IS ALWAYS VISIBLE. DESIGN-SYSTEM.md requires it on mobile too;
//     a placeholder is not a label — it disappears the moment someone types.
//   * ERRORS ARE ASSOCIATED, NOT JUST PRINTED. aria-invalid on the control and
//     the message id in aria-describedby, so a screen reader announces the
//     failure against the field that failed rather than as loose text.
//   * HINT BEFORE ERROR in aria-describedby. Reverse that order and the field's
//     help text vanishes the moment it fails validation.
//   * 44px MINIMUM HEIGHT and a 3.04:1 border (--surge-border-control). The
//     card hairline is 1.31:1, right for a card edge and under WCAG 1.4.11's
//     3:1 for the edge of a control.
//   * THE ERROR IS NOT COLOUR ALONE — a red ring is accompanied by a sentence.
//
// These primitives are wired into /contact, /book and /pricing in Phase 2 when
// those three pages are rebuilt; the forms they replace keep working meanwhile.

export const fieldBase =
  "w-full rounded-[var(--surge-radius-control)] border bg-[var(--surge-surface)] px-4 py-3 text-[length:var(--surge-small)] text-[var(--surge-ink)] outline-none transition-colors duration-[var(--surge-motion)] min-h-[var(--surge-control-min)]";

export const fieldOk = fieldBase + " border-[var(--surge-border-control)]";
export const fieldBad = fieldBase + " border-[var(--surge-danger)]";

/**
 * Builds aria-describedby. Hint first so it survives a validation failure;
 * undefined rather than "" when there is nothing to point at, because an empty
 * aria-describedby is a broken reference.
 */
export function describedBy(field: string, hasError: boolean, hintId?: string): string | undefined {
  const ids: string[] = [];
  if (hintId) ids.push(hintId);
  if (hasError) ids.push(field + "-error");
  return ids.length ? ids.join(" ") : undefined;
}

export function Field({
  id,
  label,
  optional = false,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  optional?: boolean;
  hint?: string;
  error?: string;
  /** The control itself — rendered by the caller so it can own its value/onChange. */
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-[length:var(--surge-small)] font-semibold text-[var(--surge-ink)]">
        {label}
        {optional ? <span className="font-normal text-[var(--surge-muted)]"> (optional)</span> : null}
      </label>
      <div className="mt-1.5">{children}</div>
      {hint ? (
        <p id={id + "-hint"} className="mt-1.5 text-[length:var(--surge-micro)] text-[var(--surge-muted)]">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={id + "-error"} className="mt-1.5 text-[length:var(--surge-micro)] font-semibold text-[var(--surge-danger)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * The form-level failure summary.
 *
 * role="alert" and ABOVE the fields: a keyboard user who submits and lands back
 * at the top must meet the reason before they tab into the form again. 7.10:1
 * on the soft red panel.
 */
export function FormAlert({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="rounded-[var(--surge-radius-control)] border border-[var(--surge-danger)] bg-[var(--surge-danger-soft)] px-4 py-3 text-[length:var(--surge-small)] font-semibold text-[var(--surge-danger)]">
      {children}
    </p>
  );
}

/**
 * The success state.
 *
 * role="status" plus tabIndex -1 so the caller can move focus here when it
 * replaces the form — without that, a screen-reader user submits and is left
 * standing on a button that no longer exists. NEVER render this without a
 * backend success: the launch rules forbid a faked confirmation.
 */
export function FormSuccess({ title, children, innerRef }: { title: string; children?: ReactNode; innerRef?: React.Ref<HTMLDivElement> }) {
  return (
    <div
      ref={innerRef}
      tabIndex={-1}
      role="status"
      className="rounded-[var(--surge-radius-card)] border border-[var(--surge-border)] bg-[var(--surge-canvas)] p-[var(--surge-space-6)] outline-none"
    >
      <h3 className="text-[length:var(--surge-h3)] font-bold text-[var(--surge-ink)]">{title}</h3>
      {children ? <div className="mt-2 text-[length:var(--surge-small)] leading-[var(--surge-leading-body)] text-[var(--surge-muted)]">{children}</div> : null}
    </div>
  );
}
