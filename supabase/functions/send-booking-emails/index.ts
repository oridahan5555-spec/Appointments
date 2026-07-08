import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY") || "";
const WORKER_SECRET = Deno.env.get("WORKER_SECRET") || "";
const EMAIL_FROM = Deno.env.get("EMAIL_FROM") || "";
const PUBLIC_SITE_URL = (Deno.env.get("PUBLIC_SITE_URL") || "https://appointments-rosy-chi.vercel.app").replace(/\/$/, "");
const ACTION_URL = `${SUPABASE_URL}/functions/v1/booking-email-action`;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

type OutboxRow = {
  id: string;
  event_key: string;
  event_type: string;
  recipient_type: "customer" | "owner";
  recipient_user_id: string | null;
  recipient_email: string | null;
  booking_id: string | null;
  payload: Record<string, unknown>;
  attempt_count: number;
  email_subject: string | null;
  rendered_html: string | null;
};

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function parseSender(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return { name: "Appointments", email: "" };
  const match = trimmed.match(/^(.*)<([^>]+)>$/);
  if (match) {
    return {
      name: match[1].trim().replaceAll(/^"|"$/g, "") || "Appointments",
      email: match[2].trim()
    };
  }
  return { name: "Appointments", email: trimmed };
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function createActionToken(row: OutboxRow, action: "confirm" | "cancel" | "view" | "ics") {
  if (!row.booking_id) return "";
  const rawToken = randomToken();
  const tokenHash = await sha256(rawToken);
  const bookingDate = String(row.payload.booking_date || "");
  const bookingTime = String(row.payload.booking_time || "00:00");
  const appointmentTime = new Date(`${bookingDate}T${bookingTime}:00+03:00`);
  const fallback = Date.now() + 30 * 24 * 60 * 60 * 1000;
  const appointmentMillis = Number.isNaN(appointmentTime.getTime()) ? fallback : appointmentTime.getTime();
  const isReadOnlyAction = action === "view" || action === "ics";
  const appointmentBound = appointmentMillis + (isReadOnlyAction ? 30 : 1) * 24 * 60 * 60 * 1000;
  const lifetimeBound = Date.now() + (isReadOnlyAction ? 30 : 14) * 24 * 60 * 60 * 1000;
  const expiresAt = new Date(Math.min(appointmentBound, lifetimeBound)).toISOString();

  const { error } = await supabase.from("booking_action_tokens").upsert({
    outbox_id: row.id,
    booking_id: row.booking_id,
    action,
    token_hash: tokenHash,
    expires_at: expiresAt,
    single_use: action === "confirm" || action === "cancel",
    used_at: null
  }, { onConflict: "outbox_id,action" });
  if (error) throw error;
  return rawToken;
}

async function resolveRecipient(row: OutboxRow) {
  if (row.recipient_email) return row.recipient_email;
  if (!row.recipient_user_id) return "";
  const { data, error } = await supabase.auth.admin.getUserById(row.recipient_user_id);
  if (error) throw error;
  return data.user?.email || "";
}

function eventCopy(eventType: string, payload: Record<string, unknown>) {
  const service = String(payload.service_name || "התור");
  const date = String(payload.booking_date || "");
  const time = String(payload.booking_time || "");
  const customer = String(payload.customer_name || "לקוחה");
  const copies: Record<string, [string, string]> = {
    booking_created: ["בקשת התור התקבלה", `בקשת התור ל${service} התקבלה וממתינה לאישור.`],
    booking_approved: ["התור אושר", `התור ל${service} אושר.`],
    booking_rejected: ["התור נדחה", `התור ל${service} נדחה.`],
    booking_cancelled: ["ביטול התור נקלט", `התור ל${service} בוטל והביטול נקלט במערכת.`],
    owner_appointment_booked: ["נקבע תור חדש", `${customer} קבעה תור ל${service}.`],
    owner_appointment_rescheduled: ["בקשת שינוי תור", `${customer} ביקשה לשנות תור ל${service}.`],
    owner_appointment_cancelled: ["לקוחה ביטלה תור", `${customer} ביטלה את התור ל${service}.`],
    owner_attendance_confirmed: ["הלקוחה אישרה הגעה", `${customer} אישרה הגעה לתור ל${service}.`],
    owner_attendance_declined: ["הלקוחה לא תגיע", `${customer} סימנה שלא תגיע לתור ל${service}.`],
    owner_waitlist_joined: ["הצטרפות לרשימת המתנה", `${customer} הצטרפה לרשימת ההמתנה ל${service}.`],
    waitlist_opened: ["התפנה מקום לתור", `התפנה מקום ל${service} בתאריך ${date}. אפשר להיכנס לאתר ולקבוע.`]
  };
  if (eventType.startsWith("booking_changed_")) return ["פרטי התור השתנו", `התור ל${service} עודכן.`] as [string, string];
  if (eventType.startsWith("reminder:")) return ["תזכורת לתור מחר", `מחר יש לך תור ל${service}.`] as [string, string];
  return copies[eventType] || ["עדכון בנוגע לתור", `יש עדכון בנוגע לתור ל${service}.`];
}

function googleCalendarUrl(payload: Record<string, unknown>) {
  const dateValue = String(payload.booking_date || "");
  const timeValue = String(payload.booking_time || "00:00");
  const duration = Number(payload.duration_minutes || 30);
  const [year, month, day] = dateValue.split("-").map(Number);
  const [hour, minute] = timeValue.split(":").map(Number);
  const start = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const end = new Date(start.getTime() + duration * 60_000);
  const formatLocalClock = (value: Date) => [
    value.getUTCFullYear().toString().padStart(4, "0"),
    (value.getUTCMonth() + 1).toString().padStart(2, "0"),
    value.getUTCDate().toString().padStart(2, "0"),
    "T",
    value.getUTCHours().toString().padStart(2, "0"),
    value.getUTCMinutes().toString().padStart(2, "0"),
    "00"
  ].join("");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `${payload.business_name || "העסק"} - ${payload.service_name || "תור"}`,
    dates: `${formatLocalClock(start)}/${formatLocalClock(end)}`,
    ctz: "Asia/Jerusalem",
    details: `תור ל${payload.service_name || "שירות"}`,
    location: String(payload.business_address || "")
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

async function buildEmail(row: OutboxRow) {
  const payload = row.payload || {};
  const [subject, intro] = eventCopy(row.event_type, payload);
  const isCustomer = row.recipient_type === "customer" && Boolean(row.booking_id);
  const isActiveBooking = ["pending", "approved"].includes(String(payload.status || ""));
  const tokens = isCustomer ? {
    confirm: isActiveBooking ? await createActionToken(row, "confirm") : "",
    cancel: isActiveBooking ? await createActionToken(row, "cancel") : "",
    view: await createActionToken(row, "view"),
    ics: await createActionToken(row, "ics")
  } : null;
  const ownerLink = row.booking_id
    ? `${PUBLIC_SITE_URL}/owner.html?booking=${encodeURIComponent(row.booking_id)}`
    : `${PUBLIC_SITE_URL}/owner.html#ownerWaitlistSection`;
  const viewLink = tokens ? `${PUBLIC_SITE_URL}/index.html?emailToken=${encodeURIComponent(tokens.view)}` : ownerLink;
  const actionSiteLink = (action: "confirm" | "cancel", token: string) => {
    const url = new URL(`${PUBLIC_SITE_URL}/index.html`);
    url.searchParams.set("emailIntent", action);
    url.searchParams.set("emailActionToken", token);
    return url.toString();
  };
  const button = (label: string, href: string, color = "#7c3aed") =>
    `<a href="${escapeHtml(href)}" style="display:inline-block;margin:6px 4px;padding:12px 18px;border-radius:10px;background:${color};color:#fff;text-decoration:none;font-weight:700">${escapeHtml(label)}</a>`;

  const actions = tokens
    ? [
        tokens.confirm ? button("אישור הגעה עכשיו", actionSiteLink("confirm", tokens.confirm), "#15803d") : "",
        tokens.cancel ? button("ביטול תור", actionSiteLink("cancel", tokens.cancel), "#b91c1c") : "",
        button("צפייה בתור", viewLink),
        button("Google Calendar", googleCalendarUrl(payload), "#2563eb"),
        button("הוספה ליומן / ICS", `${ACTION_URL}?action=ics&token=${encodeURIComponent(tokens.ics)}`, "#475569")
      ].join("")
    : button(row.booking_id ? "פתחי את התור" : "פתחי רשימת המתנה", ownerLink);

  const html = `<!doctype html><html lang="he" dir="rtl"><body style="margin:0;background:#f5f6fa;font-family:Arial,sans-serif;color:#20232d">
    <div style="max-width:620px;margin:24px auto;background:#fff;border-radius:18px;overflow:hidden;border:1px solid #e5e7eb">
      <div style="padding:24px;background:linear-gradient(135deg,#7c3aed,#db2777);color:#fff"><h1 style="margin:0;font-size:24px">${escapeHtml(subject)}</h1></div>
      <div style="padding:24px"><p style="font-size:17px;line-height:1.7">${escapeHtml(intro)}</p>
        <div style="padding:16px;border-radius:12px;background:#f8f7fc;line-height:1.9">
          <strong>${escapeHtml(payload.service_name || "")}</strong><br>
          תאריך: ${escapeHtml(payload.booking_date || "")}<br>
          שעה: ${escapeHtml(payload.booking_time || "")}<br>
          ${row.recipient_type === "owner" && payload.customer_name ? `לקוחה: ${escapeHtml(payload.customer_name)}<br>` : ""}
          ${row.recipient_type === "owner" && payload.customer_phone ? `טלפון לקוחה: ${escapeHtml(payload.customer_phone)}` : ""}
          ${row.recipient_type === "customer" && payload.business_address ? `כתובת: ${escapeHtml(payload.business_address)}<br>` : ""}
          ${row.recipient_type === "customer" && payload.business_phone ? `טלפון העסק: ${escapeHtml(payload.business_phone)}` : ""}
        </div>
        <div style="margin-top:20px;text-align:center">${actions}</div>
        <p style="margin-top:22px;color:#6b7280;font-size:13px">מטעמי אבטחה הקישורים מתאימים לתור הזה בלבד ומוגבלים בזמן.</p>
      </div>
    </div></body></html>`;
  return { subject, html };
}

async function markFailure(row: OutboxRow, error: unknown) {
  const delayMinutes = Math.min(60, 2 ** Math.max(1, row.attempt_count));
  await supabase.from("email_outbox").update({
    status: "failed",
    locked_at: null,
    last_error: String((error as Error)?.message || error).slice(0, 2000),
    next_attempt_at: new Date(Date.now() + delayMinutes * 60_000).toISOString(),
    updated_at: new Date().toISOString()
  }).eq("id", row.id);
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !BREVO_API_KEY || !WORKER_SECRET || !EMAIL_FROM) {
    return Response.json({ error: "Missing server secrets" }, { status: 500 });
  }
  if (request.headers.get("x-worker-secret") !== WORKER_SECRET) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  await supabase.rpc("enqueue_due_booking_reminders");
  const { data, error } = await supabase.rpc("claim_email_outbox", { p_limit: 20 });
  if (error) return Response.json({ error: error.message }, { status: 500 });

  let sent = 0;
  let failed = 0;
  let skipped = 0;
  for (const row of (data || []) as OutboxRow[]) {
    try {
      const recipient = await resolveRecipient(row);
      if (!recipient) {
        await supabase.from("email_outbox").update({ status: "skipped", last_error: "Recipient has no email", locked_at: null }).eq("id", row.id);
        skipped += 1;
        continue;
      }
      let email = row.email_subject && row.rendered_html
        ? { subject: row.email_subject, html: row.rendered_html }
        : await buildEmail(row);
      if (!row.email_subject || !row.rendered_html) {
        const { error: renderSaveError } = await supabase.from("email_outbox").update({
          email_subject: email.subject,
          rendered_html: email.html,
          updated_at: new Date().toISOString()
        }).eq("id", row.id);
        if (renderSaveError) throw renderSaveError;
      }
      const sender = parseSender(EMAIL_FROM);
      const response = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          accept: "application/json",
          "api-key": BREVO_API_KEY
        },
        body: JSON.stringify({
          sender,
          to: [{ email: recipient }],
          subject: email.subject,
          htmlContent: email.html
        })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.message || `Brevo failed with ${response.status}`);
      await supabase.from("email_outbox").update({
        status: "sent", sent_at: new Date().toISOString(), locked_at: null,
        provider_message_id: result.messageId || result.id || null, last_error: null, updated_at: new Date().toISOString()
      }).eq("id", row.id);
      sent += 1;
    } catch (sendError) {
      await markFailure(row, sendError);
      failed += 1;
    }
  }
  return Response.json({ processed: (data || []).length, sent, failed, skipped });
});
