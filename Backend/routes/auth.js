const router = require("express").Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const supabase = require("../lib/supabase");
const { authenticateToken } = require("../middleware/auth");

function signToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "7d" });
}

// POST /api/auth/signup
router.post("/signup", async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Email and password required" });

  // Check existing
  const { data: existing } = await supabase
    .from("users")
    .select("id")
    .eq("email", email)
    .single();
  if (existing) return res.status(409).json({ error: "Email already registered" });

  const passwordHash = await bcrypt.hash(password, 12);
  const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // 14-day trial

  const { data: user, error } = await supabase
    .from("users")
    .insert({ email, password_hash: passwordHash, name, trial_ends_at: trialEndsAt })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  const token = signToken({ userId: user.id, email: user.email, role: "user" });
  res.json({ token, user: { id: user.id, email: user.email, name: user.name, plan: user.plan } });
});

// POST /api/auth/signin
router.post("/signin", async (req, res) => {
  const { email, password } = req.body;

  const { data: user } = await supabase
    .from("users")
    .select("*")
    .eq("email", email)
    .single();

  if (!user) return res.status(401).json({ error: "Invalid credentials" });

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: "Invalid credentials" });

  const token = signToken({ userId: user.id, email: user.email, role: "user" });
  res.json({ token, user: { id: user.id, email: user.email, name: user.name, plan: user.plan } });
});

// POST /api/auth/signout
router.post("/signout", (req, res) => res.json({ ok: true }));

// GET /api/auth/user
router.get("/user", authenticateToken, async (req, res) => {
  const { data: user } = await supabase
    .from("users")
    .select("id, email, name, plan, trial_ends_at")
    .eq("id", req.user.userId)
    .single();
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json(user);
});

// GET /api/auth/verify
router.get("/verify", authenticateToken, (req, res) => res.json({ valid: true, user: req.user }));

module.exports = router;
