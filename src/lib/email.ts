// ── Config ──────────────────────────────────────────

const BREVO_API_KEY    = process.env.BREVO_API_KEY ?? "";
const EMAIL_FROM_NAME  = "Solicitudes IM";
const EMAIL_FROM_EMAIL = process.env.EMAIL_FROM ?? "inteligenciademercadosee@gmail.com";

const NOTIFY_EMAILS = (process.env.NOTIFY_EMAILS ?? "")
  .split(",").map((e) => e.trim()).filter(Boolean);

// ── HTML template ───────────────────────────────────

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
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td>
                <h1 style="margin:0;font-size:18px;font-weight:700;color:#fff;">Solicitudes IM</h1>
                <p style="margin:4px 0 0;font-size:13px;color:rgba(255,255,255,0.8);">Inteligencia de Mercados</p>
              </td>
              <td align="right" style="vertical-align:bottom;">
                <span style="font-size:13px;font-weight:600;color:rgba(255,255,255,0.9);background:rgba(0,0,0,0.15);padding:4px 10px;border-radius:6px;">#${opts.ticketNumber}</span>
              </td>
            </tr>
          </table>
        </td></tr>
        <tr><td style="padding:28px;">
          <h2 style="margin:0 0 4px;font-size:16px;font-weight:700;color:#1a1a1a;">${opts.subject}</h2>
          <p style="margin:0 0 16px;font-size:13px;color:#666;">${opts.ticketTitle}</p>
          ${opts.bodyHtml}
          <div style="margin-top:24px;text-align:center;">
            <a href="${opts.ticketUrl}"
               style="display:inline-block;padding:11px 28px;background:#dc2626;color:#fff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;letter-spacing:0.01em;">
              Ver ticket →
            </a>
          </div>
          <p style="margin:12px 0 0;font-size:11px;color:#bbb;text-align:center;">
            Si el botón no funciona, copia este enlace: <a href="${opts.ticketUrl}" style="color:#dc2626;">${opts.ticketUrl}</a>
          </p>
        </td></tr>
        <tr><td style="padding:16px 28px;border-top:1px solid #eee;">
          <p style="margin:0;font-size:11px;color:#999;">Mensaje automático · Solicitudes IM · No responder.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

// ── HTML escaping ───────────────────────────────────

export function esc(str: string): string {
  return str.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

// ── Public API ──────────────────────────────────────

export type EmailPayload = {
  subject: string; ticketNumber: number; ticketTitle: string;
  ticketUrl: string; bodyHtml: string;
  extraRecipients?: string[]; onlyDirect?: boolean;
};

export async function notifyTicketActivity(payload: EmailPayload): Promise<void> {
  if (!BREVO_API_KEY) {
    console.log("[email] BREVO_API_KEY no configurada");
    return;
  }

  const base = payload.onlyDirect ? [] : NOTIFY_EMAILS;
  const recipients = [...base, ...(payload.extraRecipients ?? [])]
    .filter(Boolean)
    .filter((e) => e.includes("@") && !e.endsWith("@helpdesk.com"))
    .filter((e, i, arr) => arr.indexOf(e) === i);

  if (recipients.length === 0) return;

  const html = buildHtml(payload);

  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": BREVO_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sender: { name: EMAIL_FROM_NAME, email: EMAIL_FROM_EMAIL },
        to: recipients.map((email) => ({ email, name: email.split("@")[0] })),
        subject: payload.subject,
        htmlContent: html,
      }),
    });

    const data = await res.json().catch(() => ({})) as { messageId?: string; message?: string; code?: string };

    if (!res.ok) {
      console.error("[email] Brevo error:", JSON.stringify(data));
    } else {
      console.log(`[email] Sent via Brevo: "${payload.subject}" to ${recipients.length} recipients`);
    }
  } catch (err) {
    console.error("[email] Failed:", err instanceof Error ? err.message : String(err));
  }
}
