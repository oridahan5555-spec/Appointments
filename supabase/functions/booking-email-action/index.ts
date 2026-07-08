import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const PUBLIC_SITE_URL = (Deno.env.get("PUBLIC_SITE_URL") || "https://appointments-rosy-chi.vercel.app").replace(/\/$/, "");
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const corsHeaders = {
  "Access-Control-Allow-Origin": PUBLIC_SITE_URL,
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
};

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function escapeIcs(value: unknown) {
  return String(value ?? "").replaceAll("\\", "\\\\").replaceAll(";", "\\;").replaceAll(",", "\\,").replaceAll("\n", "\\n");
}

function formatIcsDate(date: string, time: string) {
  return `${date.replaceAll("-", "")}T${time.replace(":", "")}00`;
}

function addLocalMinutes(date: string, time: string, minutes: number) {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const value = new Date(Date.UTC(year, month - 1, day, hour, minute + minutes));
  return {
    date: `${value.getUTCFullYear().toString().padStart(4, "0")}-${(value.getUTCMonth() + 1).toString().padStart(2, "0")}-${value.getUTCDate().toString().padStart(2, "0")}`,
    time: `${value.getUTCHours().toString().padStart(2, "0")}:${value.getUTCMinutes().toString().padStart(2, "0")}`
  };
}

function buildIcs(payload: Record<string, unknown>) {
  const date = String(payload.booking_date || "");
  const time = String(payload.booking_time || "00:00");
  const duration = Number(payload.duration_minutes || 30);
  const end = addLocalMinutes(date, time, duration);
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Appointments//Booking//HE", "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT", `UID:${escapeIcs(payload.booking_id)}@appointments`,
    `DTSTART;TZID=Asia/Jerusalem:${formatIcsDate(date, time)}`,
    `DTEND;TZID=Asia/Jerusalem:${formatIcsDate(end.date, end.time)}`,
    `SUMMARY:${escapeIcs(`${payload.business_name || "העסק"} - ${payload.service_name || "תור"}`)}`,
    `LOCATION:${escapeIcs(payload.business_address)}`,
    `DESCRIPTION:${escapeIcs(`טלפון העסק: ${payload.business_phone || ""}`)}`,
    "END:VEVENT", "END:VCALENDAR", ""
  ].join("\r\n");
}

function redirectResult(action: string, ok: boolean, reason = "") {
  const url = new URL(`${PUBLIC_SITE_URL}/index.html`);
  url.searchParams.set("emailAction", ok ? action : "error");
  if (reason) url.searchParams.set("reason", reason);
  return Response.redirect(url.toString(), 302);
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (!["GET", "POST"].includes(request.method)) return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return Response.json({ error: "Server is not configured" }, { status: 500, headers: corsHeaders });

  const url = new URL(request.url);
  const requestBody = request.method === "POST" ? await request.json().catch(() => ({})) : {};
  const action = String(requestBody.action || url.searchParams.get("action") || "");
  const token = String(requestBody.token || url.searchParams.get("token") || "");
  const wantsJson = url.searchParams.get("format") === "json";
  if (!token || !["confirm", "cancel", "view", "ics"].includes(action)) {
    return wantsJson || request.method === "POST"
      ? Response.json({ error: "INVALID_ACTION_LINK" }, { status: 400, headers: corsHeaders })
      : redirectResult(action, false, "invalid");
  }

  if (["confirm", "cancel"].includes(action) && request.method !== "POST") {
    return Response.json({ error: "POST_REQUIRED" }, { status: 405, headers: corsHeaders });
  }

  try {
    const tokenHash = await sha256(token);
    const { data, error } = await supabase.rpc("perform_booking_email_action", {
      p_token_hash: tokenHash,
      p_action: action
    });
    if (error) throw error;
    const payload = (data || {}) as Record<string, unknown>;

    if (action === "view" || wantsJson) {
      return Response.json({ booking: payload }, { headers: { ...corsHeaders, "Cache-Control": "no-store" } });
    }
    if (action === "ics") {
      return new Response(buildIcs(payload), {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/calendar; charset=utf-8",
          "Content-Disposition": `attachment; filename="appointment-${payload.booking_id || "booking"}.ics"`,
          "Cache-Control": "no-store"
        }
      });
    }
    return Response.json({ ok: true, action }, { headers: { ...corsHeaders, "Cache-Control": "no-store" } });
  } catch (error) {
    const message = String((error as Error)?.message || error);
    const reason = message.includes("ACTION_ALREADY_USED") ? "used"
      : message.includes("ACTION_NOT_ALLOWED") ? "not_allowed"
      : message.includes("EXPIRED") ? "expired"
      : "invalid";
    return wantsJson
      ? Response.json({ error: reason }, { status: 403, headers: corsHeaders })
      : request.method === "POST"
        ? Response.json({ error: reason }, { status: 403, headers: corsHeaders })
        : redirectResult(action, false, reason);
  }
});
