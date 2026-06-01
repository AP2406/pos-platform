import { SetupClient } from "./setup-client";

export default function SetupPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">AI Setup</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Describe your business and generate a tailored setup.
        </p>
      </div>
      <SetupClient />
    </div>
  );
}