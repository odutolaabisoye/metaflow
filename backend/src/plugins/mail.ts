import fp from "fastify-plugin";
import nodemailer from "nodemailer";

export default fp(async (app) => {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = app.config;

  const transport = SMTP_HOST
    ? nodemailer.createTransport({
        host: SMTP_HOST,
        port: Number(SMTP_PORT),
        auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined
      })
    : null;

  app.decorate("mail", {
    async sendPasswordReset(email: string, token: string) {
      if (!transport) {
        app.log.warn({ email }, "SMTP not configured; skipping email send");
        return;
      }

      const resetUrl = `${app.config.CORS_ORIGIN}/auth/reset?token=${token}`;

      await transport.sendMail({
        from: SMTP_FROM,
        to: email,
        subject: "Reset your MetaFlow password",
        text: `Reset your password: ${resetUrl}`
      });
    }
  });
});

declare module "fastify" {
  interface FastifyInstance {
    mail: {
      sendPasswordReset(email: string, token: string): Promise<void>;
    };
  }
}
