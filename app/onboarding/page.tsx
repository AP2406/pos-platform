import { requireUser, getCurrentBusiness } from "@/lib/services/tenancy";
import { redirect } from "next/navigation";
import { OnboardingForm } from "./form";

export default async function OnboardingPage() {
  await requireUser();
  const ctx = await getCurrentBusiness();
  if (ctx) redirect("/app"); // Already onboarded — skip to the app

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
      <OnboardingForm />
    </div>
  );
}