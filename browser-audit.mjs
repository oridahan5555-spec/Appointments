import { createServer } from "node:http";
import { access, readFile, stat } from "node:fs/promises";
import { spawn, spawnSync } from "node:child_process";
import { extname, join, normalize } from "node:path";
import { tmpdir } from "node:os";

const root = process.cwd();
const port = 4173;
const debuggingPort = 9300 + Math.floor(Math.random() * 500);
const browserCandidates = [
  process.env.CHROME_PATH,
  "msedge",
  "chrome",
  "google-chrome",
  "chromium",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"
].filter(Boolean);
const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8"
};
const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function installAuditSupabase() {
  const storageKey = "booking_full_audit_backend_v1";
  const ownerId = "188f1269-e04a-4184-882c-226f60a47d28";
  const customerId = "22222222-2222-4222-8222-222222222222";
  const otherCustomerId = "33333333-3333-4333-8333-333333333333";
  const conflictingCustomerId = "55555555-5555-4555-8555-555555555555";
  const businessId = "11111111-1111-4111-8111-111111111111";
  const serviceId = "44444444-4444-4444-8444-444444444444";
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const createId = () => crypto.randomUUID();
  const defaultHours = [
    [0, "ראשון"], [1, "שני"], [2, "שלישי"], [3, "רביעי"],
    [4, "חמישי"], [5, "שישי"], [6, "שבת"]
  ].map(([day, label]) => ({
    id: createId(),
    day_of_week: day,
    day_label: label,
    opens_at: "08:00",
    closes_at: "22:00",
    slot_interval_minutes: 30,
    is_closed: false
  }));

  const fresh = () => ({
    sessionRole: null,
    sessionUserId: null,
    accounts: {
      "owner@example.com": { id: ownerId, password: "correct-password", role: "owner" },
      "existing@example.com": { id: customerId, password: "strongpass", role: "customer" },
      "conflict@example.com": { id: conflictingCustomerId, password: "strongpass", role: "customer" }
    },
    business: {
      id: businessId,
      name: "Yael nails audit",
      description: "עסק בדיקה",
      address: "רחוב הבדיקה 1",
      phone: "0501234567",
      owner_email: "owner@example.com",
      instagram_url: "https://example.com/social",
      cover_image: "",
      profile_image: "",
      preparation_message: "נא להגיע בזמן.",
      features: {
        businessDescription: true,
        preparationMessage: true,
        socialLink: true,
        whatsapp: true,
        phone: true,
        waze: true,
        calendarExport: true,
        customerRescheduling: true,
        waitingList: true,
        attendanceConfirmation: true,
        workingDaysMode: "select_open_days",
        themeAccent: "#b25fd1"
      }
    },
    services: [{
      id: serviceId,
      category: "טיפולי ידיים",
      name: "טיפול בדיקה",
      price: 100,
      duration_minutes: 30,
      is_active: true,
      display_order: 0
    }],
    workingHours: defaultHours,
    specialHours: [],
    blockedSlots: [],
    users: [
      { id: createId(), auth_user_id: customerId, firstName: "לקוחה", lastName: "קיימת", phone: "0500000001", email: "existing@example.com", owner_note: "", is_blocked: false, no_show_count: 0 },
      { id: createId(), auth_user_id: otherCustomerId, firstName: "לקוחה", lastName: "אחרת", phone: "0500000002", email: "other@example.com", owner_note: "פרטי לקוחה אחרת", is_blocked: false, no_show_count: 0 }
    ],
    bookings: [{
      id: createId(),
      service_id: serviceId,
      service_ids: [serviceId],
      service_names: ["טיפול בדיקה"],
      service_name: "טיפול בדיקה",
      customer_first_name: "לקוחה",
      customer_last_name: "אחרת",
      customer_phone: "0500000002",
      customer_email: "other@example.com",
      customer_auth_user_id: otherCustomerId,
      notes: "מידע שאסור לחשוף",
      booking_date: "2099-01-01",
      booking_time: "12:00",
      duration_minutes: 30,
      status: "approved",
      customer_confirmed: false,
      hidden_for_customer: false,
      arrival_status: "",
      attendance_confirmation_status: "",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }],
    notifications: [],
    waitlistEntries: [],
    passwordResetEmail: "",
    failNextPasswordReset: false,
    customerLoadFailure: false,
    failNextOwnerSync: false
  });

  const load = () => {
    try {
      return JSON.parse(localStorage.getItem(storageKey)) || fresh();
    } catch {
      return fresh();
    }
  };
  const save = (database) => localStorage.setItem(storageKey, JSON.stringify(database));
  if (!localStorage.getItem(storageKey)) save(fresh());

  const authListeners = new Set();
  const currentUser = () => {
    const database = load();
    if (!database.sessionUserId) return null;
    const accountEntry = Object.entries(database.accounts).find(([, account]) => account.id === database.sessionUserId);
    if (!accountEntry) return null;
    return { id: accountEntry[1].id, email: accountEntry[0], user_metadata: { role: accountEntry[1].role } };
  };
  const emitAuth = (event) => {
    const user = currentUser();
    const session = user ? { access_token: "audit-access-token", user } : null;
    authListeners.forEach((listener) => listener(event, session));
  };
  const sessionFor = () => {
    const user = currentUser();
    return user ? { access_token: "audit-access-token", user } : null;
  };
  const customerProfile = (database) => database.users.find((item) => item.auth_user_id === database.sessionUserId) || null;

  const api = {
    isConfigured: () => true,
    getClient: () => null,
    getSession: async () => sessionFor(),
    getCurrentUser: async () => currentUser(),
    isOwnerUser: async () => load().sessionRole === "owner",
    signInOwner: async ({ username, email, password }) => {
      const identifier = String(username || email || "").trim().toLowerCase();
      const database = load();
      const account = database.accounts["owner@example.com"];
      if (identifier !== "admin" || password !== account.password) throw new Error("Invalid login credentials");
      database.sessionRole = "owner";
      database.sessionUserId = account.id;
      save(database);
      emitAuth("SIGNED_IN");
      return { user: currentUser(), session: sessionFor() };
    },
    signInCustomer: async (payload) => {
      const { email, password } = payload;
      if ("phone" in payload || "firstName" in payload || "lastName" in payload) {
        throw new Error("Existing customer login must not submit booking profile fields");
      }
      const database = load();
      const normalizedEmail = String(email || "").trim().toLowerCase();
      const account = database.accounts[normalizedEmail];
      if (!account || account.role !== "customer" || account.password !== password) throw new Error("Invalid login credentials");
      database.sessionRole = "customer";
      database.sessionUserId = account.id;
      database.customerLoadFailure = normalizedEmail === "conflict@example.com";
      save(database);
      emitAuth("SIGNED_IN");

      if (database.customerLoadFailure) {
        await new Promise((resolve) => setTimeout(resolve, 20));
        database.sessionRole = null;
        database.sessionUserId = null;
        database.customerLoadFailure = false;
        save(database);
        emitAuth("SIGNED_OUT");
        const conflictError = new Error("החשבון שנכנסת אליו לא מחובר לפרופיל הלקוחה המתאים. התחברי עם האימייל שבו יצרת את החשבון, או השתמשי בשכחתי סיסמה.");
        conflictError.code = "CUSTOMER_ACCOUNT_CONFLICT";
        throw conflictError;
      }

      return { user: currentUser(), session: sessionFor() };
    },
    registerCustomer: async ({ firstName, lastName, phone, email, password }) => {
      const database = load();
      const normalizedEmail = String(email || "").trim().toLowerCase();
      if (database.accounts[normalizedEmail]) throw new Error("User already registered");
      if (String(password || "").length < 6) throw new Error("Password should be at least 6 characters");
      const id = createId();
      database.accounts[normalizedEmail] = { id, password, role: "customer" };
      database.users.push({ id: createId(), auth_user_id: id, firstName, lastName, phone, email: normalizedEmail, owner_note: "", is_blocked: false, no_show_count: 0 });
      database.sessionRole = "customer";
      database.sessionUserId = id;
      save(database);
      emitAuth("SIGNED_IN");
      return { user: currentUser(), session: sessionFor(), needsEmailConfirmation: false };
    },
    claimCustomerAccount: async () => customerProfile(load()),
    signOut: async () => {
      const database = load();
      database.sessionRole = null;
      database.sessionUserId = null;
      database.customerLoadFailure = false;
      save(database);
      emitAuth("SIGNED_OUT");
    },
    sendOwnerPasswordReset: async () => true,
    sendCustomerPasswordReset: async (email) => {
      const database = load();
      if (database.failNextPasswordReset) {
        database.failNextPasswordReset = false;
        save(database);
        const error = new Error("כבר נשלחה בקשת איפוס בזמן האחרון. בדקי את תיבת האימייל ואת תיקיית הספאם. אם אין הודעה, חכי דקה ונסי שוב.");
        error.code = "PASSWORD_RESET_RATE_LIMITED";
        throw error;
      }
      database.passwordResetEmail = String(email || "").trim().toLowerCase();
      save(database);
      return true;
    },
    updateOwnerPassword: async (password) => {
      const database = load();
      const accountEntry = Object.entries(database.accounts).find(([, account]) => account.id === database.sessionUserId);
      if (!accountEntry) throw new Error("Authentication required");
      accountEntry[1].password = password;
      save(database);
      return currentUser();
    },
    updateCurrentUserPassword: async (password) => {
      const database = load();
      const accountEntry = Object.entries(database.accounts).find(([, account]) => account.id === database.sessionUserId);
      if (!accountEntry) throw new Error("Authentication required");
      accountEntry[1].password = password;
      save(database);
      return currentUser();
    },
    updateOwnerCredentials: async ({ password }) => {
      const database = load();
      if (database.sessionRole !== "owner") throw new Error("Not authorized");
      if (password) database.accounts["owner@example.com"].password = password;
      save(database);
      return currentUser();
    },
    loadPublicState: async () => {
      const database = load();
      return clone({
        business: database.business,
        services: database.services,
        workingHours: database.workingHours,
        specialHours: database.specialHours,
        blockedSlots: database.blockedSlots,
        bookings: database.bookings.map(({ booking_date, booking_time, duration_minutes, status }) => ({ booking_date, booking_time, duration_minutes, status }))
      });
    },
    loadCustomerState: async () => {
      const database = load();
      if (database.customerLoadFailure) {
        const error = new Error("הטלפון או האימייל כבר שייכים לחשבון לקוחה אחר.");
        error.code = "CUSTOMER_ACCOUNT_CONFLICT";
        throw error;
      }
      const profile = customerProfile(database);
      return clone({
        customer: profile,
        bookings: database.bookings.filter((item) => item.customer_auth_user_id === database.sessionUserId),
        notifications: database.notifications.filter((item) => item.user_id === database.sessionUserId),
        waitlistEntries: database.waitlistEntries.filter((item) => item.customer_auth_user_id === database.sessionUserId)
      });
    },
    loadOwnerState: async () => {
      const database = load();
      if (database.sessionRole !== "owner") throw new Error("Not authorized");
      return clone({
        business: database.business,
        services: database.services,
        workingHours: database.workingHours,
        specialHours: database.specialHours,
        blockedSlots: database.blockedSlots,
        users: database.users,
        bookings: database.bookings,
        notifications: database.notifications,
        waitlistEntries: database.waitlistEntries,
        owner: { id: ownerId }
      });
    },
    createBooking: async (payload) => {
      const database = load();
      if (database.sessionRole !== "customer") throw new Error("AUTH_REQUIRED");
      const profile = customerProfile(database);
      const selected = database.services.filter((item) => (payload.serviceIds || [payload.serviceId]).includes(item.id));
      const booking = {
        id: createId(),
        service_id: payload.serviceId,
        service_ids: selected.map((item) => item.id),
        service_names: selected.map((item) => item.name),
        service_name: selected.map((item) => item.name).join(" + "),
        customer_first_name: payload.firstName,
        customer_last_name: payload.lastName,
        customer_phone: payload.phone,
        customer_email: profile?.email || "",
        customer_auth_user_id: database.sessionUserId,
        notes: payload.notes || "",
        booking_date: payload.bookingDate,
        booking_time: payload.bookingTime,
        duration_minutes: selected.reduce((sum, item) => sum + item.duration_minutes, 0),
        status: "pending",
        customer_confirmed: false,
        replaces_booking_id: payload.replacesBookingId || null,
        hidden_for_customer: false,
        arrival_status: "",
        attendance_confirmation_status: "",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      database.bookings.push(booking);
      database.notifications.push({ id: createId(), title: "תור חדש", message: "נקבע תור חדש", created_at: new Date().toISOString(), is_read: false, user_id: ownerId, type: "appointment_booked", booking_id: booking.id, metadata: {} });
      save(database);
      return { booking_id: booking.id };
    },
    cancelMyBooking: async (id) => {
      const database = load();
      const booking = database.bookings.find((item) => item.id === id && item.customer_auth_user_id === database.sessionUserId);
      if (!booking) throw new Error("BOOKING_NOT_FOUND");
      booking.status = "cancelled";
      save(database);
    },
    hideMyBooking: async (id) => {
      const database = load();
      const booking = database.bookings.find((item) => item.id === id && item.customer_auth_user_id === database.sessionUserId);
      if (!booking) throw new Error("BOOKING_NOT_FOUND");
      booking.hidden_for_customer = true;
      save(database);
    },
    respondAttendance: async (id, response) => {
      const database = load();
      const booking = database.bookings.find((item) => item.id === id && item.customer_auth_user_id === database.sessionUserId);
      if (!booking) throw new Error("BOOKING_NOT_FOUND");
      booking.attendance_confirmation_status = response;
      save(database);
    },
    requestBookingAttendance: async (id) => {
      const database = load();
      const booking = database.bookings.find((item) => item.id === id);
      if (!booking || database.sessionRole !== "owner") throw new Error("Not authorized");
      booking.attendance_confirmation_status = "pending";
      booking.attendance_confirmation_requested_at = new Date().toISOString();
      save(database);
    },
    joinWaitlist: async (payload) => {
      const database = load();
      const profile = customerProfile(database);
      database.waitlistEntries.push({ id: createId(), customer_auth_user_id: database.sessionUserId, customer_phone: profile.phone, customer_name: `${profile.firstName} ${profile.lastName}`, service_id: payload.serviceId, service_name: payload.serviceName, booking_date: payload.bookingDate, notes: payload.notes || "", status: "waiting", created_at: new Date().toISOString() });
      save(database);
    },
    syncOwnerState: async (snapshot) => {
      const database = load();
      if (database.sessionRole !== "owner") throw new Error("Not authorized");
      if (database.failNextOwnerSync) {
        database.failNextOwnerSync = false;
        save(database);
        throw new Error("Failed to fetch");
      }
      database.business = clone(snapshot.business);
      database.services = clone(snapshot.services);
      database.workingHours = clone(snapshot.workingHours);
      database.specialHours = clone(snapshot.specialHours);
      database.blockedSlots = clone(snapshot.blockedSlots);
      database.users = clone(snapshot.users);
      database.bookings = clone(snapshot.bookings);
      database.notifications = clone(snapshot.notifications);
      database.waitlistEntries = clone(snapshot.waitlistEntries);
      save(database);
      return clone(database.business);
    },
    resetOwnerBusinessData: async () => {
      const database = load();
      if (database.sessionRole !== "owner") throw new Error("Not authorized");
      const preservedOwnerEmail = database.business.owner_email;
      database.business = fresh().business;
      database.business.name = "שם העסק שלך";
      database.business.description = "כתבי כאן תיאור קצר על העסק שלך.";
      database.business.address = "כתובת העסק";
      database.business.phone = "";
      database.business.instagram_url = "";
      database.business.preparation_message = "נא להגיע בזמן. אם צריך לבטל או לשנות תור, עדכני מראש.";
      database.business.owner_email = preservedOwnerEmail;
      database.services = fresh().services;
      database.workingHours = fresh().workingHours;
      database.specialHours = [];
      database.blockedSlots = [];
      database.users = [];
      database.bookings = [];
      database.notifications = [];
      database.waitlistEntries = [];
      save(database);
      return { ok: true, credentials_preserved: true, owner_email_preserved: true };
    },
    deleteOwnerRow: async (table, id) => {
      const database = load();
      const collectionMap = { services: "services", special_hours: "specialHours", blocked_slots: "blockedSlots", waitlist_entries: "waitlistEntries" };
      const collection = collectionMap[table];
      if (!collection || database.sessionRole !== "owner") throw new Error("Not authorized");
      database[collection] = database[collection].filter((item) => item.id !== id);
      save(database);
    },
    markNotificationRead: async (id) => {
      const database = load();
      const item = database.notifications.find((notification) => notification.id === id);
      if (item) item.is_read = true;
      save(database);
    },
    markAllNotificationsRead: async (userId) => {
      const database = load();
      database.notifications.filter((item) => item.user_id === userId).forEach((item) => { item.is_read = true; });
      save(database);
    },
    deleteNotification: async (id) => {
      const database = load();
      database.notifications = database.notifications.filter((item) => item.id !== id);
      save(database);
    },
    createNotification: async (notification) => {
      const database = load();
      const item = { ...notification, id: notification.id || createId(), created_at: notification.created_at || new Date().toISOString() };
      database.notifications.push(item);
      save(database);
      return clone(item);
    },
    subscribe: () => () => undefined,
    onAuthStateChange: (callback) => {
      authListeners.add(callback);
      const recoveryLink = new URLSearchParams(location.hash.replace(/^#/, "")).get("type") === "recovery";
      queueMicrotask(() => callback(recoveryLink ? "PASSWORD_RECOVERY" : "INITIAL_SESSION", sessionFor()));
      return { data: { subscription: { unsubscribe: () => authListeners.delete(callback) } } };
    },
    normalizePhone: (value) => String(value || "").replace(/[^\d+]/g, ""),
    getOwnerLoginName: () => "admin",
    getOwnerEmail: () => "owner@example.com"
  };

  window.AppSupabase = api;
  window.__AUDIT_BACKEND__ = {
    read: () => clone(load()),
    reset: () => save(fresh()),
    activateCustomerRecovery: (email) => {
      const database = load();
      const account = database.accounts[String(email || "").trim().toLowerCase()];
      if (!account || account.role !== "customer") throw new Error("Customer account not found");
      database.sessionRole = "customer";
      database.sessionUserId = account.id;
      database.customerLoadFailure = false;
      save(database);
    },
    failNextPasswordReset: () => {
      const database = load();
      database.failNextPasswordReset = true;
      save(database);
    },
    failNextOwnerSync: () => {
      const database = load();
      database.failNextOwnerSync = true;
      save(database);
    }
  };
}

const auditSupabaseSource = `(${installAuditSupabase.toString()})();`;

async function resolveBrowserPath() {
  for (const candidate of browserCandidates) {
    if (/[/\\]/.test(candidate)) {
      try {
        await access(candidate);
        return candidate;
      } catch {
        continue;
      }
    }
    const lookup = process.platform === "win32"
      ? spawnSync("where", [candidate], { stdio: "ignore" })
      : spawnSync("sh", ["-lc", `command -v ${candidate}`], { stdio: "ignore" });
    if (lookup.status === 0) return candidate;
  }
  throw new Error("Could not find Chrome or Edge. Set CHROME_PATH to the browser executable.");
}

const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, `http://127.0.0.1:${port}`).pathname);
    const pathParts = pathname.replace(/^\/+/, "").split("/").filter(Boolean);
    const mode = ["disabled", "mock"].includes(pathParts[0]) ? pathParts.shift() : "disabled";
    const relativePath = pathParts.join("/") || "index.html";

    if (relativePath === "api/email-status") {
      response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ configured: true, provider: "audit" }));
      return;
    }

    if (relativePath === "api/send-email") {
      response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ ok: true }));
      return;
    }

    if (relativePath === "supabase-config.js") {
      response.writeHead(200, { "Content-Type": mimeTypes[".js"] });
      response.end(mode === "mock"
        ? "window.SUPABASE_CONFIG = { url: 'https://audit.supabase.co', anonKey: 'audit-key', ownerEmail: 'owner@example.com', ownerLoginName: 'admin' };\n"
        : "window.SUPABASE_CONFIG = { url: '', anonKey: '' };\n");
      return;
    }

    if (relativePath === "supabase-client.js" && mode === "mock") {
      response.writeHead(200, { "Content-Type": mimeTypes[".js"] });
      response.end(auditSupabaseSource);
      return;
    }

    const filePath = normalize(join(root, relativePath));
    assert(filePath.startsWith(normalize(root)), "Blocked path outside project");
    assert((await stat(filePath)).isFile(), "Not a file");
    let body = await readFile(filePath);

    if (extname(filePath) === ".html") {
      const html = body.toString("utf8").replace(
        /<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@2"><\/script>/,
        "<script>window.supabase = {};</script>"
      );
      body = Buffer.from(html, "utf8");
    }

    response.writeHead(200, { "Content-Type": mimeTypes[extname(filePath)] || "application/octet-stream" });
    response.end(body);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
});

await new Promise((resolve) => server.listen(port, "127.0.0.1", resolve));
const browserPath = await resolveBrowserPath();
const browser = spawn(browserPath, [
  "--headless=new",
  "--disable-gpu",
  "--disable-extensions",
  "--disable-background-networking",
  "--no-first-run",
  "--no-default-browser-check",
  "--remote-allow-origins=*",
  `--remote-debugging-port=${debuggingPort}`,
  `--user-data-dir=${join(tmpdir(), `booking-audit-${Date.now()}`)}`,
  `http://127.0.0.1:${port}/disabled/index.html`
], { stdio: "ignore" });

class CdpClient {
  constructor(url) {
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
    this.socket = new WebSocket(url);
  }

  async connect() {
    if (this.socket.readyState !== WebSocket.OPEN) {
      await new Promise((resolve, reject) => {
        this.socket.addEventListener("open", resolve, { once: true });
        this.socket.addEventListener("error", reject, { once: true });
      });
    }
    this.socket.addEventListener("message", (event) => {
      const payload = JSON.parse(event.data);
      if (payload.id) {
        const pending = this.pending.get(payload.id);
        if (!pending) return;
        this.pending.delete(payload.id);
        if (payload.error) pending.reject(new Error(payload.error.message));
        else pending.resolve(payload.result);
        return;
      }
      (this.listeners.get(payload.method) || []).forEach((listener) => listener(payload.params));
    });
  }

  on(method, listener) {
    this.listeners.set(method, [...(this.listeners.get(method) || []), listener]);
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const result = await this.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true
    });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    }
    return result.result.value;
  }
}

async function getPageTarget() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const targets = await fetch(`http://127.0.0.1:${debuggingPort}/json/list`).then((response) => response.json());
      const target = targets.find((item) => item.type === "page" && item.url.startsWith(`http://127.0.0.1:${port}/`));
      if (target) return target;
    } catch {
      // Browser is still starting.
    }
    await wait(100);
  }
  throw new Error(`Could not connect to browser at ${browserPath}`);
}

const tests = [];
const consoleErrors = [];
const failedLocalRequests = [];
const requestUrls = new Map();
let client;

async function test(name, callback) {
  await callback();
  tests.push(name);
}

async function waitForExpression(expression, message, attempts = 50) {
  let lastError = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      if (await client.evaluate(`Boolean(${expression})`)) return;
      lastError = null;
    } catch (error) {
      // Navigation can briefly leave the previous page's DOM in place.
      lastError = error;
    }
    await wait(100);
  }
  throw new Error(lastError ? `${message}: ${lastError.message}` : message);
}

try {
  const target = await getPageTarget();
  client = new CdpClient(target.webSocketDebuggerUrl);
  await client.connect();
  await client.send("Runtime.enable");
  await client.send("Page.enable");
  await client.send("Network.enable");

  client.on("Runtime.exceptionThrown", ({ exceptionDetails }) => {
    consoleErrors.push(exceptionDetails.exception?.description || exceptionDetails.text);
  });
  client.on("Network.requestWillBeSent", ({ requestId, request }) => requestUrls.set(requestId, request.url));
  client.on("Network.loadingFailed", ({ requestId, canceled }) => {
    const requestUrl = requestUrls.get(requestId) || "";
    if (!canceled && requestUrl.startsWith(`http://127.0.0.1:${port}/`)) failedLocalRequests.push(requestUrl);
  });

  await wait(700);
  await test("public page fails closed without Supabase", async () => {
    const result = await client.evaluate(`({
      rtl: document.documentElement.dir === 'rtl',
      revealed: !document.documentElement.classList.contains('app-booting'),
      errorTitle: document.querySelector('#businessName')?.textContent,
      ownerLoginButton: Boolean(document.querySelector('#openSellerLogin'))
    })`);
    assert(result.rtl && result.revealed && result.ownerLoginButton, "Public page did not load safely");
    assert(result.errorTitle === "\u05dc\u05d0 \u05d4\u05e6\u05dc\u05d7\u05e0\u05d5 \u05dc\u05d8\u05e2\u05d5\u05df \u05d0\u05ea \u05d4\u05e2\u05e1\u05e7", "Public page displayed fallback business data");
  });

  await test("customer account forms and password visibility", async () => {
    const result = await client.evaluate(`(() => {
      document.querySelector('#openCustomerLogin').click();
      document.querySelector('#openCustomerSignupButton').click();
      const form = document.querySelector('#customerSignupForm');
      const password = form.elements.password;
      document.querySelector('[data-password-toggle="customerSignupPassword"]').click();
      return {
        visible: form.classList.contains('is-active'),
        fields: ['firstName','lastName','phone','email','password','confirmPassword'].every((name) => Boolean(form.elements[name])),
        passwordVisible: password.type === 'text'
      };
    })()`);
    assert(Object.values(result).every(Boolean), "Customer signup form is incomplete");
  });

  await test("legacy local data is purged", async () => {
    await client.evaluate(`localStorage.setItem('booking_app_local_working_v2', JSON.stringify({ users: [{ phone: '0500000000' }] })); location.reload()`);
    await wait(700);
    assert(await client.evaluate(`localStorage.getItem('booking_app_local_working_v2') === null`), "Legacy customer cache was not removed");
  });

  await test("mobile public layout has no horizontal overflow", async () => {
    await client.send("Emulation.setDeviceMetricsOverride", { width: 360, height: 800, deviceScaleFactor: 1, mobile: true });
    const layout = await client.evaluate(`({
      viewport: innerWidth,
      pageWidth: document.documentElement.scrollWidth,
      topbarWidth: document.querySelector('.topbar')?.getBoundingClientRect().width || 0
    })`);
    assert(layout.pageWidth <= layout.viewport + 2 && layout.topbarWidth <= layout.viewport + 2, "Public mobile layout overflows horizontally");
  });

  await client.send("Page.navigate", { url: `http://127.0.0.1:${port}/owner.html` });
  await wait(700);
  await test("owner page remains protected without Supabase", async () => {
    const owner = await client.evaluate(`({
      rtl: document.documentElement.dir === 'rtl',
      revealed: !document.documentElement.classList.contains('app-booting'),
      loginVisible: !document.querySelector('#ownerLoginGate').classList.contains('is-hidden'),
      dashboardHidden: document.querySelector('#ownerLayout').classList.contains('is-hidden'),
      username: document.querySelector('#ownerLoginForm').elements.username.value,
      message: document.querySelector('#ownerAccessMessage').textContent
    })`);
    assert(owner.rtl && owner.revealed && owner.loginVisible && owner.dashboardHidden, "Owner page exposed the dashboard");
    assert(owner.username === "admin" && owner.message.includes("\u05d4\u05d7\u05d9\u05d1\u05d5\u05e8 \u05d4\u05de\u05d0\u05d5\u05d1\u05d8\u05d7"), "Owner login state is unclear");
  });

  await test("owner mobile layout has no horizontal overflow", async () => {
    const layout = await client.evaluate(`({ viewport: innerWidth, pageWidth: document.documentElement.scrollWidth })`);
    assert(layout.pageWidth <= layout.viewport + 2, "Owner mobile layout overflows horizontally");
  });

  await client.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await client.send("Page.navigate", { url: `http://127.0.0.1:${port}/mock/index.html` });
  await waitForExpression(`window.__AUDIT_BACKEND__ && !document.documentElement.classList.contains('app-booting')`, "Mock public page did not initialize");
  await client.evaluate(`window.__AUDIT_BACKEND__.reset(); location.reload()`);
  await waitForExpression(`document.querySelector('#businessName')?.textContent === 'Yael nails audit'`, "Public business data did not load from the mock server");

  await test("public business, services, schedule, and Hebrew UI load from the server", async () => {
    const result = await client.evaluate(`({
      rtl: document.documentElement.dir === 'rtl',
      businessName: document.querySelector('#businessName')?.textContent,
      serviceCount: document.querySelectorAll('#servicesCategories [data-service-id]').length,
      technicalText: /Supabase|localStorage|Invalid login credentials/.test(document.body.innerText),
      staffStepHidden: document.querySelector('[data-step-indicator="2"]')?.classList.contains('is-hidden')
    })`);
    assert(result.rtl && result.businessName === "Yael nails audit" && result.serviceCount === 1, `Public server data is incomplete: ${JSON.stringify(result)}`);
    assert(!result.technicalText && result.staffStepHidden, "Public UI contains technical or unnecessary steps");
  });

  await test("booking draft survives first customer signup and creates one booking", async () => {
    const prepared = await client.evaluate(`(() => {
      document.querySelector('#servicesCategories [data-service-id]').click();
      document.querySelector('#goToStaffStep').click();
      const day = document.querySelector('[data-calendar-date]:not([disabled])');
      day?.click();
      const time = document.querySelector('[data-time-value]');
      time?.click();
      document.querySelector('#goToDetailsStep').click();
      document.querySelector('#bookingSignupPromptButton').click();
      return {
        day: day?.dataset.calendarDate || '',
        time: time?.dataset.timeValue || '',
        signupVisible: document.querySelector('#customerSignupForm')?.classList.contains('is-active')
      };
    })()`);
    assert(prepared.day && prepared.time && prepared.signupVisible, "Could not reach signup from the booking flow");

    await client.evaluate(`(() => {
      const form = document.querySelector('#customerSignupForm');
      const fill = (name, value) => {
        form.elements[name].value = value;
        form.elements[name].dispatchEvent(new Event('input', { bubbles: true }));
      };
      fill('firstName', 'נועה');
      fill('lastName', 'בדיקה');
      fill('phone', '0501112233');
      fill('email', 'newcustomer@example.com');
      fill('password', 'newpass123');
      fill('confirmPassword', 'newpass123');
      form.requestSubmit();
    })()`);
    await waitForExpression(`document.querySelector('#authModal')?.classList.contains('is-hidden')`, "Signup did not close the account dialog");

    const restored = await client.evaluate(`({
      detailsActive: document.querySelector('#detailsStep')?.classList.contains('is-active'),
      serviceSelected: Boolean(document.querySelector('#servicesCategories [data-service-id].is-selected')),
      dateSelected: Boolean(document.querySelector('[data-calendar-date].is-selected')),
      timeSelected: Boolean(document.querySelector('[data-time-value].is-selected')),
      fullName: document.querySelector('#bookingForm')?.elements.fullName?.value,
      phone: document.querySelector('#bookingForm')?.elements.phone?.value
    })`);
    assert(restored.detailsActive && restored.serviceSelected && restored.dateSelected && restored.timeSelected, "Booking draft was lost after signup");
    assert(restored.fullName === "נועה בדיקה" && restored.phone === "0501112233", "Customer details did not return to the booking form");

    await client.evaluate(`(() => {
      const form = document.querySelector('#bookingForm');
      form.elements.notes.value = 'הערת בדיקה';
      form.elements.notes.dispatchEvent(new Event('input', { bubbles: true }));
      form.requestSubmit();
    })()`);
    await waitForExpression(`window.__AUDIT_BACKEND__.read().bookings.length === 2`, "Booking was not saved");
    const result = await client.evaluate(`({
      successVisible: !document.querySelector('#bookingSuccessPanel')?.classList.contains('is-hidden'),
      pendingCount: window.__AUDIT_BACKEND__.read().bookings.filter(item => item.status === 'pending').length,
      customerSaved: window.__AUDIT_BACKEND__.read().users.some(item => item.email === 'newcustomer@example.com')
    })`);
    assert(result.successVisible && result.pendingCount === 1 && result.customerSaved, "Booking success or customer persistence failed");
  });

  await test("customer sees only her own bookings", async () => {
    const result = await client.evaluate(`(() => {
      document.querySelector('#myBookingsButton')?.click();
      const text = document.querySelector('#customerBookingsPanel')?.innerText || '';
      return {
        ownBookingShown: text.includes('טיפול בדיקה'),
        otherPrivateNoteHidden: !document.body.innerText.includes('מידע שאסור לחשוף'),
        otherCustomerHidden: !text.includes('לקוחה אחרת')
      };
    })()`);
    assert(Object.values(result).every(Boolean), "Customer privacy failed in My Bookings");
  });

  await test("existing customer login and forgot-password flow work", async () => {
    await client.evaluate(`document.querySelector('#logoutButton').click()`);
    await waitForExpression(`!window.__AUDIT_BACKEND__.read().sessionUserId`, "Customer logout did not finish");
    await client.evaluate(`(() => {
      document.querySelector('#openCustomerLogin').click();
      document.querySelector('#openCustomerExistingLoginButton').click();
      const form = document.querySelector('#customerLoginForm');
      form.elements.email.value = 'existing@example.com';
      form.elements.password.value = 'strongpass';
      form.requestSubmit();
    })()`);
    await waitForExpression(`window.__AUDIT_BACKEND__.read().sessionRole === 'customer'`, "Existing customer could not sign in");
    assert(await client.evaluate(`document.querySelector('#authModal').classList.contains('is-hidden')`), "Customer login dialog stayed open");

    await client.evaluate(`document.querySelector('#logoutButton').click()`);
    await waitForExpression(`!window.__AUDIT_BACKEND__.read().sessionUserId`, "Second customer logout did not finish");
    await client.evaluate(`(() => {
      document.querySelector('#openCustomerLogin').click();
      document.querySelector('#openCustomerExistingLoginButton').click();
      const form = document.querySelector('#customerLoginForm');
      form.elements.email.value = 'existing@example.com';
      document.querySelector('#customerForgotPasswordButton').click();
    })()`);
    await waitForExpression(`window.__AUDIT_BACKEND__.read().passwordResetEmail === 'existing@example.com'`, "Password reset email was not requested");
    assert(!(await client.evaluate(`window.__AUDIT_BACKEND__.read().sessionUserId`)), "Forgot password unexpectedly signed the customer in");
    const successfulResetRequest = await client.evaluate(`({
      feedback: document.querySelector('#customerLoginFeedback')?.textContent || '',
      buttonDisabled: document.querySelector('#customerForgotPasswordButton')?.disabled,
      buttonText: document.querySelector('#customerForgotPasswordButton')?.textContent || ''
    })`);
    assert(successfulResetRequest.feedback.includes('תיקיית הספאם'), "Successful password reset request did not show clear email guidance");
    assert(successfulResetRequest.buttonDisabled && successfulResetRequest.buttonText.includes('אפשר לבקש שוב'), "Password reset cooldown did not start");

    await client.evaluate(`sessionStorage.removeItem('booking_app_customer_password_reset_cooldown_v1'); location.reload()`);
    await waitForExpression(`document.querySelector('#businessName')?.textContent === 'Yael nails audit'`, "Public page did not reload after password reset cooldown test");
    await client.evaluate(`(() => {
      window.__AUDIT_BACKEND__.failNextPasswordReset();
      document.querySelector('#openCustomerLogin').click();
      document.querySelector('#openCustomerExistingLoginButton').click();
      document.querySelector('#customerLoginForm').elements.email.value = 'existing@example.com';
      document.querySelector('#customerForgotPasswordButton').click();
    })()`);
    await waitForExpression(
      `document.querySelector('#customerLoginFeedback')?.textContent.includes('כבר נשלחה בקשת איפוס')`,
      "Password reset rate limit did not show inline guidance"
    );
    const limitedResetRequest = await client.evaluate(`({
      buttonDisabled: document.querySelector('#customerForgotPasswordButton')?.disabled,
      errorToasts: Array.from(document.querySelectorAll('.app-toast')).filter((toast) =>
        /בקשות איפוס|rate limit/i.test(toast.innerText)
      ).length
    })`);
    assert(limitedResetRequest.buttonDisabled && limitedResetRequest.errorToasts === 0, "Password reset rate limit still produced repeated error UI");
  });

  await test("a conflicting customer login shows one inline error without breaking the site", async () => {
    await client.evaluate(`(() => {
      if (!document.querySelector('#authModal').classList.contains('is-hidden')) {
        document.querySelector('#closeModal').click();
      }
      document.querySelector('#openCustomerLogin').click();
      document.querySelector('#openCustomerExistingLoginButton').click();
      const form = document.querySelector('#customerLoginForm');
      form.elements.email.value = 'conflict@example.com';
      form.elements.password.value = 'strongpass';
      form.requestSubmit();
    })()`);
    await waitForExpression(
      `document.querySelector('#customerLoginFeedback')?.textContent.includes('האימייל שבו יצרת את החשבון')`,
      "Conflicting customer login did not show its inline explanation"
    );
    await waitForExpression(`!window.__AUDIT_BACKEND__.read().sessionUserId`, "Conflicting login left a partial session active");

    const result = await client.evaluate(`({
      businessName: document.querySelector('#businessName')?.textContent,
      serviceCount: document.querySelectorAll('#servicesCategories [data-service-id]').length,
      publicErrorVisible: document.querySelector('#businessName')?.textContent === 'לא הצלחנו לטעון את העסק',
      modalOpen: !document.querySelector('#authModal')?.classList.contains('is-hidden'),
      feedbackVisible: !document.querySelector('#customerLoginFeedback')?.classList.contains('is-hidden'),
      myBookingsHidden: document.querySelector('#myBookingsButton')?.classList.contains('is-hidden'),
      duplicateAccountToasts: Array.from(document.querySelectorAll('.app-toast')).filter((toast) =>
        /חשבון הלקוחה לא חובר|פרופיל הלקוחה המתאים/.test(toast.innerText)
      ).length
    })`);

    assert(result.businessName === "Yael nails audit" && result.serviceCount === 1, "Public business data disappeared after an account conflict");
    assert(!result.publicErrorVisible && result.modalOpen && result.feedbackVisible && result.myBookingsHidden, "Conflicting customer login UI is unsafe or unclear");
    assert(result.duplicateAccountToasts === 0, "Customer account conflict still created overlapping toasts");
    await client.evaluate(`document.querySelector('#closeModal').click()`);
  });

  await test("customer password recovery changes only the password", async () => {
    const before = await client.evaluate(`(() => {
      const database = window.__AUDIT_BACKEND__.read();
      return {
        users: JSON.stringify(database.users),
        bookings: JSON.stringify(database.bookings),
        notifications: JSON.stringify(database.notifications),
        waitlistEntries: JSON.stringify(database.waitlistEntries)
      };
    })()`);

    await client.evaluate(`window.__AUDIT_BACKEND__.activateCustomerRecovery('existing@example.com')`);
    await client.send("Page.navigate", {
      url: `http://127.0.0.1:${port}/mock/index.html?password-recovery=1&code=audit`
    });
    await waitForExpression(
      `document.querySelector('#customerRecoveryForm')?.classList.contains('is-active')`,
      "Customer recovery link did not open the password reset form"
    );

    const opened = await client.evaluate(`({
      modalOpen: !document.querySelector('#authModal')?.classList.contains('is-hidden'),
      recoveryActive: document.querySelector('#customerRecoveryForm')?.classList.contains('is-active'),
      businessName: document.querySelector('#businessName')?.textContent,
      conflictFeedbackVisible: !document.querySelector('#customerLoginFeedback')?.classList.contains('is-hidden')
    })`);
    assert(opened.modalOpen && opened.recoveryActive, "Password recovery form is not visible");
    assert(opened.businessName === "Yael nails audit", "Public business data disappeared during password recovery");
    assert(!opened.conflictFeedbackVisible, "Password recovery incorrectly displayed a customer account conflict");

    await client.evaluate(`(() => {
      const form = document.querySelector('#customerRecoveryForm');
      form.elements.newPassword.value = 'updated-strongpass';
      form.elements.confirmPassword.value = 'updated-strongpass';
      form.requestSubmit();
    })()`);
    await waitForExpression(
      `window.__AUDIT_BACKEND__.read().accounts['existing@example.com'].password === 'updated-strongpass'`,
      "Customer password was not updated"
    );
    await waitForExpression(
      `!window.__AUDIT_BACKEND__.read().sessionUserId`,
      "Customer remained signed in after password recovery"
    );

    const after = await client.evaluate(`(() => {
      const database = window.__AUDIT_BACKEND__.read();
      return {
        users: JSON.stringify(database.users),
        bookings: JSON.stringify(database.bookings),
        notifications: JSON.stringify(database.notifications),
        waitlistEntries: JSON.stringify(database.waitlistEntries),
        loginActive: document.querySelector('#customerLoginForm')?.classList.contains('is-active'),
        recoveryHidden: !document.querySelector('#customerRecoveryForm')?.classList.contains('is-active'),
        cleanUrl: !location.hash && !location.search
      };
    })()`);

    assert(after.users === before.users, "Password recovery changed the customer profile");
    assert(after.bookings === before.bookings, "Password recovery changed customer bookings");
    assert(after.notifications === before.notifications, "Password recovery changed customer notifications");
    assert(after.waitlistEntries === before.waitlistEntries, "Password recovery changed waitlist data");
    assert(after.loginActive && after.recoveryHidden && after.cleanUrl, "Password recovery did not return to a clean login screen");
  });

  await test("mock public layout is responsive on mobile and tablet", async () => {
    for (const width of [360, 768]) {
      await client.send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width < 600 });
      const result = await client.evaluate(`({ viewport: innerWidth, pageWidth: document.documentElement.scrollWidth })`);
      assert(result.pageWidth <= result.viewport + 2, `Public layout overflows at ${width}px`);
    }
  });

  await client.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await client.send("Page.navigate", { url: `http://127.0.0.1:${port}/mock/owner.html` });
  await waitForExpression(`window.__AUDIT_BACKEND__ && !document.documentElement.classList.contains('app-booting')`, "Mock owner page did not initialize");

  await test("owner login rejects fake reset credentials with a Hebrew message", async () => {
    const initial = await client.evaluate(`({
      loginVisible: !document.querySelector('#ownerLoginGate').classList.contains('is-hidden'),
      dashboardHidden: document.querySelector('#ownerLayout').classList.contains('is-hidden'),
      username: document.querySelector('#ownerLoginForm').elements.username.value,
      usernameLocked: document.querySelector('#ownerLoginForm').elements.username.readOnly,
      duplicateIntroHidden: document.querySelector('#ownerAccessMessage').classList.contains('is-hidden')
    })`);
    assert(Object.values(initial).every(Boolean) && initial.username === "admin", "Owner login gate is inconsistent");
    await client.evaluate(`(() => {
      const form = document.querySelector('#ownerLoginForm');
      form.elements.password.value = '1234';
      form.requestSubmit();
    })()`);
    await waitForExpression(`document.querySelector('.app-toast p')`, "Wrong owner password did not show feedback");
    const feedback = await client.evaluate(`({
      text: document.querySelector('.app-toast p')?.textContent || '',
      translated: window.AppUi?.translateMessage?.('Invalid login credentials') || '',
      dashboardHidden: document.querySelector('#ownerLayout').classList.contains('is-hidden')
    })`);
    assert(feedback.dashboardHidden && feedback.text.includes("לא נכונים") && !feedback.text.includes("Invalid"), `Owner login error is technical or unsafe: ${JSON.stringify(feedback)}`);
  });

  await test("owner login and all main management forms persist", async () => {
    await client.evaluate(`(() => {
      const form = document.querySelector('#ownerLoginForm');
      form.elements.password.value = 'correct-password';
      form.requestSubmit();
    })()`);
    await waitForExpression(`!document.querySelector('#ownerLayout').classList.contains('is-hidden')`, "Owner dashboard did not open");

    await client.evaluate(`(() => {
      const form = document.querySelector('#businessForm');
      form.elements.name.value = 'עסק מסונכרן';
      form.requestSubmit();
    })()`);
    await waitForExpression(`window.__AUDIT_BACKEND__.read().business.name === 'עסק מסונכרן'`, "Business form did not persist");

    await client.evaluate(`(() => {
      window.__AUDIT_BACKEND__.failNextOwnerSync();
      const form = document.querySelector('#businessForm');
      form.elements.name.value = 'שם שלא אמור להישמר';
      form.requestSubmit();
    })()`);
    await waitForExpression(`document.querySelector('#businessForm').elements.name.value === 'עסק מסונכרן'`, "Failed save did not restore the last confirmed state");
    assert(await client.evaluate(`window.__AUDIT_BACKEND__.read().business.name === 'עסק מסונכרן'`), "Failed save changed server data");
    await client.evaluate(`(() => {
      const form = document.querySelector('#businessForm');
      form.elements.name.value = 'עסק אחרי התאוששות';
      form.requestSubmit();
    })()`);
    await waitForExpression(`window.__AUDIT_BACKEND__.read().business.name === 'עסק אחרי התאוששות'`, "Save queue did not recover after a network failure");

    await client.evaluate(`document.querySelector('#addServiceButton').click()`);
    await waitForExpression(`document.querySelectorAll('#servicesEditor [data-service-id]').length === 2`, "Add service button did not add a service");
    await client.evaluate(`(() => {
      const rows = document.querySelectorAll('#servicesEditor [data-service-id]');
      rows[rows.length - 1].querySelector('[data-service-field="name"]').value = 'שירות חדש שנשמר';
      document.querySelector('#servicesForm').requestSubmit();
    })()`);
    await waitForExpression(`window.__AUDIT_BACKEND__.read().services.some(item => item.name === 'שירות חדש שנשמר')`, "Services form did not persist");
    await client.evaluate(`(() => {
      const rows = Array.from(document.querySelectorAll('#servicesEditor [data-service-id]'));
      const row = rows.find(item => item.querySelector('[data-service-field="name"]').value === 'שירות חדש שנשמר');
      row?.querySelector('.remove-service-button').click();
    })()`);
    await waitForExpression(`!window.__AUDIT_BACKEND__.read().services.some(item => item.name === 'שירות חדש שנשמר')`, "A newly added service returned after deletion");
    await client.evaluate(`document.querySelector('#addServiceButton').click()`);
    await waitForExpression(`document.querySelectorAll('#servicesEditor [data-service-id]').length === 2`, "Could not add a service after deleting one");
    await client.evaluate(`(() => {
      const rows = document.querySelectorAll('#servicesEditor [data-service-id]');
      rows[rows.length - 1].querySelector('[data-service-field="name"]').value = 'שירות סופי';
      document.querySelector('#servicesForm').requestSubmit();
    })()`);
    await waitForExpression(`window.__AUDIT_BACKEND__.read().services.some(item => item.name === 'שירות סופי')`, "Service save did not recover after deletion");

    await client.evaluate(`document.querySelector('[data-working-days-mode="select_closed_days"]').click()`);
    await waitForExpression(`window.__AUDIT_BACKEND__.read().business.features.workingDaysMode === 'select_closed_days'`, "Working-days mode did not persist");

    await client.evaluate(`(() => {
      const form = document.querySelector('#specialHoursForm');
      document.querySelector('[data-special-mode="custom"]').click();
      form.elements.specialDate.value = '2099-02-01';
      form.elements.specialOpen.value = '10:00';
      form.elements.specialClose.value = '13:00';
      form.elements.specialInterval.value = '30';
      form.requestSubmit();
    })()`);
    await waitForExpression(`window.__AUDIT_BACKEND__.read().specialHours.some(item => item.special_date === '2099-02-01')`, "Special date form did not persist");
    await client.evaluate(`document.querySelector('#specialHoursList .remove-special-hours-button').click()`);
    await waitForExpression(`window.__AUDIT_BACKEND__.read().specialHours.length === 0`, "A newly added special date returned after deletion");
    await client.evaluate(`(() => {
      const form = document.querySelector('#specialHoursForm');
      document.querySelector('[data-special-mode="custom"]').click();
      form.elements.specialDate.value = '2099-02-01';
      form.elements.specialOpen.value = '10:00';
      form.elements.specialClose.value = '13:00';
      form.requestSubmit();
    })()`);
    await waitForExpression(`window.__AUDIT_BACKEND__.read().specialHours.length === 1`, "Special date could not be recreated after deletion");

    const blockedForm = await client.evaluate(`(() => {
      const form = document.querySelector('#blockedSlotsForm');
      form.elements.blockedDate.value = '2099-02-02';
      form.elements.blockedDate.dispatchEvent(new Event('change', { bubbles: true }));
      const firstTimeOption = Array.from(form.elements.blockedTime.options).findIndex(option => option.value);
      if (firstTimeOption >= 0) form.elements.blockedTime.selectedIndex = firstTimeOption;
      const result = {
        date: form.elements.blockedDate.value,
        time: form.elements.blockedTime.value,
        options: form.elements.blockedTime.options.length,
        disabled: form.elements.blockedTime.disabled,
        valid: form.checkValidity()
      };
      form.requestSubmit();
      return result;
    })()`);
    assert(blockedForm.date && blockedForm.time && blockedForm.options > 0 && !blockedForm.disabled && blockedForm.valid, `Blocked slot form is not usable: ${JSON.stringify(blockedForm)}`);
    await waitForExpression(`window.__AUDIT_BACKEND__.read().blockedSlots.some(item => item.blocked_date === '2099-02-02')`, "Blocked slot form did not persist");
    await client.evaluate(`document.querySelector('#blockedSlotsList .unblock-slot-button').click()`);
    await waitForExpression(`window.__AUDIT_BACKEND__.read().blockedSlots.length === 0`, "A newly blocked slot returned after deletion");
    await client.evaluate(`(() => {
      const form = document.querySelector('#blockedSlotsForm');
      form.elements.blockedDate.value = '2099-02-02';
      form.elements.blockedDate.dispatchEvent(new Event('change', { bubbles: true }));
      const option = Array.from(form.elements.blockedTime.options).find(item => item.value);
      if (option) form.elements.blockedTime.value = option.value;
      form.requestSubmit();
    })()`);
    await waitForExpression(`window.__AUDIT_BACKEND__.read().blockedSlots.length === 1`, "Blocked slot could not be recreated after deletion");

    await client.evaluate(`(() => {
      const card = document.querySelector('.owner-customer-card [data-customer-phone="0501112233"]')?.closest('.owner-customer-card');
      const note = card?.querySelector('.owner-note-input');
      if (note) note.value = 'הערה שנשמרה לבעלת העסק';
      card?.querySelector('.save-customer-note-button')?.click();
    })()`);
    await waitForExpression(`window.__AUDIT_BACKEND__.read().users.some(item => item.phone === '0501112233' && item.owner_note === 'הערה שנשמרה לבעלת העסק')`, "Customer note did not persist");
    await client.evaluate(`document.querySelector('.toggle-customer-block-button[data-customer-phone="0501112233"]').click()`);
    await waitForExpression(`window.__AUDIT_BACKEND__.read().users.some(item => item.phone === '0501112233' && item.is_blocked)`, "Customer blocking did not persist");
    await client.evaluate(`document.querySelector('.toggle-customer-block-button[data-customer-phone="0501112233"]').click()`);
    await waitForExpression(`window.__AUDIT_BACKEND__.read().users.some(item => item.phone === '0501112233' && !item.is_blocked)`, "Customer unblock did not persist");

    const result = await client.evaluate(`({
      business: window.__AUDIT_BACKEND__.read().business.name,
      services: window.__AUDIT_BACKEND__.read().services.length,
      special: window.__AUDIT_BACKEND__.read().specialHours.length,
      blocked: window.__AUDIT_BACKEND__.read().blockedSlots.length,
      navTargetsExist: Array.from(document.querySelectorAll('.owner-nav a')).every(link => document.querySelector(link.getAttribute('href')))
    })`);
    assert(result.business === "עסק אחרי התאוששות" && result.services === 2 && result.special === 1 && result.blocked === 1 && result.navTargetsExist, "Owner management state is incomplete");
  });

  await test("owner booking actions, password change, and email test buttons work", async () => {
    const notificationState = await client.evaluate(`(() => {
      const bell = document.querySelector('.notification-bell-button');
      const badge = document.querySelector('.notification-badge');
      bell?.click();
      return {
        bellVisible: Boolean(bell && !bell.closest('.notification-center').classList.contains('is-hidden')),
        pendingBadge: Number(badge?.textContent || 0),
        panelOpen: !document.querySelector('.notification-panel').classList.contains('is-hidden')
      };
    })()`);
    assert(notificationState.bellVisible && notificationState.pendingBadge > 0 && notificationState.panelOpen, "Owner notification center did not show the pending booking");
    await client.evaluate(`document.querySelector('.notification-mark-all-button').click()`);
    await waitForExpression(`window.__AUDIT_BACKEND__.read().notifications.filter(item => item.user_id === '188f1269-e04a-4184-882c-226f60a47d28').every(item => item.is_read)`, "Mark all notifications as read did not persist");

    const approved = await client.evaluate(`(() => {
      const button = document.querySelector('.approve-booking-button');
      button?.click();
      return Boolean(button);
    })()`);
    assert(approved, "Pending booking did not expose an approve action");
    await waitForExpression(`window.__AUDIT_BACKEND__.read().bookings.some(item => item.status === 'approved' && item.customer_email === 'newcustomer@example.com')`, "Approve booking did not persist");
    await client.evaluate(`(() => {
      const booking = window.__AUDIT_BACKEND__.read().bookings.find(item => item.customer_email === 'newcustomer@example.com');
      document.querySelector('.send-attendance-confirmation-button[data-booking-id="' + booking.id + '"]')?.click();
    })()`);
    await waitForExpression(`window.__AUDIT_BACKEND__.read().bookings.some(item => item.customer_email === 'newcustomer@example.com' && item.attendance_confirmation_status === 'pending')`, "Attendance request did not persist");

    await client.evaluate(`(() => {
      const form = document.querySelector('#sellerCredentialsForm');
      form.elements.password.value = 'temporary-password';
      form.requestSubmit();
    })()`);
    await waitForExpression(`window.__AUDIT_BACKEND__.read().accounts['owner@example.com'].password === 'temporary-password'`, "Owner password change did not persist");
    await client.evaluate(`(() => {
      const form = document.querySelector('#sellerCredentialsForm');
      form.elements.password.value = 'correct-password';
      form.requestSubmit();
      document.querySelector('#sendTestEmailButton').click();
    })()`);
    await waitForExpression(`window.__AUDIT_BACKEND__.read().accounts['owner@example.com'].password === 'correct-password'`, "Owner password was not restored");
    await waitForExpression(`Array.from(document.querySelectorAll('.app-toast p')).some(item => item.textContent.includes('אימייל ניסיון נשלח'))`, "Test email button did not report success");
  });

  await test("business changes survive navigation to the public page", async () => {
    await client.send("Page.navigate", { url: `http://127.0.0.1:${port}/mock/index.html` });
    await waitForExpression(`document.querySelector('#businessName')?.textContent === 'עסק אחרי התאוששות'`, "Public page did not show the saved business name");
    assert(await client.evaluate(`document.querySelector('#businessName').textContent === document.querySelector('#brandName').textContent`), "Public business name is inconsistent");
    await client.send("Page.navigate", { url: `http://127.0.0.1:${port}/mock/owner.html` });
    await waitForExpression(`!document.querySelector('#ownerLayout').classList.contains('is-hidden')`, "Owner session did not survive navigation");
  });

  await test("customer attendance, cancellation, and account boundaries work", async () => {
    await client.send("Page.navigate", { url: `http://127.0.0.1:${port}/mock/index.html` });
    await waitForExpression(`!document.documentElement.classList.contains('app-booting')`, "Public page did not reopen");
    await client.evaluate(`document.querySelector('#sellerSiteLogoutButton').click()`);
    await waitForExpression(`window.__AUDIT_BACKEND__.read().sessionRole === null`, "Owner did not log out from the public page");
    await client.evaluate(`(() => {
      document.querySelector('#openCustomerLogin').click();
      document.querySelector('#openCustomerExistingLoginButton').click();
      const form = document.querySelector('#customerLoginForm');
      form.elements.email.value = 'newcustomer@example.com';
      form.elements.password.value = 'newpass123';
      form.requestSubmit();
    })()`);
    await waitForExpression(`window.__AUDIT_BACKEND__.read().sessionRole === 'customer'`, "Customer could not log back in");
    await client.evaluate(`document.querySelector('#myBookingsButton').click()`);
    await waitForExpression(`document.querySelector('#myBookingsList .confirm-arrival-button')`, "Customer did not receive the attendance action");
    await client.evaluate(`document.querySelector('#myBookingsList .confirm-arrival-button').click()`);
    await waitForExpression(`window.__AUDIT_BACKEND__.read().bookings.some(item => item.customer_email === 'newcustomer@example.com' && item.attendance_confirmation_status === 'confirmed')`, "Customer attendance confirmation did not persist");
    await client.evaluate(`document.querySelector('#myBookingsList .replace-booking-button').click()`);
    await waitForExpression(`document.querySelector('#scheduleStep').classList.contains('is-active')`, "Customer rescheduling did not open the schedule step");
    await waitForExpression(`document.querySelector('#firstAvailableList [data-first-date][data-first-time]')`, "No replacement time was offered");
    await client.evaluate(`document.querySelector('#firstAvailableList [data-first-date][data-first-time]').click()`);
    await waitForExpression(`document.querySelector('#detailsStep').classList.contains('is-active')`, "Replacement time did not open the confirmation step");
    const replacementFormState = await client.evaluate(`(() => {
      const form = document.querySelector('#bookingForm');
      return {
        valid: form.checkValidity(),
        fullName: form.elements.fullName.value,
        phone: form.elements.phone.value,
        email: form.elements.email.value,
        summary: document.querySelector('#bookingSummaryCard').innerText,
        changeMode: !document.querySelector('#changeModeBanner').classList.contains('is-hidden')
      };
    })()`);
    assert(replacementFormState.valid && replacementFormState.fullName && replacementFormState.phone && replacementFormState.changeMode, `Replacement form lost required state: ${JSON.stringify(replacementFormState)}`);
    await client.evaluate(`document.querySelector('#bookingForm').requestSubmit()`);
    try {
      await waitForExpression(`window.__AUDIT_BACKEND__.read().bookings.some(item => item.customer_email === 'newcustomer@example.com' && item.replaces_booking_id && item.status === 'pending')`, "Replacement booking was not created");
    } catch (error) {
      const diagnostics = await client.evaluate(`({
        bookings: window.__AUDIT_BACKEND__.read().bookings.filter(item => item.customer_email === 'newcustomer@example.com'),
        toasts: Array.from(document.querySelectorAll('.app-toast p')).map(item => item.textContent),
        detailsActive: document.querySelector('#detailsStep').classList.contains('is-active'),
        scheduleActive: document.querySelector('#scheduleStep').classList.contains('is-active'),
        bodyText: document.body.innerText.slice(0, 1200)
      })`);
      throw new Error(`${error.message}: ${JSON.stringify(diagnostics)}`);
    }
    const privacy = await client.evaluate(`({
      otherCustomerHidden: !document.querySelector('#customerBookingsPanel').innerText.includes('לקוחה אחרת'),
      otherNoteHidden: !document.body.innerText.includes('מידע שאסור לחשוף')
    })`);
    assert(privacy.otherCustomerHidden && privacy.otherNoteHidden, "Customer actions exposed another customer's data");

    await client.evaluate(`document.querySelector('#logoutButton').click()`);
    await waitForExpression(`window.__AUDIT_BACKEND__.read().sessionRole === null`, "Customer logout failed");
    await client.send("Page.navigate", { url: `http://127.0.0.1:${port}/mock/owner.html` });
    await waitForExpression(`!document.documentElement.classList.contains('app-booting') && !document.querySelector('#ownerLoginGate').classList.contains('is-hidden')`, "Owner login did not reopen");
    await client.evaluate(`(() => {
      const form = document.querySelector('#ownerLoginForm');
      form.elements.password.value = 'correct-password';
      form.requestSubmit();
    })()`);
    try {
      await waitForExpression(`!document.querySelector('#ownerLayout').classList.contains('is-hidden')`, "Owner could not log in after customer actions");
    } catch (error) {
      const diagnostics = await client.evaluate(`({
        sessionRole: window.__AUDIT_BACKEND__.read().sessionRole,
        ownerPassword: window.__AUDIT_BACKEND__.read().accounts['owner@example.com']?.password,
        loginHidden: document.querySelector('#ownerLoginGate').classList.contains('is-hidden'),
        dashboardHidden: document.querySelector('#ownerLayout').classList.contains('is-hidden'),
        messages: Array.from(document.querySelectorAll('.app-toast p, #ownerAccessMessage')).map(item => item.textContent).filter(Boolean)
      })`);
      throw new Error(`${error.message}: ${JSON.stringify(diagnostics)}`);
    }
    await client.evaluate(`(() => {
      const replacement = window.__AUDIT_BACKEND__.read().bookings.find(item => item.customer_email === 'newcustomer@example.com' && item.replaces_booking_id);
      document.querySelector('.approve-booking-button[data-booking-id="' + replacement.id + '"]')?.click();
    })()`);
    await waitForExpression(`(() => {
      const bookings = window.__AUDIT_BACKEND__.read().bookings.filter(item => item.customer_email === 'newcustomer@example.com');
      return bookings.some(item => item.replaces_booking_id && item.status === 'approved') && bookings.some(item => !item.replaces_booking_id && item.status === 'cancelled');
    })()`, "Owner approval did not complete the reschedule safely");

    await client.evaluate(`document.querySelector('#ownerLogoutButton').click()`);
    await waitForExpression(`location.pathname.endsWith('/index.html')`, "Owner logout after rescheduling failed");
    await waitForExpression(`!document.documentElement.classList.contains('app-booting') && document.querySelector('#openCustomerExistingLoginButton')`, "Customer account dialog was not ready after owner logout");
    await client.evaluate(`(() => {
      document.querySelector('#openCustomerLogin').click();
      document.querySelector('#openCustomerExistingLoginButton').click();
      const form = document.querySelector('#customerLoginForm');
      form.elements.email.value = 'newcustomer@example.com';
      form.elements.password.value = 'newpass123';
      form.requestSubmit();
    })()`);
    await waitForExpression(`window.__AUDIT_BACKEND__.read().sessionRole === 'customer'`, "Customer could not return after rescheduling");
    await client.evaluate(`document.querySelector('#myBookingsButton').click()`);
    await waitForExpression(`document.querySelector('#myBookingsList .cancel-booking-button')`, "Rescheduled booking was not visible to the customer");
    await client.evaluate(`document.querySelector('#myBookingsList .cancel-booking-button').click()`);
    await waitForExpression(`!document.querySelector('.app-confirm-overlay').classList.contains('is-hidden')`, "Customer cancellation confirmation did not open");
    await client.evaluate(`document.querySelector('[data-app-confirm="approve"]').click()`);
    await waitForExpression(`window.__AUDIT_BACKEND__.read().bookings.some(item => item.customer_email === 'newcustomer@example.com' && item.replaces_booking_id && item.status === 'cancelled')`, "Customer cancellation did not persist");
    await client.evaluate(`document.querySelector('#logoutButton').click()`);
    await waitForExpression(`window.__AUDIT_BACKEND__.read().sessionRole === null`, "Customer did not log out after cancellation");
    await client.send("Page.navigate", { url: `http://127.0.0.1:${port}/mock/owner.html` });
    await waitForExpression(`!document.documentElement.classList.contains('app-booting') && !document.querySelector('#ownerLoginGate').classList.contains('is-hidden')`, "Owner login did not reopen after cancellation");
    await client.evaluate(`(() => {
      const form = document.querySelector('#ownerLoginForm');
      form.elements.password.value = 'correct-password';
      form.requestSubmit();
    })()`);
    await waitForExpression(`!document.querySelector('#ownerLayout').classList.contains('is-hidden')`, "Owner could not return after customer cancellation");
  });

  await test("full reset is atomic, preserves credentials, and does not log the owner out", async () => {
    await client.evaluate(`document.querySelector('#resetBusinessTemplateButton').click()`);
    await waitForExpression(`!document.querySelector('.app-confirm-overlay').classList.contains('is-hidden')`, "First reset warning did not open");
    await client.evaluate(`document.querySelector('[data-app-confirm="approve"]').click()`);
    await waitForExpression(`document.querySelector('#appConfirmTitle')?.textContent === 'אישור אחרון'`, "Second reset warning did not open");
    await client.evaluate(`document.querySelector('[data-app-confirm="approve"]').click()`);
    await waitForExpression(`window.__AUDIT_BACKEND__.read().business.name === 'שם העסק שלך'`, "Full reset did not finish");
    const result = await client.evaluate(`({
      dashboardVisible: !document.querySelector('#ownerLayout').classList.contains('is-hidden'),
      sessionRole: window.__AUDIT_BACKEND__.read().sessionRole,
      password: window.__AUDIT_BACKEND__.read().accounts['owner@example.com'].password,
      ownerEmail: window.__AUDIT_BACKEND__.read().business.owner_email,
      bookings: window.__AUDIT_BACKEND__.read().bookings.length,
      customers: window.__AUDIT_BACKEND__.read().users.length,
      fakePasswordTextAbsent: !document.body.innerText.includes('admin / 1234')
    })`);
    assert(result.dashboardVisible && result.sessionRole === "owner", "Reset logged the owner out");
    assert(result.password === "correct-password" && result.ownerEmail === "owner@example.com", "Reset changed protected credentials or email");
    assert(result.bookings === 0 && result.customers === 0 && result.fakePasswordTextAbsent, "Reset left stale data or fake credentials");

    await client.evaluate(`document.querySelector('#ownerLogoutButton').click()`);
    await waitForExpression(`location.pathname.endsWith('/index.html')`, "Owner logout did not return to the public page");
    await client.send("Page.navigate", { url: `http://127.0.0.1:${port}/mock/owner.html` });
    await waitForExpression(`!document.documentElement.classList.contains('app-booting') && !document.querySelector('#ownerLoginGate').classList.contains('is-hidden')`, "Owner login did not open after reset and logout");
    await client.evaluate(`(() => {
      const form = document.querySelector('#ownerLoginForm');
      form.elements.password.value = '1234';
      form.requestSubmit();
    })()`);
    await waitForExpression(`Array.from(document.querySelectorAll('.app-toast p')).some(item => item.textContent.includes('לא נכונים'))`, "Fake reset password was not rejected after reset");
    assert(await client.evaluate(`document.querySelector('#ownerLayout').classList.contains('is-hidden')`), "Fake reset password opened the dashboard");
    await client.evaluate(`(() => {
      const form = document.querySelector('#ownerLoginForm');
      form.elements.password.value = 'correct-password';
      form.requestSubmit();
    })()`);
    await waitForExpression(`!document.querySelector('#ownerLayout').classList.contains('is-hidden')`, "The real owner password stopped working after reset");
  });

  await test("mock owner layout is responsive on mobile and tablet", async () => {
    for (const width of [360, 768]) {
      await client.send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width < 600 });
      const result = await client.evaluate(`({ viewport: innerWidth, pageWidth: document.documentElement.scrollWidth })`);
      assert(result.pageWidth <= result.viewport + 2, `Owner layout overflows at ${width}px`);
    }
  });

  assert(consoleErrors.length === 0, `Console errors: ${consoleErrors.join(" | ")}`);
  assert(failedLocalRequests.length === 0, `Failed local requests: ${failedLocalRequests.join(" | ")}`);
  process.stdout.write(JSON.stringify({ ok: true, tests, consoleErrors, failedLocalRequests }, null, 2));
} finally {
  if (client?.socket?.readyState === WebSocket.OPEN) client.socket.close();
  browser.kill();
  await new Promise((resolve) => server.close(resolve));
}
