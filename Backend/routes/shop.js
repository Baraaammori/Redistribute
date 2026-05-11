const router = require("express").Router();
const supabase = require("../lib/supabase");
const { authenticateToken, requireAdmin } = require("../middleware/auth");

// GET /api/shop/items  (public)
router.get("/items", async (req, res) => {
  const { data, error } = await supabase.from("shop_items").select("*").order("created_at", { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// POST /api/shop/items  (admin only)
router.post("/items", authenticateToken, requireAdmin, async (req, res) => {
  const { name, price, category, description, image_url, stock } = req.body;
  const { data, error } = await supabase
    .from("shop_items")
    .insert({ name, price, category, description, image_url, stock })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// PUT /api/shop/items/:id  (admin only)
router.put("/items/:id", authenticateToken, requireAdmin, async (req, res) => {
  const { data, error } = await supabase
    .from("shop_items")
    .update(req.body)
    .eq("id", req.params.id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// DELETE /api/shop/items/:id  (admin only)
router.delete("/items/:id", authenticateToken, requireAdmin, async (req, res) => {
  const { error } = await supabase.from("shop_items").delete().eq("id", req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

module.exports = router;
