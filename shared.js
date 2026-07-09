"use strict";

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sanitizeCssImageUrl(value) {
  const raw = String(value || "").trim();
  if (!raw || /["'\\\u0000-\u001f\u007f]/.test(raw)) {
    return "";
  }

  if (/^data:image\/(?:png|jpe?g|gif|webp);base64,[a-z0-9+/=]+$/i.test(raw)) {
    return raw;
  }

  try {
    const url = new URL(raw, window.location.origin);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch (error) {
    return "";
  }
}

function cssImageUrl(value) {
  const safeUrl = sanitizeCssImageUrl(value);
  return safeUrl ? `url("${safeUrl.replace(/"/g, "%22")}")` : "";
}

async function hashPassword(password) {
  const buffer = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(String(password || ""))
  );
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function verifyStoredPassword(password, storedPassword, onUpgrade) {
  const stored = String(storedPassword || "");
  const inputHash = await hashPassword(password);
  const matches = stored.length === 64 ? inputHash === stored : String(password) === stored;

  if (matches && stored.length !== 64 && typeof onUpgrade === "function") {
    onUpgrade(inputHash);
  }

  return matches;
}

function normalizeHexColor(value, fallback = "#b25fd1") {
  const color = String(value || "").trim().toLowerCase();
  return /^#[0-9a-f]{6}$/.test(color) ? color : fallback;
}

function mixHexColors(color, target, amount) {
  const source = normalizeHexColor(color).slice(1);
  const destination = normalizeHexColor(target, "#ffffff").slice(1);
  const ratio = Math.max(0, Math.min(1, Number(amount) || 0));
  const channels = [0, 2, 4].map((offset) => {
    const start = Number.parseInt(source.slice(offset, offset + 2), 16);
    const end = Number.parseInt(destination.slice(offset, offset + 2), 16);
    return Math.round(start + (end - start) * ratio).toString(16).padStart(2, "0");
  });
  return `#${channels.join("")}`;
}

function applyThemeColor(value) {
  const color = normalizeHexColor(value);
  const red = Number.parseInt(color.slice(1, 3), 16);
  const green = Number.parseInt(color.slice(3, 5), 16);
  const blue = Number.parseInt(color.slice(5, 7), 16);
  const luminance = (red * 299 + green * 587 + blue * 114) / 1000;
  const root = document.documentElement;
  root.style.setProperty("--accent", color);
  root.style.setProperty("--accent-dark", mixHexColors(color, "#000000", 0.2));
  root.style.setProperty("--accent-soft", mixHexColors(color, "#ffffff", 0.88));
  root.style.setProperty("--accent-contrast", luminance > 165 ? "#1b1d24" : "#ffffff");
  return color;
}

function applyNoShowCounterChange(booking, nextArrivalStatus) {
  const customer = getCustomerRecordByPhone(booking?.customer_phone);
  if (!customer) {
    return;
  }

  const previousStatus = String(booking.arrival_status || "");
  if (previousStatus !== "no_show" && nextArrivalStatus === "no_show") {
    customer.no_show_count = Number(customer.no_show_count || 0) + 1;
  }

  if (previousStatus === "no_show" && nextArrivalStatus !== "no_show") {
    customer.no_show_count = Math.max(0, Number(customer.no_show_count || 0) - 1);
  }
}

function buildArrivalStatusOptions(selectedStatus) {
  const safeStatus = normalizeArrivalStatus(selectedStatus, "approved") || "waiting";

  return ARRIVAL_STATUS_OPTIONS.map((status) => `
    <option value="${status}" ${status === safeStatus ? "selected" : ""}>${formatArrivalStatus(status)}</option>
  `).join("");
}

function buildCalendarFileName(booking) {
  const businessPart = String(state.business.name || "booking")
    .trim()
    .replace(/[<>:"/\\|?*]+/g, "")
    .replace(/\s+/g, "-");

  return `${businessPart || "booking"}-${booking.booking_date}-${String(booking.booking_time).replace(":", "-")}.ics`;
}

function clearRejectUndo(shouldRerender = false) {
  if (uiState.rejectUndoTimeoutId) {
    clearTimeout(uiState.rejectUndoTimeoutId);
  }

  uiState.rejectUndoBookingId = null;
  uiState.rejectUndoPreviousStatus = null;
  uiState.rejectUndoTimeoutId = null;

  if (shouldRerender) {
    rerenderAll();
  }
}

function clearRememberedSellerSession() {
  localStorage.removeItem(SELLER_SESSION_KEY);
  sessionStorage.removeItem(SELLER_SESSION_KEY);
}

function closeCalendarChoice() {
  uiState.calendarChoiceBookingId = null;
  calendarChoiceModal.classList.add("is-hidden");
}

function downloadDeviceCalendar(booking) {
  if (!booking) {
    return;
  }

  const file = new Blob([buildDeviceCalendarContent(booking)], {
    type: "text/calendar;charset=utf-8"
  });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(file);
  link.download = buildCalendarFileName(booking);
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

function escapeIcsText(value) {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function finalizeApprovedChangeRequest(booking) {
  if (!booking?.replaces_booking_id) {
    return null;
  }

  const oldBooking = findBookingById(booking.replaces_booking_id);
  if (!oldBooking || !["pending", "approved"].includes(oldBooking.status)) {
    return null;
  }

  oldBooking.status = "cancelled";
  oldBooking.arrival_status = null;
  oldBooking.replaced_by_id = booking.id;
  return oldBooking;
}

function findBookingById(bookingId) {
  return state.bookings.find((booking) => booking.id === bookingId) || null;
}

function findRegularWorkingHoursForDate(dateValue) {
  const dayOfWeek = new Date(`${dateValue}T00:00:00`).getDay();
  return state.workingHours.find((entry) => Number(entry.day_of_week) === dayOfWeek) || null;
}

function findSpecialHoursForDate(dateValue) {
  return state.specialHours.find((entry) => entry.special_date === dateValue) || null;
}

function formatDisplayDate(dateValue) {
  return new Date(`${dateValue}T00:00:00`).toLocaleDateString("he-IL", {
    weekday: "long",
    day: "numeric",
    month: "long"
  });
}

function formatIcsDateTime(dateValue, timeValue) {
  const [year, month, day] = dateValue.split("-").map(Number);
  const [hours, minutes] = String(timeValue).slice(0, 5).split(":").map(Number);

  return [
    String(year).padStart(4, "0"),
    String(month).padStart(2, "0"),
    String(day).padStart(2, "0"),
    "T",
    String(hours).padStart(2, "0"),
    String(minutes).padStart(2, "0"),
    "00"
  ].join("");
}

function formatMinutesToTime(totalMinutes) {
  const hours = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
  const minutes = String(totalMinutes % 60).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function getBookingCustomerNotificationUserId(booking) {
  return getCustomerNotificationUserId(booking?.customer_phone);
}

function getBookingEndTime(booking) {
  const startMinutes = parseTimeToMinutes(String(booking.booking_time).slice(0, 5));
  return formatMinutesToTime(startMinutes + Number(booking.duration_minutes || 30));
}

function getCustomerNotificationUserId(phone) {
  const matchedUser = state.users.find((user) => isSamePhone(user.phone, phone) && user.auth_user_id);
  if (matchedUser?.auth_user_id) {
    return matchedUser.auth_user_id;
  }

  const normalizedPhone = normalizePhoneNumber(phone);
  return normalizedPhone ? `customer:${normalizedPhone}` : "";
}

function getCustomerRecordByPhone(phone) {
  const normalizedPhone = normalizePhoneNumber(phone);
  if (!normalizedPhone) {
    return null;
  }

  return state.users.find((user) => isSamePhone(user.phone, normalizedPhone)) || null;
}

function isRejectUndoActiveForBooking(bookingId) {
  return uiState.rejectUndoBookingId === bookingId;
}

function isSamePhone(left, right) {
  return normalizePhoneNumber(left) === normalizePhoneNumber(right);
}

function isSellerRemembered() {
  return localStorage.getItem(SELLER_SESSION_KEY) === "1" || sessionStorage.getItem(SELLER_SESSION_KEY) === "1";
}

function isSlotBlocked(dateValue, timeValue) {
  return state.blockedSlots.some((slot) => slot.blocked_date === dateValue && slot.blocked_time === timeValue);
}

function localDateValue(date) {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().split("T")[0];
}

function monthDateFromKey(key) {
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month - 1, 1);
}

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function normalizeArrivalStatus(value, bookingStatus) {
  if (bookingStatus !== "approved") {
    return null;
  }

  const normalized = String(value || "").trim();
  if (ARRIVAL_STATUS_OPTIONS.includes(normalized)) {
    return normalized;
  }

  return "waiting";
}

function normalizeAttendanceConfirmationStatus(value) {
  const normalized = String(value || "").trim();
  if (["pending", "confirmed", "declined"].includes(normalized)) {
    return normalized;
  }

  return "";
}

function normalizeBookingStatus(value) {
  const normalized = String(value || "").trim();
  return ["pending", "approved", "rejected", "cancelled"].includes(normalized)
    ? normalized
    : "pending";
}

function normalizeBlockedSlots(blockedSlots) {
  if (!Array.isArray(blockedSlots)) {
    return [];
  }

  const seen = new Set();

  return blockedSlots
    .map((slot, index) => ({
      id: String(slot?.id || `blocked-slot-${Date.now()}-${index}`),
      blocked_date: String(slot?.blocked_date || "").trim(),
      blocked_time: String(slot?.blocked_time || "").trim().slice(0, 5),
      note: String(slot?.note || "").trim()
    }))
    .filter((slot) => slot.blocked_date && /^\d{2}:\d{2}$/.test(slot.blocked_time))
    .filter((slot) => {
      const key = `${slot.blocked_date}|${slot.blocked_time}`;
      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    })
    .sort((left, right) => `${left.blocked_date} ${left.blocked_time}`.localeCompare(`${right.blocked_date} ${right.blocked_time}`));
}

function normalizeCustomerNotes(notes) {
  if (!Array.isArray(notes)) {
    return [];
  }

  const noteMap = new Map();

  notes.forEach((item, index) => {
    const customerPhone = normalizePhoneNumber(item?.customer_phone);
    const noteText = String(item?.note || "").trim();

    if (!customerPhone || !noteText) {
      return;
    }

    noteMap.set(customerPhone, {
      id: String(item?.id || `customer-note-${Date.now()}-${index}`),
      customer_phone: customerPhone,
      customer_name: String(item?.customer_name || "").trim(),
      note: noteText,
      updated_at: String(item?.updated_at || new Date().toISOString())
    });
  });

  return [...noteMap.values()].sort((left, right) => String(right.updated_at).localeCompare(String(left.updated_at)));
}

function normalizePhoneNumber(value) {
  return String(value || "").replace(/[^\d+]/g, "");
}

function normalizeSocialUrl(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed || trimmed === "https://instagram.com") {
    return "";
  }
  return trimmed;
}

function normalizeSpecialHours(specialHours) {
  if (!Array.isArray(specialHours)) {
    return [];
  }

  const seen = new Set();

  return specialHours
    .map((item, index) => ({
      id: String(item?.id || `special-hours-${Date.now()}-${index}`),
      special_date: String(item?.special_date || "").trim(),
      opens_at: String(item?.opens_at || "").trim().slice(0, 5) || null,
      closes_at: String(item?.closes_at || "").trim().slice(0, 5) || null,
      slot_interval_minutes: Number(item?.slot_interval_minutes || 30),
      is_closed: Boolean(item?.is_closed),
      note: String(item?.note || "").trim()
    }))
    .filter((item) => item.special_date)
    .filter((item) => {
      if (!item.is_closed && (!/^\d{2}:\d{2}$/.test(String(item.opens_at || "")) || !/^\d{2}:\d{2}$/.test(String(item.closes_at || "")))) {
        return false;
      }

      if (item.is_closed) {
        item.opens_at = null;
        item.closes_at = null;
      }

      const key = item.special_date;
      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    })
    .sort((left, right) => left.special_date.localeCompare(right.special_date));
}

function normalizeUsers(users) {
  if (!Array.isArray(users)) {
    return [];
  }

  return users
    .map((user) => ({
      id: String(user?.id || ""),
      auth_user_id: String(user?.auth_user_id || ""),
      firstName: String(user?.firstName || "").trim(),
      lastName: String(user?.lastName || "").trim(),
      phone: String(user?.phone || "").trim(),
      email: String(user?.email || "").trim().toLowerCase(),
      password: String(user?.password || ""),
      owner_note: String(user?.owner_note || "").trim(),
      is_blocked: Boolean(user?.is_blocked),
      blocked_reason: String(user?.blocked_reason || "").trim(),
      blocked_at: String(user?.blocked_at || ""),
      no_show_count: Number(user?.no_show_count || 0),
      created_at: String(user?.created_at || new Date().toISOString())
    }))
    .filter((user) => normalizePhoneNumber(user.phone));
}

function normalizeWaitlistEntries(entries) {
  if (!Array.isArray(entries)) {
    return [];
  }

  return entries
    .map((entry, index) => ({
      id: String(entry?.id || `waitlist-${Date.now()}-${index}`),
      customer_phone: String(entry?.customer_phone || "").trim(),
      customer_name: String(entry?.customer_name || "").trim(),
      service_id: String(entry?.service_id || "").trim(),
      service_name: String(entry?.service_name || "").trim(),
      booking_date: String(entry?.booking_date || "").trim(),
      notes: String(entry?.notes || "").trim(),
      status: ["waiting", "notified", "removed"].includes(String(entry?.status || "").trim())
        ? String(entry.status).trim()
        : "waiting",
      created_at: String(entry?.created_at || new Date().toISOString()),
      notified_at: String(entry?.notified_at || "")
    }))
    .filter((entry) => normalizePhoneNumber(entry.customer_phone) && entry.service_id && entry.booking_date)
    .sort((left, right) => String(left.created_at).localeCompare(String(right.created_at)));
}

function openCalendarChoiceModal(bookingId) {
  uiState.calendarChoiceBookingId = bookingId;
  calendarChoiceModal.classList.remove("is-hidden");
}

function openGoogleCalendarForBooking(booking) {
  if (!booking) {
    return;
  }

  const calendarUrl = buildGoogleCalendarUrl(booking);
  const popup = window.open(calendarUrl, "_blank", "noopener");

  if (!popup) {
    window.location.href = calendarUrl;
  }
}

function parseTimeToMinutes(value) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function rememberSellerSession() {
  localStorage.setItem(SELLER_SESSION_KEY, "1");
}

function startRejectUndo(bookingId, previousStatus) {
  clearRejectUndo(false);
  uiState.rejectUndoBookingId = bookingId;
  uiState.rejectUndoPreviousStatus = previousStatus;
  uiState.rejectUndoTimeoutId = setTimeout(() => {
    clearRejectUndo(true);
  }, REJECT_UNDO_WINDOW_MS);
}

function syncStateFromStorage() {
  const freshState = loadState();
  Object.assign(state, freshState);
  rerenderAll();
  notificationCenter?.showNewBrowserNotifications();
}

function todayDate() {
  return localDateValue(new Date());
}

function buildCustomerFullName(firstName, lastName) {
  return [String(firstName || "").trim(), String(lastName || "").trim()].filter(Boolean).join(" ").trim();
}

function buildDeviceCalendarContent(booking) {
  const customerName = [booking.customer_first_name, booking.customer_last_name].filter(Boolean).join(" ").trim();
  const descriptionLines = [
    `שירות: ${booking.service_name}`,
    `סטטוס: ${formatStatus(booking.status)}`,
    customerName ? `לקוחה: ${customerName}` : "",
    booking.customer_phone ? `טלפון: ${booking.customer_phone}` : "",
    booking.notes ? `הערות: ${booking.notes}` : ""
  ].filter(Boolean);

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Booking App//HE",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${booking.id}@local-booking-app`,
    `DTSTAMP:${formatIcsDateTime(todayDate(), "00:00")}`,
    `DTSTART:${formatIcsDateTime(booking.booking_date, booking.booking_time)}`,
    `DTEND:${formatIcsDateTime(booking.booking_date, getBookingEndTime(booking))}`,
    `SUMMARY:${escapeIcsText(`${state.business.name} - ${booking.service_name}`)}`,
    `DESCRIPTION:${escapeIcsText(descriptionLines.join("\n"))}`,
    `LOCATION:${escapeIcsText(state.business.address || "")}`,
    "END:VEVENT",
    "END:VCALENDAR"
  ].join("\r\n");
}

function buildGoogleCalendarUrl(booking) {
  const businessTitle = String(state.business.name || DEFAULT_DATA.business.name).trim() || DEFAULT_DATA.business.name;
  const customerName = [booking.customer_first_name, booking.customer_last_name].filter(Boolean).join(" ").trim();
  const descriptionLines = [
    `שירות: ${booking.service_name}`,
    `סטטוס: ${formatStatus(booking.status)}`,
    customerName ? `לקוחה: ${customerName}` : "",
    booking.customer_phone ? `טלפון: ${booking.customer_phone}` : "",
    booking.notes ? `הערות: ${booking.notes}` : ""
  ].filter(Boolean);

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `${businessTitle} - ${booking.service_name}`,
    dates: `${formatIcsDateTime(booking.booking_date, booking.booking_time)}/${formatIcsDateTime(booking.booking_date, getBookingEndTime(booking))}`,
    details: descriptionLines.join("\n"),
    location: state.business.address || ""
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function buildSellerCalendarDays(monthDate) {
  const firstOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const firstVisible = new Date(firstOfMonth);
  firstVisible.setDate(firstVisible.getDate() - firstOfMonth.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(firstVisible);
    date.setDate(firstVisible.getDate() + index);
    const value = localDateValue(date);
    const hasBookings = state.bookings.some(
      (booking) => booking.booking_date === value && booking.status !== "cancelled"
    );
    const hasSpecialHours = state.specialHours.some((entry) => entry.special_date === value);
    const hasBlockedSlots = state.blockedSlots.some((slot) => slot.blocked_date === value);

    return {
      value,
      dayNumber: date.getDate(),
      isCurrentMonth: date.getMonth() === monthDate.getMonth(),
      hasBookings: hasBookings || hasSpecialHours || hasBlockedSlots
    };
  });
}

function findWorkingHoursForDate(dateValue) {
  const specialDay = findSpecialHoursForDate(dateValue);
  const regularDay = findRegularWorkingHoursForDate(dateValue);

  if (!specialDay) {
    return regularDay;
  }

  return {
    id: specialDay.id,
    day_of_week: regularDay?.day_of_week ?? new Date(`${dateValue}T00:00:00`).getDay(),
    day_label: regularDay?.day_label || "יום מיוחד",
    opens_at: specialDay.is_closed ? null : specialDay.opens_at,
    closes_at: specialDay.is_closed ? null : specialDay.closes_at,
    slot_interval_minutes: Number(specialDay.slot_interval_minutes || regularDay?.slot_interval_minutes || 30),
    is_closed: Boolean(specialDay.is_closed),
    is_special: true,
    note: specialDay.note || ""
  };
}

function formatArrivalStatus(status) {
  if (status === "arrived") {
    return "הגיעה";
  }
  if (status === "finished") {
    return "הסתיים";
  }
  if (status === "no_show") {
    return "לא הגיעה";
  }
  return "ממתינה";
}

function formatAttendanceConfirmationStatus(status) {
  if (status === "confirmed") {
    return "אישרה הגעה";
  }
  if (status === "declined") {
    return "סימנה שלא תגיע";
  }
  if (status === "pending") {
    return "ממתינה לאישור הגעה";
  }
  return "";
}

function formatStatus(status) {
  if (status === "approved") {
    return "אושר";
  }
  if (status === "rejected") {
    return "נדחה";
  }
  if (status === "cancelled") {
    return "בוטל";
  }
  return "ממתין לאישור";
}

function getBookingCustomerName(booking) {
  return [booking?.customer_first_name, booking?.customer_last_name].filter(Boolean).join(" ").trim() || "לקוחה";
}

function getBookingDateTimeText(booking) {
  if (!booking) {
    return "";
  }

  return `${formatDisplayDate(booking.booking_date)} בשעה ${String(booking.booking_time || "").slice(0, 5)}`;
}

function maybePromoteWaitlistForBooking(booking) {
  if (!booking || state.business.features?.waitingList === false) {
    return;
  }

  const nextEntry = state.waitlistEntries.find((entry) =>
    entry.status === "waiting" &&
    entry.booking_date === booking.booking_date &&
    entry.service_id === booking.service_id
  );

  if (!nextEntry) {
    return;
  }

  nextEntry.status = "notified";
  nextEntry.notified_at = new Date().toISOString();
  notifyCustomerWaitlistOpened(nextEntry, booking);
}

function normalizeBookings(bookings, staff, services) {
  const fallbackStaff = staff[0] || DEFAULT_OWNER_STAFF;

  return bookings.map((booking) => {
    const service = services.find((item) => item.id === booking.service_id);
    const assignedStaff = staff.find((member) => member.id === booking.staff_id) || fallbackStaff;
    const normalizedServiceIds = Array.isArray(booking.service_ids) && booking.service_ids.length
      ? booking.service_ids.map((serviceId) => String(serviceId).trim()).filter(Boolean)
      : booking.service_id
        ? [String(booking.service_id).trim()]
        : [];
    const normalizedServiceNames = Array.isArray(booking.service_names) && booking.service_names.length
      ? booking.service_names.map((serviceName) => String(serviceName).trim()).filter(Boolean)
      : booking.service_name
        ? [String(booking.service_name).trim()]
        : service
          ? [service.name]
          : [];

    return {
      ...booking,
      id: String(booking.id || `booking-${Date.now()}-${Math.random().toString(16).slice(2)}`),
      service_ids: normalizedServiceIds,
      service_names: normalizedServiceNames,
      service_name: String(booking.service_name || normalizedServiceNames.join(" + ") || service?.name || "").trim(),
      duration_minutes: Number(booking.duration_minutes || service?.duration_minutes || 30),
      status: normalizeBookingStatus(booking.status),
      arrival_status: normalizeArrivalStatus(booking.arrival_status, normalizeBookingStatus(booking.status)),
      hidden_for_customer: Boolean(booking.hidden_for_customer),
      attendance_confirmation_requested_at: String(booking.attendance_confirmation_requested_at || ""),
      attendance_confirmation_status: normalizeAttendanceConfirmationStatus(booking.attendance_confirmation_status),
      attendance_confirmation_answered_at: String(booking.attendance_confirmation_answered_at || ""),
      staff_id: assignedStaff.id,
      staff_name: assignedStaff.name
    };
  });
}

function normalizeBusiness(business) {
  const normalized = { ...business };

  if (!normalized.name) {
    normalized.name = DEFAULT_DATA.business.name;
  }

  if (!normalized.description) {
    normalized.description = DEFAULT_DATA.business.description;
  }

  if (!normalized.address) {
    normalized.address = DEFAULT_DATA.business.address;
  }

  if (!normalized.phone) {
    normalized.phone = DEFAULT_DATA.business.phone;
  }

  normalized.instagram_url = normalizeSocialUrl(normalized.instagram_url);
  normalized.cover_image = String(normalized.cover_image || "").trim();
  normalized.profile_image = String(normalized.profile_image || "").trim();
  normalized.preparation_message = String(normalized.preparation_message || DEFAULT_DATA.business.preparation_message).trim();
  normalized.features = {
    ...DEFAULT_DATA.business.features,
    ...(business?.features || {})
  };
  return normalized;
}

function normalizeNotifications(notifications) {
  if (window.AppNotifications?.normalizeList) {
    return window.AppNotifications.normalizeList(notifications);
  }

  if (!Array.isArray(notifications)) {
    return [];
  }

  return notifications
    .map((notification, index) => ({
      id: String(notification?.id || `notification-${Date.now()}-${index}`),
      title: String(notification?.title || "התראה חדשה").trim(),
      message: String(notification?.message || "").trim(),
      created_at: String(notification?.created_at || new Date().toISOString()),
      is_read: Boolean(notification?.is_read ?? notification?.read),
      user_id: String(notification?.user_id || notification?.userId || "").trim(),
      type: String(notification?.type || "general").trim()
    }))
    .filter((notification) => notification.user_id && notification.title)
    .sort((left, right) => String(right.created_at).localeCompare(String(left.created_at)));
}

function normalizeServices(services) {
  return (Array.isArray(services) ? services : []).map((service) => {
    const { duration, ...rest } = service || {};
    return {
      ...rest,
      duration_minutes: Number(service?.duration_minutes ?? duration ?? 30)
    };
  });
}

function normalizeStaff(staff) {
  return [{ ...DEFAULT_OWNER_STAFF }];
}

function notifyCustomerAppointmentCancelledByOwner(booking) {
  pushAppNotification(
    getBookingCustomerNotificationUserId(booking),
    "התור בוטל על ידי העסק",
    `התור שלך ל${booking.service_name} בתאריך ${getBookingDateTimeText(booking)} בוטל על ידי בעל העסק.`,
    "appointment_cancelled",
    { browser: false }
  );
}

function notifyCustomerAppointmentChanged(booking, previousBooking = null) {
  const dateChanged = previousBooking && previousBooking.booking_date !== booking.booking_date;
  const timeChanged = previousBooking && String(previousBooking.booking_time).slice(0, 5) !== String(booking.booking_time).slice(0, 5);
  const title = dateChanged && timeChanged
    ? "תאריך ושעת התור השתנו"
    : dateChanged
      ? "תאריך התור השתנה"
      : timeChanged
        ? "שעת התור השתנתה"
        : "התור עודכן";
  const previousText = previousBooking ? ` התור הקודם היה ${getBookingDateTimeText(previousBooking)}.` : "";

  pushAppNotification(
    getBookingCustomerNotificationUserId(booking),
    title,
    `התור שלך ל${booking.service_name} נקבע עכשיו ל${getBookingDateTimeText(booking)}.${previousText}`,
    dateChanged || timeChanged ? "appointment_rescheduled" : "appointment_updated",
    { browser: false }
  );
}

function notifyCustomerAppointmentUpdated(booking, updateText) {
  pushAppNotification(
    getBookingCustomerNotificationUserId(booking),
    "התור עודכן",
    `${updateText}: ${booking.service_name}, ${getBookingDateTimeText(booking)}.`,
    "appointment_updated",
    { browser: false }
  );
}

function notifyCustomerAttendanceConfirmation(booking) {
  pushAppNotification(
    getBookingCustomerNotificationUserId(booking),
    "אישור הגעה לתור",
    `מחר יש לך תור ל${booking.service_name} ב${getBookingDateTimeText(booking)}. נשמח לדעת אם את מגיעה.`,
    "appointment_updated",
    { browser: false }
  );
}

function notifyCustomerWaitlistOpened(waitlistEntry, cancelledBooking) {
  if (!waitlistEntry || !cancelledBooking) {
    return;
  }

  const timeText = cancelledBooking.booking_time ? ` בשעה ${cancelledBooking.booking_time}` : "";

  pushAppNotification(
    getCustomerNotificationUserId(waitlistEntry.customer_phone),
    "התפנה מקום ברשימת ההמתנה",
    `התפנה מקום ל${waitlistEntry.service_name} בתאריך ${formatDisplayDate(cancelledBooking.booking_date)}${timeText}.`,
    "appointment_updated",
    { browser: false }
  );
}

function notifyOwnerAppointmentCancelled(booking, actorText = "בעל העסק") {
  pushAppNotification(
    getOwnerNotificationTargetId(),
    "תור בוטל",
    `${actorText} ביטל את התור של ${getBookingCustomerName(booking)} ל${booking.service_name} בתאריך ${getBookingDateTimeText(booking)}.`,
    "appointment_cancelled"
  );
}

function notifyOwnerAppointmentRescheduled(booking, previousBooking = null) {
  const previousText = previousBooking ? ` במקום ${getBookingDateTimeText(previousBooking)}` : "";
  pushAppNotification(
    getOwnerNotificationTargetId(),
    "תור הוזז",
    `התור של ${getBookingCustomerName(booking)} עודכן ל${getBookingDateTimeText(booking)}${previousText}.`,
    "appointment_rescheduled"
  );
}

function notifyOwnerAppointmentUpdated(booking, updateText) {
  pushAppNotification(
    getOwnerNotificationTargetId(),
    "תור עודכן",
    `${updateText}: ${getBookingCustomerName(booking)}, ${booking.service_name}, ${getBookingDateTimeText(booking)}.`,
    "appointment_updated"
  );
}

function pushAppNotification(userId, title, message, type, config = {}) {
  if (!userId || !notificationCenter) {
    return null;
  }

  // With Supabase, database triggers are the single source of truth. Creating the
  // same notification in the browser would duplicate it on every synced device.
  if (typeof supabaseEnabled !== "undefined" && supabaseEnabled) {
    return null;
  }

  return notificationCenter.notify(
    {
      user_id: userId,
      title,
      message,
      type
    },
    config
  );
}

function requestAttendanceConfirmation(booking, options = {}) {
  if (!booking || booking.status !== "approved" || state.business.features?.attendanceConfirmation === false) {
    return false;
  }

  const tomorrowDate = localDateValue(new Date(Date.now() + 86400000));
  if (booking.booking_date !== tomorrowDate && !options.force) {
    return false;
  }

  if (booking.attendance_confirmation_requested_at) {
    return false;
  }

  booking.attendance_confirmation_requested_at = new Date().toISOString();
  booking.attendance_confirmation_status = "pending";
  booking.attendance_confirmation_answered_at = "";
  notifyCustomerAttendanceConfirmation(booking);
  return true;
}

function runAttendanceConfirmationSweep() {
  if (state.business.features?.attendanceConfirmation === false) {
    return;
  }

  if (typeof supabaseEnabled !== "undefined" && supabaseEnabled) {
    return;
  }

  let changed = false;
  state.bookings.forEach((booking) => {
    if (requestAttendanceConfirmation(booking)) {
      changed = true;
    }
  });

  if (changed) {
    saveState();
  }
}
