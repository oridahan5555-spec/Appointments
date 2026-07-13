"use strict";

const { createHash } = require("node:crypto");

const BREVO_ENDPOINT = "https://api.brevo.com/v3/smtp/email";
const REQUEST_WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 12;
const MAX_TEST_REQUESTS_PER_WINDOW = 3;
const MAX_BODY_BYTES = 12_000;
const MAX_FIELD_LENGTH = 2_000;
const requestBuckets = new Map();
const recentEvents = new Map();

const EMAIL_TYPES = Object.freeze({
  test_email: { subject: "בדיקת אימייל ממערכת התורים", owner: true, actor: "owner", message: "זהו אימייל ניסיון. מערכת שליחת האימיילים פועלת כראוי." },
  booking_created_owner: { subject: "בקשה חדשה לתור התקבלה", owner: true, actor: "customer", statuses: ["pending"], message: "בקשה חדשה לתור התקבלה וממתינה לטיפולך." },
  booking_created_customer: { subject: "הבקשה שלך התקבלה וממתינה לאישור", actor: "customer", statuses: ["pending"], message: "הבקשה שלך התקבלה וממתינה לאישור בעלת העסק." },
  booking_approved_customer: { subject: "התור שלך אושר", actor: "owner", statuses: ["approved"], message: "התור שלך אושר. נשמח לראותך!" },
  booking_rejected_customer: { subject: "הבקשה שלך לא אושרה", actor: "owner", statuses: ["rejected"], message: "לצערנו הבקשה שלך לא אושרה. אפשר לחזור לאתר ולבחור מועד אחר." },
  booking_cancelled_owner: { subject: "לקוחה ביטלה תור", owner: true, actor: "customer", statuses: ["cancelled"], message: "לקוחה ביטלה תור והשעה התפנתה." },
  booking_cancelled_customer: { subject: "התור שלך בוטל", actor: "either", statuses: ["cancelled"], message: "ביטול התור נקלט בהצלחה." },
  booking_rescheduled_customer: { subject: "התור שלך עודכן", actor: "owner", statuses: ["approved"], rescheduleOnly: true, message: "פרטי התור שלך עודכנו. הפרטים החדשים מופיעים בהמשך ההודעה." },
  attendance_confirmation_customer: { subject: "אישור הגעה לתור שלך", actor: "owner", statuses: ["approved"], attendanceRequestOnly: true, message: "בעלת העסק מבקשת לדעת אם תגיעי לתור." },
  attendance_response_owner: { subject: "הלקוחה עדכנה אישור הגעה", owner: true, actor: "customer", statuses: ["approved"], attendanceResponseOnly: true, message: "הלקוחה עדכנה אם תגיע לתור. הפרטים מופיעים למטה." },
  reminder_customer: { subject: "תזכורת לתור שלך", actor: "owner", statuses: ["approved"], message: "זוהי תזכורת לתור הקרוב שלך." }
});

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.end(JSON.stringify(body));
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

function parseSender(value) {
  const normalized = String(value || "").trim();
  const displayMatch = normalized.match(/^(.*?)\s*<([^<>]+)>$/);
  const email = String(displayMatch?.[2] || normalized).trim().toLowerCase();
  if (!isEmail(email)) return null;

  const suppliedName = String(displayMatch?.[1] || "")
    .trim()
    .replace(/^["']|["']$/g, "")
    .slice(0, 70);
  return { email, name: suppliedName || "Appointments" };
}

function readBody(req) {
  const contentLength = Number(req.headers?.["content-length"] || 0);
  if (contentLength > MAX_BODY_BYTES) return null;
  if (req.body && typeof req.body === "object" && !Array.isArray(req.body)) {
    return JSON.stringify(req.body).length <= MAX_BODY_BYTES ? req.body : null;
  }
  if (typeof req.body !== "string" || req.body.length > MAX_BODY_BYTES) return null;
  try {
    const parsed = JSON.parse(req.body);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function getAccessToken(req) {
  const authorization = String(req.headers?.authorization || "");
  const match = authorization.match(/^Bearer\s+([^\s]+)$/i);
  return match ? match[1] : "";
}

function getClientIp(req) {
  const forwarded = req.headers?.["x-vercel-forwarded-for"] || req.headers?.["x-forwarded-for"] || req.headers?.["x-real-ip"];
  return cleanText(String(forwarded || req.socket?.remoteAddress || "unknown").split(",")[0], 100);
}

function hashToken(token) {
  return createHash("sha256").update(token).digest("hex").slice(0, 24);
}

function isRateLimited(req, token, type) {
  const now = Date.now();
  const key = `${getClientIp(req)}:${hashToken(token)}:${type === "test_email" ? "test" : "email"}`;
  const limit = type === "test_email" ? MAX_TEST_REQUESTS_PER_WINDOW : MAX_REQUESTS_PER_WINDOW;
  const bucket = requestBuckets.get(key);
  if (!bucket || now - bucket.startedAt > REQUEST_WINDOW_MS) {
    requestBuckets.set(key, { startedAt: now, count: 1 });
    return false;
  }
  bucket.count += 1;
  return bucket.count > limit;
}

function cleanupMemoryGuards() {
  const cutoff = Date.now() - 15 * 60_000;
  for (const [key, createdAt] of recentEvents) {
    if (createdAt < cutoff) recentEvents.delete(key);
  }
  for (const [key, bucket] of requestBuckets) {
    if (bucket.startedAt < cutoff) requestBuckets.delete(key);
  }
}

function getSupabaseConfig() {
  return {
    url: String(process.env.SUPABASE_URL || "").replace(/\/$/, ""),
    anonKey: String(process.env.SUPABASE_ANON_KEY || "")
  };
}

async function callSupabaseRpc(name, args, token) {
  const { url, anonKey } = getSupabaseConfig();
  if (!url || !anonKey) throw Object.assign(new Error("SERVER_NOT_CONFIGURED"), { status: 503 });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5_000);
  try {
    const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify(args || {}),
      signal: controller.signal
    });
    const result = await response.json().catch(() => null);
    if (!response.ok) {
      console.warn("Supabase email authorization failed", { rpc: name, status: response.status, code: cleanText(result?.code, 30) });
      throw Object.assign(new Error("NOT_AUTHORIZED"), { status: response.status === 401 ? 401 : 403 });
    }
    return result ?? null;
  } catch (error) {
    if (error?.name === "AbortError") throw Object.assign(new Error("DATABASE_TIMEOUT"), { status: 503 });
    throw error;
  } finally {
    clearTimeout(timeoutId);
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

function bookingUrl(context, owner) {
  const bookingId = cleanText(context.booking_id, 100);
  const page = owner ? "owner.html" : "index.html";
  return bookingId ? `${siteUrl()}/${page}?booking=${encodeURIComponent(bookingId)}` : `${siteUrl()}/${page}`;
}

function validateEventContext(type, definition, context) {
  const isOwner = context.actor_is_owner === true;
  const isCustomer = context.actor_is_customer === true;
  if (definition.actor === "owner" && !isOwner) return false;
  if (definition.actor === "customer" && !isCustomer) return false;
  if (definition.actor === "either" && !isOwner && !isCustomer) return false;
  if (definition.statuses && !definition.statuses.includes(String(context.status || ""))) return false;
  if (definition.rescheduleOnly && !context.replaces_booking_id) return false;
  if (definition.attendanceRequestOnly && !context.attendance_confirmation_requested_at) return false;
  if (definition.attendanceResponseOnly && !["confirmed", "declined"].includes(String(context.attendance_confirmation_status || ""))) return false;
  return true;
}

function detailRows(context) {
  return [
    ["עסק", context.business_name],
    ["כתובת", context.business_address],
    ["טלפון העסק", context.business_phone],
    ["שירות", context.service_name],
    ["תאריך", context.booking_date],
    ["שעה", context.booking_time],
    ["שם הלקוחה", context.customer_name],
    ["טלפון", context.customer_phone],
    ["אימייל", context.customer_email],
    ["הערות", context.notes]
  ].filter(([, value]) => cleanText(value)).map(([label, value]) => `
    <tr>
      <td style="padding:8px 0;color:#667085;vertical-align:top;width:110px">${escapeHtml(label)}</td>
      <td style="padding:8px 0;color:#1f2937;font-weight:600">${escapeHtml(value)}</td>
    </tr>`).join("");
}

function buildEmail(type, context) {
  const definition = EMAIL_TYPES[type];
  const businessName = cleanText(context.business_name, 200) || "העסק";
  const actionUrl = bookingUrl(context, definition.owner);
  const actionLabel = definition.owner ? "פתחי את התור בניהול" : "צפייה בפרטי התור";
  const rows = detailRows(context);
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
    context.business_name && `עסק: ${cleanText(context.business_name)}`,
    context.service_name && `שירות: ${cleanText(context.service_name)}`,
    context.booking_date && `תאריך: ${cleanText(context.booking_date)}`,
    context.booking_time && `שעה: ${cleanText(context.booking_time)}`,
    context.customer_name && `שם הלקוחה: ${cleanText(context.customer_name)}`,
    context.customer_phone && `טלפון: ${cleanText(context.customer_phone)}`,
    context.notes && `הערות: ${cleanText(context.notes)}`,
    `${actionLabel}: ${actionUrl}`,
    "הודעה זו נשלחה ממערכת התורים."
  ].filter(Boolean).join("\n");
  return { subject: definition.subject, html, text };
}

async function sendWithBrevo(recipient, email, sender) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(BREVO_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", "api-key": process.env.BREVO_API_KEY },
      body: JSON.stringify({
        sender,
        to: [{ email: recipient }],
        subject: email.subject,
        htmlContent: email.html,
        textContent: email.text
      }),
      signal: controller.signal
    });
    if (!response.ok) {
      console.error("Brevo email request failed", { status: response.status });
      throw Object.assign(new Error("PROVIDER_REJECTED"), { status: 502 });
    }
  } catch (error) {
    if (error?.name === "AbortError") throw Object.assign(new Error("PROVIDER_TIMEOUT"), { status: 504 });
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { ok: false, error: "Method not allowed" });
  }
  if (!String(req.headers?.["content-type"] || "").toLowerCase().includes("application/json")) {
    return sendJson(res, 415, { ok: false, error: "Content-Type must be application/json" });
  }

  const body = readBody(req);
  if (!body) return sendJson(res, 400, { ok: false, error: "Invalid JSON body" });
  const type = cleanText(body.type, 100);
  const definition = EMAIL_TYPES[type];
  if (!definition) return sendJson(res, 400, { ok: false, error: "Unknown email type" });

  const token = getAccessToken(req);
  if (!token) return sendJson(res, 401, { ok: false, error: "Authentication required" });
  cleanupMemoryGuards();
  if (isRateLimited(req, token, type)) return sendJson(res, 429, { ok: false, error: "Too many requests" });

  const sender = parseSender(process.env.EMAIL_FROM);
  if (process.env.EMAIL_PROVIDER !== "brevo" || !process.env.BREVO_API_KEY || !sender) {
    return sendJson(res, 200, { ok: false, skipped: true, reason: "Email provider is not configured" });
  }

  try {
    let context;
    let bookingId = "";
    if (type === "test_email") {
      context = await callSupabaseRpc("get_owner_email_context", {}, token);
    } else {
      bookingId = cleanText(body.bookingId, 100);
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(bookingId)) {
        return sendJson(res, 400, { ok: false, error: "Invalid booking id" });
      }
      context = await callSupabaseRpc("get_booking_email_context", { p_booking_id: bookingId }, token);
      if (!context || typeof context !== "object" || String(context.booking_id || "").toLowerCase() !== bookingId.toLowerCase()) {
        return sendJson(res, 403, { ok: false, error: "Event is not allowed for this booking" });
      }
    }

    if (!context || typeof context !== "object") {
      return sendJson(res, 403, { ok: false, error: "Event is not allowed" });
    }

    if (!validateEventContext(type, definition, context)) {
      return sendJson(res, 403, { ok: false, error: "Event is not allowed for this booking" });
    }

    const recipient = String(definition.owner ? context.owner_email : context.customer_email || "").trim().toLowerCase();
    if (!recipient) return sendJson(res, 200, { ok: false, skipped: true, reason: definition.owner ? "Owner email is not configured" : "Customer email is not configured" });
    if (!isEmail(recipient)) return sendJson(res, 422, { ok: false, error: "Saved recipient email is invalid" });

    const actorId = cleanText(context.actor_user_id, 100);
    const eventKey = type === "test_email"
      ? `${type}:${actorId}:${Math.floor(Date.now() / REQUEST_WINDOW_MS)}`
      : `${type}:${cleanText(context.booking_id, 100)}`;
    if (recentEvents.has(eventKey)) return sendJson(res, 200, { ok: true, duplicate: true });

    let deliveryClaim = "";
    if (type !== "test_email") {
      const claimResult = await callSupabaseRpc("claim_email_delivery_event", {
        p_booking_id: bookingId,
        p_event_type: type
      }, token);
      deliveryClaim = cleanText(claimResult, 300);
      if (!deliveryClaim) return sendJson(res, 200, { ok: true, duplicate: true });
    }

    try {
      await sendWithBrevo(recipient, buildEmail(type, context), sender);
    } catch (error) {
      if (deliveryClaim) {
        await callSupabaseRpc("release_email_delivery_event", { p_event_key: deliveryClaim }, token).catch(() => null);
      }
      throw error;
    }

    if (deliveryClaim) {
      await callSupabaseRpc("complete_email_delivery_event", { p_event_key: deliveryClaim }, token).catch((error) => {
        console.warn("Email delivery receipt could not be persisted", { status: Number(error?.status || 0) });
      });
    }
    recentEvents.set(eventKey, Date.now());
    return sendJson(res, 200, { ok: true });
  } catch (error) {
    const status = Number(error?.status || 502);
    if (status === 401 || status === 403) return sendJson(res, status, { ok: false, error: "Not authorized" });
    console.error("Email delivery failed", { reason: cleanText(error?.message || "UNKNOWN", 80), status });
    return sendJson(res, status >= 400 && status < 600 ? status : 502, { ok: false, error: "Email delivery failed" });
  }
};
