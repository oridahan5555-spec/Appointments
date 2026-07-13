const LOCAL_STORAGE_KEY = "booking_app_local_working_v2";
const SELLER_SESSION_KEY = "booking_app_seller_session_v1";
const REJECT_UNDO_WINDOW_MS = 5000;
const ARRIVAL_STATUS_OPTIONS = ["waiting", "arrived", "finished", "no_show"];
const supabaseApi = window.AppSupabase || null;
const supabaseEnabled = Boolean(supabaseApi?.isConfigured?.());
const BUSINESS_FEATURE_FIELDS = {
  businessDescription: "featureBusinessDescription",
  preparationMessage: "featurePreparationMessage",
  socialLink: "featureSocialLink",
  whatsapp: "featureWhatsapp",
  phone: "featurePhone",
  waze: "featureWaze",
  calendarExport: "featureCalendarExport",
  customerRescheduling: "featureCustomerRescheduling",
  waitingList: "featureWaitingList",
  attendanceConfirmation: "featureAttendanceConfirmation"
};

const DEFAULT_OWNER_STAFF = {
  id: "staff-owner",
  name: "בעלת העסק",
  role: "נותנת השירות",
  initials: "ב",
  is_anyone: false
};

const DEFAULT_DATA = {
  business: {
    name: "שם העסק שלך",
    description: "כתבי כאן תיאור קצר על העסק שלך.",
    address: "כתובת העסק",
    phone: "",
    instagram_url: "",
    cover_image: "",
    profile_image: "",
    preparation_message: "נא להגיע בזמן. אם צריך לבטל או לשנות תור, עדכני מראש.",
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
  sellerCredentials: {
    username: "admin"
  },
  services: [
    { id: "service-1", category: "קטגוריה ראשית", name: "שירות לדוגמה 1", price: 150, duration_minutes: 60 },
    { id: "service-2", category: "קטגוריה ראשית", name: "שירות לדוגמה 2", price: 220, duration_minutes: 90 },
    { id: "service-3", category: "קטגוריה נוספת", name: "שירות לדוגמה 3", price: 80, duration_minutes: 30 }
  ],
  staff: [DEFAULT_OWNER_STAFF],
  workingHours: [
    { id: "hours-0", day_of_week: 0, day_label: "ראשון", opens_at: "09:00", closes_at: "18:00", slot_interval_minutes: 30, is_closed: false },
    { id: "hours-1", day_of_week: 1, day_label: "שני", opens_at: "09:00", closes_at: "18:00", slot_interval_minutes: 30, is_closed: false },
    { id: "hours-2", day_of_week: 2, day_label: "שלישי", opens_at: "09:00", closes_at: "18:00", slot_interval_minutes: 30, is_closed: false },
    { id: "hours-3", day_of_week: 3, day_label: "רביעי", opens_at: "09:00", closes_at: "18:00", slot_interval_minutes: 30, is_closed: false },
    { id: "hours-4", day_of_week: 4, day_label: "חמישי", opens_at: "09:00", closes_at: "18:00", slot_interval_minutes: 30, is_closed: false },
    { id: "hours-5", day_of_week: 5, day_label: "שישי", opens_at: "09:00", closes_at: "14:00", slot_interval_minutes: 30, is_closed: false },
    { id: "hours-6", day_of_week: 6, day_label: "שבת", opens_at: null, closes_at: null, slot_interval_minutes: 30, is_closed: true }
  ],
  specialHours: [],
  blockedSlots: [],
  waitlistEntries: [],
  bookings: [],
  notifications: [],
  users: [],
  customerNotes: []
};

const state = loadState();

const uiState = {
  sellerCalendarDate: todayDate(),
  sellerCalendarMonthKey: monthKey(new Date()),
  specialHoursDate: todayDate(),
  blockedSlotDate: todayDate(),
  ownerBookingsFilter: "all",
  ownerCustomerSearch: "",
  calendarChoiceBookingId: null,
  rejectUndoBookingId: null,
  rejectUndoPreviousStatus: null,
  rejectUndoTimeoutId: null
};

const ownerSession = {
  authUserId: null
};

const ownerBrandName = document.getElementById("ownerBrandName");
const ownerBrandDescription = document.getElementById("ownerBrandDescription");
const ownerAccessMessage = document.getElementById("ownerAccessMessage");
const ownerLoginGate = document.getElementById("ownerLoginGate");
const ownerRecoveryGate = document.getElementById("ownerRecoveryGate");
const ownerLayout = document.getElementById("ownerLayout");
const ownerLoginForm = document.getElementById("ownerLoginForm");
const ownerRecoveryForm = document.getElementById("ownerRecoveryForm");
const ownerForgotPasswordButton = document.getElementById("ownerForgotPasswordButton");
const ownerLogoutButton = document.getElementById("ownerLogoutButton");
const ownerStatsGrid = document.getElementById("ownerStatsGrid");
const ownerTipsGrid = document.getElementById("ownerTipsGrid");
const ownerCoverPreview = document.getElementById("ownerCoverPreview");
const ownerAvatarPreview = document.getElementById("ownerAvatarPreview");
const calendarChoiceModal = document.getElementById("calendarChoiceModal");
const closeCalendarChoiceModal = document.getElementById("closeCalendarChoiceModal");
const deviceCalendarButton = document.getElementById("deviceCalendarButton");
const googleCalendarButton = document.getElementById("googleCalendarButton");
const cancelCalendarChoiceButton = document.getElementById("cancelCalendarChoiceButton");

const sellerCalendarPrevButton = document.getElementById("sellerCalendarPrevButton");
const sellerCalendarNextButton = document.getElementById("sellerCalendarNextButton");
const sellerCalendarMonthLabel = document.getElementById("sellerCalendarMonthLabel");
const sellerCalendarGrid = document.getElementById("sellerCalendarGrid");
const sellerCalendarList = document.getElementById("sellerCalendarList");
const ownerBookingsFilters = document.getElementById("ownerBookingsFilters");
const sellerBookingsList = document.getElementById("sellerBookingsList");
const waitlistList = document.getElementById("waitlistList");
const ownerCustomerSearch = document.getElementById("ownerCustomerSearch");
const ownerCustomersList = document.getElementById("ownerCustomersList");

const businessForm = document.getElementById("businessForm");
const sellerCredentialsForm = document.getElementById("sellerCredentialsForm");
const servicesForm = document.getElementById("servicesForm");
const servicesEditor = document.getElementById("servicesEditor");
const addServiceButton = document.getElementById("addServiceButton");
const hoursForm = document.getElementById("hoursForm");
const hoursEditor = document.getElementById("hoursEditor");
const themeColorPresets = document.getElementById("themeColorPresets");
const themeColorValue = document.getElementById("themeColorValue");
const specialHoursForm = document.getElementById("specialHoursForm");
const specialHoursList = document.getElementById("specialHoursList");
const specialHoursWarning = document.getElementById("specialHoursWarning");
const blockedSlotsForm = document.getElementById("blockedSlotsForm");
const blockedSlotsList = document.getElementById("blockedSlotsList");
const ownerEmailStatus = document.getElementById("ownerEmailStatus");
const sendTestEmailButton = document.getElementById("sendTestEmailButton");
const resetBusinessTemplateButton = document.getElementById("resetBusinessTemplateButton");

const notificationCenter = window.AppNotifications?.create({
  mount: document.querySelector(".owner-header-actions"),
  getNotifications: () => state.notifications,
  setNotifications: (notifications) => {
    state.notifications = normalizeNotifications(notifications);
  },
  save: saveState,
  getUserId: getCurrentNotificationUserId,
  isOwnerLoggedIn: isOwnerNotificationActive,
  onMarkAsRead: (notificationId) => supabaseEnabled ? supabaseApi.markNotificationRead(notificationId) : true,
  onMarkAllAsRead: (userId) => supabaseEnabled ? supabaseApi.markAllNotificationsRead(userId) : true,
  onDeleteNotification: (notificationId) => supabaseEnabled ? supabaseApi.deleteNotification(notificationId) : true,
  onCreateNotification: (notification) => supabaseEnabled ? supabaseApi.createNotification(notification) : notification,
  getPendingCount: () => state.bookings.filter((booking) => booking.status === "pending").length,
  onOpenBooking: (notification) => focusOwnerBooking(notification.booking_id),
  onApproveBooking: (notification) => runOwnerBookingAction(notification.booking_id, "approve-booking-button"),
  onRejectBooking: (notification) => runOwnerBookingAction(notification.booking_id, "reject-booking-button"),
  onOpenFreeSlot: (notification) => openFreedOwnerSlot(notification),
  onError: (error) => appUi.toast(error?.message || "לא הצלחנו לעדכן את ההתראה.", { variant: "error" }),
  browser: true
});

const appUi = window.AppUi || {
  toast: (message) => console.warn(message),
  confirm: async () => true
};
const appEmail = window.AppEmail;

const OWNER_LOGIN_NAME = String(supabaseApi?.getOwnerLoginName?.() || "admin").trim() || "admin";

function focusOwnerBooking(bookingId) {
  const booking = findBookingById(String(bookingId || ""));
  if (!booking) {
    throw new Error("התור כבר לא זמין או שאין הרשאה לצפות בו.");
  }

  uiState.ownerBookingsFilter = "all";
  renderSellerBookings();
  const card = Array.from(sellerBookingsList.querySelectorAll("[data-booking-card-id]"))
    .find((item) => item.dataset.bookingCardId === booking.id);
  if (!card) {
    return;
  }

  card.classList.add("is-notification-target");
  card.scrollIntoView({ behavior: "smooth", block: "center" });
  window.setTimeout(() => card.classList.remove("is-notification-target"), 2200);
}

function runOwnerBookingAction(bookingId, buttonClass) {
  focusOwnerBooking(bookingId);
  const button = Array.from(sellerBookingsList.querySelectorAll(`.${buttonClass}[data-booking-id]`))
    .find((item) => item.dataset.bookingId === String(bookingId || ""));
  if (!button) {
    throw new Error("הפעולה הזאת כבר בוצעה או שהתור אינו ממתין לאישור.");
  }
  button.click();
}

function openFreedOwnerSlot(notification) {
  const booking = findBookingById(notification.booking_id);
  const dateValue = booking?.booking_date || notification.metadata?.booking_date;
  if (!dateValue) {
    throw new Error("לא נמצא התאריך של השעה שהתפנתה.");
  }

  uiState.sellerCalendarDate = dateValue;
  uiState.sellerCalendarMonthKey = dateValue.slice(0, 7);
  renderSellerCalendar();
  sellerCalendarList.scrollIntoView({ behavior: "smooth", block: "center" });
}

function focusOwnerBookingFromUrl() {
  const bookingId = new URLSearchParams(window.location.search).get("booking");
  if (!bookingId || !findBookingById(bookingId)) {
    if (window.location.hash === "#ownerWaitlistSection") {
      document.getElementById("ownerWaitlistSection")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    return;
  }

  focusOwnerBooking(bookingId);
  const url = new URL(window.location.href);
  url.searchParams.delete("booking");
  window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
}

function loadState() {
  const defaults = structuredClone(DEFAULT_DATA);
  localStorage.removeItem(LOCAL_STORAGE_KEY);
  localStorage.removeItem("booking_app_local_working_v1");
  return defaults;
}

let lastConfirmedOwnerState = null;
let ownerSaveRequestId = 0;

function restoreConfirmedOwnerState() {
  if (!lastConfirmedOwnerState) {
    return;
  }

  const snapshot = structuredClone(lastConfirmedOwnerState);
  Object.keys(state).forEach((key) => delete state[key]);
  Object.assign(state, snapshot);
  rerenderAll();
}

function saveState() {
  localStorage.removeItem(LOCAL_STORAGE_KEY);
  localStorage.removeItem("booking_app_local_working_v1");

  if (supabaseEnabled && ownerLoadedFromSupabase && isOwnerNotificationActive() && !isHydratingOwnerState) {
    const snapshot = structuredClone(state);
    const requestId = ++ownerSaveRequestId;
    return supabaseApi.syncOwnerState(snapshot).then(() => {
      lastConfirmedOwnerState = snapshot;
      return true;
    }).catch((error) => {
      showOwnerSupabaseError(error);
      if (requestId === ownerSaveRequestId) {
        restoreConfirmedOwnerState();
      }
      return false;
    });
  }
  return Promise.resolve(true);
}

async function deleteRemoteOwnerRow(table, id) {
  if (!supabaseEnabled) {
    appUi.toast("לא ניתן למחוק בלי חיבור פעיל לשרת.", { variant: "error" });
    return false;
  }

  try {
    await supabaseApi.deleteOwnerRow(table, id);
    return true;
  } catch (error) {
    showOwnerSupabaseError(error);
    return false;
  }
}

let ownerRealtimeCleanups = [];
let isHydratingOwnerState = false;
let ownerRefreshTimeoutId = null;
let ownerSupabaseErrorTimestamp = 0;
let ownerSupabaseErrorMessage = "";
let ownerLoadedFromSupabase = false;

function setOwnerAccessMessage(message = "", isError = false) {
  if (!ownerAccessMessage) {
    return;
  }

  ownerAccessMessage.textContent = message;
  ownerAccessMessage.classList.toggle("is-hidden", !message);
  ownerAccessMessage.style.color = isError ? "#b42318" : "";
}

function showOwnerSupabaseError(error) {
  const message = appUi.translateMessage?.(error?.message || "לא הצלחנו לעדכן את הנתונים בשרת.")
    || "לא הצלחנו לעדכן את הנתונים בשרת.";
  const now = Date.now();
  if (message === ownerSupabaseErrorMessage && now - ownerSupabaseErrorTimestamp < 5000) {
    return;
  }

  ownerSupabaseErrorMessage = message;
  ownerSupabaseErrorTimestamp = now;
  appUi.toast(message, { variant: "error" });
}

function getBookingCustomer(booking) {
  if (!booking) return null;
  return state.users.find((customer) =>
    (booking.customer_auth_user_id && customer.auth_user_id === booking.customer_auth_user_id)
    || isSamePhone(customer.phone, booking.customer_phone)
  ) || null;
}

function getBookingCustomerEmail(booking) {
  return String(getBookingCustomer(booking)?.email || booking?.customer_email || "").trim().toLowerCase();
}

async function sendCustomerBookingEmail(type, booking, successMessage) {
  const email = getBookingCustomerEmail(booking);
  if (!appEmail || !email || !booking?.id) return { ok: false, skipped: true };

  const payload = appEmail.buildBookingPayload(booking, state.business, { email });
  const result = await appEmail.sendEmailNotification(type, payload, {
    to: email,
    eventKey: `${type}:${booking.id}`
  });
  if (result.ok) {
    if (successMessage) appUi.toast(successMessage, { variant: "success" });
  } else if (!result.skipped) {
    appUi.toast("הפעולה נשמרה, אבל שליחת האימייל לא הצליחה.", { variant: "warning" });
  }
  return result;
}

async function refreshOwnerEmailStatus() {
  if (!ownerEmailStatus || !appEmail) return;
  const status = await appEmail.getStatus();
  const ownerEmail = String(state.business.owner_email || "").trim();
  const recipientConfigured = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail);
  const ready = status.configured && recipientConfigured;
  ownerEmailStatus.textContent = !status.configured
    ? "שירות האימייל עדיין לא מוגדר בשרת"
    : recipientConfigured
      ? `התראות העסק יישלחו אל ${ownerEmail}`
      : "צריך לשמור כתובת אימייל תקינה לקבלת התראות";
  ownerEmailStatus.classList.toggle("status-card-approved", ready);
}

function clearOwnerRealtimeSubscriptions() {
  if (ownerRefreshTimeoutId) {
    clearTimeout(ownerRefreshTimeoutId);
    ownerRefreshTimeoutId = null;
  }

  ownerRealtimeCleanups.forEach((cleanup) => {
    try {
      cleanup?.();
    } catch (error) {
      console.warn(error);
    }
  });
  ownerRealtimeCleanups = [];
}

async function refreshOwnerStateFromSupabase({ silent = false } = {}) {
  if (!supabaseEnabled) {
    return;
  }

  isHydratingOwnerState = true;
  try {
    const ownerState = await supabaseApi.loadOwnerState();
    if (!ownerState?.business?.id) {
      throw new Error("לא נמצא עסק שמחובר לחשבון הניהול הזה.");
    }

    if (!ownerState?.owner?.id) {
      throw new Error("אין הרשאת ניהול לחשבון הזה.");
    }

    if (ownerState.business) {
      state.business = normalizeBusiness(ownerState.business);
    }
    state.services = Array.isArray(ownerState.services) ? ownerState.services : state.services;
    state.workingHours = Array.isArray(ownerState.workingHours) ? ownerState.workingHours : state.workingHours;
    state.specialHours = normalizeSpecialHours(ownerState.specialHours || []);
    state.blockedSlots = normalizeBlockedSlots(ownerState.blockedSlots || []);
    state.waitlistEntries = normalizeWaitlistEntries(ownerState.waitlistEntries || []);
    state.users = normalizeUsers(ownerState.users || []);
    state.notifications = normalizeNotifications(ownerState.notifications || []);
    state.bookings = normalizeBookings(ownerState.bookings || [], state.staff, state.services);
    ownerLoadedFromSupabase = true;
    lastConfirmedOwnerState = structuredClone(state);
    saveState();
    rerenderAll();
    window.setTimeout(focusOwnerBookingFromUrl, 0);
    notificationCenter?.showNewBrowserNotifications();
  } catch (error) {
    ownerLoadedFromSupabase = false;
    if (!silent) {
      showOwnerSupabaseError(error);
    }
    throw error;
  } finally {
    isHydratingOwnerState = false;
  }
}

function scheduleOwnerRefresh() {
  if (!supabaseEnabled) {
    return;
  }

  if (ownerRefreshTimeoutId) {
    clearTimeout(ownerRefreshTimeoutId);
  }

  ownerRefreshTimeoutId = setTimeout(() => {
    ownerRefreshTimeoutId = null;
    void refreshOwnerStateFromSupabase();
  }, 250);
}

function setupOwnerRealtimeSubscriptions() {
  if (!supabaseEnabled || !ownerSession.authUserId) {
    return;
  }

  clearOwnerRealtimeSubscriptions();
  ["business", "services", "working_hours", "special_hours", "blocked_slots", "bookings", "customers", "notifications", "waitlist_entries"].forEach((table) => {
    ownerRealtimeCleanups.push(supabaseApi.subscribe(table, () => {
      scheduleOwnerRefresh();
    }));
  });
}

async function ensureOwnerSupabaseBootstrap() {
  if (!supabaseEnabled) {
    return;
  }

  if (!(await supabaseApi.isOwnerUser())) {
    throw new Error("החשבון המחובר אינו מורשה לנהל את העסק הזה.");
  }
}





function resetOwnerUiState() {
  uiState.sellerCalendarDate = todayDate();
  uiState.sellerCalendarMonthKey = monthKey(new Date());
  uiState.specialHoursDate = todayDate();
  uiState.blockedSlotDate = todayDate();
  uiState.ownerBookingsFilter = "all";
  uiState.ownerCustomerSearch = "";
  uiState.calendarChoiceBookingId = null;

  clearRejectUndo(false);
}





function getWorkingDaysMode() {
  return state.business.features?.workingDaysMode === "select_closed_days"
    ? "select_closed_days"
    : "select_open_days";
}

function setWorkingDaysMode(mode) {
  state.business.features = {
    ...state.business.features,
    workingDaysMode: mode === "select_closed_days" ? "select_closed_days" : "select_open_days"
  };
}

function getWorkingDaysModeDescription() {
  return getWorkingDaysMode() === "select_closed_days"
    ? "בחר את הימים שבהם העסק סגור וכל השאר פתוחים"
    : "בחר את הימים שבהם העסק פתוח";
}

function getWorkingDayStateLabel(isClosed) {
  return isClosed ? "לא עובד" : "יום עבודה";
}



































function isOwnerNotificationActive() {
  return Boolean(ownerLayout && !ownerLayout.classList.contains("is-hidden"));
}

function getCurrentNotificationUserId() {
  return isOwnerNotificationActive() ? ownerSession.authUserId || "" : "";
}





function getOwnerNotificationTargetId() {
  return ownerSession.authUserId || "owner";
}



















function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}



function getCustomerNoteRecord(phone) {
  const normalizedPhone = normalizePhoneNumber(phone);
  if (!normalizedPhone) {
    return null;
  }

  return state.customerNotes.find((note) => isSamePhone(note.customer_phone, normalizedPhone)) || null;
}

function getCustomerNoteText(phone) {
  return getCustomerNoteRecord(phone)?.note || "";
}



function getCustomerNoteMarkup(phone) {
  const noteText = getCustomerNoteText(phone);
  if (!noteText) {
    return "";
  }

  return `
    <div class="owner-private-note">
      <strong>הערה פנימית על הלקוחה</strong>
      <p>${escapeHtml(noteText)}</p>
    </div>
  `;
}

function saveCustomerNote(phone, customerName, noteText) {
  const normalizedPhone = normalizePhoneNumber(phone);
  if (!normalizedPhone) {
    return;
  }

  const cleanedNote = String(noteText || "").trim();
  const existingNote = getCustomerNoteRecord(normalizedPhone);
  const relatedUser = state.users.find((user) => isSamePhone(user.phone, normalizedPhone)) || null;

  if (!cleanedNote) {
    if (existingNote) {
      state.customerNotes = state.customerNotes.filter((note) => !isSamePhone(note.customer_phone, normalizedPhone));
    }
    if (relatedUser) {
      relatedUser.owner_note = "";
    }
    return;
  }

  const notePayload = {
    id: existingNote?.id || createAppUuid(),
    customer_phone: normalizedPhone,
    customer_name: String(customerName || "").trim(),
    note: cleanedNote,
    updated_at: new Date().toISOString()
  };

  if (existingNote) {
    Object.assign(existingNote, notePayload);
    if (relatedUser) {
      relatedUser.owner_note = cleanedNote;
    }
    return;
  }

  state.customerNotes.unshift(notePayload);
  state.customerNotes = normalizeCustomerNotes(state.customerNotes);
  if (relatedUser) {
    relatedUser.owner_note = cleanedNote;
  }
}

function toggleCustomerBlocked(phone) {
  const customer = getCustomerRecordByPhone(phone);
  if (!customer) {
    return false;
  }

  customer.is_blocked = !customer.is_blocked;
  customer.blocked_at = customer.is_blocked ? new Date().toISOString() : "";
  customer.blocked_reason = customer.is_blocked ? "נחסם על ידי בעלת העסק" : "";
  return customer.is_blocked;
}

function readFileAsDataUrl(file) {
  const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
  if (!allowedTypes.has(String(file?.type || "").toLowerCase())) {
    return Promise.reject(new Error("אפשר להעלות רק תמונת JPG, PNG או WebP."));
  }
  if (Number(file?.size || 0) > 2 * 1024 * 1024) {
    return Promise.reject(new Error("התמונה גדולה מדי. אפשר להעלות תמונה עד 2MB."));
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("file-read-failed"));
    reader.readAsDataURL(file);
  });
}

async function resolveBusinessImage({ currentValue, file }) {
  if (file) {
    return readFileAsDataUrl(file);
  }

  return currentValue || "";
}

























































function getPendingBookings() {
  return state.bookings.filter((booking) => booking.status === "pending");
}







function getWorkingDaySlotTimes(dateValue) {
  const workDay = findWorkingHoursForDate(dateValue);

  if (!workDay || workDay.is_closed || !workDay.opens_at || !workDay.closes_at) {
    return [];
  }

  const openMinutes = parseTimeToMinutes(String(workDay.opens_at).slice(0, 5));
  const closeMinutes = parseTimeToMinutes(String(workDay.closes_at).slice(0, 5));
  const interval = Number(workDay.slot_interval_minutes || 30);
  const times = [];

  for (let start = openMinutes; start < closeMinutes; start += interval) {
    times.push(formatMinutesToTime(start));
  }

  return times;
}

function getBlockedSlotsForDate(dateValue) {
  return state.blockedSlots
    .filter((slot) => slot.blocked_date === dateValue)
    .sort((left, right) => left.blocked_time.localeCompare(right.blocked_time));
}



function getTodayBookings() {
  return state.bookings.filter((booking) => booking.booking_date === todayDate() && ["pending", "approved"].includes(booking.status));
}

function getCancelledBookings() {
  return state.bookings.filter((booking) => booking.status === "cancelled");
}

function getTodayArrivedCount() {
  return state.bookings.filter(
    (booking) =>
      booking.booking_date === todayDate() &&
      booking.status === "approved" &&
      ["arrived", "finished"].includes(String(booking.arrival_status || ""))
  ).length;
}

function getTodayNoShowCount() {
  return state.bookings.filter(
    (booking) =>
      booking.booking_date === todayDate() &&
      booking.status === "approved" &&
      booking.arrival_status === "no_show"
  ).length;
}

function getRepeatCustomersCount() {
  const counter = state.bookings.reduce((map, booking) => {
    const customerKey = normalizePhoneNumber(booking.customer_phone) || String(booking.customer_email || "").trim().toLowerCase();
    if (!customerKey) {
      return map;
    }

    map[customerKey] = (map[customerKey] || 0) + 1;
    return map;
  }, {});

  return Object.values(counter).filter((count) => count > 1).length;
}

function getBookingsThisMonthCount() {
  const currentMonth = monthKey(new Date());
  return state.bookings.filter((booking) => booking.booking_date.startsWith(currentMonth)).length;
}

function getNewCustomersThisMonthCount() {
  const currentMonth = monthKey(new Date());
  return state.users.filter((user) => String(user.created_at || "").startsWith(currentMonth)).length;
}

function getBusiestDayInfo() {
  const dayMap = {};

  state.bookings
    .filter((booking) => ["pending", "approved"].includes(booking.status))
    .forEach((booking) => {
      const dayOfWeek = new Date(`${booking.booking_date}T00:00:00`).getDay();
      const dayLabel = state.workingHours.find((item) => Number(item.day_of_week) === dayOfWeek)?.day_label || "יום לא ידוע";

      if (!dayMap[dayLabel]) {
        dayMap[dayLabel] = 0;
      }

      dayMap[dayLabel] += 1;
    });

  const entries = Object.entries(dayMap).sort((a, b) => b[1] - a[1]);
  if (!entries.length) {
    return null;
  }

  return {
    dayLabel: entries[0][0],
    count: entries[0][1]
  };
}



function renderHeader() {
  applyThemeColor(state.business.features?.themeAccent);
  ownerBrandName.textContent = state.business.name;
  ownerBrandDescription.textContent = state.business.description || "ניהול העסק";
}

function renderBusinessImagePreviews() {
  const safeCoverImage = cssImageUrl(state.business.cover_image);
  ownerCoverPreview.style.backgroundImage = safeCoverImage
    ? `linear-gradient(rgba(110, 70, 118, 0.18), rgba(110, 70, 118, 0.18)), ${safeCoverImage}`
    : "";

  ownerAvatarPreview.style.backgroundImage = cssImageUrl(state.business.profile_image);
}

function renderOwnerStats() {
  const stats = [
    {
      value: getPendingBookings().length,
      title: "בקשות שמחכות לאישור",
      text: "ככל שמאשרים מהר יותר, קל יותר לסגור תורים."
    },
    {
      value: getTodayBookings().length,
      title: "תורים להיום",
      text: "כך רואים במבט אחד כמה לקוחות עוד צפויות היום."
    },
    {
      value: getCancelledBookings().length,
      title: "ביטולים",
      text: "טוב לבדוק אם כדאי להציע שעות חלופיות כשיש ביטולים."
    },
    {
      value: getBookingsThisMonthCount(),
      title: "תורים החודש",
      text: "כמה תורים נכנסו בחודש הנוכחי מכל המצבים."
    },
    {
      value: getNewCustomersThisMonthCount(),
      title: "לקוחות חדשות",
      text: "כמה לקוחות חדשות נרשמו החודש למערכת."
    },
    {
      value: getRepeatCustomersCount(),
      title: "לקוחות חוזרות",
      text: "לקוחות שחזרו יותר מפעם אחת הן סימן שהעסק עובד טוב."
    }
    ,
    {
      value: getTodayArrivedCount(),
      title: "הגיעו היום",
      text: "כאן רואים כמה לקוחות כבר הגיעו או הסתיימו היום בפועל."
    },
    {
      value: getTodayNoShowCount(),
      title: "לא הגיעו היום",
      text: "זה עוזר להבין אם היו היום תורים שלא מומשו."
    }
  ];

  ownerStatsGrid.innerHTML = stats
    .map((stat) => `
      <article class="owner-stat-card">
        <span>${stat.title}</span>
        <strong>${stat.value}</strong>
        <span>${stat.text}</span>
      </article>
    `)
    .join("");
}

function renderOwnerTips() {
  const pendingCount = getPendingBookings().length;
  const cancelledCount = getCancelledBookings().length;
  const repeatCustomers = getRepeatCustomersCount();
  const busiestDay = getBusiestDayInfo();
  const bookingsThisMonth = getBookingsThisMonthCount();
  const tips = [];

  if (pendingCount > 0) {
    tips.push({
      title: "תורים שלא נסגרו",
      text: `יש כרגע ${pendingCount} בקשות שמחכות לך. שווה לעבור עליהן כדי שלא ילכו לאיבוד.`,
      anchor: "#ownerBookingsSection",
      link: "לפתוח את בקשות התור"
    });
  }

  if (busiestDay) {
    tips.push({
      title: "פעילות תורים",
      text: `היום הכי עמוס כרגע הוא ${busiestDay.dayLabel} עם ${busiestDay.count} תורים פעילים. אם זה קורה הרבה, אפשר לשקול לפתוח עוד זמן ביום הזה.`,
      anchor: "#ownerCalendarSection",
      link: "לראות ביומן"
    });
  }

  if (repeatCustomers > 0) {
    tips.push({
      title: "פעילות לקוחות",
      text: `יש לך ${repeatCustomers} לקוחות חוזרות. זה אומר שהלקוחות מרוצות ושווה לשמור על זמינות טובה בשבילן.`,
      anchor: "#ownerCalendarSection",
      link: "לבדוק תורים קרובים"
    });
  }

  if (cancelledCount > 0) {
    tips.push({
      title: "מקומות שהתפנו",
      text: `נרשמו ${cancelledCount} ביטולים. אם תרצי, אפשר להשתמש בשעות שהתפנו כדי להכניס לקוחות אחרות.`,
      anchor: "#ownerBookingsSection",
      link: "לעבור על התורים"
    });
  }

  if (!tips.length) {
    tips.push({
      title: "הכול מסודר",
      text: `כרגע אין משהו דחוף לטפל בו. החודש נכנסו ${bookingsThisMonth} תורים, והמערכת נראית נקייה ומסודרת.`,
      anchor: "#ownerCalendarSection",
      link: "לפתוח את היומן"
    });
  }

  ownerTipsGrid.innerHTML = tips
    .map((tip) => `
      <article class="owner-tip-card">
        <h3>${tip.title}</h3>
        <p>${tip.text}</p>
        <a class="owner-tip-link" href="${tip.anchor}">${tip.link}</a>
      </article>
    `)
    .join("");
}

function buildOwnerCustomersDirectory() {
  const customerMap = new Map();

  function ensureCustomerRecord(phone, customerName = "") {
    const normalizedPhone = normalizePhoneNumber(phone);
    if (!normalizedPhone) {
      return null;
    }

    if (!customerMap.has(normalizedPhone)) {
      customerMap.set(normalizedPhone, {
        phone: String(phone || normalizedPhone).trim() || normalizedPhone,
        normalizedPhone,
        name: "",
        note: "",
        bookingsCount: 0,
        noShowCount: 0,
        blocked: false,
        history: [],
        lastBooking: null
      });
    }

    const customer = customerMap.get(normalizedPhone);
    if (customerName && !customer.name) {
      customer.name = customerName;
    }
    if (phone && !customer.phone) {
      customer.phone = String(phone).trim();
    }

    return customer;
  }

  state.users.forEach((user) => {
    const customer = ensureCustomerRecord(user.phone, buildCustomerFullName(user.firstName, user.lastName));
    if (customer && user.owner_note && !customer.note) {
      customer.note = String(user.owner_note).trim();
    }
    if (customer) {
      customer.blocked = Boolean(user.is_blocked);
      customer.noShowCount = Number(user.no_show_count || 0);
    }
  });

  state.bookings.forEach((booking) => {
    const customer = ensureCustomerRecord(
      booking.customer_phone,
      buildCustomerFullName(booking.customer_first_name, booking.customer_last_name)
    );

    if (!customer) {
      return;
    }

    customer.bookingsCount += 1;
    customer.history.push({
      id: booking.id,
      booking_date: booking.booking_date,
      booking_time: booking.booking_time,
      service_name: booking.service_name,
      status: booking.status,
      arrival_status: booking.arrival_status,
      notes: booking.notes || ""
    });

    const lastBookingKey = `${booking.booking_date} ${booking.booking_time}`;
    const currentKey = customer.lastBooking
      ? `${customer.lastBooking.booking_date} ${customer.lastBooking.booking_time}`
      : "";

    if (!customer.lastBooking || lastBookingKey > currentKey) {
      customer.lastBooking = {
        booking_date: booking.booking_date,
        booking_time: booking.booking_time,
        service_name: booking.service_name
      };
    }
  });

  state.customerNotes.forEach((noteRecord) => {
    const customer = ensureCustomerRecord(noteRecord.customer_phone, noteRecord.customer_name);
    if (!customer) {
      return;
    }

    customer.note = noteRecord.note;
    if (noteRecord.customer_name && !customer.name) {
      customer.name = noteRecord.customer_name;
    }
  });

  return [...customerMap.values()]
    .map((customer) => ({
      ...customer,
      name: customer.name || "לקוחה ללא שם",
      note: customer.note || getCustomerNoteText(customer.phone),
      history: [...customer.history].sort((left, right) => `${right.booking_date} ${right.booking_time}`.localeCompare(`${left.booking_date} ${left.booking_time}`))
    }))
    .sort((left, right) => {
      const leftKey = left.lastBooking ? `${left.lastBooking.booking_date} ${left.lastBooking.booking_time}` : "";
      const rightKey = right.lastBooking ? `${right.lastBooking.booking_date} ${right.lastBooking.booking_time}` : "";

      return rightKey.localeCompare(leftKey) || left.name.localeCompare(right.name, "he");
    });
}

function normalizeSearchText(value) {
  return String(value || "").trim().toLowerCase();
}

function isOwnerCustomerInSearch(customer, searchText) {
  const query = normalizeSearchText(searchText);
  if (!query) {
    return true;
  }

  const normalizedQueryPhone = normalizePhoneNumber(query);
  const searchableText = [
    customer.name,
    customer.phone,
    customer.note,
    customer.lastBooking?.service_name || ""
  ]
    .join(" ")
    .toLowerCase();

  return (
    searchableText.includes(query) ||
    (normalizedQueryPhone && customer.normalizedPhone.includes(normalizedQueryPhone))
  );
}

function renderOwnerCustomers() {
  const customers = buildOwnerCustomersDirectory();
  const filteredCustomers = customers.filter((customer) => isOwnerCustomerInSearch(customer, uiState.ownerCustomerSearch));

  if (ownerCustomerSearch && ownerCustomerSearch.value !== uiState.ownerCustomerSearch) {
    ownerCustomerSearch.value = uiState.ownerCustomerSearch;
  }

  if (!customers.length) {
    ownerCustomersList.innerHTML = '<div class="notice-box">עדיין אין לקוחות שמורות במערכת.</div>';
    return;
  }

  if (!filteredCustomers.length) {
    ownerCustomersList.innerHTML = '<div class="notice-box">לא נמצאה לקוחה שמתאימה לחיפוש.</div>';
    return;
  }

  ownerCustomersList.innerHTML = filteredCustomers
    .map((customer) => `
      <article class="booking-card owner-customer-card" data-customer-phone="${escapeHtml(customer.normalizedPhone)}">
        <div class="booking-card-head">
          <strong>${escapeHtml(customer.name)}</strong>
          <div class="booking-card-badges">
            <span class="status-pill status-special">${customer.bookingsCount} תורים</span>
            ${customer.blocked ? '<span class="status-pill status-cancelled">חסומה</span>' : ""}
            ${customer.noShowCount ? `<span class="status-pill status-pending">${customer.noShowCount} אי-הגעות</span>` : ""}
          </div>
        </div>
        <div class="booking-meta">
          <span>${escapeHtml(customer.phone)}</span>
          <span>${customer.lastBooking ? `${formatDisplayDate(customer.lastBooking.booking_date)} בשעה ${customer.lastBooking.booking_time}` : "עדיין אין תורים"}</span>
          <span>${customer.lastBooking ? escapeHtml(customer.lastBooking.service_name) : "לקוחה חדשה"}</span>
        </div>
        <div class="customer-history-list">
          <div class="customer-history-head">
            <strong>היסטוריית לקוחה</strong>
            <span>מתי הגיעה, איזה שירות לקחה ואילו הערות נשמרו בתור</span>
          </div>
          ${(customer.history.slice(0, 5).map((historyItem) => `
            <div class="customer-history-item">
              <div class="customer-history-row">
                <span>שירות</span>
                <strong>${escapeHtml(historyItem.service_name)}</strong>
              </div>
              <div class="customer-history-row">
                <span>מתי</span>
                <strong>${formatDisplayDate(historyItem.booking_date)} בשעה ${historyItem.booking_time}</strong>
              </div>
              <div class="customer-history-row">
                <span>מצב</span>
                <strong>${historyItem.arrival_status ? formatArrivalStatus(historyItem.arrival_status) : formatStatus(historyItem.status)}</strong>
              </div>
              <div class="customer-history-row">
                <span>הערות</span>
                <strong>${escapeHtml(historyItem.notes || "ללא הערה")}</strong>
              </div>
            </div>
          `).join("")) || '<div class="notice-box">עדיין אין היסטוריית תורים.</div>'}
        </div>
        <label class="field owner-note-field">
          <span>הערה פנימית על הלקוחה</span>
          <textarea
            class="owner-note-input"
            rows="3"
            data-customer-phone="${escapeHtml(customer.normalizedPhone)}"
            data-customer-name="${escapeHtml(customer.name)}"
            placeholder="למשל: רגישה, מעדיפה שעה מאוחרת, עושה רק ג׳ל"
          >${escapeHtml(customer.note)}</textarea>
        </label>
        <div class="owner-note-actions">
          <button class="primary-button save-customer-note-button" type="button" data-customer-phone="${escapeHtml(customer.normalizedPhone)}">שמירת הערה</button>
          ${customer.note ? `<button class="ghost-button clear-customer-note-button" type="button" data-customer-phone="${escapeHtml(customer.normalizedPhone)}">מחיקת הערה</button>` : ""}
          <button class="${customer.blocked ? "danger-button" : "ghost-button"} toggle-customer-block-button" type="button" data-customer-phone="${escapeHtml(customer.normalizedPhone)}">${customer.blocked ? "שחרור חסימה" : "חסימת לקוחה"}</button>
        </div>
      </article>
    `)
    .join("");
}

function renderWaitlist() {
  if (!waitlistList) {
    return;
  }

  if (state.business.features?.waitingList === false) {
    waitlistList.innerHTML = '<div class="notice-box">רשימת ההמתנה כבויה כרגע בהגדרות העסק.</div>';
    return;
  }

  const entries = [...state.waitlistEntries]
    .sort((left, right) => String(left.created_at).localeCompare(String(right.created_at)));

  if (!entries.length) {
    waitlistList.innerHTML = '<div class="notice-box">עדיין אין לקוחות ברשימת ההמתנה.</div>';
    return;
  }

  waitlistList.innerHTML = entries
    .map((entry) => `
      <article class="booking-card ${entry.status === "notified" ? "status-card-approved" : "status-card-pending"}">
        <div class="booking-card-head">
          <strong>${escapeHtml(entry.customer_name || "לקוחה")}</strong>
          <span class="status-pill status-${entry.status === "notified" ? "approved" : "pending"}">${entry.status === "notified" ? "נשלחה הודעה" : "ממתינה"}</span>
        </div>
        <div class="booking-meta">
          <span>${escapeHtml(entry.customer_phone)}</span>
          <span>${escapeHtml(entry.service_name)}</span>
          <span>${formatDisplayDate(entry.booking_date)}</span>
        </div>
        ${entry.notes ? `<div class="booking-note">הערה: ${escapeHtml(entry.notes)}</div>` : ""}
        <div class="booking-card-actions">
          ${entry.status === "waiting" ? `<button class="ghost-button notify-waitlist-button" type="button" data-waitlist-id="${escapeHtml(entry.id)}">שליחת הודעה ידנית</button>` : ""}
          <button class="danger-button remove-waitlist-button" type="button" data-waitlist-id="${escapeHtml(entry.id)}">הסרה מהרשימה</button>
        </div>
      </article>
    `)
    .join("");
}

function renderSellerCalendar() {
  const monthDate = monthDateFromKey(uiState.sellerCalendarMonthKey);
  sellerCalendarMonthLabel.textContent = monthDate.toLocaleDateString("he-IL", {
    month: "long",
    year: "numeric"
  });

  const days = buildSellerCalendarDays(monthDate);
  if (!days.some((day) => day.value === uiState.sellerCalendarDate && day.isCurrentMonth)) {
    uiState.sellerCalendarDate = localDateValue(monthDate);
  }

  sellerCalendarGrid.innerHTML = days
    .map((day) => {
      if (!day.isCurrentMonth) {
        return '<div class="calendar-day is-outside" aria-hidden="true"></div>';
      }

      const classes = [
        "calendar-day",
        day.hasBookings ? "has-bookings" : "is-available",
        uiState.sellerCalendarDate === day.value ? "is-selected" : ""
      ].filter(Boolean).join(" ");

      return `
        <button class="${classes}" type="button" data-seller-date="${day.value}">
          ${day.dayNumber}
        </button>
      `;
    })
    .join("");

  const dailyBookings = state.bookings
    .filter((booking) => booking.booking_date === uiState.sellerCalendarDate && booking.status !== "cancelled")
    .sort((a, b) => a.booking_time.localeCompare(b.booking_time));
  const specialDay = findSpecialHoursForDate(uiState.sellerCalendarDate);
  const dailyBlockedSlots = getBlockedSlotsForDate(uiState.sellerCalendarDate);

  if (!dailyBookings.length && !dailyBlockedSlots.length && !specialDay) {
    sellerCalendarList.innerHTML = '<div class="notice-box">אין תורים ביום הזה.</div>';
    return;
  }

  const specialDayCard = specialDay
    ? `
      <article class="booking-card status-card-special">
        <div class="booking-card-head">
          <strong>${formatDisplayDate(specialDay.special_date)}</strong>
          <span class="status-pill status-special">${specialDay.is_closed ? "יום סגור מיוחד" : "שעות מיוחדות"}</span>
        </div>
        <div class="booking-meta">
          <span>${specialDay.is_closed ? "לא ניתן לקבוע תורים ביום הזה" : `${specialDay.opens_at} - ${specialDay.closes_at}`}</span>
          <span>${specialDay.is_closed ? "היום הזה סגור באופן מיוחד" : `כל ${specialDay.slot_interval_minutes} דקות`}</span>
        </div>
        ${specialDay.note ? `<div class="booking-note">הערה: ${escapeHtml(specialDay.note)}</div>` : ""}
      </article>
    `
    : "";

  const blockedCards = dailyBlockedSlots
    .map((slot) => `
      <article class="booking-card status-card-blocked">
        <div class="booking-card-head">
          <strong>${slot.blocked_time}</strong>
          <span class="status-pill status-blocked">שעה חסומה</span>
        </div>
        <div class="booking-meta">
          <span>${formatDisplayDate(slot.blocked_date)}</span>
          <span>הזמן הזה לא מוצג ללקוחות</span>
        </div>
        ${slot.note ? `<div class="booking-note">סיבה: ${escapeHtml(slot.note)}</div>` : ""}
        <div class="booking-card-actions">
          <button class="ghost-button unblock-slot-button" type="button" data-blocked-slot-id="${escapeHtml(slot.id)}">הסרת חסימה</button>
        </div>
      </article>
    `)
    .join("");

  const bookingCards = dailyBookings
    .map((booking) => `
      <article class="booking-card status-card-${booking.status}" data-booking-card-id="${escapeHtml(booking.id)}">
        <div class="booking-card-head">
          <strong>${escapeHtml(booking.booking_time)}</strong>
          <div class="booking-card-badges">
            <span class="status-pill status-${booking.status}">${formatStatus(booking.status)}</span>
            ${booking.status === "approved" ? `<span class="status-pill arrival-pill arrival-${booking.arrival_status}">${formatArrivalStatus(booking.arrival_status)}</span>` : ""}
          </div>
        </div>
        <div class="booking-meta">
          <span>${escapeHtml(`${booking.customer_first_name} ${booking.customer_last_name}`)}</span>
          <span>${escapeHtml(booking.service_name)}</span>
          <span>${escapeHtml(booking.staff_name)}</span>
        </div>
        ${getCustomerNoteMarkup(booking.customer_phone)}
        ${booking.notes ? `<div class="booking-note">הערה: ${escapeHtml(booking.notes)}</div>` : ""}
        ${
          booking.status === "approved"
            ? `
              <label class="arrival-status-field">
                <span>מצב הגעה</span>
                <select class="arrival-status-select" data-booking-id="${escapeHtml(booking.id)}">
                  ${buildArrivalStatusOptions(booking.arrival_status)}
                </select>
              </label>
            `
            : ""
        }
        ${
          ["pending", "approved"].includes(booking.status)
            ? `
              <div class="booking-card-actions">
                <button class="ghost-button calendar-choice-button" type="button" data-booking-id="${escapeHtml(booking.id)}">הוספה ליומן</button>
                <button class="danger-button seller-cancel-booking-button" type="button" data-booking-id="${escapeHtml(booking.id)}">ביטול תור</button>
              </div>
            `
            : ""
        }
      </article>
    `)
    .join("");

  sellerCalendarList.innerHTML = `${specialDayCard}${blockedCards}${bookingCards}`;
}

function isOwnerBookingInFilter(booking, filterName) {
  if (filterName === "today") {
    return booking.booking_date === todayDate();
  }

  if (filterName === "pending") {
    return booking.status === "pending";
  }

  if (filterName === "approved") {
    return booking.status === "approved" && booking.arrival_status !== "no_show";
  }

  if (filterName === "cancelled") {
    return ["cancelled", "rejected"].includes(booking.status) || booking.arrival_status === "no_show";
  }

  return true;
}

function getOwnerBookingsFilterCounts() {
  return {
    all: state.bookings.length,
    today: state.bookings.filter((booking) => isOwnerBookingInFilter(booking, "today")).length,
    pending: state.bookings.filter((booking) => isOwnerBookingInFilter(booking, "pending")).length,
    approved: state.bookings.filter((booking) => isOwnerBookingInFilter(booking, "approved")).length,
    cancelled: state.bookings.filter((booking) => isOwnerBookingInFilter(booking, "cancelled")).length
  };
}

function getOwnerBookingsEmptyMessage(filterName) {
  if (filterName === "today") {
    return "אין תורים להיום.";
  }

  if (filterName === "pending") {
    return "אין כרגע תורים שממתינים לאישור.";
  }

  if (filterName === "approved") {
    return "אין כרגע תורים מאושרים.";
  }

  if (filterName === "cancelled") {
    return "אין כרגע תורים מבוטלים או דחויים.";
  }

  return "עדיין אין בקשות תור.";
}

function renderOwnerBookingsFilters() {
  const counts = getOwnerBookingsFilterCounts();

  ownerBookingsFilters.querySelectorAll("[data-owner-booking-filter]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.ownerBookingFilter === uiState.ownerBookingsFilter);
  });

  ownerBookingsFilters.querySelectorAll("[data-owner-filter-count]").forEach((badge) => {
    badge.textContent = String(counts[badge.dataset.ownerFilterCount] || 0);
  });
}

function renderSellerBookings() {
  renderOwnerBookingsFilters();

  const filteredBookings = [...state.bookings]
    .filter((booking) => isOwnerBookingInFilter(booking, uiState.ownerBookingsFilter))
    .sort((a, b) => `${b.booking_date} ${b.booking_time}`.localeCompare(`${a.booking_date} ${a.booking_time}`));

  if (!filteredBookings.length) {
    sellerBookingsList.innerHTML = `<div class="notice-box">${getOwnerBookingsEmptyMessage(uiState.ownerBookingsFilter)}</div>`;
    return;
  }

  sellerBookingsList.innerHTML = filteredBookings
    .map((booking) => `
      <article class="booking-card status-card-${booking.status}" data-booking-card-id="${escapeHtml(booking.id)}">
        <div class="booking-card-head">
          <strong>${escapeHtml(`${booking.customer_first_name} ${booking.customer_last_name}`)}</strong>
          <div class="booking-card-badges">
            <span class="status-pill status-${booking.status}">${formatStatus(booking.status)}</span>
            ${booking.status === "approved" ? `<span class="status-pill arrival-pill arrival-${booking.arrival_status}">${formatArrivalStatus(booking.arrival_status)}</span>` : ""}
          </div>
        </div>
        <div class="booking-meta">
          <span>${escapeHtml(booking.service_name)}</span>
          <span>${formatDisplayDate(booking.booking_date)}</span>
          <span>${escapeHtml(booking.booking_time)}</span>
          <span>${escapeHtml(booking.staff_name)}</span>
        </div>
        ${getCustomerNoteMarkup(booking.customer_phone)}
        ${booking.notes ? `<div class="booking-note">הערה: ${escapeHtml(booking.notes)}</div>` : ""}
        ${formatAttendanceConfirmationStatus(booking.attendance_confirmation_status) ? `<div class="booking-note">אישור הגעה: ${formatAttendanceConfirmationStatus(booking.attendance_confirmation_status)}</div>` : ""}
        ${
          booking.status === "approved"
            ? `
              <label class="arrival-status-field">
                <span>מצב הגעה</span>
                <select class="arrival-status-select" data-booking-id="${escapeHtml(booking.id)}">
                  ${buildArrivalStatusOptions(booking.arrival_status)}
                </select>
              </label>
            `
            : ""
        }
        ${
          booking.status === "pending"
            ? `
              <div class="seller-actions">
                <button class="primary-button approve-booking-button" type="button" data-booking-id="${escapeHtml(booking.id)}">אישור תור</button>
                <button class="danger-button reject-booking-button" type="button" data-booking-id="${escapeHtml(booking.id)}">דחיית תור</button>
                <button class="ghost-button calendar-choice-button" type="button" data-booking-id="${escapeHtml(booking.id)}">הוספה ליומן</button>
                <button class="danger-button seller-cancel-booking-button" type="button" data-booking-id="${escapeHtml(booking.id)}">ביטול תור</button>
              </div>
            `
            : booking.status === "approved"
              ? `
                <div class="seller-actions">
                  <button class="ghost-button calendar-choice-button" type="button" data-booking-id="${escapeHtml(booking.id)}">הוספה ליומן</button>
                  ${!booking.attendance_confirmation_requested_at && state.business.features?.attendanceConfirmation !== false ? `<button class="ghost-button send-attendance-confirmation-button" type="button" data-booking-id="${escapeHtml(booking.id)}">שליחת אישור הגעה</button>` : ""}
                  ${getBookingCustomerEmail(booking) ? `<button class="ghost-button send-email-reminder-button" type="button" data-booking-id="${escapeHtml(booking.id)}">שלח תזכורת באימייל</button>` : ""}
                  <button class="danger-button seller-cancel-booking-button" type="button" data-booking-id="${escapeHtml(booking.id)}">ביטול תור</button>
                </div>
              `
              : ""
        }
        ${
          booking.status === "rejected" && isRejectUndoActiveForBooking(booking.id)
            ? `
              <div class="undo-strip">
                <span>התור נדחה. אפשר לבטל את הדחייה במשך כמה שניות.</span>
                <button class="ghost-button undo-reject-button" type="button" data-booking-id="${escapeHtml(booking.id)}">ביטול דחייה</button>
              </div>
            `
            : ""
        }
      </article>
    `)
    .join("");
}

function renderEditors() {
  businessForm.elements.name.value = state.business.name;
  businessForm.elements.description.value = state.business.description;
  businessForm.elements.address.value = state.business.address;
  businessForm.elements.phone.value = state.business.phone;
  businessForm.elements.ownerEmail.value = state.business.owner_email || "";
  businessForm.elements.instagramUrl.value = normalizeSocialUrl(state.business.instagram_url);
  businessForm.elements.preparationMessage.value = state.business.preparation_message || "";
  renderThemeColorEditor();
  Object.entries(BUSINESS_FEATURE_FIELDS).forEach(([featureName, fieldName]) => {
    businessForm.elements[fieldName].checked = state.business.features[featureName] !== false;
  });
  renderBusinessFeatureEditorState();
  businessForm.elements.coverImageFile.value = "";
  businessForm.elements.profileImageFile.value = "";
  renderBusinessImagePreviews();

  sellerCredentialsForm.elements.username.value = state.sellerCredentials.username;
  sellerCredentialsForm.elements.password.value = "";

  servicesEditor.innerHTML = state.services
    .map((service) => `
      <div class="editor-row" data-service-id="${escapeHtml(service.id)}">
        <input type="text" value="${escapeHtml(service.name)}" data-service-field="name">
        <input type="text" value="${escapeHtml(service.category)}" data-service-field="category">
        <input type="number" min="0" value="${service.price}" data-service-field="price">
        <input type="number" min="5" step="5" value="${service.duration_minutes}" data-service-field="duration_minutes">
        <button class="danger-button remove-service-button" type="button">מחיקה</button>
      </div>
    `)
    .join("");

  const workingDaysMode = getWorkingDaysMode();

  hoursEditor.innerHTML = `
    <div class="hours-mode-switch">
      <div class="hours-mode-copy">
        <strong>איך להגדיר ימי עבודה?</strong>
        <p>${getWorkingDaysModeDescription()}</p>
      </div>
      <div class="hours-mode-buttons">
        <button
          class="${workingDaysMode === "select_open_days" ? "primary-button" : "ghost-button"} hours-mode-button"
          type="button"
          data-working-days-mode="select_open_days"
        >
          אני בוחר את הימים שאני עובד
        </button>
        <button
          class="${workingDaysMode === "select_closed_days" ? "primary-button" : "ghost-button"} hours-mode-button"
          type="button"
          data-working-days-mode="select_closed_days"
        >
          אני בוחר את הימים שאני לא עובד
        </button>
      </div>
    </div>
    <div class="editor-row editor-row-labels" aria-hidden="true">
      <span>יום</span>
      <span>פתיחה</span>
      <span>סגירה</span>
      <span>מרווח בין תורים</span>
      <span>מצב יום</span>
    </div>
    ${[...state.workingHours]
      .sort((a, b) => a.day_of_week - b.day_of_week)
      .map((row) => `
        <div class="editor-row editor-row-hours ${row.is_closed ? "is-day-closed" : ""}" data-hour-id="${escapeHtml(row.id)}" data-day-closed="${row.is_closed ? "true" : "false"}">
          <input type="text" value="${escapeHtml(row.day_label)}" placeholder="יום" data-hour-field="day_label">
          <input type="time" value="${row.opens_at || ""}" data-hour-field="opens_at">
          <input type="time" value="${row.closes_at || ""}" data-hour-field="closes_at">
          <input type="number" min="5" step="5" value="${row.slot_interval_minutes || 30}" data-hour-field="slot_interval_minutes">
          <button class="ghost-button toggle-hour-button ${row.is_closed ? "is-closed" : "is-open"}" type="button" data-hour-toggle="${row.id}">
            ${getWorkingDayStateLabel(row.is_closed)}
          </button>
        </div>
      `)
      .join("")}
  `;
}

function getBusinessFeaturesFromForm() {
  return {
    ...state.business.features,
    ...Object.fromEntries(
      Object.entries(BUSINESS_FEATURE_FIELDS).map(([featureName, fieldName]) => [
        featureName,
        Boolean(businessForm.elements[fieldName].checked)
      ])
    ),
    workingDaysMode: getWorkingDaysMode(),
    themeAccent: normalizeHexColor(businessForm.elements.themeAccent.value)
  };
}

const THEME_COLOR_PRESETS = [
  "#b25fd1", "#7c3aed", "#4f46e5", "#2563eb", "#0284c7", "#0891b2",
  "#0f9f8f", "#16a34a", "#65a30d", "#ca8a04", "#ea580c", "#dc2626",
  "#e11d48", "#db2777", "#9333ea", "#475569", "#111827", "#8b5e3c"
];

function renderThemeColorEditor() {
  const selectedColor = normalizeHexColor(state.business.features?.themeAccent);
  businessForm.elements.themeAccent.value = selectedColor;
  themeColorValue.textContent = selectedColor;
  themeColorPresets.innerHTML = THEME_COLOR_PRESETS.map((color) => `
    <button
      class="theme-color-swatch ${color === selectedColor ? "is-selected" : ""}"
      type="button"
      data-theme-color="${color}"
      style="--swatch-color: ${color}"
      aria-label="בחירת הצבע ${color}"
      aria-pressed="${color === selectedColor}"
    ></button>
  `).join("");
}

function selectThemeColor(value) {
  const color = normalizeHexColor(value);
  businessForm.elements.themeAccent.value = color;
  themeColorValue.textContent = color;
  applyThemeColor(color);
  themeColorPresets.querySelectorAll("[data-theme-color]").forEach((button) => {
    const isSelected = button.dataset.themeColor === color;
    button.classList.toggle("is-selected", isSelected);
    button.setAttribute("aria-pressed", String(isSelected));
  });
}

function renderBusinessFeatureEditorState() {
  const descriptionEnabled = businessForm.elements.featureBusinessDescription.checked;
  const socialEnabled = businessForm.elements.featureSocialLink.checked;
  const prepEnabled = businessForm.elements.featurePreparationMessage.checked;

  businessForm.querySelector('[data-feature-editor="businessDescription"]')?.classList.toggle(
    "is-feature-disabled",
    !descriptionEnabled
  );
  businessForm.querySelector('[data-feature-editor="socialLink"]')?.classList.toggle(
    "is-feature-disabled",
    !socialEnabled
  );
  businessForm.querySelector('[data-feature-editor="preparationMessage"]')?.classList.toggle(
    "is-feature-disabled",
    !prepEnabled
  );

  if (businessForm.elements.description) {
    businessForm.elements.description.disabled = !descriptionEnabled;
  }
  if (businessForm.elements.instagramUrl) {
    businessForm.elements.instagramUrl.disabled = !socialEnabled;
  }
  if (businessForm.elements.preparationMessage) {
    businessForm.elements.preparationMessage.disabled = !prepEnabled;
  }
}

function setSpecialHoursClosedState() {
  const isClosed = Boolean(specialHoursForm.elements.specialClosed.checked);
  specialHoursForm.querySelectorAll("[data-special-mode]").forEach((button) => {
    const isActive = button.dataset.specialMode === (isClosed ? "closed" : "custom");
    button.classList.toggle("primary-button", isActive);
    button.classList.toggle("ghost-button", !isActive);
  });
  specialHoursForm.elements.specialOpen.disabled = isClosed;
  specialHoursForm.elements.specialClose.disabled = isClosed;
  specialHoursForm.elements.specialInterval.disabled = isClosed;
}

function setSpecialHoursMode(mode) {
  specialHoursForm.elements.specialClosed.checked = mode === "closed";
  setSpecialHoursClosedState();
}

function getActiveBookingsCountForDate(dateValue) {
  return state.bookings.filter((booking) => booking.booking_date === dateValue && ["pending", "approved"].includes(booking.status)).length;
}

function getBookingsOutsideSpecialRange(dateValue, opensAt, closesAt) {
  const openMinutes = parseTimeToMinutes(opensAt);
  const closeMinutes = parseTimeToMinutes(closesAt);
  return state.bookings.filter((booking) => {
    if (booking.booking_date !== dateValue || !["pending", "approved"].includes(booking.status)) {
      return false;
    }

    const bookingStart = parseTimeToMinutes(String(booking.booking_time || "").slice(0, 5));
    const bookingEnd = bookingStart + Number(booking.duration_minutes || 0);
    return bookingStart < openMinutes || bookingEnd > closeMinutes;
  });
}

function renderSpecialHoursWarning(dateValue, isClosed, opensAt, closesAt) {
  if (!specialHoursWarning || !dateValue) {
    return;
  }

  let message = "";
  const activeBookingsCount = getActiveBookingsCountForDate(dateValue);

  if (isClosed && activeBookingsCount > 0) {
    message = `יש כבר ${activeBookingsCount} תורים קיימים בתאריך הזה. הסגירה תחסום רק תורים חדשים ולא תמחק תורים שכבר נקבעו.`;
  } else if (!isClosed && opensAt && closesAt) {
    const conflictingBookings = getBookingsOutsideSpecialRange(dateValue, opensAt, closesAt);
    if (conflictingBookings.length > 0) {
      message = `יש כבר ${conflictingBookings.length} תורים מחוץ לשעות המיוחדות שבחרת. השעות החדשות יחולו רק על תורים חדשים.`;
    }
  }

  specialHoursWarning.textContent = message;
  specialHoursWarning.classList.toggle("is-hidden", !message);
}

function renderSpecialHoursManager() {
  const dateField = specialHoursForm.elements.specialDate;
  const openField = specialHoursForm.elements.specialOpen;
  const closeField = specialHoursForm.elements.specialClose;
  const intervalField = specialHoursForm.elements.specialInterval;
  const closedField = specialHoursForm.elements.specialClosed;
  const noteField = specialHoursForm.elements.specialNote;
  const selectedDate = uiState.specialHoursDate || uiState.sellerCalendarDate || todayDate();
  const specialDay = findSpecialHoursForDate(selectedDate);
  const regularDay = findRegularWorkingHoursForDate(selectedDate);

  dateField.min = todayDate();
  dateField.value = selectedDate;
  openField.value = specialDay?.opens_at || regularDay?.opens_at || "10:00";
  closeField.value = specialDay?.closes_at || regularDay?.closes_at || "18:00";
  intervalField.value = String(specialDay?.slot_interval_minutes || regularDay?.slot_interval_minutes || 30);
  closedField.checked = Boolean(specialDay?.is_closed);
  noteField.value = specialDay?.note || "";
  setSpecialHoursClosedState();
  renderSpecialHoursWarning(selectedDate, Boolean(closedField.checked), String(openField.value || "").trim(), String(closeField.value || "").trim());

  if (!state.specialHours.length) {
    specialHoursList.innerHTML = '<div class="notice-box">עדיין אין חריגים בתאריכים. ברגע שתוסיפי תאריך חריג, הוא יופיע כאן.</div>';
    return;
  }

  specialHoursList.innerHTML = [...state.specialHours]
    .sort((left, right) => left.special_date.localeCompare(right.special_date))
    .map((item) => `
      <article class="booking-card status-card-special">
        <div class="booking-card-head">
          <strong>${formatDisplayDate(item.special_date)}</strong>
          <span class="status-pill status-special">${item.is_closed ? "העסק סגור" : "שעות מיוחדות"}</span>
        </div>
        <div class="booking-meta">
          <span>${item.is_closed ? "לא ניתן לקבוע תורים ביום הזה" : `${item.opens_at} - ${item.closes_at}`}</span>
          <span>${item.is_closed ? "התאריך הזה חסום ללקוחות" : `כל ${item.slot_interval_minutes} דקות`}</span>
        </div>
        ${item.note ? `<div class="booking-note">הערה: ${escapeHtml(item.note)}</div>` : ""}
        <div class="booking-card-actions">
          <button class="ghost-button edit-special-hours-button" type="button" data-special-date="${escapeHtml(item.special_date)}">עריכה</button>
          <button class="danger-button remove-special-hours-button" type="button" data-special-id="${escapeHtml(item.id)}">הסרה</button>
        </div>
      </article>
    `)
    .join("");
}

function renderBlockedSlotTimeOptions(preferredTime = "") {
  const dateField = blockedSlotsForm.elements.blockedDate;
  const timeField = blockedSlotsForm.elements.blockedTime;
  const selectedDate = uiState.blockedSlotDate || uiState.sellerCalendarDate || todayDate();
  const availableTimes = getWorkingDaySlotTimes(selectedDate);

  dateField.min = todayDate();
  dateField.value = selectedDate;

  if (!availableTimes.length) {
    timeField.innerHTML = '<option value="">אין שעות פעילות ביום הזה</option>';
    timeField.disabled = true;
    return;
  }

  timeField.disabled = false;
  timeField.innerHTML = `
    <option value="">בחירת שעה</option>
    ${availableTimes.map((time) => `<option value="${time}">${time}</option>`).join("")}
  `;

  if (availableTimes.includes(preferredTime)) {
    timeField.value = preferredTime;
  }
}

function renderBlockedSlotsManager() {
  if (!uiState.blockedSlotDate) {
    uiState.blockedSlotDate = uiState.sellerCalendarDate || todayDate();
  }

  renderBlockedSlotTimeOptions(String(blockedSlotsForm.elements.blockedTime.value || ""));

  if (!state.blockedSlots.length) {
    blockedSlotsList.innerHTML = '<div class="notice-box">עדיין אין שעות חסומות. ברגע שתחסמי שעה, היא תופיע כאן.</div>';
    return;
  }

  blockedSlotsList.innerHTML = [...state.blockedSlots]
    .sort((left, right) => `${left.blocked_date} ${left.blocked_time}`.localeCompare(`${right.blocked_date} ${right.blocked_time}`))
    .map((slot) => {
      const dayOfWeek = new Date(`${slot.blocked_date}T00:00:00`).getDay();
      const dayLabel = state.workingHours.find((row) => Number(row.day_of_week) === dayOfWeek)?.day_label || "יום";

      return `
        <article class="booking-card status-card-blocked">
          <div class="booking-card-head">
            <strong>${formatDisplayDate(slot.blocked_date)}</strong>
            <span class="status-pill status-blocked">שעה חסומה</span>
          </div>
          <div class="booking-meta">
            <span>${slot.blocked_time}</span>
            <span>${dayLabel}</span>
          </div>
          ${slot.note ? `<div class="booking-note">סיבה: ${escapeHtml(slot.note)}</div>` : ""}
          <div class="booking-card-actions">
            <button class="ghost-button unblock-slot-button" type="button" data-blocked-slot-id="${escapeHtml(slot.id)}">הסרת חסימה</button>
          </div>
        </article>
      `;
    })
    .join("");
}

function rerenderAll() {
  runAttendanceConfirmationSweep();
  renderHeader();
  renderOwnerStats();
  renderOwnerTips();
  renderSellerCalendar();
  renderSellerBookings();
  renderWaitlist();
  renderOwnerCustomers();
  renderEditors();
  renderSpecialHoursManager();
  renderBlockedSlotsManager();
  notificationCenter?.render();
}



function showOwnerLayout() {
  ownerLogoutButton.classList.remove("is-hidden");
  ownerLoginGate.classList.add("is-hidden");
  ownerLayout.classList.remove("is-hidden");
  setOwnerAccessMessage("");
  notificationCenter?.rememberCurrentNotifications();
  notificationCenter?.askAfterOwnerLogin();
  rerenderAll();
  void refreshOwnerEmailStatus();
}

function showOwnerLogin() {
  ownerLogoutButton.classList.add("is-hidden");
  ownerRecoveryGate?.classList.add("is-hidden");
  ownerLayout.classList.add("is-hidden");
  ownerLoginGate.classList.remove("is-hidden");
  if (ownerLoginForm?.elements?.username) {
    ownerLoginForm.elements.username.value = OWNER_LOGIN_NAME;
  }
  if (ownerLoginForm?.elements?.password) {
    ownerLoginForm.elements.password.value = "";
  }
  notificationCenter?.render();
}

function showOwnerRecovery() {
  ownerLogoutButton.classList.add("is-hidden");
  ownerLoginGate.classList.add("is-hidden");
  ownerLayout.classList.add("is-hidden");
  setOwnerAccessMessage("");
  ownerRecoveryGate?.classList.remove("is-hidden");
  if (ownerRecoveryForm?.reset) {
    ownerRecoveryForm.reset();
  }
}

function isPasswordRecoveryUrl() {
  const hash = window.location.hash.replace(/^#/, "");
  if (!hash) {
    return false;
  }

  const hashParams = new URLSearchParams(hash);
  return hashParams.get("type") === "recovery";
}

ownerLoginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitButton = event.submitter instanceof HTMLButtonElement
    ? event.submitter
    : ownerLoginForm.querySelector('button[type="submit"]');
  if (submitButton?.disabled) return;
  const formData = new FormData(ownerLoginForm);
  const username = String(formData.get("username")).trim();
  const password = String(formData.get("password"));

  if (!supabaseEnabled) {
    appUi.toast("לא ניתן להיכנס לניהול כי החיבור המאובטח לשרת אינו זמין.", { variant: "error" });
    return;
  }

  if (username !== OWNER_LOGIN_NAME) {
    appUi.toast("שם המשתמש לניהול חייב להיות admin.", { variant: "error" });
    return;
  }

  if (submitButton) submitButton.disabled = true;
  try {
    await supabaseApi.signInOwner({ username, password });
    const currentUser = await supabaseApi.getCurrentUser();
    ownerSession.authUserId = currentUser?.id || null;
    if (!(await supabaseApi.isOwnerUser())) {
      await supabaseApi.signOut();
      ownerSession.authUserId = null;
      setOwnerAccessMessage("החשבון הזה לא מחובר להרשאת ניהול של העסק.", true);
      throw new Error("החשבון הזה לא מחובר להרשאת ניהול של העסק.");
    }
    setOwnerAccessMessage("");
    await ensureOwnerSupabaseBootstrap();
    await refreshOwnerStateFromSupabase();
    setupOwnerRealtimeSubscriptions();
    showOwnerLayout();
  } catch (error) {
    appUi.toast(error?.message || "פרטי הכניסה לא תקינים.", { variant: "error" });
  } finally {
    if (submitButton) submitButton.disabled = false;
  }
});

ownerForgotPasswordButton?.addEventListener("click", async () => {
  if (ownerForgotPasswordButton.disabled) return;
  if (!supabaseEnabled) {
    appUi.toast("החיבור המאובטח לשרת עדיין לא זמין בדף הזה.", { variant: "error" });
    return;
  }

  ownerForgotPasswordButton.disabled = true;
  try {
    await supabaseApi.sendOwnerPasswordReset();
    appUi.toast("שלחנו קישור איפוס סיסמה לכתובת של בעל העסק.", { variant: "success" });
  } catch (error) {
    appUi.toast(error?.message || "לא הצלחנו לשלוח קישור איפוס סיסמה.", { variant: "error" });
  } finally {
    ownerForgotPasswordButton.disabled = false;
  }
});

ownerRecoveryForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitButton = event.submitter instanceof HTMLButtonElement
    ? event.submitter
    : ownerRecoveryForm.querySelector('button[type="submit"]');
  if (submitButton?.disabled) return;

  if (!supabaseEnabled) {
    appUi.toast("החיבור המאובטח לשרת עדיין לא זמין בדף הזה.", { variant: "error" });
    return;
  }

  const formData = new FormData(ownerRecoveryForm);
  const newPassword = String(formData.get("newPassword") || "");
  const confirmPassword = String(formData.get("confirmPassword") || "");

  if (!newPassword || !confirmPassword) {
    appUi.toast("יש למלא את שתי הסיסמאות.", { variant: "error" });
    return;
  }

  if (newPassword !== confirmPassword) {
    appUi.toast("הסיסמאות לא תואמות.", { variant: "error" });
    return;
  }

  if (newPassword.length < 6) {
    appUi.toast("הסיסמה קצרה מדי. בחרי סיסמה עם לפחות 6 תווים.", { variant: "error" });
    return;
  }

  if (submitButton) submitButton.disabled = true;
  try {
    await supabaseApi.updateOwnerPassword(newPassword);
    appUi.toast("הסיסמה עודכנה, אפשר להתחבר", { variant: "success" });
    await supabaseApi.signOut();
    ownerSession.authUserId = null;
    window.history.replaceState({}, document.title, window.location.pathname);
    showOwnerLogin();
  } catch (error) {
    appUi.toast(error?.message || "לא הצלחנו לעדכן את הסיסמה.", { variant: "error" });
  } finally {
    if (submitButton) submitButton.disabled = false;
  }
});
ownerLogoutButton.addEventListener("click", async () => {
  clearRejectUndo(false);
  closeCalendarChoice();
  clearRememberedSellerSession();
  if (supabaseEnabled) {
    await supabaseApi.signOut();
  }
  ownerSession.authUserId = null;
  clearOwnerRealtimeSubscriptions();
  window.location.href = "index.html";
});

sendTestEmailButton?.addEventListener("click", async () => {
  if (!appEmail) {
    appUi.toast("האימייל עדיין לא מוגדר בשרת.", { variant: "warning" });
    return;
  }

  sendTestEmailButton.disabled = true;
  try {
    const result = await appEmail.sendEmailNotification("test_email", {
      businessName: state.business.name
    }, { eventKey: `test_email:${Date.now()}` });
    if (result.ok) {
      appUi.toast("אימייל ניסיון נשלח בהצלחה.", { variant: "success" });
    } else if (result.skipped) {
      appUi.toast("האימייל עדיין לא מוגדר בשרת.", { variant: "warning" });
    } else {
      appUi.toast("שליחת אימייל הניסיון לא הצליחה.", { variant: "error" });
    }
    await refreshOwnerEmailStatus();
  } finally {
    sendTestEmailButton.disabled = false;
  }
});

resetBusinessTemplateButton.addEventListener("click", async () => {
  if (resetBusinessTemplateButton.disabled) return;
  resetBusinessTemplateButton.disabled = true;
  try {
    const shouldReset = await appUi.confirm(
      "האיפוס ימחק את נתוני העסק, התורים, הלקוחות, השירותים, התמונות וההגדרות. חשבון הניהול, הסיסמה ואימייל ההתראות יישארו ללא שינוי.",
      { title: "איפוס מלא של העסק", confirmText: "המשך לאזהרה האחרונה", variant: "danger" }
    );

    if (!shouldReset) {
      return;
    }

    const confirmedAgain = await appUi.confirm(
      "זו אזהרה אחרונה: אי אפשר לשחזר דרך האתר את התורים והלקוחות שיימחקו. לבצע את האיפוס עכשיו?",
      { title: "אישור אחרון", confirmText: "כן, לבצע איפוס", variant: "danger" }
    );

    if (!confirmedAgain) {
      return;
    }

    if (!supabaseEnabled || !ownerSession.authUserId || !supabaseApi?.resetOwnerBusinessData) {
      throw new Error("האיפוס המאובטח עדיין לא הוגדר בשרת.");
    }

    await supabaseApi.resetOwnerBusinessData();
    resetOwnerUiState();
    closeCalendarChoice();
    await refreshOwnerStateFromSupabase();
    showOwnerLayout();
    appUi.toast("האיפוס הושלם. שם המשתמש והסיסמה שלך לא השתנו.", { variant: "success", title: "האיפוס הושלם" });
  } catch (error) {
    showOwnerSupabaseError(error);
  } finally {
    resetBusinessTemplateButton.disabled = false;
  }
});

closeCalendarChoiceModal.addEventListener("click", closeCalendarChoice);
cancelCalendarChoiceButton.addEventListener("click", closeCalendarChoice);

deviceCalendarButton.addEventListener("click", () => {
  downloadDeviceCalendar(findBookingById(uiState.calendarChoiceBookingId));
  closeCalendarChoice();
});

googleCalendarButton.addEventListener("click", () => {
  openGoogleCalendarForBooking(findBookingById(uiState.calendarChoiceBookingId));
  closeCalendarChoice();
});

sellerCalendarGrid.addEventListener("click", (event) => {
  const button = event.target.closest("[data-seller-date]");
  if (!button) {
    return;
  }

  uiState.sellerCalendarDate = button.dataset.sellerDate;
  uiState.specialHoursDate = button.dataset.sellerDate;
  uiState.blockedSlotDate = button.dataset.sellerDate;
  renderSellerCalendar();
  renderSpecialHoursManager();
  renderBlockedSlotsManager();
});

sellerCalendarPrevButton.addEventListener("click", () => {
  const monthDate = monthDateFromKey(uiState.sellerCalendarMonthKey);
  monthDate.setMonth(monthDate.getMonth() - 1);
  uiState.sellerCalendarMonthKey = monthKey(monthDate);
  renderSellerCalendar();
});

sellerCalendarNextButton.addEventListener("click", () => {
  const monthDate = monthDateFromKey(uiState.sellerCalendarMonthKey);
  monthDate.setMonth(monthDate.getMonth() + 1);
  uiState.sellerCalendarMonthKey = monthKey(monthDate);
  renderSellerCalendar();
});

sellerCalendarList.addEventListener("click", async (event) => {
  const target = event.target.closest("button");
  if (!target) {
    return;
  }

  if (target.classList.contains("unblock-slot-button")) {
    target.disabled = true;
    const deleted = await deleteRemoteOwnerRow("blocked_slots", target.dataset.blockedSlotId);
    if (!deleted) {
      target.disabled = false;
      return;
    }
    state.blockedSlots = state.blockedSlots.filter((slot) => slot.id !== target.dataset.blockedSlotId);
    lastConfirmedOwnerState = structuredClone(state);
    rerenderAll();
    return;
  }

  const booking = findBookingById(target.dataset.bookingId);
  if (!booking) {
    return;
  }

  if (target.classList.contains("calendar-choice-button")) {
    openCalendarChoiceModal(booking.id);
    return;
  }

  if (target.classList.contains("send-attendance-confirmation-button")) {
    if (supabaseEnabled) {
      try {
        await supabaseApi.requestBookingAttendance(booking.id);
        await refreshOwnerStateFromSupabase({ silent: true });
        const emailResult = await sendCustomerBookingEmail("attendance_confirmation_customer", booking);
        appUi.toast(emailResult.ok ? "נשלחה בקשת אישור הגעה ללקוחה וגם באימייל." : "נשלחה בקשת אישור הגעה ללקוחה.", { variant: "success" });
      } catch (error) {
        appUi.toast(error?.message || "לא הצלחנו לשלוח בקשת אישור הגעה.", { variant: "error" });
      }
    } else if (requestAttendanceConfirmation(booking, { force: true })) {
      saveState();
      rerenderAll();
      appUi.toast("נשלחה בקשת אישור הגעה ללקוחה.", { variant: "success" });
    }
    return;
  }

  if (target.classList.contains("send-email-reminder-button")) {
    const result = await sendCustomerBookingEmail("reminder_customer", booking, "התזכורת נשלחה באימייל.");
    if (!result.ok && result.skipped) {
      appUi.toast("אין כתובת אימייל ללקוחה או שהאימייל עדיין לא מוגדר בשרת.", { variant: "warning" });
    }
    return;
  }

  if (!target.classList.contains("seller-cancel-booking-button")) {
    return;
  }

  if (!["pending", "approved"].includes(booking.status)) {
    return;
  }

  if (!(await appUi.confirm("האם לבטל את התור הזה?", { title: "ביטול תור" }))) {
    return;
  }

  booking.status = "cancelled";
  booking.arrival_status = null;
  notifyOwnerAppointmentCancelled(booking, "בעל העסק");
  notifyCustomerAppointmentCancelledByOwner(booking);
  maybePromoteWaitlistForBooking(booking);
  const saved = await saveState();
  rerenderAll();
  if (saved) {
    await sendCustomerBookingEmail("booking_cancelled_customer", booking);
  }
});

sellerCalendarList.addEventListener("change", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLSelectElement) || !target.classList.contains("arrival-status-select")) {
    return;
  }

  const booking = findBookingById(target.dataset.bookingId);
  if (!booking || booking.status !== "approved") {
    return;
  }

  const nextArrivalStatus = normalizeArrivalStatus(target.value, "approved");
  applyNoShowCounterChange(booking, nextArrivalStatus);
  booking.arrival_status = nextArrivalStatus;
  notifyOwnerAppointmentUpdated(booking, `עודכן מצב הגעה ל${formatArrivalStatus(booking.arrival_status)}`);
  notifyCustomerAppointmentUpdated(booking, `מצב ההגעה עודכן ל${formatArrivalStatus(booking.arrival_status)}`);
  await saveState();
  rerenderAll();
});

blockedSlotsForm.elements.blockedDate.addEventListener("change", () => {
  uiState.blockedSlotDate = String(blockedSlotsForm.elements.blockedDate.value || "");
  if (uiState.blockedSlotDate) {
    uiState.sellerCalendarMonthKey = monthKey(new Date(`${uiState.blockedSlotDate}T00:00:00`));
  }
  renderBlockedSlotTimeOptions();
  renderSellerCalendar();
});

specialHoursForm.elements.specialDate.addEventListener("change", () => {
  uiState.specialHoursDate = String(specialHoursForm.elements.specialDate.value || "");

  if (uiState.specialHoursDate) {
    uiState.sellerCalendarDate = uiState.specialHoursDate;
    uiState.blockedSlotDate = uiState.specialHoursDate;
    uiState.sellerCalendarMonthKey = monthKey(new Date(`${uiState.specialHoursDate}T00:00:00`));
  }

  renderSpecialHoursManager();
  renderBlockedSlotsManager();
  renderSellerCalendar();
});

specialHoursForm.addEventListener("click", (event) => {
  const modeButton = event.target.closest("[data-special-mode]");
  if (!modeButton) {
    return;
  }

  setSpecialHoursMode(modeButton.dataset.specialMode);
  renderSpecialHoursWarning(
    String(specialHoursForm.elements.specialDate.value || "").trim(),
    Boolean(specialHoursForm.elements.specialClosed.checked),
    String(specialHoursForm.elements.specialOpen.value || "").trim(),
    String(specialHoursForm.elements.specialClose.value || "").trim()
  );
});

specialHoursForm.elements.specialClosed.addEventListener("change", () => {
  setSpecialHoursClosedState();
  renderSpecialHoursWarning(
    String(specialHoursForm.elements.specialDate.value || "").trim(),
    Boolean(specialHoursForm.elements.specialClosed.checked),
    String(specialHoursForm.elements.specialOpen.value || "").trim(),
    String(specialHoursForm.elements.specialClose.value || "").trim()
  );
});

["specialOpen", "specialClose", "specialInterval"].forEach((fieldName) => {
  specialHoursForm.elements[fieldName].addEventListener("input", () => {
    renderSpecialHoursWarning(
      String(specialHoursForm.elements.specialDate.value || "").trim(),
      Boolean(specialHoursForm.elements.specialClosed.checked),
      String(specialHoursForm.elements.specialOpen.value || "").trim(),
      String(specialHoursForm.elements.specialClose.value || "").trim()
    );
  });
});

specialHoursForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitButton = event.submitter instanceof HTMLButtonElement ? event.submitter : null;
  if (submitButton?.disabled) return;

  const specialDate = String(specialHoursForm.elements.specialDate.value || "").trim();
  const specialOpen = String(specialHoursForm.elements.specialOpen.value || "").trim();
  const specialClose = String(specialHoursForm.elements.specialClose.value || "").trim();
  const specialInterval = Number(specialHoursForm.elements.specialInterval.value || 30);
  const specialClosed = Boolean(specialHoursForm.elements.specialClosed.checked);
  const specialNote = String(specialHoursForm.elements.specialNote.value || "").trim();

  if (!specialDate) {
    appUi.toast("צריך לבחור תאריך מיוחד.", { variant: "error" });
    return;
  }

  if (!specialClosed) {
    if (!specialOpen || !specialClose) {
      appUi.toast("צריך למלא שעת פתיחה ושעת סגירה.", { variant: "error" });
      return;
    }

    if (parseTimeToMinutes(specialClose) <= parseTimeToMinutes(specialOpen)) {
      appUi.toast("שעת הסגירה חייבת להיות אחרי שעת הפתיחה.", { variant: "error" });
      return;
    }
  }

  renderSpecialHoursWarning(specialDate, specialClosed, specialOpen, specialClose);

  const activeBookingsCount = getActiveBookingsCountForDate(specialDate);
  if (specialClosed && activeBookingsCount > 0) {
    appUi.toast("יש כבר תורים בתאריך הזה. החריג ייחסם ללקוחות חדשים בלבד.", { variant: "warning" });
  } else if (!specialClosed && specialOpen && specialClose && getBookingsOutsideSpecialRange(specialDate, specialOpen, specialClose).length > 0) {
    appUi.toast("יש כבר תורים מחוץ לשעות המיוחדות. השעות החדשות יחולו רק על תורים חדשים.", { variant: "warning" });
  }

  state.specialHours = normalizeSpecialHours([
    ...state.specialHours.filter((item) => item.special_date !== specialDate),
    {
      id: createAppUuid(),
      special_date: specialDate,
      opens_at: specialClosed ? null : specialOpen,
      closes_at: specialClosed ? null : specialClose,
      slot_interval_minutes: specialInterval,
      is_closed: specialClosed,
      note: specialNote
    }
  ]);

  uiState.specialHoursDate = specialDate;
  uiState.sellerCalendarDate = specialDate;
  uiState.blockedSlotDate = specialDate;
  uiState.sellerCalendarMonthKey = monthKey(new Date(`${specialDate}T00:00:00`));
  if (submitButton) submitButton.disabled = true;
  const saved = await saveState();
  rerenderAll();
  if (submitButton) submitButton.disabled = false;
  if (saved) {
    appUi.toast("התאריך החריג נשמר.", { variant: "success" });
  }
});

specialHoursList.addEventListener("click", async (event) => {
  const editButton = event.target.closest(".edit-special-hours-button");
  if (editButton) {
    uiState.specialHoursDate = String(editButton.dataset.specialDate || "");
    uiState.sellerCalendarDate = uiState.specialHoursDate || uiState.sellerCalendarDate;
    uiState.blockedSlotDate = uiState.specialHoursDate || uiState.blockedSlotDate;

    if (uiState.specialHoursDate) {
      uiState.sellerCalendarMonthKey = monthKey(new Date(`${uiState.specialHoursDate}T00:00:00`));
    }

    rerenderAll();
    return;
  }

  const removeButton = event.target.closest(".remove-special-hours-button");
  if (!removeButton) {
    return;
  }

  removeButton.disabled = true;
  const deleted = await deleteRemoteOwnerRow("special_hours", removeButton.dataset.specialId);
  if (!deleted) {
    removeButton.disabled = false;
    return;
  }
  state.specialHours = state.specialHours.filter((item) => item.id !== removeButton.dataset.specialId);
  lastConfirmedOwnerState = structuredClone(state);
  rerenderAll();
});

blockedSlotsForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitButton = event.submitter instanceof HTMLButtonElement ? event.submitter : null;
  if (submitButton?.disabled) return;

  const blockedDate = String(blockedSlotsForm.elements.blockedDate.value || "").trim();
  const blockedTime = String(blockedSlotsForm.elements.blockedTime.value || "").trim();
  const note = String(blockedSlotsForm.elements.blockedNote.value || "").trim();

  if (!blockedDate || !blockedTime) {
    appUi.toast("צריך לבחור תאריך ושעה לחסימה.", { variant: "error" });
    return;
  }

  if (!getWorkingDaySlotTimes(blockedDate).includes(blockedTime)) {
    appUi.toast("השעה שבחרת לא תואמת לשעות הפעילות של אותו יום.", { variant: "error" });
    return;
  }

  if (isSlotBlocked(blockedDate, blockedTime)) {
    appUi.toast("השעה הזאת כבר חסומה.", { variant: "warning" });
    return;
  }

  state.blockedSlots.push({
    id: createAppUuid(),
    blocked_date: blockedDate,
    blocked_time: blockedTime,
    note
  });

  state.blockedSlots = normalizeBlockedSlots(state.blockedSlots);
  uiState.blockedSlotDate = blockedDate;
  uiState.sellerCalendarDate = blockedDate;
  uiState.sellerCalendarMonthKey = monthKey(new Date(`${blockedDate}T00:00:00`));
  blockedSlotsForm.reset();
  if (submitButton) submitButton.disabled = true;
  const saved = await saveState();
  rerenderAll();
  if (submitButton) submitButton.disabled = false;
  if (saved) {
    appUi.toast("השעה נחסמה ונשמרה.", { variant: "success" });
  }
});

blockedSlotsList.addEventListener("click", async (event) => {
  const target = event.target.closest(".unblock-slot-button");
  if (!target) {
    return;
  }

  target.disabled = true;
  const deleted = await deleteRemoteOwnerRow("blocked_slots", target.dataset.blockedSlotId);
  if (!deleted) {
    target.disabled = false;
    return;
  }
  state.blockedSlots = state.blockedSlots.filter((slot) => slot.id !== target.dataset.blockedSlotId);
  lastConfirmedOwnerState = structuredClone(state);
  rerenderAll();
});

ownerCustomersList.addEventListener("click", async (event) => {
  const saveButton = event.target.closest(".save-customer-note-button");
  const clearButton = event.target.closest(".clear-customer-note-button");
  const toggleBlockButton = event.target.closest(".toggle-customer-block-button");

  if (!saveButton && !clearButton && !toggleBlockButton) {
    return;
  }

  const actionButton = saveButton || clearButton || toggleBlockButton;
  const customerPhone = actionButton?.dataset.customerPhone || "";
  const customerCard = actionButton?.closest(".owner-customer-card");
  const noteField = customerCard?.querySelector(".owner-note-input");
  const customerName = noteField?.dataset.customerName || "";

  if (toggleBlockButton) {
    toggleBlockButton.disabled = true;
    const isBlocked = toggleCustomerBlocked(customerPhone);
    const saved = await saveState();
    rerenderAll();
    if (saved) {
      appUi.toast(isBlocked ? "הלקוחה נחסמה לקביעת תורים חדשים." : "החסימה הוסרה מהלקוחה.", {
        variant: isBlocked ? "warning" : "success"
      });
    }
    return;
  }

  if (clearButton) {
    clearButton.disabled = true;
    saveCustomerNote(customerPhone, customerName, "");
    const saved = await saveState();
    rerenderAll();
    if (saved) appUi.toast("ההערה נמחקה.", { variant: "success" });
    return;
  }

  if (!noteField) {
    return;
  }

  saveButton.disabled = true;
  saveCustomerNote(customerPhone, customerName, noteField.value);
  const saved = await saveState();
  rerenderAll();
  if (saved) appUi.toast("ההערה נשמרה.", { variant: "success" });
});

waitlistList?.addEventListener("click", async (event) => {
  const notifyButton = event.target.closest(".notify-waitlist-button");
  const removeButton = event.target.closest(".remove-waitlist-button");
  const button = notifyButton || removeButton;

  if (!button) {
    return;
  }

  const entry = state.waitlistEntries.find((item) => item.id === button.dataset.waitlistId);
  if (!entry) {
    return;
  }

  if (removeButton) {
    removeButton.disabled = true;
    const deleted = await deleteRemoteOwnerRow("waitlist_entries", entry.id);
    if (!deleted) {
      removeButton.disabled = false;
      return;
    }
    state.waitlistEntries = state.waitlistEntries.filter((item) => item.id !== entry.id);
    lastConfirmedOwnerState = structuredClone(state);
    rerenderAll();
    return;
  }

  entry.status = "notified";
  entry.notified_at = new Date().toISOString();
  notifyCustomerWaitlistOpened(entry, {
    booking_date: entry.booking_date,
    booking_time: "",
    service_name: entry.service_name
  });
  await saveState();
  rerenderAll();
});

ownerBookingsFilters.addEventListener("click", (event) => {
  const filterButton = event.target.closest("[data-owner-booking-filter]");
  if (!filterButton) {
    return;
  }

  uiState.ownerBookingsFilter = filterButton.dataset.ownerBookingFilter || "all";
  renderSellerBookings();
});

ownerCustomerSearch.addEventListener("input", () => {
  uiState.ownerCustomerSearch = ownerCustomerSearch.value;
  renderOwnerCustomers();
});

sellerBookingsList.addEventListener("click", async (event) => {
  const target = event.target.closest("button");
  if (!target) {
    return;
  }

  const bookingId = target.dataset.bookingId;
  if (!bookingId) {
    return;
  }

  const booking = findBookingById(bookingId);
  if (!booking) {
    return;
  }

  if (target.classList.contains("calendar-choice-button")) {
    openCalendarChoiceModal(booking.id);
    return;
  }

  if (target.classList.contains("send-attendance-confirmation-button")) {
    if (supabaseEnabled) {
      try {
        await supabaseApi.requestBookingAttendance(booking.id);
        await refreshOwnerStateFromSupabase({ silent: true });
        const emailResult = await sendCustomerBookingEmail("attendance_confirmation_customer", booking);
        appUi.toast(emailResult.ok ? "נשלחה בקשת אישור הגעה ללקוחה וגם באימייל." : "נשלחה בקשת אישור הגעה ללקוחה.", { variant: "success" });
      } catch (error) {
        appUi.toast(error?.message || "לא הצלחנו לשלוח בקשת אישור הגעה.", { variant: "error" });
      }
    } else if (requestAttendanceConfirmation(booking, { force: true })) {
      saveState();
      rerenderAll();
      appUi.toast("נשלחה בקשת אישור הגעה ללקוחה.", { variant: "success" });
    }
    return;
  }

  if (target.classList.contains("send-email-reminder-button")) {
    const result = await sendCustomerBookingEmail("reminder_customer", booking, "התזכורת נשלחה באימייל.");
    if (!result.ok && result.skipped) {
      appUi.toast("אין כתובת אימייל ללקוחה או שהאימייל עדיין לא מוגדר בשרת.", { variant: "warning" });
    }
    return;
  }

  if (target.classList.contains("seller-cancel-booking-button")) {
    if (!["pending", "approved"].includes(booking.status)) {
      return;
    }

    if (!(await appUi.confirm("האם לבטל את התור הזה?", { title: "ביטול תור" }))) {
      return;
    }

    clearRejectUndo(false);
    booking.status = "cancelled";
    booking.arrival_status = null;
    notifyOwnerAppointmentCancelled(booking, "בעל העסק");
    notifyCustomerAppointmentCancelledByOwner(booking);
    maybePromoteWaitlistForBooking(booking);
    const saved = await saveState();
    rerenderAll();
    if (saved) {
      await sendCustomerBookingEmail("booking_cancelled_customer", booking);
    }
    return;
  }

  if (target.classList.contains("undo-reject-button")) {
    booking.status = uiState.rejectUndoPreviousStatus || "pending";
    await saveState();
    clearRejectUndo(false);
    rerenderAll();
    return;
  }

  let customerEmailType = "";
  if (target.classList.contains("approve-booking-button")) {
    clearRejectUndo(false);
    booking.status = "approved";
    booking.arrival_status = normalizeArrivalStatus(booking.arrival_status, "approved");
    const previousBooking = finalizeApprovedChangeRequest(booking);
    if (previousBooking) {
      customerEmailType = "booking_rescheduled_customer";
      notifyOwnerAppointmentRescheduled(booking, previousBooking);
      notifyCustomerAppointmentChanged(booking, previousBooking);
    } else {
      customerEmailType = "booking_approved_customer";
      notifyOwnerAppointmentUpdated(booking, "אושר תור");
      notifyCustomerAppointmentUpdated(booking, "התור שלך אושר");
    }
  }

  if (target.classList.contains("reject-booking-button")) {
    customerEmailType = "booking_rejected_customer";
    const previousStatus = booking.status;
    booking.status = "rejected";
    booking.arrival_status = null;
    startRejectUndo(booking.id, previousStatus);
    notifyOwnerAppointmentUpdated(booking, "נדחה תור");
    notifyCustomerAppointmentUpdated(booking, "התור שלך נדחה");
  }

  const saved = await saveState();
  rerenderAll();
  if (saved && customerEmailType) {
    await sendCustomerBookingEmail(customerEmailType, booking, "נשלח עדכון באימייל ללקוחה.");
  }
});

sellerBookingsList.addEventListener("change", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLSelectElement) || !target.classList.contains("arrival-status-select")) {
    return;
  }

  const booking = findBookingById(target.dataset.bookingId);
  if (!booking || booking.status !== "approved") {
    return;
  }

  const nextArrivalStatus = normalizeArrivalStatus(target.value, "approved");
  applyNoShowCounterChange(booking, nextArrivalStatus);
  booking.arrival_status = nextArrivalStatus;
  notifyOwnerAppointmentUpdated(booking, `עודכן מצב הגעה ל${formatArrivalStatus(booking.arrival_status)}`);
  notifyCustomerAppointmentUpdated(booking, `מצב ההגעה עודכן ל${formatArrivalStatus(booking.arrival_status)}`);
  await saveState();
  rerenderAll();
});

businessForm.addEventListener("click", async (event) => {
  const colorButton = event.target.closest("[data-theme-color]");
  if (colorButton) {
    selectThemeColor(colorButton.dataset.themeColor);
    return;
  }

  const clearButton = event.target.closest("[data-clear-image]");
  if (!clearButton) {
    return;
  }

  if (clearButton.dataset.clearImage === "cover") {
    state.business.cover_image = "";
  }

  if (clearButton.dataset.clearImage === "profile") {
    state.business.profile_image = "";
  }

  clearButton.disabled = true;
  const saved = await saveState();
  rerenderAll();
  clearButton.disabled = false;
  if (saved) appUi.toast("התמונה הוסרה ונשמרה.", { variant: "success" });
});

businessForm.addEventListener("input", (event) => {
  const target = event.target;
  if (target instanceof HTMLInputElement && target.name === "themeAccent") {
    selectThemeColor(target.value);
  }
});

businessForm.addEventListener("change", async (event) => {
  const target = event.target;
  if (target instanceof HTMLInputElement && target.name.startsWith("feature")) {
    renderBusinessFeatureEditorState();
    return;
  }

  if (!(target instanceof HTMLInputElement) || target.type !== "file") {
    return;
  }

  const file = target.files?.[0];
  if (!file) {
    return;
  }

  try {
    const imageDataUrl = await readFileAsDataUrl(file);

    if (target.name === "coverImageFile") {
      ownerCoverPreview.style.backgroundImage = `linear-gradient(rgba(110, 70, 118, 0.18), rgba(110, 70, 118, 0.18)), ${cssImageUrl(imageDataUrl)}`;
    }

    if (target.name === "profileImageFile") {
      ownerAvatarPreview.style.backgroundImage = cssImageUrl(imageDataUrl);
    }
  } catch (error) {
    appUi.toast(error?.message || "לא הצלחנו לקרוא את קובץ התמונה. נסי לבחור קובץ אחר.", { variant: "error" });
  }
});

businessForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitButton = event.submitter instanceof HTMLButtonElement ? event.submitter : null;

  const ownerEmail = String(businessForm.elements.ownerEmail?.value || "").trim().toLowerCase();
  if (!ownerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail)) {
    appUi.toast("הכניסי כתובת אימייל תקינה לקבלת התראות.", { variant: "error" });
    return;
  }

  let coverImage = state.business.cover_image;
  let profileImage = state.business.profile_image;

  try {
    coverImage = await resolveBusinessImage({
      currentValue: state.business.cover_image,
      file: businessForm.elements.coverImageFile.files?.[0]
    });

    profileImage = await resolveBusinessImage({
      currentValue: state.business.profile_image,
      file: businessForm.elements.profileImageFile.files?.[0]
    });
  } catch (error) {
    appUi.toast(error?.message || "לא הצלחנו לשמור את התמונות. נסי שוב עם קובץ אחר.", { variant: "error" });
    return;
  }

  if (submitButton) submitButton.disabled = true;
  try {
    state.business = {
      ...state.business,
      name: String(businessForm.elements.name.value).trim(),
      description: String(businessForm.elements.description.value).trim(),
      address: String(businessForm.elements.address.value).trim(),
      phone: String(businessForm.elements.phone.value).trim(),
      owner_email: String(businessForm.elements.ownerEmail.value).trim().toLowerCase(),
      instagram_url: normalizeSocialUrl(businessForm.elements.instagramUrl.value),
      preparation_message: String(businessForm.elements.preparationMessage.value).trim(),
      features: getBusinessFeaturesFromForm(),
      cover_image: coverImage,
      profile_image: profileImage
    };
    const saved = await saveState();
    rerenderAll();
    if (saved) {
      appUi.toast("פרטי העסק נשמרו ויסתנכרנו עם השרת.", { variant: "success" });
      await refreshOwnerEmailStatus();
    }
  } finally {
    if (submitButton) submitButton.disabled = false;
  }
});

sellerCredentialsForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitButton = event.submitter instanceof HTMLButtonElement
    ? event.submitter
    : sellerCredentialsForm.querySelector('button[type="submit"]');
  if (submitButton?.disabled) return;
  const username = String(sellerCredentialsForm.elements.username.value).trim();
  const password = String(sellerCredentialsForm.elements.password.value);

  if (!username) {
    appUi.toast("שם משתמש לא יכול להיות ריק.", { variant: "error" });
    return;
  }

  if (!password.trim()) {
    appUi.toast("לא הוזנה סיסמה חדשה, ולכן אין מה לשמור.", { variant: "warning" });
    return;
  }

  if (submitButton) submitButton.disabled = true;
  try {
    if (supabaseEnabled && ownerSession.authUserId) {
      if (username !== OWNER_LOGIN_NAME) {
        appUi.toast(`שם המשתמש לניהול נשאר ${OWNER_LOGIN_NAME}. אפשר לשנות כאן רק סיסמה.`, { variant: "warning" });
        sellerCredentialsForm.elements.username.value = OWNER_LOGIN_NAME;
        return;
      }
      await supabaseApi.updateOwnerCredentials({ password });
    } else if (!supabaseEnabled) {
      throw new Error("לא ניתן לשמור סיסמה בלי חיבור מאובטח לשרת.");
    }
    state.sellerCredentials.username = OWNER_LOGIN_NAME;
    sellerCredentialsForm.elements.password.value = "";
    rerenderAll();
    appUi.toast("הסיסמה החדשה נשמרה בחשבון הניהול המאובטח.", { variant: "success" });
  } catch (error) {
    appUi.toast(error?.message || "לא הצלחנו לעדכן את פרטי ההתחברות.", { variant: "error" });
  } finally {
    if (submitButton) submitButton.disabled = false;
  }
});

addServiceButton.addEventListener("click", async () => {
  if (addServiceButton.disabled) return;
  addServiceButton.disabled = true;
  state.services.push({
    id: createAppUuid(),
    category: "קטגוריה ראשית",
    name: "שירות חדש",
    price: 0,
    duration_minutes: 30
  });
  await saveState();
  rerenderAll();
  addServiceButton.disabled = false;
});

servicesEditor.addEventListener("click", async (event) => {
  const target = event.target.closest(".remove-service-button");
  if (!target) {
    return;
  }

  const row = target.closest("[data-service-id]");
  if (!row) {
    return;
  }

  const serviceId = row.dataset.serviceId;
  target.disabled = true;
  const deleted = await deleteRemoteOwnerRow("services", serviceId);
  if (!deleted) {
    target.disabled = false;
    return;
  }
  state.services = state.services.filter((service) => service.id !== serviceId);
  lastConfirmedOwnerState = structuredClone(state);
  rerenderAll();
});

servicesForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitButton = event.submitter instanceof HTMLButtonElement ? event.submitter : null;
  if (submitButton?.disabled) return;
  state.services = Array.from(servicesEditor.querySelectorAll("[data-service-id]")).map((row) => ({
    id: row.dataset.serviceId,
    name: String(row.querySelector('[data-service-field="name"]').value).trim(),
    category: String(row.querySelector('[data-service-field="category"]').value).trim(),
    price: Number(row.querySelector('[data-service-field="price"]').value),
    duration_minutes: Number(row.querySelector('[data-service-field="duration_minutes"]').value)
  }));
  if (submitButton) submitButton.disabled = true;
  const saved = await saveState();
  rerenderAll();
  if (submitButton) submitButton.disabled = false;
  if (saved) {
    appUi.toast("השירותים נשמרו.", { variant: "success" });
  }
});

hoursEditor.addEventListener("click", async (event) => {
  const modeButton = event.target.closest("[data-working-days-mode]");
  if (modeButton) {
    if (modeButton.disabled) return;
    modeButton.disabled = true;
    setWorkingDaysMode(modeButton.dataset.workingDaysMode);
    await saveState();
    rerenderAll();
    return;
  }

  const button = event.target.closest("[data-hour-toggle]");
  if (!button) {
    return;
  }

  const row = state.workingHours.find((item) => item.id === button.dataset.hourToggle);
  if (!row) {
    return;
  }

  button.disabled = true;
  row.is_closed = !row.is_closed;
  if (!row.is_closed) {
    row.opens_at ||= "10:00";
    row.closes_at ||= "18:00";
  }

  await saveState();
  rerenderAll();
});

hoursForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitButton = event.submitter instanceof HTMLButtonElement ? event.submitter : null;
  if (submitButton?.disabled) return;
  state.workingHours = Array.from(hoursEditor.querySelectorAll("[data-hour-id]")).map((row, index) => {
    const opensAt = String(row.querySelector('[data-hour-field="opens_at"]').value).trim();
    const closesAt = String(row.querySelector('[data-hour-field="closes_at"]').value).trim();
    const explicitlyClosed = row.dataset.dayClosed === "true";

    return {
      id: row.dataset.hourId,
      day_of_week: index,
      day_label: String(row.querySelector('[data-hour-field="day_label"]').value).trim(),
      opens_at: opensAt || null,
      closes_at: closesAt || null,
      slot_interval_minutes: Number(row.querySelector('[data-hour-field="slot_interval_minutes"]').value || 30),
      is_closed: explicitlyClosed || !opensAt || !closesAt
    };
  });
  if (submitButton) submitButton.disabled = true;
  const saved = await saveState();
  rerenderAll();
  if (submitButton) submitButton.disabled = false;
  if (saved) {
    appUi.toast("שעות העבודה נשמרו.", { variant: "success" });
  }
});

async function initializeOwnerPage() {
  if (isPasswordRecoveryUrl()) {
    showOwnerRecovery();
  } else {
    showOwnerLogin();
  }

  if (supabaseEnabled) {
    supabaseApi.onAuthStateChange(async (event, session) => {
      if (event === "INITIAL_SESSION") {
        return;
      }
      if (event === "PASSWORD_RECOVERY") {
        ownerSession.authUserId = session?.user?.id || null;
        showOwnerRecovery();
        return;
      }

      if (!session?.user) {
        ownerSession.authUserId = null;
        clearOwnerRealtimeSubscriptions();
        showOwnerLogin();
        return;
      }

      ownerSession.authUserId = session.user.id;
      if (!(await supabaseApi.isOwnerUser())) {
        clearOwnerRealtimeSubscriptions();
        setOwnerAccessMessage("החשבון המחובר אינו מורשה לנהל את העסק הזה.", true);
        showOwnerLogin();
        return;
      }

      try {
        await refreshOwnerStateFromSupabase();
        setupOwnerRealtimeSubscriptions();
        showOwnerLayout();
      } catch (error) {
        clearOwnerRealtimeSubscriptions();
        setOwnerAccessMessage(appUi.translateMessage?.(error?.message) || "לא הצלחנו לטעון את נתוני הניהול מהשרת.", true);
        showOwnerLogin();
      }
    });
  }

  if (!supabaseEnabled) {
    setOwnerAccessMessage("לא הצלחנו לטעון את החיבור המאובטח לניהול. נסו לרענן את הדף בעוד רגע.", true);
    showOwnerLogin();
    return;
  }

  if (isPasswordRecoveryUrl()) {
    return;
  }

  const currentUser = await supabaseApi.getCurrentUser();
  if (!currentUser) {
    return;
  }

  ownerSession.authUserId = currentUser.id;
  if (!(await supabaseApi.isOwnerUser())) {
    setOwnerAccessMessage("החשבון המחובר אינו מורשה לנהל את העסק הזה.", true);
    return;
  }

  await ensureOwnerSupabaseBootstrap();
  try {
    await refreshOwnerStateFromSupabase();
    setupOwnerRealtimeSubscriptions();
    showOwnerLayout();
  } catch (error) {
    clearOwnerRealtimeSubscriptions();
    setOwnerAccessMessage(appUi.translateMessage?.(error?.message) || "לא הצלחנו לטעון את נתוני הניהול מהשרת.", true);
    showOwnerLogin();
  }
}

void initializeOwnerPage()
  .catch((error) => {
    clearOwnerRealtimeSubscriptions();
    setOwnerAccessMessage(appUi.translateMessage?.(error?.message) || "לא הצלחנו לבדוק את הרשאת הניהול.", true);
    showOwnerLogin();
  })
  .finally(() => {
    document.documentElement.classList.remove("app-booting");
  });


