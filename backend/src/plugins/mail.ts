import fp from "fastify-plugin";
import nodemailer from "nodemailer";

// ─── Shared HTML shell ────────────────────────────────────────────────────────
function emailShell(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#0d0d0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#0d0d0f;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" role="presentation" style="max-width:560px;width:100%;">
          <!-- Logo -->
          <tr>
            <td style="padding-bottom:28px;">
              <span style="font-size:18px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">
                Meta<span style="color:#22d3ee;">Flow</span>
              </span>
            </td>
          </tr>
          <!-- Card -->
          <tr>
            <td style="background:#16161a;border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:36px 40px;">
              ${body}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding-top:24px;text-align:center;">
              <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.25);">
                MetaFlow · Product intelligence for Meta catalog ads
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function ctaButton(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;margin-top:24px;background:#22d3ee;color:#0d0d0f;font-size:14px;font-weight:600;text-decoration:none;padding:12px 28px;border-radius:10px;">${label} →</a>`;
}

const divider = `<hr style="border:none;border-top:1px solid rgba(255,255,255,0.07);margin:24px 0;" />`;

// ─── Email template builders ──────────────────────────────────────────────────
function buildWelcome(name: string, appUrl: string) {
  return emailShell("Welcome to MetaFlow", `
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.4px;">Welcome to MetaFlow${name ? `, ${name}` : ""}! 🎉</h1>
    <p style="margin:0 0 20px;font-size:14px;line-height:1.7;color:rgba(255,255,255,0.6);">
      Your account is ready. MetaFlow gives you product-level intelligence for Meta catalog ads —
      so you always know which SKUs to scale, test, or cut.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
      <tr>
        <td style="background:rgba(34,211,238,0.05);border:1px solid rgba(34,211,238,0.12);border-radius:12px;padding:16px 20px;">
          <p style="margin:0 0 10px;font-size:12px;font-weight:600;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:0.8px;">Get started in 3 steps</p>
          <p style="margin:0 0 6px;font-size:13px;color:rgba(255,255,255,0.75);">① Connect your Shopify, WooCommerce, or custom store</p>
          <p style="margin:0 0 6px;font-size:13px;color:rgba(255,255,255,0.75);">② Authorize Meta Ads to pull catalog performance</p>
          <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.75);">③ Let MetaFlow score every SKU — SCALE, TEST, RISK, or KILL</p>
        </td>
      </tr>
    </table>
    ${ctaButton(`${appUrl}/app/onboarding`, "Set up your workspace")}
    ${divider}
    <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.3);">
      If you didn't create this account, you can safely ignore this email.
    </p>
  `);
}

function buildImportStarted(name: string, storeName: string, appUrl: string) {
  return emailShell("Import started — MetaFlow", `
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.4px;">Your import is running ⚡</h1>
    <p style="margin:0 0 20px;font-size:14px;line-height:1.7;color:rgba(255,255,255,0.6);">
      Hey ${name || "there"}, we've started syncing <strong style="color:#ffffff;">${storeName}</strong>.
      We're pulling your product catalog, order history, and Meta ad performance now.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
      <tr>
        <td style="background:rgba(132,204,22,0.05);border:1px solid rgba(132,204,22,0.15);border-radius:12px;padding:16px 20px;">
          <p style="margin:0 0 10px;font-size:12px;font-weight:600;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:0.8px;">What's happening</p>
          <p style="margin:0 0 6px;font-size:13px;color:rgba(255,255,255,0.75);">📦 Fetching product catalog &amp; inventory levels</p>
          <p style="margin:0 0 6px;font-size:13px;color:rgba(255,255,255,0.75);">📊 Pulling 30 days of orders &amp; revenue data</p>
          <p style="margin:0 0 6px;font-size:13px;color:rgba(255,255,255,0.75);">📣 Syncing Meta ad spend, ROAS &amp; CTR per SKU</p>
          <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.75);">🧠 Scoring every SKU — usually takes 1–3 minutes</p>
        </td>
      </tr>
    </table>
    ${ctaButton(`${appUrl}/app/products`, "View products")}
    ${divider}
    <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.3);">
      Scores will update in your dashboard as the sync completes. Large catalogs may take a few minutes.
    </p>
  `);
}

function buildExportReady(name: string, productCount: number, appUrl: string) {
  return emailShell("Export downloaded — MetaFlow", `
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.4px;">Export downloaded ✓</h1>
    <p style="margin:0 0 20px;font-size:14px;line-height:1.7;color:rgba(255,255,255,0.6);">
      Hey ${name || "there"}, your MetaFlow product export containing
      <strong style="color:#ffffff;">${productCount.toLocaleString()} product${productCount !== 1 ? "s" : ""}</strong>
      was just downloaded with full scoring data.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
      <tr>
        <td style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:16px 20px;">
          <p style="margin:0 0 10px;font-size:12px;font-weight:600;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:0.8px;">Export includes</p>
          <p style="margin:0 0 6px;font-size:13px;color:rgba(255,255,255,0.75);">Product title, SKU, category (SCALE / TEST / RISK / KILL)</p>
          <p style="margin:0 0 6px;font-size:13px;color:rgba(255,255,255,0.75);">Score, ROAS, CTR, gross margin, revenue</p>
          <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.75);">Spend, impressions, clicks, conversions</p>
        </td>
      </tr>
    </table>
    ${ctaButton(`${appUrl}/app/products`, "Back to products")}
    ${divider}
    <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.3);">
      If you didn't trigger this export, please contact support immediately.
    </p>
  `);
}

function buildPasswordReset(resetUrl: string) {
  return emailShell("Reset your MetaFlow password", `
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.4px;">Reset your password</h1>
    <p style="margin:0 0 20px;font-size:14px;line-height:1.7;color:rgba(255,255,255,0.6);">
      We received a request to reset your MetaFlow password. Click below to choose a new one.
      This link expires in <strong style="color:#ffffff;">1 hour</strong>.
    </p>
    ${ctaButton(resetUrl, "Reset password")}
    ${divider}
    <p style="margin:0 0 8px;font-size:12px;color:rgba(255,255,255,0.35);">
      If you didn't request a password reset, you can safely ignore this email.
    </p>
    <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.25);word-break:break-all;">
      Or copy this link: <span style="color:rgba(34,211,238,0.7);">${resetUrl}</span>
    </p>
  `);
}

// ─── Plugin ───────────────────────────────────────────────────────────────────
export default fp(async (app) => {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM, CORS_ORIGIN } = app.config;
  const appUrl = CORS_ORIGIN || "http://localhost:3000";

  const transport = SMTP_HOST
    ? nodemailer.createTransport({
        host: SMTP_HOST,
        port: Number(SMTP_PORT),
        auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined
      })
    : null;

  async function send(to: string, subject: string, html: string) {
    if (!transport) {
      app.log.warn({ to, subject }, "SMTP not configured — skipping email");
      return;
    }
    try {
      await transport.sendMail({ from: SMTP_FROM, to, subject, html });
      app.log.info({ to, subject }, "Email sent");
    } catch (err) {
      app.log.error({ err, to, subject }, "Failed to send email");
    }
  }

  app.decorate("mail", {
    async sendWelcome(email: string, name: string) {
      await send(email, "Welcome to MetaFlow 🎉", buildWelcome(name, appUrl));
    },
    async sendImportStarted(email: string, name: string, storeName: string) {
      await send(email, `Import started — ${storeName}`, buildImportStarted(name, storeName, appUrl));
    },
    async sendExportReady(email: string, name: string, productCount: number) {
      await send(email, "Your MetaFlow export was downloaded", buildExportReady(name, productCount, appUrl));
    },
    async sendPasswordReset(email: string, token: string) {
      const resetUrl = `${appUrl}/auth/reset?token=${token}`;
      await send(email, "Reset your MetaFlow password", buildPasswordReset(resetUrl));
    }
  });
});

declare module "fastify" {
  interface FastifyInstance {
    mail: {
      sendWelcome(email: string, name: string): Promise<void>;
      sendImportStarted(email: string, name: string, storeName: string): Promise<void>;
      sendExportReady(email: string, name: string, productCount: number): Promise<void>;
      sendPasswordReset(email: string, token: string): Promise<void>;
    };
  }
}
