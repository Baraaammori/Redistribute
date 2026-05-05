const router = require("express").Router();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const supabase = require("../lib/supabase");
const { authenticateToken } = require("../middleware/auth");

// POST /api/stripe/checkout  — create Checkout session
router.post("/checkout", authenticateToken, async (req, res) => {
  const { data: user } = await supabase.from("users").select("*").eq("id", req.user.userId).single();

  let customerId = user.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({ email: user.email, metadata: { userId: user.id } });
    customerId = customer.id;
    await supabase.from("users").update({ stripe_customer_id: customerId }).eq("id", user.id);
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: process.env.STRIPE_PRO_PRICE_ID, quantity: 1 }],
    subscription_data: { trial_period_days: 14 },
    success_url: `${process.env.FRONTEND_URL}/dashboard/billing?success=true`,
    cancel_url:  `${process.env.FRONTEND_URL}/dashboard/billing?cancelled=true`,
  });

  res.json({ url: session.url });
});

// POST /api/stripe/portal  — customer billing portal
router.post("/portal", authenticateToken, async (req, res) => {
  const { data: user } = await supabase.from("users").select("stripe_customer_id").eq("id", req.user.userId).single();
  if (!user.stripe_customer_id) return res.status(400).json({ error: "No billing account found" });

  const session = await stripe.billingPortal.sessions.create({
    customer: user.stripe_customer_id,
    return_url: `${process.env.FRONTEND_URL}/dashboard/billing`,
  });
  res.json({ url: session.url });
});

// POST /api/stripe/webhook
router.post("/webhook", async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Stripe webhook signature error:", err.message);
    return res.status(400).send(`Webhook error: ${err.message}`);
  }

  // Idempotency: skip if already processed
  const { data: existing } = await supabase.from("stripe_events")
    .select("id").eq("event_id", event.id).single();
  if (existing) return res.json({ received: true, skipped: true });

  const obj = event.data.object;

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        // Trial started or payment completed → upgrade to pro
        if (obj.mode === "subscription") {
          const customer = await stripe.customers.retrieve(obj.customer);
          const userId = customer.metadata?.userId;
          if (userId) {
            await supabase.from("users")
              .update({ plan: "pro", stripe_sub_id: obj.subscription, stripe_customer_id: obj.customer })
              .eq("id", userId);
            console.log(`✅ Stripe: user ${userId} upgraded to pro`);
          }
        }
        break;
      }

      case "customer.subscription.updated": {
        // Handles: trial → active, active → past_due, cancellation-at-period-end
        const isActive = ["active", "trialing"].includes(obj.status);
        const plan = isActive ? "pro" : "free";
        await supabase.from("users")
          .update({ plan, stripe_sub_id: isActive ? obj.id : null })
          .eq("stripe_sub_id", obj.id);
        console.log(`ℹ️ Stripe: subscription ${obj.id} → status=${obj.status}, plan=${plan}`);
        break;
      }

      case "customer.subscription.deleted": {
        // Subscription fully cancelled → downgrade immediately
        await supabase.from("users")
          .update({ plan: "free", stripe_sub_id: null })
          .eq("stripe_sub_id", obj.id);
        console.log(`⬇️ Stripe: subscription ${obj.id} deleted → user downgraded to free`);
        break;
      }

      case "invoice.payment_succeeded": {
        // Successful renewal — ensure plan stays pro
        if (obj.subscription) {
          await supabase.from("users")
            .update({ plan: "pro" })
            .eq("stripe_sub_id", obj.subscription);
        }
        break;
      }

      case "invoice.payment_failed": {
        // Subscription renewal failed — keep pro for grace period (Stripe retries 4x over 8 days)
        // Log for follow-up; Stripe will send customer.subscription.updated when it finally fails
        console.warn(`⚠️ Stripe: invoice payment failed for subscription ${obj.subscription}`);
        await supabase.from("stripe_events").insert({
          event_id: `prefail_${obj.id}`,
          type: event.type,
          data: { subscription: obj.subscription, amount: obj.amount_due },
          processed_at: new Date().toISOString(),
        }).select().single().catch(() => {}); // non-fatal
        break;
      }

      case "charge.refunded": {
        console.log(`💸 Stripe: charge ${obj.id} refunded ($${obj.amount_refunded / 100})`);
        break;
      }
    }

    // Mark event as processed (idempotency table)
    await supabase.from("stripe_events").insert({
      event_id: event.id,
      type: event.type,
      data: { object_id: obj.id },
      processed_at: new Date().toISOString(),
    });

  } catch (err) {
    console.error(`❌ Stripe webhook handler error [${event.type}]:`, err.message);
    // Return 500 — Stripe will retry
    return res.status(500).json({ error: "Webhook handler failed" });
  }

  res.json({ received: true });
});

module.exports = router;
