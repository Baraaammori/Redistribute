const router = require("express").Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { google } = require("googleapis");
const supabase = require("../lib/supabase");
const { authenticateToken } = require("../middleware/auth");

function signToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "7d" });
}

// POST /api/auth/signup
router.post("/signup", async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Email and password required" });

  const { data: existing } = await supabase
    .from("users")
    .select("id")
    .eq("email", email)
    .single();
  if (existing) return res.status(409).json({ error: "Email already registered" });

  const passwordHash = await bcrypt.hash(password, 12);
  const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

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

// ── Google OAuth ──────────────────────────────────────────────────────────────

function getGoogleOAuth() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || `${process.env.BACKEND_URL || "http://localhost:5000"}/api/auth/google/callback`
  );
}

// GET /api/auth/google — redirect to Google consent screen
router.get("/google", (req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID) {
    return res.status(503).json({ error: "Google OAuth is not configured" });
  }
  // State is a short-lived signed JWT — verifiable without server-side storage
  const state = jwt.sign({ nonce: Math.random().toString(36).slice(2) }, process.env.JWT_SECRET, { expiresIn: "10m" });
  const url = getGoogleOAuth().generateAuthUrl({
    access_type: "online",
    scope: ["profile", "email"],
    state,
    prompt: "select_account",
  });
  res.redirect(url);
});

// GET /api/auth/google/callback
router.get("/google/callback", async (req, res) => {
  const { code, state, error } = req.query;
  const frontendBase = process.env.FRONTEND_URL || "http://localhost:3000";

  if (error) {
    return res.redirect(`${frontendBase}/login?error=${encodeURIComponent("Google login was cancelled")}`);
  }

  // Verify CSRF state
  try {
    jwt.verify(state, process.env.JWT_SECRET);
  } catch {
    return res.redirect(`${frontendBase}/login?error=${encodeURIComponent("Invalid state — please try again")}`);
  }

  try {
    const auth = getGoogleOAuth();
    const { tokens } = await auth.getToken(code);

    // Decode the ID token — contains email, name, sub (no extra round-trip needed)
    const ticket = await auth.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const profile = ticket.getPayload();
    const email = profile.email;
    const name  = profile.name || email.split("@")[0];

    if (!email) throw new Error("No email returned from Google");

    // Find or create user
    const { data: existing } = await supabase
      .from("users")
      .select("*")
      .eq("email", email)
      .single();

    let user = existing;
    if (!user) {
      const { data: created, error: createErr } = await supabase
        .from("users")
        .insert({ email, name, plan: "free" })
        .select()
        .single();
      if (createErr) throw new Error(createErr.message);
      user = created;
    }

    const token = signToken({ userId: user.id, email: user.email, role: "user" });
    res.redirect(`${frontendBase}/dashboard?token=${token}`);
  } catch (err) {
    console.error("[auth/google] Callback error:", err.message);
    res.redirect(`${frontendBase}/login?error=${encodeURIComponent("Google login failed — please try again")}`);
  }
});

// ── Apple Sign In ─────────────────────────────────────────────────────────────

// GET /api/auth/apple — redirect to Apple authorization
router.get("/apple", (req, res) => {
  if (!process.env.APPLE_CLIENT_ID) {
    return res.status(503).json({ error: "Apple Sign In is not configured" });
  }
  const state = jwt.sign({ nonce: Math.random().toString(36).slice(2) }, process.env.JWT_SECRET, { expiresIn: "10m" });
  const redirectUri = process.env.APPLE_REDIRECT_URI || `${process.env.BACKEND_URL || "http://localhost:5000"}/api/auth/apple/callback`;

  const params = new URLSearchParams({
    response_type: "code id_token",
    response_mode: "form_post",
    client_id: process.env.APPLE_CLIENT_ID,
    redirect_uri: redirectUri,
    scope: "name email",
    state,
  });
  res.redirect(`https://appleid.apple.com/auth/authorize?${params}`);
});

// POST /api/auth/apple/callback — Apple sends form_post with code + id_token
router.post("/apple/callback", async (req, res) => {
  const frontendBase = process.env.FRONTEND_URL || "http://localhost:3000";
  const { code, id_token, state, error, user: appleUserJson } = req.body;

  if (error) {
    return res.redirect(`${frontendBase}/login?error=${encodeURIComponent("Apple Sign In was cancelled")}`);
  }

  // Verify CSRF state
  try {
    jwt.verify(state, process.env.JWT_SECRET);
  } catch {
    return res.redirect(`${frontendBase}/login?error=${encodeURIComponent("Invalid state — please try again")}`);
  }

  try {
    let appleSignIn;
    try {
      appleSignIn = require("apple-signin-auth");
    } catch {
      throw new Error("apple-signin-auth package not installed. Run: npm install apple-signin-auth");
    }

    const clientSecret = appleSignIn.getClientSecret({
      clientID:   process.env.APPLE_CLIENT_ID,
      teamID:     process.env.APPLE_TEAM_ID,
      keyIdentifier: process.env.APPLE_KEY_ID,
      privateKey: process.env.APPLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    });

    const tokenResponse = await appleSignIn.getAuthorizationToken(code, {
      clientID:     process.env.APPLE_CLIENT_ID,
      redirectUri:  process.env.APPLE_REDIRECT_URI,
      clientSecret,
    });

    const idTokenPayload = await appleSignIn.verifyIdToken(tokenResponse.id_token, {
      audience: process.env.APPLE_CLIENT_ID,
      ignoreExpiration: false,
    });

    const appleSub = idTokenPayload.sub;
    // Apple only sends email on the very first login — read from POST body if present
    let email = idTokenPayload.email;
    let name  = null;
    if (appleUserJson) {
      try {
        const appleUser = JSON.parse(appleUserJson);
        if (!email && appleUser.email) email = appleUser.email;
        if (appleUser.name) name = `${appleUser.name.firstName || ""} ${appleUser.name.lastName || ""}`.trim();
      } catch {}
    }

    if (!email && !appleSub) throw new Error("No email or sub from Apple");

    // Find existing user by apple_sub first, then email
    let { data: user } = await supabase
      .from("users")
      .select("*")
      .eq("apple_sub", appleSub)
      .single();

    if (!user && email) {
      const { data: byEmail } = await supabase
        .from("users")
        .select("*")
        .eq("email", email)
        .single();
      user = byEmail;
    }

    if (user) {
      // Update apple_sub if we now have it
      if (appleSub && !user.apple_sub) {
        await supabase.from("users").update({ apple_sub: appleSub }).eq("id", user.id);
      }
    } else {
      if (!email) throw new Error("Cannot create account — Apple did not provide an email");
      const { data: created, error: createErr } = await supabase
        .from("users")
        .insert({ email, name: name || email.split("@")[0], plan: "free", apple_sub: appleSub })
        .select()
        .single();
      if (createErr) throw new Error(createErr.message);
      user = created;
    }

    const token = signToken({ userId: user.id, email: user.email, role: "user" });
    res.redirect(`${frontendBase}/dashboard?token=${token}`);
  } catch (err) {
    console.error("[auth/apple] Callback error:", err.message);
    res.redirect(`${frontendBase}/login?error=${encodeURIComponent("Apple Sign In failed — please try again")}`);
  }
});

module.exports = router;
