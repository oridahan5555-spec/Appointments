"use strict";

const BREVO_ENDPOINT = "https://api.brevo.com/v3/smtp/email";
const REQUEST_WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 20;
const MAX_FIELD_LENGTH = 2_000;
const requestBuckets = new Map();
const recentEvents = new Map();
let cachedOwnerEmail = "";
let cachedOwnerEmailAt = 0;

const EMAIL_TYPES = Object.freeze({
  test_email: { subject: "בדיקת אימייל ממערכת התורים", owner: true, message: "זהו אימייל ניסיון. מערכת שליחת האימיילים פועלת כראוי." },
  booking_created_owner: { subject: "נקבע תור חדש באתר", owner: true, message: "נקבע תור חדש באתר וממתין לטיפולך." },
  booking_created_customer: { subject: "התור שלך התקבל וממתין לאישור", message: "בקשת התור התקבלה ונשלחה לאישור בעלת העסק." },
  booking_approved_customer: { subject: "התור שלך אושר", message: "התור שלך אושר. נשמח לראותך!" },
  booking_rejected_customer: { subject: "התור שלך לא אושר", message: "לצערנו התור שביקשת לא אושר. אפשר לחזור לאתר ולבחור מועד אחר." },
  booking_cancelled_owner: { subject: "לקוחה ביטלה תור", owner: true, message: "לקוחה ביטלה תור והשעה התפנתה." },
  booking_cancelled_customer: { subject: "התור שלך בוטל", message: "ביטול התור נקלט בהצלחה." },
  booking_rescheduled_customer: { subject: "התור שלך עודכן", message: "פרטי התור שלך עודכנו. הפרטים החדשים מופיעים בהמשך ההודעה." },
  attendance_confirmation_customer: { subject: "אישור הגעה לתור שלך", message: "בעלת העסק מבקשת לדעת אם תגיעי לתור." },
  reminder_customer: { subject: "תזכורת לתור שלך", message: "זוהי תזכורת לתור הקרוב שלך." }
});

function sendJson(res, status, body) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body !== "string" || req.body.length > 50_000) return null;
  try {
    return JSON.parse(req.body);
  } catch {
    return null;
  }
}

function cleanText(value, maxLength = MAX_FIELD_LENGTH) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, maxLength);
}

function escapeHtml(value) {
  return cleanText(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  })[character]);
}

function isEmail(value) {
  const normalized = String(value || "").trim();
  return normalized.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
}

function getClientIp(req) {
  return cleanText(String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown").split(",")[0], 100);
}

function isRateLimited(req) {
  const now = Date.now();
  const key = getClientIp(req);
  const bucket = requestBuckets.get(key);
  if (!bucket || now - bucket.startedAt > REQUEST_WINDOW_MS) {
    requestBuckets.set(key, { startedAt: now, count: 1 });
    return false;
  }
  bucket.count += 1;
  return bucket.count > MAX_REQUESTS_PER_WINDOW;
}

function cleanupRecentEvents() {
  const cutoff = Date.now() - 15 * 60_000;
  for (const [key, createdAt] of recentEvents) {
    if (createdAt < cutoff) recentEvents.delete(key);
  }
}

function siteUrl() {
  const fallback = "https://appointments-rosy-chi.vercel.app";
  try {
    const url = new URL(process.env.SITE_BASE_URL || fallback);
    return url.protocol === "https:" ? url.origin : fallback;
  } catch {
    return fallback;
  }
}

function bookingUrl(payload, owner) {
  const bookingId = cleanText(payload.bookingId, 100);
  const page = owner ? "owner.html" : "index.html";
  return bookingId
    ? `${siteUrl()}/${page}?booking=${encodeURIComponent(bookingId)}`
    : `${siteUrl()}/${page}`;
}

async function getOwnerEmailFromDatabase() {
  if (cachedOwnerEmail && Date.now() - cachedOwnerEmailAt < 60_000) return cachedOwnerEmail;

  const supabaseUrl = String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
  const supabaseAnonKey = String(process.env.SUPABASE_ANON_KEY || "");
  if (!supabaseUrl || !supabaseAnonKey) return "";

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3_000);
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/business?select=owner_email&order=created_at.asc&limit=1`, {
      headers: { apikey: supabaseAnonKey, Authorization: `Bearer ${supabaseAnonKey}`, Accept: "application/json" },
      signal: controller.signal
    });
    if (!response.ok) return "";
    const rows = await response.json();
    const email = String(rows?.[0]?.owner_email || "").trim().toLowerCase();
    if (!isEmail(email)) return "";
    cachedOwnerEmail = email;
    cachedOwnerEmailAt = Date.now();
    return email;
  } catch {
    return "";
  } finally {
    clearTimeout(timeoutId);
  }
}

function detailRows(payload) {
  return [
    ["עסק", payload.businessName],
    ["שירות", payload.serviceName],
    ["תאריך", payload.bookingDate],
    ["שעה", payload.bookingTime],
    ["שם הלקוחה", payload.customerName],
    ["טלפון", payload.customerPhone],
    ["אימייל", payload.customerEmail],
    ["הערות", payload.notes]
  ].filter(([, value]) => cleanText(value)).map(([label, value]) => `
    <tr>
      <td style="padding:8px 0;color:#667085;vertical-align:top;width:110px">${escapeHtml(label)}</td>
      <td style="padding:8px 0;color:#1f2937;font-weight:600">${escapeHtml(value)}</td>
    </tr>`).join("");
}

function buildEmail(type, payload) {
  const definition = EMAIL_TYPES[type];
  const businessName = cleanText(payload.businessName, 200) || "העסק";
  const actionUrl = bookingUrl(payload, definition.owner);
  const actionLabel = definition.owner ? "פתחי את התור בניהול" : "צפייה בפרטי התור";
  const rows = detailRows(payload);
  const html = `<!doctype html>
  <html lang="he" dir="rtl">
    <body style="margin:0;background:#f5f7fb;font-family:Arial,sans-serif;direction:rtl;text-align:right;color:#1f2937">
      <div style="max-width:620px;margin:0 auto;padding:24px 12px">
        <div style="background:#fff;border:1px solid #e5e7eb;border-radius:18px;padding:28px">
          <div style="font-size:13px;color:#7c3aed;margin-bottom:8px">${escapeHtml(businessName)}</div>
          <h1 style="font-size:24px;line-height:1.35;margin:0 0 14px">${escapeHtml(definition.subject)}</h1>
          <p style="font-size:16px;line-height:1.7;margin:0 0 18px">${escapeHtml(definition.message)}</p>
          ${rows ? `<table role="presentation" style="width:100%;border-collapse:collapse;border-top:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb;margin:18px 0">${rows}</table>` : ""}
          <a href="${escapeHtml(actionUrl)}" style="display:inline-block;background:#7c3aed;color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:10px">${escapeHtml(actionLabel)}</a>
          <p style="font-size:12px;line-height:1.6;color:#98a2b3;margin:24px 0 0">הודעה זו נשלחה ממערכת התורים.</p>
        </div>
      </div>
    </body>
  </html>`;
  const text = [
    definition.message,
    payload.businessName && `עסק: ${cleanText(payload.businessName)}`,
    payload.serviceName && `שירות: ${cleanText(payload.serviceName)}`,
    payload.bookingDate && `תאריך: ${cleanText(payload.bookingDate)}`,
    payload.bookingTime && `שעה: ${cleanText(payload.bookingTime)}`,
    payload.customerName && `שם הלקוחה: ${cleanText(payload.customerName)}`,
    payload.customerPhone && `טלפון: ${cleanText(payload.customerPhone)}`,
    payload.notes && `הערות: ${cleanText(payload.notes)}`,
    `${actionLabel}: ${actionUrl}`,
    "הודעה זו נשלחה ממערכת התורים."
  ].filter(Boolean).join("\n");
  return { subject: definition.subject, html, text };
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { ok: false, error: "Method not allowed" });
  }
  if (isRateLimited(req)) return sendJson(res, 429, { ok: false, error: "Too many requests" });

  const body = readBody(req);
  const type = cleanText(body?.type, 100);
  const definition = EMAIL_TYPES[type];
  if (!definition) return sendJson(res, 400, { ok: false, error: "Unknown email type" });

  const payload = body?.payload && typeof body.payload === "object" && !Array.isArray(body.payload) ? body.payload : {};
  if (type !== "test_email" && !cleanText(payload.bookingId, 100)) {
    return sendJson(res, 400, { ok: false, error: "Missing booking id" });
  }

  if (process.env.EMAIL_PROVIDER !== "brevo" || !process.env.BREVO_API_KEY || !process.env.EMAIL_FROM || !isEmail(process.env.EMAIL_FROM)) {
    return sendJson(res, 200, { ok: false, skipped: true, reason: "Email provider is not configured" });
  }

  const requestedRecipient = cleanText(body?.to, 254).toLowerCase();
  const recipient = definition.owner ? await getOwnerEmailFromDatabase() : requestedRecipient;
  if (definition.owner && !recipient) {
    return sendJson(res, 200, { ok: false, skipped: true, reason: "Owner email is not configured" });
  }
  if (!isEmail(recipient)) return sendJson(res, 400, { ok: false, error: "Invalid recipient" });
  if (!definition.owner && cleanText(payload.customerEmail, 254).toLowerCase() !== recipient) {
    return sendJson(res, 400, { ok: false, error: "Recipient does not match booking customer" });
  }

  const eventKey = cleanText(body?.eventKey, 300);
  cleanupRecentEvents();
  if (eventKey && recentEvents.has(eventKey)) return sendJson(res, 200, { ok: true, duplicate: true });

  try {
    const email = buildEmail(type, payload);
    const response = await fetch(BREVO_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "api-key": process.env.BREVO_API_KEY
      },
      body: JSON.stringify({
        sender: {
          email: process.env.EMAIL_FROM,
          name: "מערכת התורים"
        },
        to: [{ email: recipient }],
        subject: email.subject,
        htmlContent: email.html,
        textContent: email.text
      })
    });

    if (!response.ok) {
      console.error("Brevo email request failed", { status: response.status });
      return sendJson(res, 502, { ok: false, error: "Email provider rejected the request" });
    }
    if (eventKey) recentEvents.set(eventKey, Date.now());
    return sendJson(res, 200, { ok: true });
  } catch (error) {
    console.error("Email delivery failed", { message: String(error?.message || "Unknown error").slice(0, 300) });
    return sendJson(res, 502, { ok: false, error: "Email delivery failed" });
  }
};

// TODO before production: verify bookingId and customer recipient server-side against Supabase.
