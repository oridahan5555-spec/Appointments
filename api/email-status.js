"use strict";

module.exports = function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }

  const configured = process.env.EMAIL_PROVIDER === "brevo"
    && Boolean(process.env.BREVO_API_KEY)
    && Boolean(process.env.EMAIL_FROM)
    && Boolean(process.env.SUPABASE_URL)
    && Boolean(process.env.SUPABASE_ANON_KEY);

  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({
    configured,
    provider: configured ? "brevo" : null
  });
};
