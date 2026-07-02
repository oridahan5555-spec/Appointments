import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { spawn } from "node:child_process";
import { extname, join, normalize } from "node:path";
import { tmpdir } from "node:os";

const root = process.cwd();
const port = 4173;
const debuggingPort = 9300 + Math.floor(Math.random() * 500);
const edgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".sql": "text/plain; charset=utf-8"
};

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const server = createServer(async (request, response) => {
  try {
    const urlPath = decodeURIComponent(new URL(request.url, `http://127.0.0.1:${port}`).pathname);
    const relativePath = urlPath === "/" ? "index.html" : urlPath.replace(/^\/+/, "");
    const filePath = normalize(join(root, relativePath));
    assert(filePath.startsWith(normalize(root)), "Blocked path outside project");
    assert((await stat(filePath)).isFile(), "Not a file");
    response.writeHead(200, { "Content-Type": mimeTypes[extname(filePath)] || "application/octet-stream" });
    response.end(await readFile(filePath));
  } catch (error) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
});

await new Promise((resolve) => server.listen(port, "127.0.0.1", resolve));

const browser = spawn(edgePath, [
  "--headless=new",
  "--disable-gpu",
  "--disable-extensions",
  "--no-first-run",
  "--no-default-browser-check",
  `--remote-debugging-port=${debuggingPort}`,
  `--user-data-dir=${join(tmpdir(), `booking-audit-${Date.now()}`)}`,
  `http://127.0.0.1:${port}/index.html`
], { stdio: "ignore" });

class CdpClient {
  constructor(url) {
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
    this.socket = new WebSocket(url);
  }

  async connect() {
    if (this.socket.readyState === WebSocket.OPEN) {
      return;
    }
    await new Promise((resolve, reject) => {
      this.socket.addEventListener("open", resolve, { once: true });
      this.socket.addEventListener("error", reject, { once: true });
    });
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
    const listeners = this.listeners.get(method) || [];
    listeners.push(listener);
    this.listeners.set(method, listeners);
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
      const target = targets.find(
        (item) => item.type === "page" && item.url.startsWith(`http://127.0.0.1:${port}/`)
      );
      if (target) return target;
    } catch (error) {
      // Edge is still starting.
    }
    await wait(100);
  }
  throw new Error("Could not connect to Edge");
}

const results = [];
const consoleErrors = [];
const failedRequests = [];
let client;

async function test(name, callback) {
  await callback();
  results.push(name);
}

try {
  const target = await getPageTarget();
  client = new CdpClient(target.webSocketDebuggerUrl);
  await client.connect();
  await client.send("Runtime.enable");
  await client.send("Page.enable");
  await client.send("Network.enable");
  await client.send("Log.enable");

  client.on("Runtime.exceptionThrown", ({ exceptionDetails }) => {
    consoleErrors.push(exceptionDetails.exception?.description || exceptionDetails.text);
  });
  client.on("Log.entryAdded", ({ entry }) => {
    if (entry.level === "error") consoleErrors.push(entry.text);
  });
  client.on("Network.loadingFailed", ({ errorText, canceled }) => {
    if (!canceled) failedRequests.push(errorText);
  });

  await client.send("Page.navigate", { url: `http://127.0.0.1:${port}/index.html` });
  await wait(600);
  await client.evaluate("localStorage.clear(); sessionStorage.clear(); location.reload()");
  await wait(800);

  await test("index page and RTL load", async () => {
    const page = await client.evaluate(`({
      title: document.title,
      dir: document.documentElement.dir,
      form: Boolean(document.querySelector('#bookingForm')),
      scripts: [...document.scripts].map((script) => script.src.split('/').pop())
    })`);
    assert(page.title && page.dir === "rtl" && page.form, "Index page or RTL did not load");
    assert(page.scripts.includes("app-ui.js") && page.scripts.includes("notifications.js") && page.scripts.includes("script.js"), "Broken index imports");
  });

  await test("wizard navigation and calendar buttons", async () => {
    const navigation = await client.evaluate(`(() => {
      document.querySelector('.service-card').click();
      goToStaffStep.click();
      const reachedStaff = uiState.wizardStep === 2;
      document.querySelector('.staff-card').click();
      goToScheduleStep.click();
      const reachedSchedule = uiState.wizardStep === 3;
      const firstModeDefault = uiState.scheduleMode === 'firstAvailable' && !firstAvailablePanel.classList.contains('is-hidden');
      scheduleModeSwitch.querySelector('[data-schedule-mode="calendar"]').click();
      const switchedToCalendar = uiState.scheduleMode === 'calendar' && !calendarModePanel.classList.contains('is-hidden');
      scheduleModeSwitch.querySelector('[data-schedule-mode="firstAvailable"]').click();
      const firstSlot = firstAvailableList.querySelector('[data-first-date][data-first-time]');
      if (firstSlot) {
        firstSlot.click();
      }
      const firstAvailableSelected = Boolean(firstSlot) && uiState.wizardStep === 4 && uiState.selectedDate && uiState.selectedTime;
      backToScheduleStep.click();
      const monthBefore = uiState.selectedMonthKey;
      calendarNextButton.click();
      const nextWorked = uiState.selectedMonthKey !== monthBefore;
      calendarPrevButton.click();
      backToStaffStep.click();
      const backWorked = uiState.wizardStep === 2;
      return { reachedStaff, reachedSchedule, firstModeDefault, switchedToCalendar, firstAvailableSelected, nextWorked, backWorked };
    })()`);
    assert(Object.values(navigation).every(Boolean), `Wizard navigation failed: ${JSON.stringify(navigation)}`);
  });

  await test("buttons show tactile press feedback", async () => {
    const feedback = await client.evaluate(`(() => {
      const button = openCustomerLogin;
      const bounds = button.getBoundingClientRect();
      button.dispatchEvent(new PointerEvent('pointerdown', {
        bubbles: true,
        button: 0,
        clientX: bounds.left + bounds.width / 2,
        clientY: bounds.top + bounds.height / 2
      }));
      return {
        ripple: Boolean(button.querySelector('.button-press-ripple')),
        pressClass: button.classList.contains('has-press-feedback')
      };
    })()`);
    assert(feedback.ripple && feedback.pressClass, "Button press feedback did not appear");
  });

  await test("password visibility toggles", async () => {
    const passwordToggle = await client.evaluate(`(() => {
      const input = customerLoginForm.elements.password;
      const toggle = input.closest('.password-field-control')?.querySelector('.password-visibility-button');
      if (!toggle) return null;
      input.value = 'secret123';
      toggle.click();
      const shown = input.type === 'text' && toggle.getAttribute('aria-pressed') === 'true';
      toggle.click();
      const hidden = input.type === 'password' && toggle.getAttribute('aria-pressed') === 'false';
      return {
        shown,
        hidden,
        everyPasswordWrapped: [...document.querySelectorAll('input[type="password"]')].every((field) => Boolean(field.closest('.password-field-control')))
      };
    })()`);
    assert(passwordToggle && Object.values(passwordToggle).every(Boolean), `Password toggle failed: ${JSON.stringify(passwordToggle)}`);
  });

  await test("booking fields accept typing and preserve draft", async () => {
    await client.evaluate(`showWizardStep(4); renderDetailsForm();
      bookingForm.elements.fullName.value = '';
      bookingForm.elements.fullName.focus();`);
    await client.send("Input.insertText", { text: "אורי דהאן" });
    await client.evaluate("bookingForm.elements.phone.focus()");
    await client.send("Input.insertText", { text: "0501234567" });
    await client.evaluate("bookingForm.elements.notes.focus()");
    await client.send("Input.insertText", { text: "הערת בדיקה" });
    const before = await client.evaluate(`({
      name: bookingForm.elements.fullName.value,
      phone: bookingForm.elements.phone.value,
      notes: bookingForm.elements.notes.value,
      disabled: [...bookingForm.elements].some((element) => element.disabled)
    })`);
    assert(before.name === "אורי דהאן" && before.phone === "0501234567" && before.notes === "הערת בדיקה", "Booking fields rejected typing");
    assert(!before.disabled, "Booking form contains disabled controls");
    await client.evaluate("rerenderAll()");
    const after = await client.evaluate(`({ name: bookingForm.elements.fullName.value, phone: bookingForm.elements.phone.value, notes: bookingForm.elements.notes.value })`);
    assert(after.name === before.name && after.phone === before.phone && after.notes === before.notes, "Booking draft was erased by render");
  });

  await test("customer login and modal prefill", async () => {
    await client.evaluate("bookingForm.requestSubmit()");
    await wait(100);
    const modal = await client.evaluate(`({
      open: !authModal.classList.contains('is-hidden'),
      firstName: customerLoginForm.elements.firstName.value,
      lastName: customerLoginForm.elements.lastName.value,
      phone: customerLoginForm.elements.phone.value
    })`);
    assert(modal.open && modal.firstName === "אורי" && modal.lastName === "דהאן" && modal.phone === "0501234567", "Customer login modal did not preserve draft");
    await client.evaluate(`customerLoginForm.elements.password.value = 'test1234'; customerLoginForm.requestSubmit()`);
    await wait(150);
    assert(await client.evaluate("session.role === 'customer' && !customerBookingsPanel.classList.contains('is-hidden')"), "Customer login failed");
  });

  await test("appointment creation and owner notification", async () => {
    const prepared = await client.evaluate(`(() => {
      uiState.selectedServiceId = state.services[0].id;
      uiState.selectedServiceIds = [state.services[0].id, state.services[1].id];
      uiState.selectedStaffId = state.staff[0].id;
      for (let offset = 1; offset < 21; offset += 1) {
        const date = new Date();
        date.setDate(date.getDate() + offset);
        const dateValue = localDateValue(date);
        const slots = getAvailableSlots(dateValue);
        if (slots.length) {
          uiState.selectedDate = dateValue;
          uiState.selectedTime = slots[0];
          rerenderAll();
          showWizardStep(4);
          bookingForm.elements.fullName.value = 'אורי דהאן';
          bookingForm.elements.phone.value = '0501234567';
          bookingForm.elements.notes.value = 'בדיקה';
          bookingForm.dispatchEvent(new Event('input', { bubbles: true }));
          return true;
        }
      }
      return false;
    })()`);
    assert(prepared, "No available slot for booking test");
    await client.evaluate("bookingForm.requestSubmit()");
    await wait(180);
    const created = await client.evaluate(`({
      bookings: state.bookings.length,
      serviceIds: state.bookings[0]?.service_ids?.length || 0,
      serviceName: state.bookings[0]?.service_name || '',
      totalDuration: state.bookings[0]?.duration_minutes || 0,
      expectedDuration: (state.services[0]?.duration || 0) + (state.services[1]?.duration || 0),
      ownerNotifications: state.notifications.filter((item) => item.user_id === 'owner' && item.type === 'appointment_booked').length,
      success: !bookingSuccessPanel.classList.contains('is-hidden')
    })`);
    assert(
      created.bookings === 1 &&
      created.serviceIds === 2 &&
      created.serviceName.includes(' + ') &&
      created.totalDuration === created.expectedDuration &&
      created.ownerNotifications === 1 &&
      created.success,
      "Appointment creation or combined-service notification failed"
    );
  });

  await test("customer appointment cancellation and confirmation", async () => {
    await client.evaluate("renderCustomerBookings(); document.querySelector('.cancel-booking-button').click()");
    await wait(180);
    const confirmation = await client.evaluate(`({
      open: !document.querySelector('.app-confirm-overlay').classList.contains('is-hidden'),
      buttons: document.querySelectorAll('.app-confirm-overlay button').length
    })`);
    assert(confirmation.open && confirmation.buttons === 2, "Cancellation confirmation did not open correctly");
    await client.evaluate("document.querySelector('.app-confirm-overlay button:last-child').click()");
    await wait(160);
    const cancelled = await client.evaluate(`({
      status: state.bookings[0].status,
      notification: state.notifications.some((item) => item.user_id === 'owner' && item.type === 'appointment_cancelled')
    })`);
    assert(cancelled.status === "cancelled" && cancelled.notification, "Customer cancellation failed");
  });

  await test("customer appointment rescheduling request", async () => {
    const started = await client.evaluate(`(() => {
      const original = state.bookings[0];
      original.status = 'approved';
      original.arrival_status = 'waiting';
      original.hidden_for_customer = false;
      saveState();
      uiState.customerBookingsView = 'active';
      renderCustomerBookings();
      const replaceButton = document.querySelector('.replace-booking-button');
      if (!replaceButton) return false;
      replaceButton.click();
      for (let offset = 8; offset < 35; offset += 1) {
        const date = new Date();
        date.setDate(date.getDate() + offset);
        const dateValue = localDateValue(date);
        const slots = getAvailableSlots(dateValue);
        if (slots.length && (dateValue !== original.booking_date || slots[0] !== original.booking_time)) {
          uiState.selectedDate = dateValue;
          uiState.selectedTime = slots[0];
          rerenderAll();
          showWizardStep(4);
          return true;
        }
      }
      return false;
    })()`);
    assert(started, "Could not start appointment rescheduling");
    await client.evaluate("bookingForm.requestSubmit()");
    await wait(180);
    const rescheduled = await client.evaluate(`({
      count: state.bookings.length,
      replaces: state.bookings[1]?.replaces_booking_id,
      originalId: state.bookings[0]?.id,
      serviceIds: state.bookings[1]?.service_ids?.length || 0,
      ownerNotification: state.notifications.some((item) => item.user_id === 'owner' && item.type === 'appointment_rescheduled')
    })`);
    assert(rescheduled.count === 2 && rescheduled.replaces === rescheduled.originalId && rescheduled.serviceIds === 2 && rescheduled.ownerNotification, "Rescheduling request failed");
  });

  await test("customer login persists after leaving and returning", async () => {
    await client.send("Page.navigate", { url: "about:blank" });
    await wait(120);
    await client.send("Page.navigate", { url: `http://127.0.0.1:${port}/index.html` });
    await wait(700);
    const restored = await client.evaluate(`({
      role: session.role,
      phone: session.customerPhone,
      bookingsVisible: !customerBookingsPanel.classList.contains('is-hidden'),
      remembered: Boolean(localStorage.getItem(CUSTOMER_SESSION_KEY))
    })`);
    assert(restored.role === "customer" && restored.phone === "0501234567" && restored.bookingsVisible && restored.remembered, "Customer session was not restored");
  });

  await test("owner page, login, navigation and notification panel", async () => {
    await client.send("Page.navigate", { url: `http://127.0.0.1:${port}/owner.html` });
    await wait(800);
    assert(await client.evaluate("Boolean(ownerLoginForm) && document.documentElement.dir === 'rtl'"), "Owner page failed to load");
    await client.evaluate(`ownerLoginForm.elements.username.value = 'admin'; ownerLoginForm.elements.password.value = '1234'; ownerLoginForm.requestSubmit()`);
    await wait(180);
    const owner = await client.evaluate(`({
      visible: !ownerLayout.classList.contains('is-hidden'),
      bell: Boolean(document.querySelector('.notification-bell-button')),
      brokenAnchors: [...document.querySelectorAll('a[href^="#"]')].filter((link) => !document.querySelector(link.getAttribute('href'))).map((link) => link.getAttribute('href'))
    })`);
    assert(owner.visible && owner.bell, "Owner login or notification bell failed");
    assert(owner.brokenAnchors.length === 0, `Broken owner navigation: ${owner.brokenAnchors.join(", ")}`);
    await client.evaluate("document.querySelector('.notification-bell-button').click()");
    assert(await client.evaluate("!document.querySelector('.notification-center .notification-panel').classList.contains('is-hidden')"), "Notification panel did not open");
  });

  await test("owner approves reschedule and customer is notified", async () => {
    const approved = await client.evaluate(`(() => {
      const button = document.querySelector('.approve-booking-button');
      if (!button) return null;
      button.click();
      const original = state.bookings[0];
      const replacement = state.bookings[1];
      return {
        originalStatus: original.status,
        replacementStatus: replacement.status,
        linked: original.replaced_by_id === replacement.id,
        customerNotification: state.notifications.some((item) => item.user_id.startsWith('customer:') && item.type === 'appointment_rescheduled')
      };
    })()`);
    assert(approved && approved.originalStatus === "cancelled" && approved.replacementStatus === "approved" && approved.linked && approved.customerNotification, "Owner approval of reschedule failed");
  });

  await test("owner forms and calendar controls", async () => {
    const forms = await client.evaluate(`(async () => {
      const originalDescription = state.business.description;
      businessForm.elements.name.value = state.business.name || 'עסק בדיקה';
      businessForm.elements.description.value = originalDescription + ' בדיקה';
      businessForm.elements.address.value = state.business.address || 'רחוב הבדיקה 1';
      businessForm.elements.phone.value = state.business.phone || '0500000000';
      businessForm.elements.instagramUrl.value = 'https://www.tiktok.com/@booking-test';
      businessForm.requestSubmit();
      await new Promise((resolve) => setTimeout(resolve, 80));
      const businessSaved = state.business.description.endsWith('בדיקה');

      const serviceCount = state.services.length;
      addServiceButton.click();
      const serviceAdded = state.services.length === serviceCount + 1;
      servicesEditor.querySelector('.remove-service-button')?.click();
      servicesForm.requestSubmit();

      const username = state.sellerCredentials.username;
      sellerCredentialsForm.elements.username.value = username;
      sellerCredentialsForm.elements.password.value = '';
      sellerCredentialsForm.requestSubmit();
      hoursForm.requestSubmit();

      const monthBefore = uiState.sellerCalendarMonthKey;
      sellerCalendarNextButton.click();
      const calendarMoved = uiState.sellerCalendarMonthKey !== monthBefore;
      sellerCalendarPrevButton.click();

      return {
        businessSaved,
        socialSaved: state.business.instagram_url.includes('tiktok.com'),
        serviceAdded,
        credentialsSaved: state.sellerCredentials.username === username,
        hoursSaved: state.workingHours.length === 7,
        calendarMoved
      };
    })()`);
    assert(Object.values(forms).every(Boolean), `One or more owner forms failed: ${JSON.stringify(forms)}`);
  });

  await test("owner dashboard stats and customer history render", async () => {
    const overview = await client.evaluate(`(() => {
      rerenderAll();
      const statTitles = [...ownerStatsGrid.querySelectorAll('.owner-stat-card > span:first-child')].map((item) => item.textContent.trim());
      const firstCustomerCard = ownerCustomersList.querySelector('.owner-customer-card');
      return {
        hasMonthlyAppointments: statTitles.includes('תורים החודש'),
        hasCancelled: statTitles.includes('ביטולים'),
        hasNewCustomers: statTitles.includes('לקוחות חדשות'),
        historyTitle: firstCustomerCard?.querySelector('.customer-history-head strong')?.textContent.trim() || '',
        historyItems: firstCustomerCard?.querySelectorAll('.customer-history-item').length || 0,
        noteVisible: firstCustomerCard?.textContent.includes('בדיקה') || false
      };
    })()`);
    assert(
      overview.hasMonthlyAppointments &&
      overview.hasCancelled &&
      overview.hasNewCustomers &&
      overview.historyTitle === 'היסטוריית לקוחה' &&
      overview.historyItems > 0 &&
      overview.noteVisible,
      `Owner stats or customer history failed: ${JSON.stringify(overview)}`
    );
  });

  await test("blocked customer cannot create a new appointment", async () => {
    const blockResult = await client.evaluate(`(() => {
      const phone = '0501234567';
      const blockButton = ownerCustomersList.querySelector('.toggle-customer-block-button[data-customer-phone="' + phone + '"]');
      if (!blockButton) return { blocked: false, exists: false };
      blockButton.click();
      return {
        exists: true,
        blocked: Boolean(state.users.find((user) => normalizePhoneNumber(user.phone) === phone)?.is_blocked)
      };
    })()`);
    assert(blockResult.exists && blockResult.blocked, `Could not block customer: ${JSON.stringify(blockResult)}`);

    await client.send("Page.navigate", { url: `http://127.0.0.1:${port}/index.html` });
    await wait(700);
    const prevented = await client.evaluate(`(() => {
      syncSelectedServiceState([state.services[0].id]);
      uiState.selectedStaffId = state.staff[0].id;
      for (let offset = 2; offset < 21; offset += 1) {
        const date = new Date();
        date.setDate(date.getDate() + offset);
        const dateValue = localDateValue(date);
        const slots = getAvailableSlots(dateValue);
        if (slots.length) {
          uiState.selectedDate = dateValue;
          uiState.selectedTime = slots[0];
          break;
        }
      }
      showWizardStep(4);
      renderDetailsForm();
      const before = state.bookings.length;
      bookingForm.requestSubmit();
      return {
        blocked: isCustomerBlocked(),
        disabled: bookingSubmitButton.disabled,
        notice: detailsNotice.textContent,
        unchanged: state.bookings.length === before
      };
    })()`);
    assert(
      prevented.blocked &&
      prevented.disabled &&
      prevented.notice.includes('חסום') &&
      prevented.unchanged,
      `Blocked customer was not prevented: ${JSON.stringify(prevented)}`
    );

    await client.send("Page.navigate", { url: `http://127.0.0.1:${port}/owner.html` });
    await wait(700);
    const unblocked = await client.evaluate(`(() => {
      const phone = '0501234567';
      const unblockButton = ownerCustomersList.querySelector('.toggle-customer-block-button[data-customer-phone="' + phone + '"]');
      if (!unblockButton) return false;
      unblockButton.click();
      return !state.users.find((user) => normalizePhoneNumber(user.phone) === phone)?.is_blocked;
    })()`);
    assert(unblocked, "Customer could not be unblocked after the test");
  });

  await test("waiting list prompt, join flow and cancellation notification", async () => {
    const waitlistSetup = await client.evaluate(`(() => {
      const waitDate = '2030-02-10';
      const service = state.services[state.services.length - 1];
      const waitingPhone = '0507654321';

      state.specialHours = normalizeSpecialHours([
        ...state.specialHours.filter((item) => item.id !== 'audit-waitlist-hours'),
        {
          id: 'audit-waitlist-hours',
          special_date: waitDate,
          opens_at: '10:00',
          closes_at: '10:30',
          slot_interval_minutes: 30,
          is_closed: false,
          note: 'בדיקת רשימת המתנה'
        }
      ]);

      state.users = normalizeUsers([
        ...state.users.filter((user) => normalizePhoneNumber(user.phone) !== waitingPhone),
        {
          firstName: 'נועה',
          lastName: 'ממתינה',
          phone: waitingPhone,
          password: 'wait123',
          owner_note: '',
          is_blocked: false,
          blocked_reason: '',
          blocked_at: '',
          no_show_count: 0,
          created_at: new Date().toISOString()
        }
      ]);

      state.waitlistEntries = normalizeWaitlistEntries(
        state.waitlistEntries.filter((entry) => entry.id !== 'audit-waitlist-entry')
      );

      state.bookings = normalizeBookings([
        ...state.bookings.filter((booking) => booking.id !== 'audit-waitlist-booking'),
        {
          id: 'audit-waitlist-booking',
          service_id: service.id,
          service_ids: [service.id],
          service_name: service.name,
          service_names: [service.name],
          staff_id: state.staff[0].id,
          staff_name: state.staff[0].name,
          customer_first_name: 'אורי',
          customer_last_name: 'דהאן',
          customer_phone: '0501234567',
          notes: '',
          booking_date: waitDate,
          booking_time: '10:00',
          duration_minutes: Number(service.duration || 30),
          status: 'approved',
          arrival_status: 'waiting',
          attendance_confirmation_requested_at: '',
          attendance_confirmation_status: '',
          attendance_confirmation_answered_at: ''
        }
      ], state.staff, state.services);

      saveState();
      rerenderAll();
      return { waitDate, serviceId: service.id };
    })()`);

    await client.send("Page.navigate", { url: `http://127.0.0.1:${port}/index.html` });
    await wait(700);
    await client.evaluate(`(() => {
      openAuthModal('customer');
      customerLoginForm.elements.firstName.value = 'נועה';
      customerLoginForm.elements.lastName.value = 'ממתינה';
      customerLoginForm.elements.phone.value = '0507654321';
      customerLoginForm.elements.password.value = 'wait123';
      customerLoginForm.requestSubmit();
    })()`);
    await wait(180);
    const waitlistUi = await client.evaluate(`(() => {
      syncSelectedServiceState(['${waitlistSetup.serviceId}']);
      uiState.selectedStaffId = state.staff[0].id;
      uiState.selectedDate = '${waitlistSetup.waitDate}';
      uiState.selectedTime = '';
      showWizardStep(3);
      rerenderAll();
      return {
        promptVisible: !waitlistPrompt.classList.contains('is-hidden'),
        joinDisabled: joinWaitlistButton.disabled,
        noSlots: !timeGroups.textContent.trim()
      };
    })()`);
    assert(waitlistUi.promptVisible && !waitlistUi.joinDisabled && waitlistUi.noSlots, `Waiting list prompt failed: ${JSON.stringify(waitlistUi)}`);
    const waitlistJoined = await client.evaluate(`(() => {
      const before = state.waitlistEntries.length;
      joinWaitlistForCurrentSelection();
      return {
        before,
        after: state.waitlistEntries.length,
        sessionRole: session.role,
        sessionPhone: session.customerPhone,
        selectedIds: getSelectedServiceIds(),
        selectedDate: uiState.selectedDate,
        created: state.waitlistEntries.some((entry) => normalizePhoneNumber(entry.customer_phone) === '0507654321' && entry.booking_date === '${waitlistSetup.waitDate}' && entry.status === 'waiting')
      };
    })()`);
    assert(waitlistJoined.created && waitlistJoined.after === waitlistJoined.before + 1, `Customer was not added to the waiting list: ${JSON.stringify(waitlistJoined)}`);

    await client.send("Page.navigate", { url: `http://127.0.0.1:${port}/owner.html` });
    await wait(700);
    await client.evaluate(`uiState.ownerBookingsFilter = 'all'; renderSellerBookings(); document.querySelector('.seller-cancel-booking-button[data-booking-id="audit-waitlist-booking"]').click()`);
    await wait(120);
    await client.evaluate("document.querySelector('.app-confirm-overlay button:last-child').click()");
    await wait(160);
    const waitlistNotified = await client.evaluate(`(() => {
      const entry = state.waitlistEntries.find((item) => item.id === 'audit-waitlist-entry') || state.waitlistEntries.find((item) => normalizePhoneNumber(item.customer_phone) === '0507654321' && item.booking_date === '${waitlistSetup.waitDate}');
      return {
        status: entry?.status || '',
        notification: state.notifications.some((item) => item.user_id === 'customer:0507654321' && item.title.includes('התפנה מקום'))
      };
    })()`);
    assert(waitlistNotified.status === 'notified' && waitlistNotified.notification, `Waiting list notification failed: ${JSON.stringify(waitlistNotified)}`);
  });

  await test("attendance confirmation can be sent and answered", async () => {
    const attendanceSetup = await client.evaluate(`(() => {
      const targetDate = localDateValue(new Date(Date.now() + 172800000));
      const service = state.services[0];
      state.bookings = normalizeBookings([
        ...state.bookings.filter((booking) => booking.id !== 'audit-attendance-booking'),
        {
          id: 'audit-attendance-booking',
          service_id: service.id,
          service_ids: [service.id],
          service_name: service.name,
          service_names: [service.name],
          staff_id: state.staff[0].id,
          staff_name: state.staff[0].name,
          customer_first_name: 'נועה',
          customer_last_name: 'ממתינה',
          customer_phone: '0507654321',
          notes: 'אישור הגעה',
          booking_date: targetDate,
          booking_time: '11:00',
          duration_minutes: Number(service.duration || 60),
          status: 'approved',
          arrival_status: 'waiting',
          attendance_confirmation_requested_at: '',
          attendance_confirmation_status: '',
          attendance_confirmation_answered_at: ''
        }
      ], state.staff, state.services);
      saveState();
      rerenderAll();
      return targetDate;
    })()`);
    await client.evaluate(`uiState.ownerBookingsFilter = 'approved'; renderSellerBookings(); document.querySelector('.send-attendance-confirmation-button[data-booking-id="audit-attendance-booking"]').click()`);
    await wait(160);
    const sent = await client.evaluate(`(() => {
      const booking = state.bookings.find((item) => item.id === 'audit-attendance-booking');
      return {
        requested: booking?.attendance_confirmation_status || '',
        notification: state.notifications.some((item) => item.user_id === 'customer:0507654321' && item.title.includes('אישור הגעה'))
      };
    })()`);
    assert(sent.requested === 'pending' && sent.notification, `Attendance confirmation was not sent: ${JSON.stringify(sent)}`);

    await client.send("Page.navigate", { url: `http://127.0.0.1:${port}/index.html` });
    await wait(700);
    const responded = await client.evaluate(`(() => {
      renderCustomerBookings();
      const button = document.querySelector('.confirm-arrival-button[data-booking-id="audit-attendance-booking"]');
      if (!button) {
        return { found: false };
      }
      button.click();
      const booking = state.bookings.find((item) => item.id === 'audit-attendance-booking');
      return {
        found: true,
        status: booking?.attendance_confirmation_status || '',
        answered: Boolean(booking?.attendance_confirmation_answered_at),
        bookingDate: booking?.booking_date || ''
      };
    })()`);
    assert(responded.found && responded.status === 'confirmed' && responded.answered && responded.bookingDate === attendanceSetup, `Attendance response failed: ${JSON.stringify(responded)}`);
  });

  await test("optional feature switches hide bonus features", async () => {
    await client.send("Page.navigate", { url: `http://127.0.0.1:${port}/index.html` });
    await wait(650);
    assert(await client.evaluate("!socialLink.classList.contains('is-hidden') && socialLink.title === 'טיקטוק'"), "Enabled social link was not displayed");

    await client.send("Page.navigate", { url: `http://127.0.0.1:${port}/owner.html` });
    await wait(650);
    const saved = await client.evaluate(`(async () => {
      businessForm.elements.featureBusinessDescription.checked = false;
      businessForm.elements.featurePreparationMessage.checked = false;
      businessForm.elements.featureSocialLink.checked = false;
      businessForm.elements.featureWhatsapp.checked = false;
      businessForm.elements.featureCalendarExport.checked = false;
      businessForm.elements.featureCustomerRescheduling.checked = false;
      businessForm.requestSubmit();
      await new Promise((resolve) => setTimeout(resolve, 100));
      return ['businessDescription', 'preparationMessage', 'socialLink', 'whatsapp', 'calendarExport', 'customerRescheduling']
        .every((name) => state.business.features[name] === false);
    })()`);
    assert(saved, "Optional feature switches were not saved");

    await client.send("Page.navigate", { url: `http://127.0.0.1:${port}/index.html` });
    await wait(650);
    const hiddenFeatures = await client.evaluate(`(() => {
      clearRememberedSellerSession();
      updateSessionUi();
      renderCustomerBookings();
      const customerCardsText = myBookingsList.textContent;
      const result = {
        descriptionHidden: businessDescription.classList.contains('is-hidden'),
        socialHidden: socialLink.classList.contains('is-hidden'),
        whatsappHidden: whatsAppLink.classList.contains('is-hidden'),
        calendarButtonsHidden: !myBookingsList.querySelector('.calendar-choice-button'),
        rescheduleButtonsHidden: !myBookingsList.querySelector('.replace-booking-button'),
        preparationHidden: !customerCardsText.includes('הכנה לתור')
      };
      rememberSellerSession();
      sessionStorage.setItem(SELLER_SESSION_KEY, '1');
      rerenderAll();
      return result;
    })()`);
    assert(Object.values(hiddenFeatures).every(Boolean), `Disabled features remained visible: ${JSON.stringify(hiddenFeatures)}`);

    await client.send("Page.navigate", { url: `http://127.0.0.1:${port}/owner.html` });
    await wait(650);
  });

  await test("special hours, blocked slots and reset cancellation", async () => {
    const managers = await client.evaluate(`(async () => {
      const specialDate = '2030-01-07';
      specialHoursForm.elements.specialDate.value = specialDate;
      specialHoursForm.elements.specialOpen.value = '10:00';
      specialHoursForm.elements.specialClose.value = '14:00';
      specialHoursForm.elements.specialInterval.value = '30';
      specialHoursForm.elements.specialNote.value = 'בדיקת שעות';
      specialHoursForm.requestSubmit();
      const specialSaved = state.specialHours.some((item) => item.special_date === specialDate);

      blockedSlotsForm.elements.blockedDate.value = specialDate;
      uiState.blockedSlotDate = specialDate;
      renderBlockedSlotsManager();
      const firstTime = [...blockedSlotsForm.elements.blockedTime.options].find((option) => option.value)?.value || '';
      blockedSlotsForm.elements.blockedTime.value = firstTime;
      blockedSlotsForm.elements.blockedNote.value = 'בדיקת חסימה';
      blockedSlotsForm.requestSubmit();
      const blockedSaved = Boolean(firstTime) && state.blockedSlots.some((item) => item.blocked_date === specialDate && item.blocked_time === firstTime);

      const bookingCount = state.bookings.length;
      resetBusinessTemplateButton.click();
      await new Promise((resolve) => setTimeout(resolve, 80));
      const resetDialogOpened = !document.querySelector('.app-confirm-overlay').classList.contains('is-hidden');
      document.querySelector('.app-confirm-overlay button:first-child')?.click();
      await new Promise((resolve) => setTimeout(resolve, 80));
      const resetCancelled = state.bookings.length === bookingCount;
      return { specialSaved, blockedSaved, resetDialogOpened, resetCancelled };
    })()`);
    assert(Object.values(managers).every(Boolean), `Owner managers failed: ${JSON.stringify(managers)}`);
  });

  await test("notification read, mark-all, delete and persistence", async () => {
    const notificationResult = await client.evaluate(`(() => {
      notificationCenter.render();
      const ownerItemsBefore = state.notifications.filter((item) => item.user_id === 'owner').length;
      notificationCenter.markAllAsRead();
      const allRead = state.notifications.filter((item) => item.user_id === 'owner').every((item) => item.read);
      const created = notificationCenter.notify({ user_id: 'owner', title: 'בדיקת מחיקה', message: 'התראה זמנית', type: 'general' }, { browser: false });
      notificationCenter.deleteNotification(created.id);
      const deleted = !state.notifications.some((item) => item.id === created.id);
      return { ownerItemsBefore, allRead, deleted };
    })()`);
    assert(notificationResult.ownerItemsBefore > 0 && notificationResult.allRead && notificationResult.deleted, "Notification actions failed");
    await client.evaluate("location.reload()");
    await wait(650);
    assert(await client.evaluate("state.notifications.length > 0 && state.bookings.length >= 2"), "Notifications or appointments did not persist after refresh");
  });

  await test("mobile, tablet and desktop layout", async () => {
    for (const width of [390, 768, 1440]) {
      await client.send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width < 720 });
      await wait(80);
      const layout = await client.evaluate(`({
        viewport: innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        headerWidth: document.querySelector('header').getBoundingClientRect().width,
        offenders: [...document.querySelectorAll('body *')]
          .map((element) => ({
            tag: element.tagName,
            id: element.id,
            className: typeof element.className === 'string' ? element.className : '',
            left: Math.round(element.getBoundingClientRect().left),
            right: Math.round(element.getBoundingClientRect().right),
            width: Math.round(element.getBoundingClientRect().width)
          }))
          .filter((item) => item.left < -1 || item.right > innerWidth + 1)
          .slice(0, 8)
      })`);
      assert(layout.scrollWidth <= layout.viewport + 1, `Horizontal overflow at ${width}px: ${JSON.stringify(layout.offenders)}`);
      assert(layout.headerWidth <= layout.viewport + 1, `Header overflow at ${width}px`);
    }
  });

  await test("owner controls replace login buttons on the public site", async () => {
    await client.send("Emulation.clearDeviceMetricsOverride");
    await client.send("Page.navigate", { url: `http://127.0.0.1:${port}/index.html` });
    await wait(700);
    const publicOwnerUi = await client.evaluate(`({
      returnVisible: !returnToOwnerButton.classList.contains('is-hidden'),
      ownerLogoutVisible: !sellerSiteLogoutButton.classList.contains('is-hidden'),
      customerLoginHidden: openCustomerLogin.classList.contains('is-hidden'),
      sellerLoginHidden: openSellerLogin.classList.contains('is-hidden'),
      socialLinkHidden: socialLink.classList.contains('is-hidden')
    })`);
    assert(Object.values(publicOwnerUi).every(Boolean), `Owner public controls failed: ${JSON.stringify(publicOwnerUi)}`);

    await client.evaluate("returnToOwnerButton.click()");
    await wait(650);
    assert(await client.evaluate("location.pathname.endsWith('/owner.html') && !ownerLayout.classList.contains('is-hidden')"), "Return to owner editing failed");

    await client.send("Page.navigate", { url: `http://127.0.0.1:${port}/index.html` });
    await wait(650);
    await client.evaluate("sellerSiteLogoutButton.click()");
    const loggedOut = await client.evaluate(`({
      sellerForgotten: !localStorage.getItem(SELLER_SESSION_KEY),
      returnHidden: returnToOwnerButton.classList.contains('is-hidden'),
      ownerLogoutHidden: sellerSiteLogoutButton.classList.contains('is-hidden'),
      sellerLoginVisible: !openSellerLogin.classList.contains('is-hidden')
    })`);
    assert(Object.values(loggedOut).every(Boolean), `Owner logout on public site failed: ${JSON.stringify(loggedOut)}`);
  });

  assert(consoleErrors.length === 0, `Console/runtime errors: ${consoleErrors.join(" | ")}`);
  assert(failedRequests.length === 0, `Failed requests: ${failedRequests.join(" | ")}`);

  process.stdout.write(JSON.stringify({ ok: true, tests: results, consoleErrors, failedRequests }, null, 2));
} finally {
  if (client?.socket?.readyState === WebSocket.OPEN) client.socket.close();
  browser.kill();
  await new Promise((resolve) => server.close(resolve));
}
