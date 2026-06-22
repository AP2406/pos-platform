// SMS sending behind a feature flag (Twilio). When the env isn't configured,
// isSmsConfigured() is false and callers fall back to email. Never throws on a
// missing config — it just reports not-configured.

export function isSmsConfigured(): boolean {
  return !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM);
}

export async function sendSms(input: { to: string; body: string }): Promise<{ ok: true } | { error: string }> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM;
  if (!sid || !token || !from) return { error: "SMS is not configured." };

  const to = (input.to || "").trim();
  if (!to) return { error: "No phone number." };

  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: "Basic " + Buffer.from(`${sid}:${token}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, From: from, Body: input.body.slice(0, 480) }).toString(),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      console.error("sendSms:", res.status, txt);
      return { error: "Could not send the text." };
    }
    return { ok: true };
  } catch (e) {
    console.error("sendSms:", e);
    return { error: "Could not send the text." };
  }
}
