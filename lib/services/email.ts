type SendInput = { to: string; subject: string; html: string };
type SendResult = { ok: true; id: string | null } | { error: string };

export async function sendEmail(input: SendInput): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { error: "Email is not set up yet (missing RESEND_API_KEY)." };
  }
  const from = process.env.RECEIPT_FROM_EMAIL || "Surge Receipts <onboarding@resend.dev>";

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: from,
        to: [input.to],
        subject: input.subject,
        html: input.html,
      }),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const msg =
        data && data.message ? String(data.message) : "Email send failed (" + res.status + ").";
      return { error: msg };
    }
    return { ok: true, id: data && data.id ? String(data.id) : null };
  } catch (e) {
    console.error("sendEmail:", e);
    return { error: "Could not reach the email service." };
  }
}