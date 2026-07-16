import nodemailer from "nodemailer";

const GMAIL_SENDER       = process.env.GMAIL_SENDER ?? "";
const GMAIL_APP_PASSWORD = (process.env.GMAIL_APP_PASSWORD ?? "").replace(/\s/g, "");

const NOTIFY_EMAILS = (process.env.NOTIFY_EMAILS ?? "")
  .split(",").map((e) => e.trim()).filter(Boolean);

let _transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (!_transporter) {
    _transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: { user: GMAIL_SENDER, pass: GMAIL_APP_PASSWORD },
    });
  }
  return _transporter;
}

function buildHtml(opts: {
  subject: string; ticketNumber: number; ticketTitle: string;
  ticketUrl: string; bodyHtml: string;
}): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;margin:0;padding:0;background:#f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:24px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
        <tr><td style="background:#dc2626;padding:20px 28px;">
          <h1 style="margin:0;font-size:18px;font-weight:700;color:#fff;">Solicitudes IM</h1>
          <p style="margin:4px 0 0;font-size:13px;color:rgba(255,255,255,0.8);">Ticket #${opts.ticketNumber}</p>
        </td></tr>
        <tr><td style="padding:28px;">
          <h2 style="margin:0 0 4px;font-size:16px;font-weight:700;color:#1a1a1a;">${opts.subject}</h2>
          <p style="margin:0 0 16px;font-size:13px;color:#666;">
            <a href="${opts.ticketUrl}" style="color:#dc2626;text-decoration:none;">${opts.ticketTitle}</a>
          </p>
          ${opts.bodyHtml}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

export function esc(str: string): string {
  return str.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

export type EmailPayload = {
  subject: string; ticketNumber: number; ticketTitle: string;
  ticketUrl: string; bodyHtml: string;
  extraRecipients?: string[]; onlyDirect?: boolean;
};

export async function notifyTicketActivity(payload: EmailPayload): Promise<void> {
  if (!GMAIL_SENDER || !GMAIL_APP_PASSWORD) return;

  const base = payload.onlyDirect ? [] : NOTIFY_EMAILS;
  const recipients = [...base, ...(payload.extraRecipients ?? [])]
    .filter(Boolean)
    .filter((e) => e.includes("@") && !e.endsWith("@helpdesk.com"))
    .filter((e, i, arr) => arr.indexOf(e) === i);

  if (recipients.length === 0) return;

  try {
    const html = buildHtml(payload);
    await getTransporter().sendMail({
      from: `"Solicitudes IM" <${GMAIL_SENDER}>`,
      to: recipients.join(","),
      subject: payload.subject,
      html,
    });
    console.log(`[email] Sent: "${payload.subject}" to ${recipients.length} recipients`);
  } catch (err) {
    console.error("[email] Failed to send:", err instanceof Error ? err.message : String(err));
  }
}
