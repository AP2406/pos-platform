import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

export function isEmailConfigured(): boolean {
  return resend !== null;
}

export async function sendEmail(input: {
  to: string;
  from?: string;
  replyTo?: string;
  subject: string;
  html: string;
}): Promise<{ ok: true; id: string } | { error: string }> {
  if (!resend) {
    return { error: "Email service is not configured." };
  }

  try {
    const result = await resend.emails.send({
      from: input.from ?? "Surge <onboarding@resend.dev>",
      to: input.to,
      replyTo: input.replyTo,
      subject: input.subject,
      html: input.html,
    });

    if (result.error) {
      console.error("sendEmail:", result.error);
      return { error: result.error.message ?? "Email failed to send." };
    }

    return { ok: true, id: result.data?.id ?? "unknown" };
  } catch (err) {
    console.error("sendEmail exception:", err);
    return { error: "Email service threw an exception." };
  }
}