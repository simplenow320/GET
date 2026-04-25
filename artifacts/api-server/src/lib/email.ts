import sgMail from "@sendgrid/mail";
import { logger } from "./logger";

/**
 * SendGrid wrapper. Configured lazily so the server can boot without an API
 * key in development — calls just log a warning and resolve. Once the key is
 * set in the environment, every send uses it.
 *
 * From-address policy: every system email is sent from a single verified
 * domain (env `EMAIL_FROM`). For client-facing invites, the inviter's name
 * is woven into the display name and `replyTo` is set to their address so
 * replies route correctly without spoofing the From header (which Gmail's
 * 2024+ DMARC enforcement would reject).
 */

const apiKey = process.env.SENDGRID_API_KEY;
const fromAddress = process.env.EMAIL_FROM ?? "no-reply@example.com";
const PRODUCT_NAME = "get";

let configured = false;
function ensureConfigured() {
  if (configured) return apiKey != null;
  if (!apiKey) {
    logger.warn(
      "SENDGRID_API_KEY is not set — outbound emails will be logged but not delivered.",
    );
    configured = true;
    return false;
  }
  sgMail.setApiKey(apiKey);
  configured = true;
  return true;
}

interface SendArgs {
  to: string;
  subject: string;
  html: string;
  text: string;
  fromName?: string;
  replyTo?: string;
}

async function send({ to, subject, html, text, fromName, replyTo }: SendArgs) {
  const ready = ensureConfigured();
  const fromDisplay = fromName ? `${fromName} via ${PRODUCT_NAME}` : PRODUCT_NAME;
  const msg = {
    to,
    from: { email: fromAddress, name: fromDisplay },
    subject,
    text,
    html,
    ...(replyTo ? { replyTo } : {}),
  };

  if (!ready) {
    logger.info({ to, subject, preview: text.slice(0, 200) }, "email (not sent — no API key)");
    return;
  }

  try {
    await sgMail.send(msg);
    logger.info({ to, subject }, "email sent");
  } catch (err: any) {
    logger.error(
      { err, to, subject, sgErrors: err?.response?.body?.errors },
      "sendgrid send failed",
    );
    throw err;
  }
}

// ── Templates ─────────────────────────────────────────────────────────────
// Plain, brand-quiet HTML — safe across most clients. No external CSS, no
// images, no remote fonts (those tank deliverability). Inline styles only.

function shell(body: string, footerNote?: string) {
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#faf9f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1a2e;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border:1px solid rgba(26,26,46,0.06);border-radius:14px;padding:32px;">
        ${body}
      </table>
      ${
        footerNote
          ? `<p style="font-size:12px;color:rgba(26,26,46,0.48);margin-top:18px;max-width:520px;line-height:1.55;">${footerNote}</p>`
          : ""
      }
    </td></tr>
  </table>
</body></html>`;
}

function ctaButton(href: string, label: string) {
  return `<a href="${href}" style="display:inline-block;background:#1a1a2e;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:10px;font-size:14px;">${label}</a>`;
}

export async function sendPasswordResetEmail(args: {
  to: string;
  name: string;
  resetUrl: string;
}) {
  const { to, name, resetUrl } = args;
  const subject = `Reset your ${PRODUCT_NAME} password`;
  const text = `Hi ${name},

We received a request to reset the password on your ${PRODUCT_NAME} account.

Reset link (valid for 1 hour, single-use):
${resetUrl}

If you didn't ask for this, you can safely ignore this email — your password won't change.`;

  const html = shell(
    `
    <h1 style="font-size:20px;font-weight:600;letter-spacing:-0.01em;margin:0 0 16px;">Reset your password</h1>
    <p style="font-size:14px;line-height:1.6;color:rgba(26,26,46,0.78);margin:0 0 20px;">
      Hi ${escapeHtml(name)}, we got a request to reset your ${PRODUCT_NAME} password. Click the button below to choose a new one.
    </p>
    <p style="margin:0 0 22px;">${ctaButton(resetUrl, "Reset password")}</p>
    <p style="font-size:12px;line-height:1.55;color:rgba(26,26,46,0.48);margin:0;">
      This link is valid for 1 hour and can only be used once. If you didn't ask for this, ignore this email — your password won't change.
    </p>
  `,
    `If the button doesn't work, paste this link into your browser:<br/><span style="word-break:break-all;">${escapeHtml(resetUrl)}</span>`,
  );

  await send({ to, subject, html, text });
}

export async function sendInviteEmail(args: {
  to: string;
  inviterName: string;
  inviterEmail: string;
  projectName: string;
  role: "editor" | "viewer";
  acceptUrl: string;
}) {
  const { to, inviterName, inviterEmail, projectName, role, acceptUrl } = args;
  const subject = `${inviterName} invited you to edit ${projectName}`;

  const text = `${inviterName} (${inviterEmail}) invited you to be a ${role} on "${projectName}" in ${PRODUCT_NAME}.

Accept your invite:
${acceptUrl}

If you weren't expecting this, you can safely ignore this email.`;

  const html = shell(
    `
    <h1 style="font-size:20px;font-weight:600;letter-spacing:-0.01em;margin:0 0 16px;">You've been invited</h1>
    <p style="font-size:14px;line-height:1.6;color:rgba(26,26,46,0.78);margin:0 0 18px;">
      <strong>${escapeHtml(inviterName)}</strong> invited you to be a <strong>${role}</strong> on <strong>${escapeHtml(projectName)}</strong> in ${PRODUCT_NAME}.
    </p>
    <p style="margin:0 0 22px;">${ctaButton(acceptUrl, "Accept invite")}</p>
    <p style="font-size:12px;line-height:1.55;color:rgba(26,26,46,0.48);margin:0;">
      Reply to this email to reach ${escapeHtml(inviterName)} directly. If you weren't expecting this, you can safely ignore it.
    </p>
  `,
    `If the button doesn't work, paste this link into your browser:<br/><span style="word-break:break-all;">${escapeHtml(acceptUrl)}</span>`,
  );

  await send({
    to,
    subject,
    html,
    text,
    fromName: inviterName,
    replyTo: inviterEmail,
  });
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
