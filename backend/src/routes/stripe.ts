import type { FastifyInstance } from "fastify";
import Stripe from "stripe";

const PLAN_PRICES: Record<string, { priceId: string; amount: number; name: string }> = {
  GROWTH: { priceId: process.env.STRIPE_PRICE_GROWTH ?? "price_growth", amount: 10000, name: "Growth" },
  SCALE:  { priceId: process.env.STRIPE_PRICE_SCALE  ?? "price_scale",  amount: 25000, name: "Scale"  },
};

export async function stripeRoutes(app: FastifyInstance) {
  // POST /billing/checkout — create a Stripe Checkout Session for plan upgrade
  app.post("/billing/checkout", async (request, reply) => {
    try {
      const payload = await request.jwtVerify<{ sub: string }>();
      const { plan } = (request.body ?? {}) as { plan?: string };

      if (!plan || !PLAN_PRICES[plan.toUpperCase()]) {
        return reply.code(400).send({ ok: false, message: "Invalid plan" });
      }

      const user = await app.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { email: true, name: true, plan: true }
      });
      if (!user) return reply.code(404).send({ ok: false, message: "User not found" });

      const stripeSecretKey = app.config.STRIPE_SECRET_KEY;
      if (!stripeSecretKey) {
        return reply.code(503).send({ ok: false, message: "Billing not configured" });
      }

      const stripe = new Stripe(stripeSecretKey);
      const planInfo = PLAN_PRICES[plan.toUpperCase()];
      const appUrl = app.config.CORS_ORIGIN ?? "http://localhost:3000";

      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        payment_method_types: ["card"],
        customer_email: user.email,
        line_items: [{ price: planInfo.priceId, quantity: 1 }],
        metadata: { userId: payload.sub, plan: plan.toUpperCase() },
        success_url: `${appUrl}/app/settings?upgraded=1&plan=${plan.toUpperCase()}`,
        cancel_url: `${appUrl}/app/settings?upgrade=cancelled`,
      });

      return reply.send({ ok: true, url: session.url });
    } catch {
      return reply.code(401).send({ ok: false, message: "Unauthorized" });
    }
  });

  // POST /billing/webhook — Stripe webhook to apply plan after successful payment
  app.post("/billing/webhook", {
    config: { rawBody: true, csrf: false }
  }, async (request, reply) => {
    const stripeSecretKey = app.config.STRIPE_SECRET_KEY;
    const webhookSecret = app.config.STRIPE_WEBHOOK_SECRET;

    if (!stripeSecretKey || !webhookSecret) {
      return reply.code(503).send({ ok: false, message: "Billing not configured" });
    }

    const stripe = new Stripe(stripeSecretKey);
    const sig = request.headers["stripe-signature"] as string;

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        (request as any).rawBody ?? Buffer.from(JSON.stringify(request.body)),
        sig,
        webhookSecret
      );
    } catch (err: any) {
      app.log.error({ err }, "Stripe webhook signature verification failed");
      return reply.code(400).send({ ok: false, message: "Invalid signature" });
    }

    // Idempotency guard — Stripe may replay the same event on retry.
    // Store the event ID in Redis for 24 h; skip if already processed.
    if (app.redis) {
      const idempotencyKey = `stripe:evt:${event.id}`;
      const alreadyProcessed = await app.redis.set(idempotencyKey, "1", "EX", 86400, "NX").catch(() => null);
      if (alreadyProcessed === null) {
        app.log.info({ eventId: event.id }, "Stripe event already processed — skipping");
        return reply.send({ received: true });
      }
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const { userId, plan } = session.metadata ?? {};

      if (userId && plan) {
        const validPlans = ["STARTER", "GROWTH", "SCALE", "GRANDFATHERED"];
        if (validPlans.includes(plan)) {
          await app.prisma.user.update({
            where: { id: userId },
            data: { plan: plan as any }
          });
          app.log.info({ userId, plan, eventId: event.id }, "Plan upgraded via Stripe");
        }
      }
    }

    return reply.send({ received: true });
  });

  // GET /billing/portal — create a Stripe Customer Portal session for managing subscription
  app.get("/billing/portal", async (request, reply) => {
    try {
      const payload = await request.jwtVerify<{ sub: string }>();
      const stripeSecretKey = app.config.STRIPE_SECRET_KEY;

      if (!stripeSecretKey) {
        return reply.code(503).send({ ok: false, message: "Billing not configured" });
      }

      const user = await app.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { email: true }
      });
      if (!user) return reply.code(404).send({ ok: false, message: "User not found" });

      const stripe = new Stripe(stripeSecretKey);
      const appUrl = app.config.CORS_ORIGIN ?? "http://localhost:3000";

      // Find or create customer by email
      const customers = await stripe.customers.list({ email: user.email, limit: 1 });
      const customer = customers.data[0];

      if (!customer) {
        return reply.code(404).send({ ok: false, message: "No billing account found. Please upgrade first." });
      }

      const portalSession = await stripe.billingPortal.sessions.create({
        customer: customer.id,
        return_url: `${appUrl}/app/settings`,
      });

      return reply.send({ ok: true, url: portalSession.url });
    } catch {
      return reply.code(401).send({ ok: false, message: "Unauthorized" });
    }
  });
}
