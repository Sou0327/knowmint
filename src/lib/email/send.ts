/**
 * Resend REST API 経由でメール送信 (Cloudflare Workers 互換)
 * resend SDK は Node.js https モジュールを使うため Workers 非対応。
 * RESEND_API_KEY 未設定時はスキップ — 購入フローをブロックしない。
 */
export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn("[email] RESEND_API_KEY not configured, skipping email");
    return;
  }
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM ?? "noreply@knowmint.shop",
      ...opts,
    }),
  }).then(
    (res) => {
      if (!res.ok) console.error(`[email] send failed: HTTP ${res.status}`);
    },
    (err: unknown) => console.error("[email] send failed:", err)
  );
}
