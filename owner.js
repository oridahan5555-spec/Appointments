const LOCAL_STORAGE_KEY = "booking_app_local_working_v2";
const SELLER_SESSION_KEY = "booking_app_seller_session_v1";
const CUSTOMER_SESSION_KEY = "booking_app_customer_session_v1";
const REJECT_UNDO_WINDOW_MS = 5000;
const ARRIVAL_STATUS_OPTIONS = ["waiting", "arrived", "finished", "no_show"];
const BUSINESS_FEATURE_FIELDS = {
  businessDescription: "featureBusinessDescription",
  preparationMessage: "featurePreparationMessage",
  socialLink: "featureSocialLink",
  whatsapp: "featureWhatsapp",
  phone: "featurePhone",
  waze: "featureWaze",
  calendarExport: "featureCalendarExport",
  customerRescheduling: "featureCustomerRescheduling"
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
      customerRescheduling: true
    }
  },
  sellerCredentials: {
    username: "admin",
    password: "1234"
  },
  services: [
    { id: "service-1", category: "קטגוריה ראשית", name: "שירות לדוגמה 1", price: 150, duration: 60 },
    { id: "service-2", category: "קטגוריה ראשית", name: "שירות לדוגמה 2", price: 220, duration: 90 },
    { id: "service-3", category: "קטגוריה נוספת", name: "שירות לדוגמה 3", price: 80, duration: 30 }
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

const ownerBrandName = document.getElementById("ownerBrandName");
const ownerBrandDescription = document.getElementById("ownerBrandDescription");
const ownerLoginGate = document.getElementById("ownerLoginGate");
const ownerLayout = document.getElementById("ownerLayout");
const ownerLoginForm = document.getElementById("ownerLoginForm");
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
const ownerCustomerSearch = document.getElementById("ownerCustomerSearch");
const ownerCustomersList = document.getElementById("ownerCustomersList");

const businessForm = document.getElementById("businessForm");
const sellerCredentialsForm = document.getElementById("sellerCredentialsForm");
const servicesForm = document.getElementById("servicesForm");
const servicesEditor = document.getElementById("servicesEditor");
const addServiceButton = document.getElementById("addServiceButton");
const hoursForm = document.getElementById("hoursForm");
const hoursEditor = document.getElementById("hoursEditor");
const specialHoursForm = document.getElementById("specialHoursForm");
const specialHoursList = document.getElementById("specialHoursList");
const blockedSlotsForm = document.getElementById("blockedSlotsForm");
const blockedSlotsList = document.getElementById("blockedSlotsList");
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
  browser: true
});

const appUi = window.AppUi || {
  toast: (message) => console.warn(message),
  confirm: async () => true
};

function loadState() {
  const defaults = structuredClone(DEFAULT_DATA);

  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY) || localStorage.getItem("booking_app_local_working_v1");
    if (!raw) {
      return defaults;
    }

    const parsed = JSON.parse(raw);
    const loadedState = {
      business: normalizeBusiness({ ...defaults.business, ...(parsed.business || {}) }),
      sellerCredentials: {
        ...defaults.sellerCredentials,
        ...(parsed.sellerCredentials || {})
      },
      services: Array.isArray(parsed.services) && parsed.services.length ? parsed.services : defaults.services,
      staff: Array.isArray(parsed.staff) && parsed.staff.length ? parsed.staff : defaults.staff,
      workingHours: Array.isArray(parsed.workingHours) && parsed.workingHours.length ? parsed.workingHours : defaults.workingHours,
      specialHours: normalizeSpecialHours(parsed.specialHours),
      blockedSlots: normalizeBlockedSlots(parsed.blockedSlots),
      bookings: Array.isArray(parsed.bookings) ? parsed.bookings : [],
      notifications: normalizeNotifications(parsed.notifications),
      users: Array.isArray(parsed.users) ? parsed.users : [],
      customerNotes: normalizeCustomerNotes(parsed.customerNotes)
    };

    loadedState.staff = normalizeStaff(loadedState.staff);
    loadedState.bookings = normalizeBookings(loadedState.bookings, loadedState.staff, loadedState.services);
    loadedState.users = normalizeUsers(loadedState.users);
    return loadedState;
  } catch (error) {
    return defaults;
  }
}

function saveState() {
  localStorage.setItem(
    LOCAL_STORAGE_KEY,
    JSON.stringify({
      business: state.business,
      sellerCredentials: state.sellerCredentials,
      services: state.services,
      staff: state.staff,
      workingHours: state.workingHours,
      specialHours: state.specialHours,
      blockedSlots: state.blockedSlots,
      bookings: state.bookings,
      notifications: state.notifications,
      users: state.users,
      customerNotes: state.customerNotes
    })
  );
}

function rememberSellerSession() {
  localStorage.setItem(SELLER_SESSION_KEY, "1");
}

function clearRememberedSellerSession() {
  localStorage.removeItem(SELLER_SESSION_KEY);
  sessionStorage.removeItem(SELLER_SESSION_KEY);
}

function clearRememberedSessions() {
  clearRememberedSellerSession();
  localStorage.removeItem(CUSTOMER_SESSION_KEY);
}

function isSellerRemembered() {
  return localStorage.getItem(SELLER_SESSION_KEY) === "1" || sessionStorage.getItem(SELLER_SESSION_KEY) === "1";
}

function resetStateToDefaultTemplate() {
  const freshState = structuredClone(DEFAULT_DATA);

  state.business = normalizeBusiness(freshState.business);
  state.sellerCredentials = { ...freshState.sellerCredentials };
  state.services = freshState.services.map((service) => ({ ...service }));
  state.staff = normalizeStaff();
  state.workingHours = freshState.workingHours.map((item) => ({ ...item }));
  state.specialHours = [];
  state.blockedSlots = [];
  state.bookings = [];
  state.notifications = [];
  state.users = [];
  state.customerNotes = [];

  uiState.sellerCalendarDate = todayDate();
  uiState.sellerCalendarMonthKey = monthKey(new Date());
  uiState.specialHoursDate = todayDate();
  uiState.blockedSlotDate = todayDate();
  uiState.ownerBookingsFilter = "all";
  uiState.ownerCustomerSearch = "";
  uiState.calendarChoiceBookingId = null;

  clearRejectUndo(false);
  saveState();
}

function normalizeBusiness(business) {
  const normalized = { ...business };

  if (!normalized.name || normalized.name === "שם העסק") {
    normalized.name = DEFAULT_DATA.business.name;
  }

  if (!normalized.description || normalized.description === "תיאור קצר של העסק." || normalized.description === "מניקור, ג'ל ובנייה באווירה נקייה, רגועה ומדויקת.") {
    normalized.description = DEFAULT_DATA.business.description;
  }

  if (!normalized.address || normalized.address === "כתובת העסק" || normalized.address === "נחל צלמון 12") {
    normalized.address = DEFAULT_DATA.business.address;
  }

  if (!normalized.phone || normalized.phone === "058-560-9500") {
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

function normalizeStaff() {
  return [{ ...DEFAULT_OWNER_STAFF }];
}

function normalizeUsers(users) {
  if (!Array.isArray(users)) {
    return [];
  }

  return users
    .map((user) => ({
      firstName: String(user?.firstName || "").trim(),
      lastName: String(user?.lastName || "").trim(),
      phone: String(user?.phone || "").trim(),
      password: String(user?.password || ""),
      owner_note: String(user?.owner_note || "").trim()
    }))
    .filter((user) => normalizePhoneNumber(user.phone));
}

function normalizeBookings(bookings, staff, services) {
  const fallbackStaff = staff[0] || DEFAULT_OWNER_STAFF;

  return bookings.map((booking) => {
    const service = services.find((item) => item.id === booking.service_id);
    const assignedStaff = staff.find((member) => member.id === booking.staff_id) || fallbackStaff;

    return {
      ...booking,
      duration_minutes: Number(booking.duration_minutes || service?.duration || 30),
      arrival_status: normalizeArrivalStatus(booking.arrival_status, booking.status),
      staff_id: assignedStaff.id,
      staff_name: assignedStaff.name
    };
  });
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
      read: Boolean(notification?.read ?? notification?.is_read),
      user_id: String(notification?.user_id || notification?.userId || "").trim(),
      type: String(notification?.type || "general").trim()
    }))
    .filter((notification) => notification.user_id && notification.title)
    .sort((left, right) => String(right.created_at).localeCompare(String(left.created_at)));
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

function normalizeSocialUrl(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed || trimmed === "https://instagram.com") {
    return "";
  }
  return trimmed;
}

function localDateValue(date) {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().split("T")[0];
}

function todayDate() {
  return localDateValue(new Date());
}

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthDateFromKey(key) {
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month - 1, 1);
}

function normalizePhoneNumber(value) {
  return String(value || "").replace(/[^\d+]/g, "");
}

function isSamePhone(left, right) {
  return normalizePhoneNumber(left) === normalizePhoneNumber(right);
}

function getCustomerNotificationUserId(phone) {
  const normalizedPhone = normalizePhoneNumber(phone);
  return normalizedPhone ? `customer:${normalizedPhone}` : "";
}

function getBookingCustomerNotificationUserId(booking) {
  return getCustomerNotificationUserId(booking?.customer_phone);
}

function isOwnerNotificationActive() {
  return Boolean(ownerLayout && !ownerLayout.classList.contains("is-hidden"));
}

function getCurrentNotificationUserId() {
  return isOwnerNotificationActive() ? "owner" : "";
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

function pushAppNotification(userId, title, message, type, config = {}) {
  if (!userId || !notificationCenter) {
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

function notifyOwnerAppointmentCancelled(booking, actorText = "בעל העסק") {
  pushAppNotification(
    "owner",
    "תור בוטל",
    `${actorText} ביטל את התור של ${getBookingCustomerName(booking)} ל${booking.service_name} בתאריך ${getBookingDateTimeText(booking)}.`,
    "appointment_cancelled"
  );
}

function notifyOwnerAppointmentRescheduled(booking, previousBooking = null) {
  const previousText = previousBooking ? ` במקום ${getBookingDateTimeText(previousBooking)}` : "";
  pushAppNotification(
    "owner",
    "תור הוזז",
    `התור של ${getBookingCustomerName(booking)} עודכן ל${getBookingDateTimeText(booking)}${previousText}.`,
    "appointment_rescheduled"
  );
}

function notifyOwnerAppointmentUpdated(booking, updateText) {
  pushAppNotification(
    "owner",
    "תור עודכן",
    `${updateText}: ${getBookingCustomerName(booking)}, ${booking.service_name}, ${getBookingDateTimeText(booking)}.`,
    "appointment_updated"
  );
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

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildCustomerFullName(firstName, lastName) {
  return [String(firstName || "").trim(), String(lastName || "").trim()].filter(Boolean).join(" ").trim();
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
    id: existingNote?.id || `customer-note-${Date.now()}`,
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

function readFileAsDataUrl(file) {
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

function parseTimeToMinutes(value) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function formatMinutesToTime(totalMinutes) {
  const hours = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
  const minutes = String(totalMinutes % 60).padStart(2, "0");
  return `${hours}:${minutes}`;
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

function getBookingEndTime(booking) {
  const startMinutes = parseTimeToMinutes(String(booking.booking_time).slice(0, 5));
  return formatMinutesToTime(startMinutes + Number(booking.duration_minutes || 30));
}

function escapeIcsText(value) {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function buildCalendarFileName(booking) {
  const businessPart = String(state.business.name || "booking")
    .trim()
    .replace(/[<>:"/\\|?*]+/g, "")
    .replace(/\s+/g, "-");

  return `${businessPart || "booking"}-${booking.booking_date}-${String(booking.booking_time).replace(":", "-")}.ics`;
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

function buildArrivalStatusOptions(selectedStatus) {
  const safeStatus = normalizeArrivalStatus(selectedStatus, "approved") || "waiting";

  return ARRIVAL_STATUS_OPTIONS.map((status) => `
    <option value="${status}" ${status === safeStatus ? "selected" : ""}>${formatArrivalStatus(status)}</option>
  `).join("");
}

function formatDisplayDate(dateValue) {
  return new Date(`${dateValue}T00:00:00`).toLocaleDateString("he-IL", {
    weekday: "long",
    day: "numeric",
    month: "long"
  });
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

function openCalendarChoiceModal(bookingId) {
  uiState.calendarChoiceBookingId = bookingId;
  calendarChoiceModal.classList.remove("is-hidden");
}

function closeCalendarChoice() {
  uiState.calendarChoiceBookingId = null;
  calendarChoiceModal.classList.add("is-hidden");
}

function findBookingById(bookingId) {
  return state.bookings.find((booking) => booking.id === bookingId) || null;
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

function startRejectUndo(bookingId, previousStatus) {
  clearRejectUndo(false);
  uiState.rejectUndoBookingId = bookingId;
  uiState.rejectUndoPreviousStatus = previousStatus;
  uiState.rejectUndoTimeoutId = setTimeout(() => {
    clearRejectUndo(true);
  }, REJECT_UNDO_WINDOW_MS);
}

function isRejectUndoActiveForBooking(bookingId) {
  return uiState.rejectUndoBookingId === bookingId;
}

function getPendingBookings() {
  return state.bookings.filter((booking) => booking.status === "pending");
}

function findRegularWorkingHoursForDate(dateValue) {
  const dayOfWeek = new Date(`${dateValue}T00:00:00`).getDay();
  return state.workingHours.find((entry) => Number(entry.day_of_week) === dayOfWeek) || null;
}

function findSpecialHoursForDate(dateValue) {
  return state.specialHours.find((entry) => entry.special_date === dateValue) || null;
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

function isSlotBlocked(dateValue, timeValue) {
  return state.blockedSlots.some((slot) => slot.blocked_date === dateValue && slot.blocked_time === timeValue);
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

function renderHeader() {
  ownerBrandName.textContent = state.business.name;
  ownerBrandDescription.textContent = state.business.description || "ניהול העסק";
}

function renderBusinessImagePreviews() {
  ownerCoverPreview.style.backgroundImage = state.business.cover_image
    ? `linear-gradient(rgba(110, 70, 118, 0.18), rgba(110, 70, 118, 0.18)), url("${state.business.cover_image}")`
    : "";

  ownerAvatarPreview.style.backgroundImage = state.business.profile_image
    ? `url("${state.business.profile_image}")`
    : "";
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
      note: customer.note || getCustomerNoteText(customer.phone)
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
          <span class="status-pill status-special">${customer.bookingsCount} תורים</span>
        </div>
        <div class="booking-meta">
          <span>${escapeHtml(customer.phone)}</span>
          <span>${customer.lastBooking ? `${formatDisplayDate(customer.lastBooking.booking_date)} בשעה ${customer.lastBooking.booking_time}` : "עדיין אין תורים"}</span>
          <span>${customer.lastBooking ? escapeHtml(customer.lastBooking.service_name) : "לקוחה חדשה"}</span>
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
        ${specialDay.note ? `<div class="booking-note">הערה: ${specialDay.note}</div>` : ""}
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
        ${slot.note ? `<div class="booking-note">סיבה: ${slot.note}</div>` : ""}
        <div class="booking-card-actions">
          <button class="ghost-button unblock-slot-button" type="button" data-blocked-slot-id="${slot.id}">הסרת חסימה</button>
        </div>
      </article>
    `)
    .join("");

  const bookingCards = dailyBookings
    .map((booking) => `
      <article class="booking-card status-card-${booking.status}">
        <div class="booking-card-head">
          <strong>${booking.booking_time}</strong>
          <div class="booking-card-badges">
            <span class="status-pill status-${booking.status}">${formatStatus(booking.status)}</span>
            ${booking.status === "approved" ? `<span class="status-pill arrival-pill arrival-${booking.arrival_status}">${formatArrivalStatus(booking.arrival_status)}</span>` : ""}
          </div>
        </div>
        <div class="booking-meta">
          <span>${booking.customer_first_name} ${booking.customer_last_name}</span>
          <span>${booking.service_name}</span>
          <span>${booking.staff_name}</span>
        </div>
        ${getCustomerNoteMarkup(booking.customer_phone)}
        ${booking.notes ? `<div class="booking-note">הערה: ${booking.notes}</div>` : ""}
        ${
          booking.status === "approved"
            ? `
              <label class="arrival-status-field">
                <span>מצב הגעה</span>
                <select class="arrival-status-select" data-booking-id="${booking.id}">
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
                <button class="ghost-button calendar-choice-button" type="button" data-booking-id="${booking.id}">הוספה ליומן</button>
                <button class="danger-button seller-cancel-booking-button" type="button" data-booking-id="${booking.id}">ביטול תור</button>
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
      <article class="booking-card status-card-${booking.status}">
        <div class="booking-card-head">
          <strong>${booking.customer_first_name} ${booking.customer_last_name}</strong>
          <div class="booking-card-badges">
            <span class="status-pill status-${booking.status}">${formatStatus(booking.status)}</span>
            ${booking.status === "approved" ? `<span class="status-pill arrival-pill arrival-${booking.arrival_status}">${formatArrivalStatus(booking.arrival_status)}</span>` : ""}
          </div>
        </div>
        <div class="booking-meta">
          <span>${booking.service_name}</span>
          <span>${formatDisplayDate(booking.booking_date)}</span>
          <span>${booking.booking_time}</span>
          <span>${booking.staff_name}</span>
        </div>
        ${getCustomerNoteMarkup(booking.customer_phone)}
        ${booking.notes ? `<div class="booking-note">הערה: ${booking.notes}</div>` : ""}
        ${
          booking.status === "approved"
            ? `
              <label class="arrival-status-field">
                <span>מצב הגעה</span>
                <select class="arrival-status-select" data-booking-id="${booking.id}">
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
                <button class="primary-button approve-booking-button" type="button" data-booking-id="${booking.id}">אישור תור</button>
                <button class="danger-button reject-booking-button" type="button" data-booking-id="${booking.id}">דחיית תור</button>
                <button class="ghost-button calendar-choice-button" type="button" data-booking-id="${booking.id}">הוספה ליומן</button>
                <button class="danger-button seller-cancel-booking-button" type="button" data-booking-id="${booking.id}">ביטול תור</button>
              </div>
            `
            : booking.status === "approved"
              ? `
                <div class="seller-actions">
                  <button class="ghost-button calendar-choice-button" type="button" data-booking-id="${booking.id}">הוספה ליומן</button>
                  <button class="danger-button seller-cancel-booking-button" type="button" data-booking-id="${booking.id}">ביטול תור</button>
                </div>
              `
              : ""
        }
        ${
          booking.status === "rejected" && isRejectUndoActiveForBooking(booking.id)
            ? `
              <div class="undo-strip">
                <span>התור נדחה. אפשר לבטל את הדחייה במשך כמה שניות.</span>
                <button class="ghost-button undo-reject-button" type="button" data-booking-id="${booking.id}">ביטול דחייה</button>
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
  businessForm.elements.instagramUrl.value = normalizeSocialUrl(state.business.instagram_url);
  businessForm.elements.preparationMessage.value = state.business.preparation_message || "";
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
      <div class="editor-row" data-service-id="${service.id}">
        <input type="text" value="${service.name}" data-service-field="name">
        <input type="text" value="${service.category}" data-service-field="category">
        <input type="number" min="0" value="${service.price}" data-service-field="price">
        <input type="number" min="5" step="5" value="${service.duration}" data-service-field="duration">
        <button class="danger-button remove-service-button" type="button">מחיקה</button>
      </div>
    `)
    .join("");

  hoursEditor.innerHTML = `
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
        <div class="editor-row editor-row-hours" data-hour-id="${row.id}">
          <input type="text" value="${row.day_label}" placeholder="יום" data-hour-field="day_label">
          <input type="text" value="${row.opens_at || ""}" placeholder="10:00" data-hour-field="opens_at">
          <input type="text" value="${row.closes_at || ""}" placeholder="18:00" data-hour-field="closes_at">
          <input type="number" min="5" step="5" value="${row.slot_interval_minutes || 30}" data-hour-field="slot_interval_minutes">
          <button class="ghost-button toggle-hour-button ${row.is_closed ? "is-closed" : "is-open"}" type="button" data-hour-toggle="${row.id}">
            ${row.is_closed ? "היום סגור" : "היום פתוח"}
          </button>
        </div>
      `)
      .join("")}
  `;
}

function getBusinessFeaturesFromForm() {
  return Object.fromEntries(
    Object.entries(BUSINESS_FEATURE_FIELDS).map(([featureName, fieldName]) => [
      featureName,
      Boolean(businessForm.elements[fieldName].checked)
    ])
  );
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
  specialHoursForm.elements.specialOpen.disabled = isClosed;
  specialHoursForm.elements.specialClose.disabled = isClosed;
  specialHoursForm.elements.specialInterval.disabled = isClosed;
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

  if (!state.specialHours.length) {
    specialHoursList.innerHTML = '<div class="notice-box">עדיין אין שעות מיוחדות. ברגע שתשמרי תאריך מיוחד, הוא יופיע כאן.</div>';
    return;
  }

  specialHoursList.innerHTML = [...state.specialHours]
    .sort((left, right) => left.special_date.localeCompare(right.special_date))
    .map((item) => `
      <article class="booking-card status-card-special">
        <div class="booking-card-head">
          <strong>${formatDisplayDate(item.special_date)}</strong>
          <span class="status-pill status-special">${item.is_closed ? "יום סגור מיוחד" : "שעות מיוחדות"}</span>
        </div>
        <div class="booking-meta">
          <span>${item.is_closed ? "לא ניתן לקבוע תורים ביום הזה" : `${item.opens_at} - ${item.closes_at}`}</span>
          <span>${item.is_closed ? "היום הזה סגור באופן מיוחד" : `כל ${item.slot_interval_minutes} דקות`}</span>
        </div>
        ${item.note ? `<div class="booking-note">הערה: ${item.note}</div>` : ""}
        <div class="booking-card-actions">
          <button class="ghost-button edit-special-hours-button" type="button" data-special-date="${item.special_date}">עריכה</button>
          <button class="danger-button remove-special-hours-button" type="button" data-special-id="${item.id}">הסרה</button>
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
          ${slot.note ? `<div class="booking-note">סיבה: ${slot.note}</div>` : ""}
          <div class="booking-card-actions">
            <button class="ghost-button unblock-slot-button" type="button" data-blocked-slot-id="${slot.id}">הסרת חסימה</button>
          </div>
        </article>
      `;
    })
    .join("");
}

function rerenderAll() {
  renderHeader();
  renderOwnerStats();
  renderOwnerTips();
  renderSellerCalendar();
  renderSellerBookings();
  renderOwnerCustomers();
  renderEditors();
  renderSpecialHoursManager();
  renderBlockedSlotsManager();
  notificationCenter?.render();
}

function syncStateFromStorage() {
  const freshState = loadState();
  Object.assign(state, freshState);
  rerenderAll();
  notificationCenter?.showNewBrowserNotifications();
}

function showOwnerLayout() {
  ownerLogoutButton.classList.remove("is-hidden");
  ownerLoginGate.classList.add("is-hidden");
  ownerLayout.classList.remove("is-hidden");
  notificationCenter?.rememberCurrentNotifications();
  notificationCenter?.askAfterOwnerLogin();
  rerenderAll();
}

function showOwnerLogin() {
  ownerLogoutButton.classList.add("is-hidden");
  ownerLayout.classList.add("is-hidden");
  ownerLoginGate.classList.remove("is-hidden");
  notificationCenter?.render();
}

ownerLoginForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(ownerLoginForm);
  const username = String(formData.get("username")).trim();
  const password = String(formData.get("password"));

  if (username !== state.sellerCredentials.username) {
    appUi.toast("שם המשתמש לא טוב.", { variant: "error" });
    return;
  }

  if (password !== state.sellerCredentials.password) {
    appUi.toast("הסיסמה לא טובה.", { variant: "error" });
    return;
  }

  rememberSellerSession();
  sessionStorage.setItem(SELLER_SESSION_KEY, "1");
  showOwnerLayout();
});

ownerLogoutButton.addEventListener("click", () => {
  clearRejectUndo(false);
  closeCalendarChoice();
  clearRememberedSellerSession();
  window.location.href = "index.html";
});

resetBusinessTemplateButton.addEventListener("click", async () => {
  const shouldReset = await appUi.confirm(
    "האיפוס ימחק את כל הנתונים השמורים במערכת, כולל תורים, לקוחות, שירותים ותמונות. להמשיך?",
    { title: "איפוס מערכת" }
  );

  if (!shouldReset) {
    return;
  }

  resetStateToDefaultTemplate();
  closeCalendarChoice();
  clearRememberedSessions();
  ownerLoginForm.reset();
  showOwnerLogin();
  renderHeader();
  appUi.toast("האיפוס הושלם. פרטי הכניסה הזמניים הם: admin / 1234", { variant: "success", title: "האיפוס הושלם" });
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
    state.blockedSlots = state.blockedSlots.filter((slot) => slot.id !== target.dataset.blockedSlotId);
    saveState();
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
  saveState();
  rerenderAll();
});

sellerCalendarList.addEventListener("change", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLSelectElement) || !target.classList.contains("arrival-status-select")) {
    return;
  }

  const booking = findBookingById(target.dataset.bookingId);
  if (!booking || booking.status !== "approved") {
    return;
  }

  booking.arrival_status = normalizeArrivalStatus(target.value, "approved");
  notifyOwnerAppointmentUpdated(booking, `עודכן מצב הגעה ל${formatArrivalStatus(booking.arrival_status)}`);
  notifyCustomerAppointmentUpdated(booking, `מצב ההגעה עודכן ל${formatArrivalStatus(booking.arrival_status)}`);
  saveState();
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

specialHoursForm.elements.specialClosed.addEventListener("change", () => {
  setSpecialHoursClosedState();
});

specialHoursForm.addEventListener("submit", (event) => {
  event.preventDefault();

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

  state.specialHours = normalizeSpecialHours([
    ...state.specialHours.filter((item) => item.special_date !== specialDate),
    {
      id: `special-hours-${Date.now()}`,
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
  saveState();
  rerenderAll();
});

specialHoursList.addEventListener("click", (event) => {
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

  state.specialHours = state.specialHours.filter((item) => item.id !== removeButton.dataset.specialId);
  saveState();
  rerenderAll();
});

blockedSlotsForm.addEventListener("submit", (event) => {
  event.preventDefault();

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
    id: `blocked-slot-${Date.now()}`,
    blocked_date: blockedDate,
    blocked_time: blockedTime,
    note
  });

  state.blockedSlots = normalizeBlockedSlots(state.blockedSlots);
  uiState.blockedSlotDate = blockedDate;
  uiState.sellerCalendarDate = blockedDate;
  uiState.sellerCalendarMonthKey = monthKey(new Date(`${blockedDate}T00:00:00`));
  blockedSlotsForm.reset();
  saveState();
  rerenderAll();
});

blockedSlotsList.addEventListener("click", (event) => {
  const target = event.target.closest(".unblock-slot-button");
  if (!target) {
    return;
  }

  state.blockedSlots = state.blockedSlots.filter((slot) => slot.id !== target.dataset.blockedSlotId);
  saveState();
  rerenderAll();
});

ownerCustomersList.addEventListener("click", (event) => {
  const saveButton = event.target.closest(".save-customer-note-button");
  const clearButton = event.target.closest(".clear-customer-note-button");

  if (!saveButton && !clearButton) {
    return;
  }

  const actionButton = saveButton || clearButton;
  const customerPhone = actionButton?.dataset.customerPhone || "";
  const customerCard = actionButton?.closest(".owner-customer-card");
  const noteField = customerCard?.querySelector(".owner-note-input");
  const customerName = noteField?.dataset.customerName || "";

  if (clearButton) {
    saveCustomerNote(customerPhone, customerName, "");
    saveState();
    rerenderAll();
    return;
  }

  if (!noteField) {
    return;
  }

  saveCustomerNote(customerPhone, customerName, noteField.value);
  saveState();
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
    saveState();
    rerenderAll();
    return;
  }

  if (target.classList.contains("undo-reject-button")) {
    booking.status = uiState.rejectUndoPreviousStatus || "pending";
    saveState();
    clearRejectUndo(false);
    rerenderAll();
    return;
  }

  if (target.classList.contains("approve-booking-button")) {
    clearRejectUndo(false);
    booking.status = "approved";
    booking.arrival_status = normalizeArrivalStatus(booking.arrival_status, "approved");
    const previousBooking = finalizeApprovedChangeRequest(booking);
    if (previousBooking) {
      notifyOwnerAppointmentRescheduled(booking, previousBooking);
      notifyCustomerAppointmentChanged(booking, previousBooking);
    } else {
      notifyOwnerAppointmentUpdated(booking, "אושר תור");
      notifyCustomerAppointmentUpdated(booking, "התור שלך אושר");
    }
  }

  if (target.classList.contains("reject-booking-button")) {
    const previousStatus = booking.status;
    booking.status = "rejected";
    booking.arrival_status = null;
    startRejectUndo(booking.id, previousStatus);
    notifyOwnerAppointmentUpdated(booking, "נדחה תור");
    notifyCustomerAppointmentUpdated(booking, "התור שלך נדחה");
  }

  saveState();
  rerenderAll();
});

sellerBookingsList.addEventListener("change", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLSelectElement) || !target.classList.contains("arrival-status-select")) {
    return;
  }

  const booking = findBookingById(target.dataset.bookingId);
  if (!booking || booking.status !== "approved") {
    return;
  }

  booking.arrival_status = normalizeArrivalStatus(target.value, "approved");
  notifyOwnerAppointmentUpdated(booking, `עודכן מצב הגעה ל${formatArrivalStatus(booking.arrival_status)}`);
  notifyCustomerAppointmentUpdated(booking, `מצב ההגעה עודכן ל${formatArrivalStatus(booking.arrival_status)}`);
  saveState();
  rerenderAll();
});

businessForm.addEventListener("click", (event) => {
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

  saveState();
  rerenderAll();
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
      ownerCoverPreview.style.backgroundImage = `linear-gradient(rgba(110, 70, 118, 0.18), rgba(110, 70, 118, 0.18)), url("${imageDataUrl}")`;
    }

    if (target.name === "profileImageFile") {
      ownerAvatarPreview.style.backgroundImage = `url("${imageDataUrl}")`;
    }
  } catch (error) {
    appUi.toast("לא הצלחנו לקרוא את קובץ התמונה. נסי לבחור קובץ אחר.", { variant: "error" });
  }
});

businessForm.addEventListener("submit", async (event) => {
  event.preventDefault();

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
    appUi.toast("לא הצלחנו לשמור את התמונות. נסי שוב עם קובץ אחר.", { variant: "error" });
    return;
  }

  state.business = {
    ...state.business,
    name: String(businessForm.elements.name.value).trim(),
    description: String(businessForm.elements.description.value).trim(),
    address: String(businessForm.elements.address.value).trim(),
    phone: String(businessForm.elements.phone.value).trim(),
    instagram_url: normalizeSocialUrl(businessForm.elements.instagramUrl.value),
    preparation_message: String(businessForm.elements.preparationMessage.value).trim(),
    features: getBusinessFeaturesFromForm(),
    cover_image: coverImage,
    profile_image: profileImage
  };
  saveState();
  rerenderAll();
});

sellerCredentialsForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const username = String(sellerCredentialsForm.elements.username.value).trim();
  const password = String(sellerCredentialsForm.elements.password.value);

  if (!username) {
    appUi.toast("שם משתמש לא יכול להיות ריק.", { variant: "error" });
    return;
  }

  state.sellerCredentials.username = username;
  if (password.trim()) {
    state.sellerCredentials.password = password;
  }

  saveState();
  sellerCredentialsForm.elements.password.value = "";
  rerenderAll();
});

addServiceButton.addEventListener("click", () => {
  state.services.push({
    id: `service-${Date.now()}`,
    category: "קטגוריה ראשית",
    name: "שירות חדש",
    price: 0,
    duration: 30
  });
  saveState();
  rerenderAll();
});

servicesEditor.addEventListener("click", (event) => {
  const target = event.target.closest(".remove-service-button");
  if (!target) {
    return;
  }

  const row = target.closest("[data-service-id]");
  if (!row) {
    return;
  }

  const serviceId = row.dataset.serviceId;
  state.services = state.services.filter((service) => service.id !== serviceId);
  saveState();
  rerenderAll();
});

servicesForm.addEventListener("submit", (event) => {
  event.preventDefault();
  state.services = Array.from(servicesEditor.querySelectorAll("[data-service-id]")).map((row) => ({
    id: row.dataset.serviceId,
    name: String(row.querySelector('[data-service-field="name"]').value).trim(),
    category: String(row.querySelector('[data-service-field="category"]').value).trim(),
    price: Number(row.querySelector('[data-service-field="price"]').value),
    duration: Number(row.querySelector('[data-service-field="duration"]').value)
  }));
  saveState();
  rerenderAll();
});

hoursEditor.addEventListener("click", (event) => {
  const button = event.target.closest("[data-hour-toggle]");
  if (!button) {
    return;
  }

  const row = state.workingHours.find((item) => item.id === button.dataset.hourToggle);
  if (!row) {
    return;
  }

  row.is_closed = !row.is_closed;
  if (row.is_closed) {
    row.opens_at = null;
    row.closes_at = null;
  } else {
    row.opens_at ||= "10:00";
    row.closes_at ||= "18:00";
  }

  saveState();
  rerenderAll();
});

hoursForm.addEventListener("submit", (event) => {
  event.preventDefault();
  state.workingHours = Array.from(hoursEditor.querySelectorAll("[data-hour-id]")).map((row, index) => {
    const opensAt = String(row.querySelector('[data-hour-field="opens_at"]').value).trim();
    const closesAt = String(row.querySelector('[data-hour-field="closes_at"]').value).trim();

    return {
      id: row.dataset.hourId,
      day_of_week: index,
      day_label: String(row.querySelector('[data-hour-field="day_label"]').value).trim(),
      opens_at: opensAt || null,
      closes_at: closesAt || null,
      slot_interval_minutes: Number(row.querySelector('[data-hour-field="slot_interval_minutes"]').value || 30),
      is_closed: !opensAt || !closesAt
    };
  });
  saveState();
  rerenderAll();
});

window.addEventListener("storage", (event) => {
  if (event.key === LOCAL_STORAGE_KEY) {
    syncStateFromStorage();
  }
});

if (isSellerRemembered()) {
  rememberSellerSession();
  sessionStorage.setItem(SELLER_SESSION_KEY, "1");
  showOwnerLayout();
} else {
  showOwnerLogin();
}
