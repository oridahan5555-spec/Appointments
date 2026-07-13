"use strict";

function hasValidSender(value) {
  const normalized = String(value || "").trim();
  const displayMatch = normalized.match(/^(.*?)\s*<([^<>]+)>$/);
  const email = String(displayMatch?.[2] || normalized).trim();
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

module.exports = function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.statusCode = 405;
    res.end(JSON.stringify({ ok: false, error: "Method not allowed" }));
    return;
  }

  const configured = process.env.EMAIL_PROVIDER === "brevo"
    && Boolean(process.env.BREVO_API_KEY)
    && hasValidSender(process.env.EMAIL_FROM)
    && Boolean(process.env.SUPABASE_URL)
    && Boolean(process.env.SUPABASE_ANON_KEY);

  res.statusCode = 200;
  res.end(JSON.stringify({
    configured,
    provider: configured ? "brevo" : null
  }));
};
