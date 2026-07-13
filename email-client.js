(function createEmailClient(global) {
  "use strict";

  const activeEvents = new Set();

  async function getAccessToken() {
    try {
      const session = await global.AppSupabase?.getSession?.();
      return String(session?.access_token || "");
    } catch {
      return "";
    }
  }

  async function sendEmailNotification(type, payload = {}, options = {}) {
    const eventKey = String(options.eventKey || "").trim();
    if (eventKey && activeEvents.has(eventKey)) {
      return { ok: true, duplicate: true };
    }

    const controller = new AbortController();
    const timeoutId = global.setTimeout(() => controller.abort(), 8000);
    if (eventKey) activeEvents.add(eventKey);

    try {
      const accessToken = await getAccessToken();
      const response = await fetch("/api/send-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
        },
        body: JSON.stringify({
          type,
          bookingId: String(payload?.bookingId || "").trim() || undefined
        }),
        signal: controller.signal
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        console.warn("Email notification was not sent", result?.error || response.status);
        return { ok: false, skipped: false, error: result?.error || "Email request failed" };
      }
      return {
        ok: Boolean(result.ok),
        skipped: Boolean(result.skipped),
        duplicate: Boolean(result.duplicate),
        error: result.error || result.reason || ""
      };
    } catch (error) {
      console.warn("Email notification is unavailable", error?.name === "AbortError" ? "timeout" : error?.message);
      return { ok: false, skipped: false, error: "Email service unavailable" };
    } finally {
      global.clearTimeout(timeoutId);
      if (eventKey) activeEvents.delete(eventKey);
    }
  }

  async function getStatus() {
    try {
      const response = await fetch("/api/email-status", { headers: { Accept: "application/json" } });
      const result = await response.json().catch(() => ({}));
      return { configured: response.ok && Boolean(result.configured), provider: result.provider || null };
    } catch {
      return { configured: false, provider: null };
    }
  }

  function buildBookingPayload(booking, business = {}, customer = {}) {
    return {
      businessName: String(business?.name || "").trim(),
      customerName: String(
        customer?.fullName
        || [booking?.customer_first_name, booking?.customer_last_name].filter(Boolean).join(" ")
      ).trim(),
      customerPhone: String(booking?.customer_phone || customer?.phone || "").trim(),
      customerEmail: String(customer?.email || booking?.customer_email || "").trim().toLowerCase(),
      serviceName: String(booking?.service_name || booking?.service_names?.join?.(" + ") || "").trim(),
      bookingDate: String(booking?.booking_date || "").trim(),
      bookingTime: String(booking?.booking_time || "").slice(0, 5),
      notes: String(booking?.notes || "").trim(),
      bookingId: String(booking?.id || booking?.booking_id || "").trim()
    };
  }

  global.AppEmail = { sendEmailNotification, getStatus, buildBookingPayload };
})(window);
