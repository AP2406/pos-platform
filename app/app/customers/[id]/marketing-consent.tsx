"use client";

import { useState, useTransition } from "react";
import { setMarketingConsent } from "../../marketing/marketing-actions";

export function MarketingConsent({
  customerId,
  initialConsent,
  hasEmail,
  canEdit,
}: {
  customerId: string;
  initialConsent: boolean;
  hasEmail: boolean;
  canEdit: boolean;
}) {
  const [consent, setConsent] = useState(initialConsent);
  const [pending, startTransition] = useTransition();

  function toggle(next: boolean) {
    setConsent(next);
    startTransition(async () => {
      const res = await setMarketingConsent(customerId, next);
      if ("error" in res) setConsent(!next);
    });
  }

  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <div className="text-sm font-medium">Email marketing</div>
        <p className="text-xs text-muted-foreground">
          {hasEmail
            ? "Only opted-in customers receive campaigns. Keep this off unless they agreed."
            : "Add an email to this customer to enable marketing."}
        </p>
      </div>
      <label className="flex items-center gap-2 text-sm shrink-0">
        <input
          type="checkbox"
          checked={consent}
          disabled={!canEdit || !hasEmail || pending}
          onChange={(e) => toggle(e.target.checked)}
          className="h-4 w-4"
        />
        {consent ? "Opted in" : "Not opted in"}
      </label>
    </div>
  );
}
