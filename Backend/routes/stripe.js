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
    console.error("Stripe webhook error:", err.message);
    return res.status(400).send(`Webhook error: ${err.message}`);
  }

  const obj = event.data.object;

  if (event.type === "checkout.session.completed") {
    const customer = await stripe.customers.retrieve(obj.customer);
    await supabase.from("users").update({ plan: "pro", stripe_sub_id: obj.subscription })
      .eq("id", customer.metadata.userId);
  }

  if (event.type === "customer.subscription.deleted") {
    await supabase.from("users").update({ plan: "free", stripe_sub_id: null })
      .eq("stripe_sub_id", obj.id);
  }

  if (event.type === "customer.subscription.updated") {
    const plan = obj.status === "active" ? "pro" : "free";
    await supabase.from("users").update({ plan }).eq("stripe_sub_id", obj.id);
  }

  res.json({ received: true });
});

module.exports = router;
