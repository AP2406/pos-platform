import { ApplyForm } from "./apply-form";

export const dynamic = "force-dynamic";

// Public branded intake. /apply or /apply/<repCode> (rep attribution via the link).
export default async function ApplyPage({ params }: { params: Promise<{ rep?: string[] }> }) {
  const { rep } = await params;
  const repCode = Array.isArray(rep) && rep.length > 0 ? rep[0] : null;
  return <ApplyForm repCode={repCode} />;
}
