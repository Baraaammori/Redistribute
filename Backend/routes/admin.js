const router = require("express").Router();
const jwt = require("jsonwebtoken");

// POST /api/admin/verify-password
router.post("/verify-password", (req, res) => {
  const { password } = req.body;
  if (password !== process.env.ADMIN_MASTER_PASSWORD) {
    return res.status(401).json({ error: "Invalid admin password" });
  }
  const token = jwt.sign({ role: "admin" }, process.env.JWT_SECRET, { expiresIn: "7d" });
  res.json({ token });
});

module.exports = router;
