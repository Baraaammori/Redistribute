const router = require("express").Router();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const supabase = require("../lib/supabase");
const { authenticateToken } = require("../middleware/auth");

async function withStripeRetry(fn) {
  try {
    return await fn();
  } catch (err) {
    if (err.statusCode === 500 || err.statusCode === 503) {
      await new Promise(r => setTimeout(r, 2000));
      return await fn();
    }
    throw err;
  }
}

// POST /api/stripe/checkout  — create Checkout session
router.post("/checkout", authenticateToken, async (req, res) => {
  try {
    const { data: user } = await supabase
      .from("users")
      .select("*")
      .eq("id", req.user.userId)
      .single();

    let customerId = user.stripe_customer_id;
    if (!customerId) {
      const customer = await withStripeRetry(() =>
        stripe.customers.create({ email: user.email, metadata: { userId: user.id } })
      );
      customerId = customer.id;
      await supabase.from("users").update({ stripe_customer_id: customerId }).eq("id", user.id);
    }

    const session = await withStripeRetry(() =>
      stripe.checkout.sessions.create(
        {
          customer: customerId,
          customer_email: customerId ? undefined : user.email, // pre-fill if no customer yet
          mode: "subscription",
          line_items: [{ price: process.env.STRIPE_PRO_PRICE_ID, quantity: 1 }],
          subscription_data: { trial_period_days: 14 },
          allow_promotion_codes: true,
          success_url: `${process.env.FRONTEND_URL}/dashboard/billing?success=true`,
          cancel_url:  `${process.env.FRONTEND_URL}/dashboard/billing?cancelled=true`,
        },
        { idempotencyKey: `checkout-${user.id}-${Date.now()}` }
      )
    );

    res.json({ url: session.url });
  } catch (err) {
    console.error("[stripe/checkout] Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/stripe/webhook
router.post("/webhook", async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("[stripe-webhook] Signature error:", err.message);
    return res.status(400).send(`Webhook error: ${err.message}`);
  }

  console.log("[stripe-webhook]", event.type, event.data.object.customer || event.data.object.id, new Date().toISOString());

  // Idempotency: skip if already processed
  const { data: existing } = await supabase
    .from("stripe_events")
    .select("id")
    .eq("event_id", event.id)
    .single();
  if (existing) return res.json({ received: true, skipped: true });

  const obj = event.data.object;

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        if (obj.mode === "subscription") {
          const customer = await stripe.customers.retrieve(obj.customer);
          const userId = customer.metadata?.userId;
          if (userId) {
            await supabase.from("users")
              .update({
                plan: "pro",
                stripe_sub_id: obj.subscription,
                stripe_customer_id: obj.customer,
              })
              .eq("id", userId);
            console.log(`[stripe-webhook] ✅ user ${userId} upgraded to pro`);
          }
        }
        break;
      }

      case "customer.subscription.updated": {
        const isActive = ["active", "trialing"].includes(obj.status);
        const plan = isActive ? "pro" : "free";
        await supabase.from("users")
          .update({
            plan,
            stripe_sub_id: isActive ? obj.id : null,
          })
          .eq("stripe_sub_id", obj.id);
        console.log(`[stripe-webhook] subscription ${obj.id} → status=${obj.status}, plan=${plan}`);
        break;
      }

      case "customer.subscription.deleted": {
        await supabase.from("users")
          .update({ plan: "free", stripe_sub_id: null })
          .eq("stripe_sub_id", obj.id);
        console.log(`[stripe-webhook] subscription ${obj.id} deleted → user downgraded to free`);
        break;
      }

      case "invoice.paid":
      case "invoice.payment_succeeded": {
        if (obj.subscription) {
          await supabase.from("users")
            .update({ plan: "pro" })
            .eq("stripe_sub_id", obj.subscription);
          console.log(`[stripe-webhook] invoice paid for subscription ${obj.subscription}`);
        }
        break;
      }

      case "invoice.payment_failed": {
        console.warn(`[stripe-webhook] ⚠️ invoice payment failed for subscription ${obj.subscription}`);
        // Stripe will retry over 8 days; subscription.updated will fire when status changes to past_due
        // We log for follow-up tracking
        await supabase.from("stripe_events").insert({
          event_id: `prefail_${obj.id}`,
          type: event.type,
          data: { subscription: obj.subscription, amount: obj.amount_due },
          processed_at: new Date().toISOString(),
        }).select().single().catch(() => {});
        break;
      }

      case "charge.refunded": {
        console.log(`[stripe-webhook] charge ${obj.id} refunded ($${obj.amount_refunded / 100})`);
        break;
      }
    }

    // Mark event as processed
    await supabase.from("stripe_events").insert({
      event_id: event.id,
      type: event.type,
      data: { object_id: obj.id },
      processed_at: new Date().toISOString(),
    });

  } catch (err) {
    console.error(`[stripe-webhook] handler error [${event.type}]:`, err.message);
    return res.status(500).json({ error: "Webhook handler failed" });
  }

  res.json({ received: true });
});

module.exports = router;
