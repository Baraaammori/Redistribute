// ─── Settings Route ───────────────────────────────────────────────────────────
// POST /api/settings/watermark  — Upload + store watermark config
// GET  /api/settings/watermark  — Get current watermark settings
// ─────────────────────────────────────────────────────────────────────────────
const router  = require("express").Router();
const multer  = require("multer");
const path    = require("path");
const fs      = require("fs");
const supabase = require("../lib/supabase");
const { authenticateToken } = require("../middleware/auth");
const { uploadFile } = require("../lib/storage");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
  fileFilter: (_req, file, cb) => {
    const ok = ["image/png", "image/svg+xml"].includes(file.mimetype);
    cb(ok ? null : new Error("Only PNG and SVG files are allowed"), ok);
  },
});

// GET /api/settings/watermark
router.get("/watermark", authenticateToken, async (req, res) => {
  const userId = req.user?.userId || req.user?.id;
  const { data } = await supabase
    .from("user_settings")
    .select("watermark_url, watermark_position, watermark_opacity, watermark_scale")
    .eq("user_id", userId)
    .single();

  res.json(data || {});
});

// POST /api/settings/watermark
router.post("/watermark", authenticateToken, upload.single("watermark"), async (req, res) => {
  const userId = req.user?.userId || req.user?.id;
  if (!req.file) return res.status(400).json({ error: "No watermark file provided" });

  const { position = "bottom-right", opacity = "0.8", scale = "0.12" } = req.body;

  try {
    const ext = req.file.mimetype === "image/svg+xml" ? ".svg" : ".png";
    const storagePath = `watermarks/${userId}/watermark${ext}`;

    const publicUrl = await uploadFile(storagePath, req.file.buffer, req.file.mimetype);

    await supabase.from("user_settings").upsert({
      user_id: userId,
      watermark_url: publicUrl,
      watermark_position: position,
      watermark_opacity: parseFloat(opacity),
      watermark_scale: parseFloat(scale),
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });

    res.json({ watermark_url: publicUrl, position, opacity: parseFloat(opacity), scale: parseFloat(scale) });
  } catch (err) {
    console.error("[settings] Watermark upload error:", err.message);
    res.status(500).json({ error: "Failed to save watermark" });
  }
});

module.exports = router;
