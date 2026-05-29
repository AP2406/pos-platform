import { FinixPingButton } from "./finix-ping-button";
import { FinixChargeForm } from "./finix-charge-form";

export default function DebugPage() {
  return (
    <div className="max-w-3xl mx-auto p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold mb-2">Debug</h1>
        <p className="text-sm text-muted-foreground">
          Internal tools to test integrations.
        </p>
      </div>

      <div className="bg-card border border-border rounded-lg p-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Finix sandbox connectivity</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Pings the /identities endpoint to confirm auth and credentials work.
          </p>
        </div>
        <FinixPingButton />
      </div>

      <div className="bg-card border border-border rounded-lg p-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Finix test charge</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Charge a sandbox test card against the Surge Application Owner merchant.
            Routes funds through Finix → records the transfer in the finix_payments table.
          </p>
        </div>
        <FinixChargeForm />
      </div>
    </div>
  );
}