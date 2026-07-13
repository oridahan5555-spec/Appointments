import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const handler = require("./api/send-email.js");
const statusHandler = require("./api/email-status.js");

process.env.EMAIL_PROVIDER = "brevo";
process.env["BREVO" + "_API_KEY"] = "test-only-key";
process.env.EMAIL_FROM = "Appointments <sender@example.com>";
process.env.SUPABASE_URL = "https://project.supabase.co";
process.env.SUPABASE_ANON_KEY = "public-anon-test-key";

function responseMock(resolve) {
  return {
    statusCode: 200,
    headers: {},
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    end(value) {
      resolve({ status: this.statusCode, headers: this.headers, body: JSON.parse(value) });
    }
  };
}

function invoke(body, { method = "POST", token = "valid-test-token", contentType = "application/json" } = {}) {
  return new Promise((resolve) => {
    handler({
      method,
      body,
      headers: {
        "content-type": contentType,
        ...(token ? { authorization: `Bearer ${token}` } : {})
      },
      socket: { remoteAddress: "127.0.0.1" }
    }, responseMock(resolve));
  });
}

function invokeStatus(method = "GET") {
  return new Promise((resolve) => {
    statusHandler({ method, headers: {} }, responseMock(resolve));
  });
}

function bookingContext(overrides = {}) {
  return {
    actor_user_id: "188f1269-e04a-4184-882c-226f60a47d28",
    actor_is_owner: true,
    actor_is_customer: false,
    business_name: "עסק בדיקה",
    owner_email: "owner@example.com",
    booking_id: "00000000-0000-4000-8000-000000000001",
    status: "approved",
    service_name: "שירות בדיקה",
    booking_date: "2099-01-01",
    booking_time: "10:00",
    customer_name: "לקוחה <script>alert(1)</script>",
    customer_phone: "0500000000",
    customer_email: "customer@example.com",
    notes: "A & B <img src=x onerror=alert(1)>",
    ...overrides
  };
}

let brevoRequest = null;
global.fetch = async (url, options = {}) => {
  const target = String(url);
  if (target.includes("/rpc/claim_email_delivery_event")) {
    return { ok: true, status: 200, json: async () => "booking_approved_customer:00000000-0000-4000-8000-000000000001" };
  }
  if (target.includes("/rpc/complete_email_delivery_event") || target.includes("/rpc/release_email_delivery_event")) {
    return { ok: true, status: 200, json: async () => true };
  }
  if (target.includes("/rest/v1/rpc/")) {
    return { ok: true, status: 200, json: async () => bookingContext() };
  }
  brevoRequest = JSON.parse(options.body);
  return { ok: true, status: 201, json: async () => ({ messageId: "test" }) };
};

const getResult = await invoke({}, { method: "GET" });
assert.equal(getResult.status, 405);

const wrongContentType = await invoke({}, { contentType: "text/plain" });
assert.equal(wrongContentType.status, 415);

const statusResult = await invokeStatus();
assert.equal(statusResult.status, 200);
assert.deepEqual(statusResult.body, { configured: true, provider: "brevo" });
const statusWrongMethod = await invokeStatus("POST");
assert.equal(statusWrongMethod.status, 405);

const noAuth = await invoke({ type: "test_email" }, { token: "" });
assert.equal(noAuth.status, 401);
const noAuthReminder = await invoke({
  type: "reminder_customer",
  bookingId: "00000000-0000-4000-8000-000000000001"
}, { token: "" });
assert.equal(noAuthReminder.status, 401);

const unknown = await invoke({ type: "arbitrary_email" });
assert.equal(unknown.status, 400);
const invalidBookingId = await invoke({ type: "reminder_customer", bookingId: "not-a-booking-id" });
assert.equal(invalidBookingId.status, 400);

const ownerTestEmail = await invoke({ type: "test_email" });
assert.equal(ownerTestEmail.status, 200);
assert.equal(ownerTestEmail.body.ok, true);
assert.equal(brevoRequest.to[0].email, "owner@example.com");

const approved = await invoke({
  type: "booking_approved_customer",
  bookingId: "00000000-0000-4000-8000-000000000001",
  to: "attacker@example.com",
  payload: { customerEmail: "attacker@example.com", notes: "untrusted" }
});
assert.equal(approved.status, 200);
assert.equal(approved.body.ok, true);
assert.equal(brevoRequest.to[0].email, "customer@example.com");
assert.deepEqual(brevoRequest.sender, { email: "sender@example.com", name: "Appointments" });
assert.match(brevoRequest.htmlContent, /&lt;script&gt;/);
assert.doesNotMatch(brevoRequest.htmlContent, /<script>alert/);
assert.match(brevoRequest.htmlContent, /A &amp; B/);

global.fetch = async (url) => {
  if (String(url).includes("/rest/v1/rpc/")) {
    return { ok: true, status: 200, json: async () => bookingContext({ actor_is_owner: false, actor_is_customer: true }) };
  }
  throw new Error("Brevo must not be called");
};
const customerTriedOwnerAction = await invoke({
  type: "booking_approved_customer",
  bookingId: "00000000-0000-4000-8000-000000000002"
});
assert.equal(customerTriedOwnerAction.status, 403);

global.fetch = async (url) => {
  if (String(url).includes("/rpc/get_booking_email_context")) {
    return { ok: false, status: 403, json: async () => ({ code: "42501" }) };
  }
  throw new Error("Brevo must not be called");
};
const inaccessibleWarn = console.warn;
console.warn = () => {};
const inaccessibleBooking = await invoke({
  type: "booking_approved_customer",
  bookingId: "00000000-0000-4000-8000-000000000009"
});
console.warn = inaccessibleWarn;
assert.equal(inaccessibleBooking.status, 403);

global.fetch = async (url) => {
  if (String(url).includes("/rest/v1/rpc/")) {
    return { ok: true, status: 200, json: async () => bookingContext({
      booking_id: "00000000-0000-4000-8000-000000000003",
      customer_email: ""
    }) };
  }
  throw new Error("Brevo must not be called");
};
const missingEmail = await invoke({
  type: "booking_approved_customer",
  bookingId: "00000000-0000-4000-8000-000000000003"
});
assert.equal(missingEmail.status, 200);
assert.equal(missingEmail.body.skipped, true);

let duplicateProviderCalled = false;
global.fetch = async (url) => {
  const target = String(url);
  if (target.includes("/rpc/get_booking_email_context")) {
    return { ok: true, status: 200, json: async () => bookingContext({
      booking_id: "00000000-0000-4000-8000-000000000004"
    }) };
  }
  if (target.includes("/rpc/claim_email_delivery_event")) {
    return { ok: true, status: 200, json: async () => null };
  }
  duplicateProviderCalled = true;
  return { ok: true, status: 201, json: async () => ({}) };
};
const durableDuplicate = await invoke({
  type: "booking_approved_customer",
  bookingId: "00000000-0000-4000-8000-000000000004"
});
assert.equal(durableDuplicate.status, 200);
assert.equal(durableDuplicate.body.duplicate, true, JSON.stringify(durableDuplicate));
assert.equal(duplicateProviderCalled, false);

let ownerRecipient = "";
global.fetch = async (url, options = {}) => {
  const target = String(url);
  if (target.includes("/rpc/get_booking_email_context")) {
    return { ok: true, status: 200, json: async () => bookingContext({
      booking_id: "00000000-0000-4000-8000-000000000006",
      status: "pending",
      actor_is_owner: false,
      actor_is_customer: true
    }) };
  }
  if (target.includes("/rpc/claim_email_delivery_event")) {
    return { ok: true, status: 200, json: async () => "booking_created_owner:00000000-0000-4000-8000-000000000006" };
  }
  if (target.includes("/rpc/complete_email_delivery_event")) {
    return { ok: true, status: 200, json: async () => true };
  }
  ownerRecipient = JSON.parse(options.body).to[0].email;
  return { ok: true, status: 201, json: async () => ({}) };
};
const customerCreatedOwnerEmail = await invoke({
  type: "booking_created_owner",
  bookingId: "00000000-0000-4000-8000-000000000006",
  to: "attacker@example.com"
});
assert.equal(customerCreatedOwnerEmail.body.ok, true);
assert.equal(ownerRecipient, "owner@example.com");

let releaseCalled = false;
global.fetch = async (url) => {
  const target = String(url);
  if (target.includes("/rpc/get_booking_email_context")) {
    return { ok: true, status: 200, json: async () => bookingContext({
      booking_id: "00000000-0000-4000-8000-000000000007"
    }) };
  }
  if (target.includes("/rpc/claim_email_delivery_event")) {
    return { ok: true, status: 200, json: async () => "reminder_customer:00000000-0000-4000-8000-000000000007:2099-01-01" };
  }
  if (target.includes("/rpc/release_email_delivery_event")) {
    releaseCalled = true;
    return { ok: true, status: 200, json: async () => true };
  }
  return { ok: false, status: 503, json: async () => ({}) };
};
const originalConsoleError = console.error;
console.error = () => {};
const providerFailure = await invoke({
  type: "reminder_customer",
  bookingId: "00000000-0000-4000-8000-000000000007"
});
console.error = originalConsoleError;
assert.equal(providerFailure.status, 502);
assert.equal(releaseCalled, true);

let attendanceOwnerRecipient = "";
global.fetch = async (url, options = {}) => {
  const target = String(url);
  if (target.includes("/rpc/get_booking_email_context")) {
    return { ok: true, status: 200, json: async () => bookingContext({
      booking_id: "00000000-0000-4000-8000-000000000008",
      actor_is_owner: false,
      actor_is_customer: true,
      attendance_confirmation_status: "confirmed"
    }) };
  }
  if (target.includes("/rpc/claim_email_delivery_event")) {
    return { ok: true, status: 200, json: async () => "attendance_response_owner:00000000-0000-4000-8000-000000000008" };
  }
  if (target.includes("/rpc/complete_email_delivery_event")) {
    return { ok: true, status: 200, json: async () => true };
  }
  attendanceOwnerRecipient = JSON.parse(options.body).to[0].email;
  return { ok: true, status: 201, json: async () => ({}) };
};
const attendanceOwnerEmail = await invoke({
  type: "attendance_response_owner",
  bookingId: "00000000-0000-4000-8000-000000000008"
});
assert.equal(attendanceOwnerEmail.body.ok, true);
assert.equal(attendanceOwnerRecipient, "owner@example.com");

global.fetch = async (url) => {
  if (String(url).includes("/rest/v1/rpc/")) {
    return { ok: false, status: 401, json: async () => ({ code: "PGRST301" }) };
  }
  throw new Error("Provider must not be called");
};
const originalConsoleWarn = console.warn;
console.warn = () => {};
const invalidSession = await invoke({ type: "test_email" }, { token: "expired-test-token" });
console.warn = originalConsoleWarn;
assert.equal(invalidSession.status, 401);

process.stdout.write(JSON.stringify({ ok: true, tests: 18 }, null, 2));
