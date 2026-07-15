import nodemailer from "nodemailer";

// ── Config ──────────────────────────────────────────

const GMAIL_SENDER = process.env.GMAIL_SENDER ?? "";
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD ?? "";

const NOTIFY_EMAILS = (process.env.NOTIFY_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim())
  .filter(Boolean);

// ── Transport (lazy singleton) ──────────────────────

let _transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (!_transporter) {
    _transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: GMAIL_SENDER,
        pass: GMAIL_APP_PASSWORD,
      },
    });
  }
  return _transporter;
}

// ── HTML template ───────────────────────────────────

function buildHtml(opts: {
  subject: string;
  ticketNumber: number;
  ticketTitle: string;
  ticketUrl: string;
  bodyHtml: string;
}): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;margin:0;padding:0;background:#f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:24px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
        <!-- Header -->
        <tr>
          <td style="background:#dc2626;padding:20px 28px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <h1 style="margin:0;font-size:18px;font-weight:700;color:#fff;">Help Desk · IM</h1>
                  <p style="margin:4px 0 0;font-size:13px;color:rgba(255,255,255,0.8);">Inteligencia de Mercados</p>
                </td>
                <td align="right" style="vertical-align:bottom;">
                  <span style="font-size:13px;font-weight:600;color:rgba(255,255,255,0.9);background:rgba(0,0,0,0.15);padding:4px 10px;border-radius:6px;">
                    #${opts.ticketNumber}
                  </span>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <!-- Body -->
        <tr><td style="padding:28px;">
          <h2 style="margin:0 0 4px;font-size:16px;font-weight:700;color:#1a1a1a;">${opts.subject}</h2>
          <p style="margin:0 0 16px;font-size:13px;color:#666;">
            <a href="${opts.ticketUrl}" style="color:#dc2626;text-decoration:none;font-weight:500;">${opts.ticketTitle}</a>
          </p>
          ${opts.bodyHtml}
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:16px 28px;border-top:1px solid #eee;">
          <p style="margin:0;font-size:11px;color:#999;">
            Este es un mensaje automático del Help Desk de Inteligencia de Mercados.
            No responder a este correo.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── HTML escaping ──────────────────────────────────

export function esc(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── Public API ──────────────────────────────────────

export type EmailPayload = {
  subject: string;
  ticketNumber: number;
  ticketTitle: string;
  ticketUrl: string;
  bodyHtml: string;
  extraRecipients?: string[];
};

/**
 * Send ticket notification to all configured recipients plus any extra ones.
 * This runs asynchronously and swallows errors so it never blocks the API.
 */
export async function notifyTicketActivity(payload: EmailPayload): Promise<void> {
  if (!GMAIL_SENDER || !GMAIL_APP_PASSWORD) return;

  const recipients = [
    ...NOTIFY_EMAILS,
    ...(payload.extraRecipients ?? []),
  ].filter(Boolean).filter((e, i, arr) => arr.indexOf(e) === i);

  if (recipients.length === 0) return;

  const html = buildHtml(payload);

  try {
    const transporter = getTransporter();
    await transporter.sendMail({
      from: `"Help Desk IM" <${GMAIL_SENDER}>`,
      to: recipients.join(","),
      subject: payload.subject,
      html,
    });
    console.log(`[email] Sent: "${payload.subject}" to ${recipients.length} recipients`);
  } catch (err) {
    console.error("[email] Failed to send:", err instanceof Error ? err.message : err);
  }
}
