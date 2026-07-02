const LOCAL_STORAGE_KEY = "booking_app_local_working_v2";
const SELLER_SESSION_KEY = "booking_app_seller_session_v1";
const CUSTOMER_SESSION_KEY = "booking_app_customer_session_v1";
const REJECT_UNDO_WINDOW_MS = 5000;
const ARRIVAL_STATUS_OPTIONS = ["waiting", "arrived", "finished", "no_show"];
const supabaseApi = window.AppSupabase || null;
const supabaseEnabled = Boolean(supabaseApi?.isConfigured?.());
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
      attendanceConfirmation: true
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
  waitlistEntries: [],
  bookings: [],
  notifications: [],
  users: [],
  customerNotes: []
};

const state = loadState();

const uiState = {
  wizardStep: 1,
  scheduleMode: "firstAvailable",
  selectedServiceId: null,
  selectedServiceIds: [],
  selectedStaffId: DEFAULT_OWNER_STAFF.id,
  selectedDate: "",
  selectedTime: "",
  selectedMonthKey: monthKey(new Date()),
  customerBookingsView: "active",
  sellerCalendarDate: todayDate(),
  sellerCalendarMonthKey: monthKey(new Date()),
  isBookingSubmitting: false,
  replacementBookingId: null,
  rejectUndoBookingId: null,
  rejectUndoPreviousStatus: null,
  rejectUndoTimeoutId: null,
  calendarChoiceBookingId: null,
  bookingDraft: {
    fullName: "",
    phone: "",
    notes: ""
  }
};

const session = {
  role: null,
  customerPhone: null,
  authUserId: null
};

const brandName = document.getElementById("brandName");
const businessCoverImage = document.getElementById("businessCoverImage");
const businessAvatar = document.getElementById("businessAvatar");
const businessName = document.getElementById("businessName");
const businessDescription = document.getElementById("businessDescription");
const businessAddress = document.getElementById("businessAddress");
const businessPhoneText = document.getElementById("businessPhoneText");
const whatsAppLink = document.getElementById("whatsAppLink");
const phoneLink = document.getElementById("phoneLink");
const socialLink = document.getElementById("socialLink");
const wazeLink = document.getElementById("wazeLink");
const contactRow = document.querySelector(".contact-row");

const wizardSteps = document.querySelectorAll("[data-step-indicator]");
const servicesStep = document.getElementById("servicesStep");
const staffStep = document.getElementById("staffStep");
const scheduleStep = document.getElementById("scheduleStep");
const detailsStep = document.getElementById("detailsStep");
const servicesCategories = document.getElementById("servicesCategories");
const staffCards = document.getElementById("staffCards");
const selectedSummary = document.getElementById("selectedSummary");
const calendarMonthLabel = document.getElementById("calendarMonthLabel");
const calendarGrid = document.getElementById("calendarGrid");
const scheduleModeSwitch = document.getElementById("scheduleModeSwitch");
const firstAvailablePanel = document.getElementById("firstAvailablePanel");
const calendarModePanel = document.getElementById("calendarModePanel");
const firstAvailableList = document.getElementById("firstAvailableList");
const calendarPrevButton = document.getElementById("calendarPrevButton");
const calendarNextButton = document.getElementById("calendarNextButton");
const timeGroups = document.getElementById("timeGroups");
const emptyTimesState = document.getElementById("emptyTimesState");
const waitlistPrompt = document.getElementById("waitlistPrompt");
const joinWaitlistButton = document.getElementById("joinWaitlistButton");
const todayAvailabilityText = document.getElementById("todayAvailabilityText");
const todaySlotsList = document.getElementById("todaySlotsList");
const bookingSummaryCard = document.getElementById("bookingSummaryCard");
const detailsNotice = document.getElementById("detailsNotice");
const bookingSuccessPanel = document.getElementById("bookingSuccessPanel");
const bookingSuccessTitle = document.getElementById("bookingSuccessTitle");
const bookingSuccessText = document.getElementById("bookingSuccessText");
const bookingPreparationMessage = document.getElementById("bookingPreparationMessage");
const bookingSuccessSummary = document.getElementById("bookingSuccessSummary");
const bookingSuccessCalendarButton = document.getElementById("bookingSuccessCalendarButton");
const bookingSubmitButton = document.getElementById("bookingSubmitButton");
const changeModeBanner = document.getElementById("changeModeBanner");
const changeModeText = document.getElementById("changeModeText");
const cancelChangeModeButton = document.getElementById("cancelChangeModeButton");
const bookingForm = document.getElementById("bookingForm");
const customerBookingsPanel = document.getElementById("customerBookingsPanel");
const customerBookingsFilters = document.getElementById("customerBookingsFilters");
const customerBookingCountBadges = document.querySelectorAll("[data-booking-count]");
const myBookingsList = document.getElementById("myBookingsList");
const sellerPanel = document.getElementById("sellerPanel");
const sellerCalendarPrevButton = document.getElementById("sellerCalendarPrevButton");
const sellerCalendarNextButton = document.getElementById("sellerCalendarNextButton");
const sellerCalendarMonthLabel = document.getElementById("sellerCalendarMonthLabel");
const sellerCalendarGrid = document.getElementById("sellerCalendarGrid");
const sellerCalendarList = document.getElementById("sellerCalendarList");
const sellerBookingsList = document.getElementById("sellerBookingsList");

const openCustomerLogin = document.getElementById("openCustomerLogin");
const openSellerLogin = document.getElementById("openSellerLogin");
const logoutButton = document.getElementById("logoutButton");
const returnToOwnerButton = document.getElementById("returnToOwnerButton");
const sellerSiteLogoutButton = document.getElementById("sellerSiteLogoutButton");
const authModal = document.getElementById("authModal");
const closeModal = document.getElementById("closeModal");
const modalTabs = document.querySelectorAll(".modal-tab");
const customerLoginForm = document.getElementById("customerLoginForm");
const sellerLoginForm = document.getElementById("sellerLoginForm");
const calendarChoiceModal = document.getElementById("calendarChoiceModal");
const closeCalendarChoiceModal = document.getElementById("closeCalendarChoiceModal");
const deviceCalendarButton = document.getElementById("deviceCalendarButton");
const googleCalendarButton = document.getElementById("googleCalendarButton");
const cancelCalendarChoiceButton = document.getElementById("cancelCalendarChoiceButton");

const goToStaffStep = document.getElementById("goToStaffStep");
const goToScheduleStep = document.getElementById("goToScheduleStep");
const goToDetailsStep = document.getElementById("goToDetailsStep");
const backToServicesStep = document.getElementById("backToServicesStep");
const backToStaffStep = document.getElementById("backToStaffStep");
const backToScheduleStep = document.getElementById("backToScheduleStep");

const businessForm = document.getElementById("businessForm");
const sellerCredentialsForm = document.getElementById("sellerCredentialsForm");
const servicesForm = document.getElementById("servicesForm");
const servicesEditor = document.getElementById("servicesEditor");
const addServiceButton = document.getElementById("addServiceButton");
const hoursForm = document.getElementById("hoursForm");
const hoursEditor = document.getElementById("hoursEditor");

const notificationCenter = window.AppNotifications?.create({
  mount: document.querySelector(".topbar-actions"),
  getNotifications: () => state.notifications,
  setNotifications: (notifications) => {
    state.notifications = normalizeNotifications(notifications);
  },
  save: saveState,
  getUserId: getCurrentNotificationUserId,
  onMarkAsRead: (notificationId) => supabaseEnabled ? supabaseApi.markNotificationRead(notificationId) : true,
  onMarkAllAsRead: (userId) => supabaseEnabled ? supabaseApi.markAllNotificationsRead(userId) : true,
  onDeleteNotification: (notificationId) => supabaseEnabled ? supabaseApi.deleteNotification(notificationId) : true,
  onCreateNotification: (notification) => supabaseEnabled ? supabaseApi.createNotification(notification) : notification,
  onError: (error) => appUi.toast(error?.message || "לא הצלחנו לעדכן את ההתראה.", { variant: "error" }),
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
      waitlistEntries: normalizeWaitlistEntries(parsed.waitlistEntries),
      bookings: Array.isArray(parsed.bookings) ? parsed.bookings : [],
      notifications: normalizeNotifications(parsed.notifications),
      users: normalizeUsers(parsed.users),
      customerNotes: normalizeCustomerNotes(parsed.customerNotes)
    };

    loadedState.bookings = normalizeBookings(loadedState.bookings, loadedState.staff, loadedState.services);
    loadedState.staff = normalizeStaff(loadedState.staff);
    return loadedState;
  } catch (error) {
    return defaults;
  }
}

function saveState() {
  const currentCustomerPhone = normalizePhoneNumber(session.customerPhone);
  const savedUsers = currentCustomerPhone
    ? state.users.filter((user) => isSamePhone(user.phone, currentCustomerPhone))
    : [];
  const savedBookings = currentCustomerPhone
    ? state.bookings.filter((booking) => isSamePhone(booking.customer_phone, currentCustomerPhone))
    : [];
  const savedNotifications = currentCustomerPhone
    ? state.notifications.filter((notification) => String(notification.user_id || "") === String(session.authUserId || getCurrentNotificationUserId()))
    : [];
  const savedWaitlistEntries = currentCustomerPhone
    ? state.waitlistEntries.filter((entry) => isSamePhone(entry.customer_phone, currentCustomerPhone))
    : [];

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
      waitlistEntries: savedWaitlistEntries,
      bookings: savedBookings,
      notifications: savedNotifications,
      users: savedUsers,
      customerNotes: state.customerNotes
    })
  );
}

let publicRealtimeCleanups = [];
let personalRealtimeCleanups = [];

function clearRealtimeSubscriptions(collection) {
  collection.forEach((cleanup) => {
    try {
      cleanup?.();
    } catch (error) {
      console.warn(error);
    }
  });
  collection.length = 0;
}

async function syncSessionFromSupabase() {
  if (!supabaseEnabled) {
    return;
  }

  const user = await supabaseApi.getCurrentUser();
  if (!user) {
    session.role = null;
    session.customerPhone = null;
    session.authUserId = null;
    return;
  }

  session.authUserId = user.id;
  if (await supabaseApi.isOwnerUser()) {
    session.role = "seller";
    return;
  }

  session.role = "customer";
}

function mergePublicState(publicState) {
  if (publicState.business) {
    state.business = normalizeBusiness(publicState.business);
  }

  state.services = Array.isArray(publicState.services) && publicState.services.length ? publicState.services : state.services;
  state.workingHours = Array.isArray(publicState.workingHours) && publicState.workingHours.length ? publicState.workingHours : state.workingHours;
  state.specialHours = normalizeSpecialHours(publicState.specialHours);
  state.blockedSlots = normalizeBlockedSlots(publicState.blockedSlots);
  state.bookings = normalizeBookings(publicState.bookings || [], state.staff, state.services);
}

function mergeCustomerState(customerState) {
  const ownBookings = normalizeBookings(customerState.bookings || [], state.staff, state.services);
  const bookingMap = new Map(ownBookings.map((booking) => [booking.id, booking]));
  state.bookings.forEach((booking) => {
    if (!bookingMap.has(booking.id)) {
      bookingMap.set(booking.id, booking);
    }
  });
  state.bookings = [...bookingMap.values()];

  if (customerState.customer) {
    session.customerPhone = normalizePhoneNumber(customerState.customer.phone);
    const otherUsers = state.users.filter((user) => !isSamePhone(user.phone, customerState.customer.phone));
    state.users = normalizeUsers([customerState.customer, ...otherUsers]);
  }

  state.notifications = normalizeNotifications(customerState.notifications || []);
  state.waitlistEntries = normalizeWaitlistEntries(customerState.waitlistEntries || []);
}

async function refreshStateFromSupabase() {
  if (!supabaseEnabled) {
    return;
  }

  await syncSessionFromSupabase();
  const publicState = await supabaseApi.loadPublicState();
  mergePublicState(publicState);

  if (session.role === "customer") {
    const customerState = await supabaseApi.loadCustomerState();
    mergeCustomerState(customerState);
  } else {
    state.notifications = [];
    state.waitlistEntries = [];
  }

  saveState();
  rerenderAll();
  notificationCenter?.showNewBrowserNotifications();
}

function setupPublicRealtimeSubscriptions() {
  if (!supabaseEnabled) {
    return;
  }

  clearRealtimeSubscriptions(publicRealtimeCleanups);
  ["business", "services", "working_hours", "special_hours", "blocked_slots", "bookings"].forEach((table) => {
    publicRealtimeCleanups.push(supabaseApi.subscribe(table, () => {
      void refreshStateFromSupabase();
    }));
  });
}

function setupPersonalRealtimeSubscriptions() {
  if (!supabaseEnabled) {
    return;
  }

  clearRealtimeSubscriptions(personalRealtimeCleanups);
  if (!session.authUserId) {
    return;
  }

  personalRealtimeCleanups.push(supabaseApi.subscribe("bookings", () => {
    void refreshStateFromSupabase();
  }, `customer_auth_user_id=eq.${session.authUserId}`));
  personalRealtimeCleanups.push(supabaseApi.subscribe("notifications", () => {
    void refreshStateFromSupabase();
  }, `user_id=eq.${session.authUserId}`));
  personalRealtimeCleanups.push(supabaseApi.subscribe("waitlist_entries", () => {
    void refreshStateFromSupabase();
  }, `customer_auth_user_id=eq.${session.authUserId}`));
}

function rememberCustomerSession(phone) {
  localStorage.setItem(
    CUSTOMER_SESSION_KEY,
    JSON.stringify({
      phone: normalizePhoneNumber(phone)
    })
  );
}

function clearRememberedCustomerSession() {
  localStorage.removeItem(CUSTOMER_SESSION_KEY);
}

function rememberSellerSession() {
  localStorage.setItem(SELLER_SESSION_KEY, "1");
}

function clearRememberedSellerSession() {
  localStorage.removeItem(SELLER_SESSION_KEY);
  sessionStorage.removeItem(SELLER_SESSION_KEY);
}

function isSellerRemembered() {
  return localStorage.getItem(SELLER_SESSION_KEY) === "1" || sessionStorage.getItem(SELLER_SESSION_KEY) === "1";
}

function restoreRememberedCustomerSession() {
  try {
    const raw = localStorage.getItem(CUSTOMER_SESSION_KEY);
    if (!raw) {
      return;
    }

    const parsed = JSON.parse(raw);
    const rememberedPhone = normalizePhoneNumber(parsed?.phone);
    if (!rememberedPhone) {
      clearRememberedCustomerSession();
      return;
    }

    const existingUser = state.users.find((user) => isSamePhone(user.phone, rememberedPhone));
    if (!existingUser) {
      clearRememberedCustomerSession();
      return;
    }

    session.role = "customer";
    session.customerPhone = rememberedPhone;
  } catch (error) {
    clearRememberedCustomerSession();
  }
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

function normalizeStaff(staff) {
  return [{ ...DEFAULT_OWNER_STAFF }];
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
      service_ids: normalizedServiceIds,
      service_names: normalizedServiceNames,
      service_name: String(booking.service_name || normalizedServiceNames.join(" + ") || service?.name || "").trim(),
      duration_minutes: Number(booking.duration_minutes || service?.duration || 30),
      arrival_status: normalizeArrivalStatus(booking.arrival_status, booking.status),
      hidden_for_customer: Boolean(booking.hidden_for_customer),
      attendance_confirmation_requested_at: String(booking.attendance_confirmation_requested_at || ""),
      attendance_confirmation_status: normalizeAttendanceConfirmationStatus(booking.attendance_confirmation_status),
      attendance_confirmation_answered_at: String(booking.attendance_confirmation_answered_at || ""),
      staff_id: assignedStaff.id,
      staff_name: assignedStaff.name
    };
  });
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
  const matchedUser = state.users.find((user) => isSamePhone(user.phone, phone) && user.auth_user_id);
  if (matchedUser?.auth_user_id) {
    return matchedUser.auth_user_id;
  }

  const normalizedPhone = normalizePhoneNumber(phone);
  return normalizedPhone ? `customer:${normalizedPhone}` : "";
}

function getBookingCustomerNotificationUserId(booking) {
  return getCustomerNotificationUserId(booking?.customer_phone);
}

function getCurrentNotificationUserId() {
  if (session.role === "seller" && session.authUserId) {
    return session.authUserId;
  }

  if (session.role === "customer" && session.authUserId) {
    return session.authUserId;
  }

  return "";
}

function getBookingCustomerName(booking) {
  return [booking?.customer_first_name, booking?.customer_last_name].filter(Boolean).join(" ").trim() || "לקוחה";
}

function getOwnerNotificationTargetId() {
  return session.authUserId || "owner";
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

function notifyOwnerAppointmentBooked(booking) {
  pushAppNotification(
    getOwnerNotificationTargetId(),
    "נקבע תור חדש",
    `${getBookingCustomerName(booking)} קבעה תור ל${booking.service_name} בתאריך ${getBookingDateTimeText(booking)}.`,
    "appointment_booked"
  );
}

function notifyOwnerAppointmentCancelled(booking, actorText = "הלקוחה") {
  pushAppNotification(
    getOwnerNotificationTargetId(),
    "תור בוטל",
    `${actorText} ביטלה את התור של ${getBookingCustomerName(booking)} ל${booking.service_name} בתאריך ${getBookingDateTimeText(booking)}.`,
    "appointment_cancelled"
  );
}

function notifyOwnerAppointmentRescheduled(booking, previousBooking = null) {
  const previousText = previousBooking ? ` במקום ${getBookingDateTimeText(previousBooking)}` : "";
  pushAppNotification(
    getOwnerNotificationTargetId(),
    "בקשת שינוי תור",
    `${getBookingCustomerName(booking)} ביקשה להעביר את התור ל${getBookingDateTimeText(booking)}${previousText}.`,
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

function notifyCustomerAppointmentCancelledByOwner(booking) {
  pushAppNotification(
    getBookingCustomerNotificationUserId(booking),
    "התור בוטל על ידי העסק",
    `התור שלך ל${booking.service_name} בתאריך ${getBookingDateTimeText(booking)} בוטל על ידי בעל העסק.`,
    "appointment_cancelled"
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
    dateChanged || timeChanged ? "appointment_rescheduled" : "appointment_updated"
  );
}

function notifyCustomerAppointmentUpdated(booking, updateText) {
  pushAppNotification(
    getBookingCustomerNotificationUserId(booking),
    "התור עודכן",
    `${updateText}: ${booking.service_name}, ${getBookingDateTimeText(booking)}.`,
    "appointment_updated"
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
    "appointment_updated"
  );
}

function notifyCustomerAttendanceConfirmation(booking) {
  pushAppNotification(
    getBookingCustomerNotificationUserId(booking),
    "אישור הגעה לתור",
    `מחר יש לך תור ל${booking.service_name} ב${getBookingDateTimeText(booking)}. נשמח לדעת אם את מגיעה.`,
    "appointment_updated"
  );
}

function buildCustomerFullName(firstName, lastName) {
  return [String(firstName || "").trim(), String(lastName || "").trim()]
    .filter(Boolean)
    .join(" ")
    .trim();
}

function normalizeSocialUrl(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed || trimmed === "https://instagram.com") {
    return "";
  }
  return trimmed;
}

function getSocialNetworkLabel(value) {
  try {
    const hostname = new URL(value).hostname.toLowerCase().replace(/^www\./, "");
    if (hostname.includes("instagram.com")) return "אינסטגרם";
    if (hostname.includes("facebook.com") || hostname === "fb.com") return "פייסבוק";
    if (hostname.includes("tiktok.com")) return "טיקטוק";
    if (hostname.includes("youtube.com") || hostname === "youtu.be") return "יוטיוב";
    if (hostname === "x.com" || hostname.includes("twitter.com")) return "X";
    if (hostname.includes("linkedin.com")) return "LinkedIn";
  } catch (error) {
    return "רשת חברתית";
  }

  return "רשת חברתית";
}

function isBusinessFeatureEnabled(featureName) {
  return state.business.features?.[featureName] !== false;
}

function formatPrice(price) {
  return `₪${Number(price)}`;
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

function normalizeAttendanceConfirmationStatus(value) {
  const normalized = String(value || "").trim();
  if (["pending", "confirmed", "declined"].includes(normalized)) {
    return normalized;
  }

  return "";
}

function formatAttendanceConfirmationStatus(status) {
  if (status === "confirmed") {
    return "אישרה הגעה";
  }
  if (status === "declined") {
    return "סימנה שלא תגיע";
  }
  if (status === "pending") {
    return "ממתין לאישור הגעה";
  }
  return "";
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

function buildBookingDateTime(dateValue, timeValue) {
  const safeTime = String(timeValue || "00:00").slice(0, 5);
  return new Date(`${dateValue}T${safeTime}:00`);
}

function getBookingEndDateTime(booking) {
  const startDateTime = buildBookingDateTime(booking.booking_date, booking.booking_time);
  if (Number.isNaN(startDateTime.getTime())) {
    return null;
  }

  return new Date(startDateTime.getTime() + Number(booking.duration_minutes || 30) * 60000);
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

function getReplacementSourceBooking() {
  if (!uiState.replacementBookingId) {
    return null;
  }

  return findBookingById(uiState.replacementBookingId);
}

function findPendingChangeRequestForBooking(bookingId) {
  return state.bookings.find((booking) => booking.replaces_booking_id === bookingId && booking.status === "pending") || null;
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

function clearReplacementBooking() {
  uiState.replacementBookingId = null;
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

function getSelectedService() {
  return getSelectedServices()[0] || null;
}

function getSelectedServiceIds() {
  const selectedIds = Array.isArray(uiState.selectedServiceIds) ? uiState.selectedServiceIds : [];
  const normalizedIds = selectedIds
    .map((serviceId) => String(serviceId || "").trim())
    .filter((serviceId, index, array) => serviceId && array.indexOf(serviceId) === index);

  if (normalizedIds.length) {
    return normalizedIds;
  }

  return uiState.selectedServiceId ? [String(uiState.selectedServiceId).trim()] : [];
}

function syncSelectedServiceState(nextIds = getSelectedServiceIds()) {
  uiState.selectedServiceIds = [...nextIds];
  uiState.selectedServiceId = nextIds[0] || null;
}

function getSelectedServices() {
  const selectedIds = getSelectedServiceIds();
  return selectedIds
    .map((serviceId) => state.services.find((service) => service.id === serviceId) || null)
    .filter(Boolean);
}

function buildServiceBundle(services) {
  if (!services.length) {
    return null;
  }

  const names = services.map((service) => service.name);
  const ids = services.map((service) => service.id);

  return {
    ids,
    names,
    name: names.join(" + "),
    price: services.reduce((sum, service) => sum + Number(service.price || 0), 0),
    duration: services.reduce((sum, service) => sum + Number(service.duration || 0), 0),
    primaryServiceId: ids[0],
    primaryServiceName: names[0]
  };
}

function getSelectedServiceBundle() {
  return buildServiceBundle(getSelectedServices());
}

function resolveServiceBundle(selection = null) {
  if (!selection) {
    return getSelectedServiceBundle();
  }

  if (typeof selection === "string") {
    const service = state.services.find((item) => item.id === selection);
    return service ? buildServiceBundle([service]) : null;
  }

  if (Array.isArray(selection)) {
    const services = selection
      .map((serviceId) => state.services.find((item) => item.id === serviceId) || null)
      .filter(Boolean);
    return buildServiceBundle(services);
  }

  return buildServiceBundle(
    Array.isArray(selection.services) ? selection.services.filter(Boolean) : []
  );
}

function getSelectedStaff() {
  return state.staff.find((staff) => staff.id === uiState.selectedStaffId) || state.staff[0];
}

function getRealStaffMembers() {
  return state.staff.filter((staff) => !staff.is_anyone);
}

function getCurrentCustomer() {
  if (!session.customerPhone) {
    return null;
  }
  return state.users.find((user) => isSamePhone(user.phone, session.customerPhone)) || null;
}

function getCustomerRecordByPhone(phone) {
  const normalizedPhone = normalizePhoneNumber(phone);
  if (!normalizedPhone) {
    return null;
  }

  return state.users.find((user) => isSamePhone(user.phone, normalizedPhone)) || null;
}

function isCustomerBlocked(phone = session.customerPhone) {
  return Boolean(getCustomerRecordByPhone(phone)?.is_blocked);
}

function getSelectedWaitlistEntry() {
  const selectedIds = getSelectedServiceIds();
  if (selectedIds.length !== 1 || !uiState.selectedDate) {
    return null;
  }

  return state.waitlistEntries.find((entry) =>
    entry.status === "waiting" &&
    entry.booking_date === uiState.selectedDate &&
    entry.service_id === selectedIds[0] &&
    isSamePhone(entry.customer_phone, session.customerPhone)
  ) || null;
}

function getCustomerBookingsForSession() {
  if (!session.customerPhone) {
    return [];
  }

  return state.bookings.filter(
    (booking) => isSamePhone(booking.customer_phone, session.customerPhone) && !booking.hidden_for_customer
  );
}

function getCustomerBookingBucket(booking) {
  if (["cancelled", "rejected"].includes(booking.status)) {
    return "cancelled";
  }

  if (booking.arrival_status === "no_show") {
    return "cancelled";
  }

  if (booking.arrival_status === "finished") {
    return "completed";
  }

  if (booking.status === "approved") {
    const bookingEndDateTime = getBookingEndDateTime(booking);
    if (bookingEndDateTime && bookingEndDateTime.getTime() < Date.now()) {
      return "completed";
    }
  }

  return "active";
}

function getCustomerBookingPresentation(booking) {
  const bucket = getCustomerBookingBucket(booking);
  if (bucket === "completed") {
    return {
      bucket,
      statusClass: "completed",
      statusLabel: "הושלם"
    };
  }

  if (bucket === "cancelled" && booking.arrival_status === "no_show") {
    return {
      bucket,
      statusClass: "cancelled",
      statusLabel: "לא הגיעה"
    };
  }

  return {
    bucket,
    statusClass: booking.status,
    statusLabel: formatStatus(booking.status)
  };
}

function getCustomerEmptyMessage(viewName) {
  if (viewName === "completed") {
    return "עדיין אין תורים שהושלמו.";
  }

  if (viewName === "cancelled") {
    return "עדיין אין תורים שבוטלו או נדחו.";
  }

  return "כרגע אין תורים פעילים.";
}

function updateCustomerBookingsFilterUi(groupedBookings) {
  if (!customerBookingsFilters) {
    return;
  }

  const counts = {
    active: groupedBookings.active.length,
    completed: groupedBookings.completed.length,
    cancelled: groupedBookings.cancelled.length
  };

  customerBookingsFilters.querySelectorAll("[data-booking-view]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.bookingView === uiState.customerBookingsView);
  });

  customerBookingCountBadges.forEach((badge) => {
    const key = badge.dataset.bookingCount;
    badge.textContent = String(counts[key] || 0);
  });
}

function parseFullName(fullName) {
  const parts = String(fullName || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) {
    return { firstName: "", lastName: "" };
  }
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: "" };
  }
  return {
    firstName: parts.shift(),
    lastName: parts.join(" ")
  };
}

function hideBookingSuccess() {
  bookingSuccessPanel.classList.add("is-hidden");
  bookingSuccessTitle.textContent = "ההזמנה נשלחה בהצלחה";
  bookingSuccessText.textContent = "הבקשה נשמרה ומחכה לאישור של בעלת העסק.";
  bookingPreparationMessage.textContent = "";
  bookingPreparationMessage.classList.add("is-hidden");
  bookingSuccessSummary.innerHTML = "";
  bookingSuccessCalendarButton.classList.add("is-hidden");
  delete bookingSuccessCalendarButton.dataset.bookingId;
}

function showBookingSuccess(booking) {
  const isChangeRequest = Boolean(booking.replaces_booking_id);
  bookingSuccessSummary.innerHTML = `
    <div class="summary-row"><span>${booking.service_ids?.length > 1 ? "שירותים" : "שירות"}</span><strong>${booking.service_name}</strong></div>
    <div class="summary-row"><span>אשת צוות</span><strong>${booking.staff_name}</strong></div>
    <div class="summary-row"><span>תאריך</span><strong>${formatDisplayDate(booking.booking_date)}</strong></div>
    <div class="summary-row"><span>שעה</span><strong>${booking.booking_time}</strong></div>
    <div class="summary-row"><span>משך כולל</span><strong>${booking.duration_minutes} דקות</strong></div>
  `;
  bookingSuccessTitle.textContent = isChangeRequest ? "בקשת שינוי התור נשלחה" : "ההזמנה נשלחה בהצלחה";
  bookingSuccessText.textContent = isChangeRequest
    ? "בקשת השינוי נשמרה. התור הישן נשאר שמור עד שבעלת העסק תאשר את התור החדש."
    : "הבקשה נשמרה ומחכה לאישור של בעלת העסק.";
  if (isBusinessFeatureEnabled("preparationMessage") && state.business.preparation_message) {
    bookingPreparationMessage.textContent = state.business.preparation_message;
    bookingPreparationMessage.classList.remove("is-hidden");
  } else {
    bookingPreparationMessage.textContent = "";
    bookingPreparationMessage.classList.add("is-hidden");
  }
  bookingSuccessCalendarButton.dataset.bookingId = booking.id;
  bookingSuccessCalendarButton.classList.toggle("is-hidden", !isBusinessFeatureEnabled("calendarExport"));
  bookingSuccessPanel.classList.remove("is-hidden");
}

function renderChangeModeBanner() {
  const sourceBooking = getReplacementSourceBooking();

  if (!sourceBooking || !["pending", "approved"].includes(sourceBooking.status)) {
    changeModeBanner.classList.add("is-hidden");
    changeModeText.textContent = "כאן משנים תור קיים בלי לאבד את התור הישן עד לאישור.";
    return;
  }

  changeModeText.textContent = `משנים עכשיו את התור הקיים של ${formatDisplayDate(sourceBooking.booking_date)} בשעה ${sourceBooking.booking_time}. התור הישן נשאר שמור עד לאישור התור החדש.`;
  changeModeBanner.classList.remove("is-hidden");
}

function updateContactLinks() {
  const phoneNumber = (state.business.phone || "").replace(/[^0-9+]/g, "");
  const socialUrl = normalizeSocialUrl(state.business.instagram_url);
  const showWhatsapp = isBusinessFeatureEnabled("whatsapp") && Boolean(phoneNumber);
  const showPhone = isBusinessFeatureEnabled("phone") && Boolean(phoneNumber);
  const showWaze = isBusinessFeatureEnabled("waze") && Boolean(state.business.address);
  const showSocial = isBusinessFeatureEnabled("socialLink") && Boolean(socialUrl);

  whatsAppLink.classList.toggle("is-hidden", !showWhatsapp);
  phoneLink.classList.toggle("is-hidden", !showPhone);
  wazeLink.classList.toggle("is-hidden", !showWaze);
  if (showWhatsapp) whatsAppLink.href = `https://wa.me/${phoneNumber}`;
  else whatsAppLink.removeAttribute("href");
  if (showPhone) phoneLink.href = `tel:${phoneNumber}`;
  else phoneLink.removeAttribute("href");
  if (showWaze) wazeLink.href = `https://waze.com/ul?q=${encodeURIComponent(state.business.address || "")}`;
  else wazeLink.removeAttribute("href");

  socialLink.classList.toggle("is-hidden", !showSocial);
  if (showSocial) {
    const socialLabel = getSocialNetworkLabel(socialUrl);
    socialLink.href = socialUrl;
    socialLink.target = "_blank";
    socialLink.rel = "noreferrer";
    socialLink.setAttribute("aria-label", socialLabel);
    socialLink.title = socialLabel;
  } else {
    socialLink.removeAttribute("href");
    socialLink.removeAttribute("target");
    socialLink.removeAttribute("rel");
    socialLink.setAttribute("aria-label", "רשת חברתית");
    socialLink.title = "רשת חברתית";
  }
  contactRow.classList.toggle("is-hidden", !showWhatsapp && !showPhone && !showWaze && !showSocial);
}

function applyBusinessImages() {
  const coverImage = String(state.business.cover_image || "").trim();
  const profileImage = String(state.business.profile_image || "").trim();

  businessCoverImage.style.backgroundImage = coverImage
    ? `linear-gradient(rgba(110, 70, 118, 0.18), rgba(110, 70, 118, 0.18)), url("${coverImage}")`
    : "";

  businessAvatar.style.backgroundImage = profileImage
    ? `url("${profileImage}")`
    : "";
}

function renderBusiness() {
  brandName.textContent = state.business.name;
  businessName.textContent = state.business.name;
  businessDescription.textContent = state.business.description;
  businessDescription.classList.toggle("is-hidden", !isBusinessFeatureEnabled("businessDescription"));
  businessAddress.textContent = state.business.address;
  businessPhoneText.textContent = state.business.phone;
  businessPhoneText.classList.toggle("is-hidden", !state.business.phone);
  updateContactLinks();
  applyBusinessImages();
}

function renderWizardSteps() {
  wizardSteps.forEach((step) => {
    const stepNumber = Number(step.dataset.stepIndicator);
    step.classList.toggle("is-active", stepNumber === uiState.wizardStep);
    step.classList.toggle("is-complete", stepNumber < uiState.wizardStep);
  });
}

function showWizardStep(stepNumber) {
  uiState.wizardStep = stepNumber;
  servicesStep.classList.toggle("is-active", stepNumber === 1);
  staffStep.classList.toggle("is-active", stepNumber === 2);
  scheduleStep.classList.toggle("is-active", stepNumber === 3);
  detailsStep.classList.toggle("is-active", stepNumber === 4);
  renderWizardSteps();
}

function groupedServices() {
  return state.services.reduce((groups, service) => {
    if (!groups[service.category]) {
      groups[service.category] = [];
    }
    groups[service.category].push(service);
    return groups;
  }, {});
}

function renderServices() {
  const selectedIds = getSelectedServiceIds();
  servicesCategories.innerHTML = Object.entries(groupedServices())
    .map(([category, services]) => `
      <section class="category-block">
        <h3 class="category-title">${category}</h3>
        <div class="services-grid">
          ${services.map((service) => `
            <button class="service-card ${selectedIds.includes(service.id) ? "is-selected" : ""}" type="button" data-service-id="${service.id}">
              <div class="service-card-head">
                <strong>${service.name}</strong>
                <span class="service-card-check" aria-hidden="true"></span>
              </div>
              <div class="service-card-meta">
                <span>${formatPrice(service.price)} | ${service.duration} דקות</span>
              </div>
            </button>
          `).join("")}
        </div>
      </section>
    `)
    .join("");
}

function renderStaff() {
  staffCards.innerHTML = state.staff
    .map((staff) => `
      <button class="staff-card ${staff.id === uiState.selectedStaffId ? "is-selected" : ""}" type="button" data-staff-id="${staff.id}">
        <div class="staff-avatar" aria-hidden="true">${staff.initials}</div>
        <strong>${staff.name}</strong>
        <span>${staff.role}</span>
      </button>
    `)
    .join("");
}

function renderSelectedSummary() {
  const serviceBundle = getSelectedServiceBundle();
  const staff = getSelectedStaff();

  if (!serviceBundle) {
    selectedSummary.innerHTML = "";
    return;
  }

  selectedSummary.innerHTML = `
    <div class="selected-summary-row"><span>${serviceBundle.ids.length > 1 ? "שירותים" : "שירות"}</span><strong>${serviceBundle.name}</strong></div>
    <div class="selected-summary-row"><span>כמה שירותים</span><strong>${serviceBundle.ids.length}</strong></div>
    <div class="selected-summary-row"><span>מחיר כולל</span><strong>${formatPrice(serviceBundle.price)}</strong></div>
    <div class="selected-summary-row"><span>משך כולל</span><strong>${serviceBundle.duration} דקות</strong></div>
    <div class="selected-summary-row"><span>צוות</span><strong>${staff.name}</strong></div>
    ${uiState.replacementBookingId ? '<div class="selected-summary-row"><span>מצב</span><strong>שינוי תור קיים</strong></div>' : ""}
  `;
}

function renderBookingSummary() {
  const serviceBundle = getSelectedServiceBundle();
  const staff = getSelectedStaff();
  const dateText = uiState.selectedDate ? formatDisplayDate(uiState.selectedDate) : "-";
  const timeText = uiState.selectedTime || "-";

  bookingSummaryCard.innerHTML = `
    <div class="summary-row"><span>${serviceBundle?.ids.length > 1 ? "שירותים" : "שירות"}</span><strong>${serviceBundle ? serviceBundle.name : "-"}</strong></div>
    <div class="summary-row"><span>משך כולל</span><strong>${serviceBundle ? `${serviceBundle.duration} דקות` : "-"}</strong></div>
    <div class="summary-row"><span>מחיר כולל</span><strong>${serviceBundle ? formatPrice(serviceBundle.price) : "-"}</strong></div>
    <div class="summary-row"><span>אשת צוות</span><strong>${staff ? staff.name : "-"}</strong></div>
    <div class="summary-row"><span>תאריך</span><strong>${dateText}</strong></div>
    <div class="summary-row"><span>שעה</span><strong>${timeText}</strong></div>
    ${uiState.replacementBookingId ? '<div class="summary-row"><span>סוג פעולה</span><strong>שינוי תור קיים</strong></div>' : ""}
  `;
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

function isPastDate(dateValue) {
  return dateValue < todayDate();
}

function isPastTime(dateValue, timeValue) {
  const now = new Date();
  const slot = new Date(`${dateValue}T${timeValue}:00`);
  return slot.getTime() <= now.getTime();
}

function bookingOverlaps(booking, startMinutes, durationMinutes) {
  const bookingStart = parseTimeToMinutes(String(booking.booking_time).slice(0, 5));
  const bookingEnd = bookingStart + Number(booking.duration_minutes);
  const candidateEnd = startMinutes + durationMinutes;
  return startMinutes < bookingEnd && bookingStart < candidateEnd;
}

function getActiveBookingsForDate(dateValue) {
  return state.bookings.filter((booking) => booking.booking_date === dateValue && ["pending", "approved"].includes(booking.status));
}

function isSlotBlocked(dateValue, timeValue) {
  return state.blockedSlots.some((slot) => slot.blocked_date === dateValue && slot.blocked_time === timeValue);
}

function getAssignableStaffIds(dateValue, startMinutes, durationMinutes) {
  const activeBookings = getActiveBookingsForDate(dateValue);
  return getRealStaffMembers()
    .filter((staff) => !activeBookings.some((booking) => booking.staff_id === staff.id && bookingOverlaps(booking, startMinutes, durationMinutes)))
    .map((staff) => staff.id);
}

function getAvailableSlots(dateValue, serviceSelection = getSelectedServiceIds(), staffId = uiState.selectedStaffId) {
  const serviceBundle = resolveServiceBundle(serviceSelection);
  const workDay = findWorkingHoursForDate(dateValue);

  if (!serviceBundle || !workDay || workDay.is_closed || !workDay.opens_at || !workDay.closes_at || isPastDate(dateValue)) {
    return [];
  }

  const openMinutes = parseTimeToMinutes(workDay.opens_at.slice(0, 5));
  const closeMinutes = parseTimeToMinutes(workDay.closes_at.slice(0, 5));
  const interval = Number(workDay.slot_interval_minutes || 30);
  const slots = [];

  for (let start = openMinutes; start + Number(serviceBundle.duration) <= closeMinutes; start += interval) {
    const slotTime = formatMinutesToTime(start);

    if (dateValue === todayDate() && isPastTime(dateValue, slotTime)) {
      continue;
    }

    if (isSlotBlocked(dateValue, slotTime)) {
      continue;
    }

    const assignableStaffIds = getAssignableStaffIds(dateValue, start, Number(serviceBundle.duration));
    if (assignableStaffIds.includes(staffId)) {
      slots.push(slotTime);
    }
  }

  return slots;
}

function hasAvailabilityOnDate(dateValue) {
  return getAvailableSlots(dateValue).length > 0;
}

function maybePromoteWaitlistForBooking(booking) {
  if (!booking || !isBusinessFeatureEnabled("waitingList")) {
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

function joinWaitlistForCurrentSelection() {
  const serviceBundle = getSelectedServiceBundle();
  const currentCustomer = getCurrentCustomer();

  if (session.role !== "customer") {
    openAuthModal("customer");
    return;
  }

  if (!isBusinessFeatureEnabled("waitingList") || !serviceBundle || !uiState.selectedDate || serviceBundle.ids.length !== 1) {
    return;
  }

  if (isCustomerBlocked()) {
    appUi.toast("החשבון שלך חסום כרגע לקביעת תורים חדשים.", { variant: "error" });
    return;
  }

  if (getSelectedWaitlistEntry()) {
    appUi.toast("כבר נרשמת לרשימת ההמתנה של היום הזה.", { variant: "info" });
    return;
  }

  const createEntryLocally = () => {
    state.waitlistEntries.push({
      id: `waitlist-${Date.now()}`,
      customer_phone: currentCustomer?.phone || session.customerPhone || "",
      customer_name: buildCustomerFullName(currentCustomer?.firstName, currentCustomer?.lastName) || "לקוחה",
      customer_auth_user_id: session.authUserId || "",
      service_id: serviceBundle.primaryServiceId,
      service_name: serviceBundle.primaryServiceName,
      booking_date: uiState.selectedDate,
      notes: uiState.bookingDraft.notes || "",
      status: "waiting",
      created_at: new Date().toISOString(),
      notified_at: ""
    });
    state.waitlistEntries = normalizeWaitlistEntries(state.waitlistEntries);
    saveState();
    rerenderAll();
  };

  if (!supabaseEnabled) {
    createEntryLocally();
    appUi.toast("נרשמת לרשימת ההמתנה. אם יתפנה מקום תקבלי התראה.", { variant: "success" });
    return;
  }

  supabaseApi.joinWaitlist({
    serviceId: serviceBundle.primaryServiceId,
    serviceName: serviceBundle.primaryServiceName,
    bookingDate: uiState.selectedDate,
    notes: uiState.bookingDraft.notes || ""
  }).then(async () => {
    await refreshStateFromSupabase();
    appUi.toast("נרשמת לרשימת ההמתנה. אם יתפנה מקום תקבלי התראה.", { variant: "success" });
  }).catch((error) => {
    appUi.toast(error?.message || "לא הצלחנו להצטרף לרשימת ההמתנה.", { variant: "error" });
  });
}

function shouldOfferAttendanceConfirmation(booking) {
  if (!isBusinessFeatureEnabled("attendanceConfirmation")) {
    return false;
  }

  if (!booking || booking.status !== "approved" || !booking.attendance_confirmation_requested_at) {
    return false;
  }

  return booking.attendance_confirmation_status === "pending";
}

function requestAttendanceConfirmation(booking, options = {}) {
  if (!booking || booking.status !== "approved" || !isBusinessFeatureEnabled("attendanceConfirmation")) {
    return false;
  }

  if (booking.booking_date !== localDateValue(new Date(Date.now() + 86400000)) && !options.force) {
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
  if (!isBusinessFeatureEnabled("attendanceConfirmation")) {
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

function renderTodayAvailability() {
  const serviceBundle = getSelectedServiceBundle();

  if (!serviceBundle) {
    todayAvailabilityText.textContent = "בחרי שירות כדי לראות שעות פנויות להיום.";
    todaySlotsList.innerHTML = "";
    return;
  }

  const slots = getAvailableSlots(todayDate(), serviceBundle.ids, uiState.selectedStaffId).slice(0, 6);
  if (!slots.length) {
    todayAvailabilityText.textContent = `אין שעות פנויות היום עבור ${serviceBundle.name}.`;
    todaySlotsList.innerHTML = "";
    return;
  }

  todayAvailabilityText.textContent = `השעות הקרובות הפנויות היום עבור ${serviceBundle.name}:`;
  todaySlotsList.innerHTML = slots
    .map((time) => `<button class="today-slot-chip" type="button" data-today-time="${time}">${time}</button>`)
    .join("");
}

function buildCalendarDays(monthDate) {
  const firstOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const firstVisible = new Date(firstOfMonth);
  firstVisible.setDate(firstVisible.getDate() - firstOfMonth.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(firstVisible);
    date.setDate(firstVisible.getDate() + index);
    const value = localDateValue(date);
    return {
      value,
      dayNumber: date.getDate(),
      isCurrentMonth: date.getMonth() === monthDate.getMonth(),
      isPast: isPastDate(value),
      isAvailable: hasAvailabilityOnDate(value)
    };
  });
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

    return {
      value,
      dayNumber: date.getDate(),
      isCurrentMonth: date.getMonth() === monthDate.getMonth(),
      hasBookings: hasBookings || hasSpecialHours
    };
  });
}

function renderCalendar() {
  const monthDate = monthDateFromKey(uiState.selectedMonthKey);
  calendarMonthLabel.textContent = monthDate.toLocaleDateString("he-IL", {
    month: "long",
    year: "numeric"
  });

  calendarGrid.innerHTML = buildCalendarDays(monthDate)
    .map((day) => {
      if (!day.isCurrentMonth) {
        return '<div class="calendar-day is-outside" aria-hidden="true"></div>';
      }

      const disabled = day.isPast || !day.isAvailable;
      const classes = [
        "calendar-day",
        day.isAvailable ? "is-available" : "",
        disabled ? "is-disabled" : "",
        uiState.selectedDate === day.value ? "is-selected" : ""
      ].filter(Boolean).join(" ");

      return `
        <button class="${classes}" type="button" data-calendar-date="${day.value}" ${disabled ? "disabled" : ""}>
          ${day.dayNumber}
        </button>
      `;
    })
    .join("");
}

function buildFirstAvailableDays(limitDays = 7, searchWindow = 30) {
  const items = [];

  for (let offset = 0; offset < searchWindow && items.length < limitDays; offset += 1) {
    const date = new Date();
    date.setDate(date.getDate() + offset);
    const dateValue = localDateValue(date);
    const slots = getAvailableSlots(dateValue);

    if (!slots.length) {
      continue;
    }

    items.push({
      date: dateValue,
      slots: slots.slice(0, 10)
    });
  }

  return items;
}

function renderScheduleMode() {
  scheduleModeSwitch?.querySelectorAll("[data-schedule-mode]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.scheduleMode === uiState.scheduleMode);
  });

  firstAvailablePanel?.classList.toggle("is-hidden", uiState.scheduleMode !== "firstAvailable");
  calendarModePanel?.classList.toggle("is-hidden", uiState.scheduleMode !== "calendar");
}

function renderFirstAvailableList() {
  const serviceBundle = getSelectedServiceBundle();

  if (!firstAvailableList) {
    return;
  }

  if (!serviceBundle) {
    firstAvailableList.innerHTML = '<div class="empty-state"><div class="empty-icon" aria-hidden="true">⌛</div><p>בחרי שירות כדי לראות את הזמנים הראשונים שפנויים.</p></div>';
    return;
  }

  const availableDays = buildFirstAvailableDays();
  if (!availableDays.length) {
    firstAvailableList.innerHTML = '<div class="empty-state"><div class="empty-icon" aria-hidden="true">⌛</div><p>לא מצאנו כרגע זמנים קרובים. אפשר לעבור ללשונית "לפי יום".</p></div>';
    return;
  }

  firstAvailableList.innerHTML = availableDays
    .map((day) => `
      <section class="first-available-day ${uiState.selectedDate === day.date ? "is-selected" : ""}">
        <div class="first-available-head">
          <strong>${formatDisplayDate(day.date)}</strong>
          <span>${day.slots.length} שעות קרובות</span>
        </div>
        <div class="first-available-slots">
          ${day.slots.map((time) => `
            <button
              class="first-available-slot ${uiState.selectedDate === day.date && uiState.selectedTime === time ? "is-selected" : ""}"
              type="button"
              data-first-date="${day.date}"
              data-first-time="${time}"
            >
              ${time}
            </button>
          `).join("")}
        </div>
      </section>
    `)
    .join("");
}

function groupTimes(times) {
  const groups = {
    בוקר: [],
    צהריים: [],
    ערב: []
  };

  times.forEach((time) => {
    const hour = Number(time.split(":")[0]);
    if (hour < 12) {
      groups["בוקר"].push(time);
    } else if (hour < 17) {
      groups["צהריים"].push(time);
    } else {
      groups["ערב"].push(time);
    }
  });

  return groups;
}

function renderTimeOptions() {
  const availableTimes = uiState.selectedDate ? getAvailableSlots(uiState.selectedDate) : [];
  const selectedIds = getSelectedServiceIds();
  const grouped = groupTimes(availableTimes);
  const canOfferWaitlist = Boolean(
    waitlistPrompt &&
    session.role === "customer" &&
    uiState.selectedDate &&
    !availableTimes.length &&
    isBusinessFeatureEnabled("waitingList") &&
    selectedIds.length === 1 &&
    getSelectedServiceBundle()
  );

  if (!availableTimes.includes(uiState.selectedTime)) {
    uiState.selectedTime = "";
  }

  timeGroups.innerHTML = Object.entries(grouped)
    .filter(([, values]) => values.length > 0)
    .map(([title, values]) => `
      <section class="time-group">
        <h4>${title}</h4>
        <div class="time-slots-grid">
          ${values.map((time) => `
            <button class="time-slot-button ${time === uiState.selectedTime ? "is-selected" : ""}" type="button" data-time-value="${time}">
              ${time}
            </button>
          `).join("")}
        </div>
      </section>
    `)
    .join("");

  emptyTimesState.classList.toggle("is-hidden", availableTimes.length > 0);
  waitlistPrompt?.classList.toggle("is-hidden", !canOfferWaitlist);
  if (joinWaitlistButton) {
    joinWaitlistButton.disabled = !canOfferWaitlist || Boolean(getSelectedWaitlistEntry()) || isCustomerBlocked();
    joinWaitlistButton.textContent = getSelectedWaitlistEntry() ? "כבר הצטרפת לרשימה" : "הצטרפות לרשימת המתנה";
  }
}

function renderDetailsForm() {
  const currentCustomer = getCurrentCustomer();
  const sourceBooking = getReplacementSourceBooking();
  const accountFullName = currentCustomer
    ? [currentCustomer.firstName, currentCustomer.lastName].filter(Boolean).join(" ")
    : "";

  if (currentCustomer && !uiState.bookingDraft.fullName) {
    uiState.bookingDraft.fullName = accountFullName;
  }
  if (currentCustomer && !uiState.bookingDraft.phone) {
    uiState.bookingDraft.phone = currentCustomer.phone || "";
  }

  const draftFields = {
    fullName: uiState.bookingDraft.fullName || accountFullName,
    phone: uiState.bookingDraft.phone || currentCustomer?.phone || "",
    notes: uiState.bookingDraft.notes
  };

  Object.entries(draftFields).forEach(([fieldName, value]) => {
    const field = bookingForm.elements[fieldName];
    if (field && document.activeElement !== field) {
      field.value = value;
    }
  });

  const isLoggedIn = session.role === "customer";
  const blockedCustomer = isCustomerBlocked();
  if (isLoggedIn) {
    detailsNotice.textContent = blockedCustomer
      ? "החשבון שלך חסום כרגע לקביעת תורים חדשים. אפשר לפנות לבעלת העסק כדי להסדיר את זה."
      : uiState.replacementBookingId
        ? "את משנה עכשיו תור קיים. בקשת השינוי תישלח לאישור, והתור הישן יישאר שמור עד שבעלת העסק תאשר את התור החדש."
        : "הפרטים נמשכו מהחשבון שלך. אפשר לעדכן אותם לפני אישור.";
  } else {
    detailsNotice.textContent = "כדי לאשר תור צריך להתחבר כלקוחה. בלי התחברות אי אפשר לשמור הזמנה.";
  }

  bookingSubmitButton.textContent = uiState.isBookingSubmitting
    ? "שומר..."
    : sourceBooking
      ? "שליחת שינוי תור"
      : "קבע תור";

  Array.from(bookingForm.elements).forEach((element) => {
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLButtonElement) {
      element.disabled = false;
      element.readOnly = false;
    }
  });

  bookingSubmitButton.disabled = blockedCustomer || uiState.isBookingSubmitting;
}

function renderCustomerBookings() {
  if (session.role !== "customer") {
    updateCustomerBookingsFilterUi({
      active: [],
      completed: [],
      cancelled: []
    });
    myBookingsList.innerHTML = '<div class="notice-box">התחברי כלקוחה כדי לראות את התורים שלך.</div>';
    return;
  }

  const bookings = getCustomerBookingsForSession()
    .sort((a, b) => `${a.booking_date} ${a.booking_time}`.localeCompare(`${b.booking_date} ${b.booking_time}`));

  if (!bookings.length) {
    updateCustomerBookingsFilterUi({
      active: [],
      completed: [],
      cancelled: []
    });
    myBookingsList.innerHTML = '<div class="notice-box">עדיין אין תורים על החשבון הזה.</div>';
    return;
  }

  const groupedBookings = {
    active: [],
    completed: [],
    cancelled: []
  };

  bookings.forEach((booking) => {
    groupedBookings[getCustomerBookingBucket(booking)].push(booking);
  });

  groupedBookings.completed.sort((a, b) => `${b.booking_date} ${b.booking_time}`.localeCompare(`${a.booking_date} ${a.booking_time}`));
  groupedBookings.cancelled.sort((a, b) => `${b.booking_date} ${b.booking_time}`.localeCompare(`${a.booking_date} ${a.booking_time}`));

  updateCustomerBookingsFilterUi(groupedBookings);

  const visibleBookings = groupedBookings[uiState.customerBookingsView] || [];
  if (!visibleBookings.length) {
    myBookingsList.innerHTML = `<div class="notice-box">${getCustomerEmptyMessage(uiState.customerBookingsView)}</div>`;
    return;
  }

  myBookingsList.innerHTML = visibleBookings
    .map((booking) => {
      const presentation = getCustomerBookingPresentation(booking);
      const pendingChangeRequest = findPendingChangeRequestForBooking(booking.id);
      const originalBooking = booking.replaces_booking_id ? findBookingById(booking.replaces_booking_id) : null;
      const canChangeThisBooking = isBusinessFeatureEnabled("customerRescheduling") && ["pending", "approved"].includes(booking.status) && !booking.replaces_booking_id && !pendingChangeRequest;
      const canExportCalendar = isBusinessFeatureEnabled("calendarExport");
      const preparationMessage = isBusinessFeatureEnabled("preparationMessage") && booking.status === "approved"
        ? state.business.preparation_message
        : "";
      const attendanceStatusText = formatAttendanceConfirmationStatus(booking.attendance_confirmation_status);
      const canRespondAttendance = shouldOfferAttendanceConfirmation(booking);

      return `
        <article class="booking-card status-card-${presentation.statusClass}">
          <div class="booking-card-head">
            <strong>${booking.service_name}</strong>
            <div class="booking-card-badges">
              <span class="status-pill status-${presentation.statusClass}">${presentation.statusLabel}</span>
              ${booking.status === "approved" && booking.arrival_status ? `<span class="status-pill arrival-pill arrival-${booking.arrival_status}">${formatArrivalStatus(booking.arrival_status)}</span>` : ""}
            </div>
          </div>
          <div class="booking-meta">
            <span>${formatDisplayDate(booking.booking_date)}</span>
            <span>${booking.booking_time}</span>
            <span>${booking.staff_name}</span>
          </div>
          ${booking.status === "approved" && booking.arrival_status ? `<div class="booking-note">מצב הגעה: ${formatArrivalStatus(booking.arrival_status)}</div>` : ""}
          ${attendanceStatusText ? `<div class="booking-note">אישור הגעה: ${attendanceStatusText}</div>` : ""}
          ${booking.notes ? `<div class="booking-note">הערה: ${booking.notes}</div>` : ""}
          ${preparationMessage ? `<div class="booking-note">הכנה לתור: ${preparationMessage}</div>` : ""}
          ${
            pendingChangeRequest
              ? `<div class="change-request-strip">יש כרגע בקשת שינוי פתוחה לתאריך ${formatDisplayDate(pendingChangeRequest.booking_date)} בשעה ${pendingChangeRequest.booking_time}. התור הישן נשאר שמור עד לאישור.</div>`
              : ""
          }
          ${
            originalBooking
              ? `<div class="change-request-strip">זו בקשת שינוי עבור התור המקורי של ${formatDisplayDate(originalBooking.booking_date)} בשעה ${originalBooking.booking_time}.</div>`
              : ""
          }
          ${
            presentation.bucket === "active"
              ? `
                <div class="booking-card-actions">
                  ${canExportCalendar ? `<button class="ghost-button calendar-choice-button" type="button" data-booking-id="${booking.id}">הוספה ליומן</button>` : ""}
                  ${canChangeThisBooking ? `<button class="ghost-button replace-booking-button" type="button" data-booking-id="${booking.id}">שינוי תור</button>` : ""}
                  ${canRespondAttendance ? `<button class="ghost-button confirm-arrival-button" type="button" data-booking-id="${booking.id}" data-attendance-response="confirmed">אני מגיעה</button>` : ""}
                  ${canRespondAttendance ? `<button class="ghost-button decline-arrival-button" type="button" data-booking-id="${booking.id}" data-attendance-response="declined">לא אוכל להגיע</button>` : ""}
                  <button class="danger-button cancel-booking-button" type="button" data-booking-id="${booking.id}">ביטול</button>
                </div>
              `
              : presentation.bucket === "completed"
                ? canExportCalendar
                  ? `
                    <div class="booking-card-actions">
                      <button class="ghost-button calendar-choice-button" type="button" data-booking-id="${booking.id}">הוספה ליומן</button>
                    </div>
                  `
                  : ""
                : `
                  <div class="booking-card-actions">
                    <button class="ghost-button hide-cancelled-booking-button" type="button" data-booking-id="${booking.id}">מחיקה מהרשימה</button>
                  </div>
                `
          }
        </article>
      `;
    })
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

  if (!dailyBookings.length) {
    sellerCalendarList.innerHTML = '<div class="notice-box">אין תורים ביום הזה.</div>';
    return;
  }

  sellerCalendarList.innerHTML = dailyBookings
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
}

function renderSellerBookings() {
  if (!state.bookings.length) {
    sellerBookingsList.innerHTML = '<div class="notice-box">עדיין אין בקשות תור.</div>';
    return;
  }

  sellerBookingsList.innerHTML = [...state.bookings]
    .sort((a, b) => `${b.booking_date} ${b.booking_time}`.localeCompare(`${a.booking_date} ${a.booking_time}`))
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
            : ["approved"].includes(booking.status)
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

  hoursEditor.innerHTML = [...state.workingHours]
    ? `
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
            <input type="text" value="${row.opens_at || ""}" placeholder="שעת פתיחה, למשל 10:00" data-hour-field="opens_at">
            <input type="text" value="${row.closes_at || ""}" placeholder="שעת סגירה, למשל 18:00" data-hour-field="closes_at">
            <input type="number" min="5" step="5" value="${row.slot_interval_minutes || 30}" title="מספר הדקות בין תחילת תור אחד לתחילת התור הבא" placeholder="דקות בין תורים" data-hour-field="slot_interval_minutes">
            <button class="ghost-button toggle-hour-button ${row.is_closed ? "is-closed" : "is-open"}" type="button" data-hour-toggle="${row.id}">
              ${row.is_closed ? "היום סגור" : "היום פתוח"}
            </button>
          </div>
        `)
        .join("")}
    `
    : "";

  businessForm.elements.name.value = state.business.name;
  businessForm.elements.description.value = state.business.description;
  businessForm.elements.address.value = state.business.address;
  businessForm.elements.phone.value = state.business.phone;
  businessForm.elements.instagramUrl.value = normalizeSocialUrl(state.business.instagram_url);

  sellerCredentialsForm.elements.username.value = state.sellerCredentials.username;
  sellerCredentialsForm.elements.password.value = "";
}

function updateSessionUi() {
  const customerLoggedIn = session.role === "customer";
  const sellerLoggedIn = session.role === "seller";
  const customerUiVisible = customerLoggedIn && !sellerLoggedIn;

  logoutButton.classList.toggle("is-hidden", !customerUiVisible);
  openCustomerLogin.classList.toggle("is-hidden", customerLoggedIn || sellerLoggedIn);
  openSellerLogin.classList.toggle("is-hidden", sellerLoggedIn);
  returnToOwnerButton.classList.toggle("is-hidden", !sellerLoggedIn);
  sellerSiteLogoutButton.classList.toggle("is-hidden", !sellerLoggedIn);
  customerBookingsPanel.classList.toggle("is-hidden", !customerUiVisible);
  sellerPanel.classList.add("is-hidden");
}

function rerenderAll() {
  syncSelectedServiceState(getSelectedServiceIds().filter((serviceId) => state.services.some((service) => service.id === serviceId)));
  runAttendanceConfirmationSweep();
  renderBusiness();
  renderWizardSteps();
  renderChangeModeBanner();
  renderServices();
  renderStaff();
  renderSelectedSummary();
  renderScheduleMode();
  renderFirstAvailableList();
  renderCalendar();
  renderTodayAvailability();
  renderTimeOptions();
  renderBookingSummary();
  renderDetailsForm();
  renderCustomerBookings();
  renderSellerCalendar();
  renderSellerBookings();
  renderEditors();
  updateSessionUi();
  notificationCenter?.render();
}

function syncStateFromStorage() {
  const freshState = loadState();
  Object.assign(state, freshState);
  rerenderAll();
  notificationCenter?.showNewBrowserNotifications();
}

function goToStep(stepNumber) {
  showWizardStep(stepNumber);
  renderBookingSummary();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function ensureServiceSelected() {
  if (getSelectedServiceBundle()) {
    return true;
  }
  appUi.toast("צריך לבחור לפחות שירות אחד לפני שממשיכים.", { variant: "error" });
  goToStep(1);
  return false;
}

function ensureStaffSelected() {
  if (getSelectedStaff()) {
    return true;
  }
  appUi.toast("צריך לבחור אשת צוות לפני שממשיכים.", { variant: "error" });
  goToStep(2);
  return false;
}

function ensureScheduleSelected() {
  if (uiState.selectedDate && uiState.selectedTime) {
    return true;
  }
  appUi.toast("צריך לבחור יום ושעה לפני שממשיכים.", { variant: "error" });
  goToStep(3);
  return false;
}

function openAuthModal(role) {
  if (role === "customer") {
    const draftName = parseFullName(uiState.bookingDraft.fullName);
    if (!customerLoginForm.elements.firstName.value) {
      customerLoginForm.elements.firstName.value = draftName.firstName;
    }
    if (!customerLoginForm.elements.lastName.value) {
      customerLoginForm.elements.lastName.value = draftName.lastName;
    }
    if (!customerLoginForm.elements.phone.value) {
      customerLoginForm.elements.phone.value = uiState.bookingDraft.phone;
    }
  }

  authModal.classList.remove("is-hidden");
  showAuthTab(role);
}

function closeAuthModal() {
  authModal.classList.add("is-hidden");
}

function showAuthTab(tabName) {
  modalTabs.forEach((tab) => {
    tab.classList.toggle("is-active", tab.dataset.authTab === tabName);
  });

  customerLoginForm.classList.toggle("is-active", tabName === "customer");
  sellerLoginForm.classList.toggle("is-active", tabName === "seller");
}

function updateCurrentCustomer(fullName, phone) {
  const customer = getCurrentCustomer();
  const nameParts = parseFullName(fullName);
  if (!customer) {
    state.users.push({
      auth_user_id: session.authUserId || "",
      firstName: nameParts.firstName,
      lastName: nameParts.lastName,
      phone,
      password: "",
      owner_note: "",
      is_blocked: false,
      blocked_reason: "",
      blocked_at: "",
      no_show_count: 0,
      created_at: new Date().toISOString()
    });
  } else {
    customer.auth_user_id = customer.auth_user_id || session.authUserId || "";
    customer.firstName = nameParts.firstName;
    customer.lastName = nameParts.lastName;
    customer.phone = phone;
    customer.created_at ||= new Date().toISOString();
    customer.no_show_count = Number(customer.no_show_count || 0);
  }
  session.customerPhone = normalizePhoneNumber(phone);
  rememberCustomerSession(session.customerPhone);
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

function resolveAssignedStaff(dateValue, timeValue, service) {
  const startMinutes = parseTimeToMinutes(timeValue);
  const assignableStaffIds = getAssignableStaffIds(dateValue, startMinutes, Number(service.duration));

  return getRealStaffMembers().find((staff) => staff.id === uiState.selectedStaffId && assignableStaffIds.includes(staff.id)) || null;
}

function resetBookingSelection() {
  syncSelectedServiceState([]);
  uiState.selectedStaffId = DEFAULT_OWNER_STAFF.id;
  uiState.selectedDate = "";
  uiState.selectedTime = "";
  uiState.selectedMonthKey = monthKey(new Date());
  clearReplacementBooking();
  showWizardStep(1);
}

openCustomerLogin.addEventListener("click", () => openAuthModal("customer"));
openSellerLogin.addEventListener("click", () => {
  openAuthModal("seller");
});
closeModal.addEventListener("click", closeAuthModal);

logoutButton.addEventListener("click", async () => {
  clearRejectUndo(false);
  clearReplacementBooking();
  closeCalendarChoice();
  clearRememberedCustomerSession();
  if (supabaseEnabled) {
    await supabaseApi.signOut();
  }
  session.role = null;
  session.customerPhone = null;
  session.authUserId = null;
  uiState.customerBookingsView = "active";
  uiState.bookingDraft = { fullName: "", phone: "", notes: "" };
  bookingForm.reset();
  rerenderAll();
});

sellerSiteLogoutButton.addEventListener("click", async () => {
  clearRememberedSellerSession();
  if (supabaseEnabled) {
    await supabaseApi.signOut();
  }
  session.role = null;
  session.authUserId = null;
  rerenderAll();
});

cancelChangeModeButton.addEventListener("click", () => {
  clearReplacementBooking();
  hideBookingSuccess();
  rerenderAll();
  goToStep(1);
});

bookingSuccessCalendarButton.addEventListener("click", () => {
  if (!isBusinessFeatureEnabled("calendarExport")) {
    return;
  }
  openCalendarChoiceModal(bookingSuccessCalendarButton.dataset.bookingId);
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

modalTabs.forEach((tab) => {
  tab.addEventListener("click", () => showAuthTab(tab.dataset.authTab));
});

customerBookingsFilters.addEventListener("click", (event) => {
  const button = event.target.closest("[data-booking-view]");
  if (!button) {
    return;
  }

  uiState.customerBookingsView = button.dataset.bookingView;
  renderCustomerBookings();
});

servicesCategories.addEventListener("click", (event) => {
  const card = event.target.closest("[data-service-id]");
  if (!card) {
    return;
  }

  const selectedIds = getSelectedServiceIds();
  const serviceId = card.dataset.serviceId;
  const nextIds = selectedIds.includes(serviceId)
    ? selectedIds.filter((item) => item !== serviceId)
    : [...selectedIds, serviceId];

  syncSelectedServiceState(nextIds);
  uiState.selectedDate = "";
  uiState.selectedTime = "";
  uiState.selectedMonthKey = monthKey(new Date());
  hideBookingSuccess();
  rerenderAll();
});

staffCards.addEventListener("click", (event) => {
  const card = event.target.closest("[data-staff-id]");
  if (!card) {
    return;
  }

  uiState.selectedStaffId = card.dataset.staffId;
  uiState.selectedDate = "";
  uiState.selectedTime = "";
  hideBookingSuccess();
  rerenderAll();
});

todaySlotsList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-today-time]");
  if (!button || !ensureServiceSelected()) {
    return;
  }

  uiState.selectedDate = todayDate();
  uiState.selectedTime = button.dataset.todayTime;
  uiState.selectedMonthKey = monthKey(new Date());
  hideBookingSuccess();
  rerenderAll();
  goToStep(4);
});

calendarGrid.addEventListener("click", (event) => {
  const button = event.target.closest("[data-calendar-date]");
  if (!button) {
    return;
  }

  uiState.selectedDate = button.dataset.calendarDate;
  uiState.selectedTime = "";
  hideBookingSuccess();
  rerenderAll();
});

timeGroups.addEventListener("click", (event) => {
  const button = event.target.closest("[data-time-value]");
  if (!button) {
    return;
  }

  uiState.selectedTime = button.dataset.timeValue;
  hideBookingSuccess();
  rerenderAll();
});

scheduleModeSwitch?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-schedule-mode]");
  if (!button) {
    return;
  }

  uiState.scheduleMode = button.dataset.scheduleMode || "firstAvailable";
  rerenderAll();
});

firstAvailableList?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-first-date][data-first-time]");
  if (!button) {
    return;
  }

  uiState.selectedDate = button.dataset.firstDate;
  uiState.selectedTime = button.dataset.firstTime;
  uiState.selectedMonthKey = monthKey(new Date(`${uiState.selectedDate}T00:00:00`));
  hideBookingSuccess();
  rerenderAll();
  goToStep(4);
});

joinWaitlistButton?.addEventListener("click", () => {
  joinWaitlistForCurrentSelection();
});

calendarPrevButton.addEventListener("click", () => {
  const monthDate = monthDateFromKey(uiState.selectedMonthKey);
  monthDate.setMonth(monthDate.getMonth() - 1);
  uiState.selectedMonthKey = monthKey(monthDate);
  rerenderAll();
});

calendarNextButton.addEventListener("click", () => {
  const monthDate = monthDateFromKey(uiState.selectedMonthKey);
  monthDate.setMonth(monthDate.getMonth() + 1);
  uiState.selectedMonthKey = monthKey(monthDate);
  rerenderAll();
});

goToStaffStep.addEventListener("click", () => {
  if (!ensureServiceSelected()) {
    return;
  }
  goToStep(2);
});

backToServicesStep.addEventListener("click", () => goToStep(1));

goToScheduleStep.addEventListener("click", () => {
  if (!ensureServiceSelected() || !ensureStaffSelected()) {
    return;
  }
  goToStep(3);
});

backToStaffStep.addEventListener("click", () => goToStep(2));

goToDetailsStep.addEventListener("click", () => {
  if (!ensureServiceSelected() || !ensureStaffSelected() || !ensureScheduleSelected()) {
    return;
  }
  goToStep(4);
});

backToScheduleStep.addEventListener("click", () => goToStep(3));

bookingForm.addEventListener("input", (event) => {
  const field = event.target;
  if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement)) {
    return;
  }

  if (["fullName", "phone", "notes"].includes(field.name)) {
    uiState.bookingDraft[field.name] = field.value;
  }
});

customerLoginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(customerLoginForm);
  const password = String(formData.get("password"));
  const firstName = String(formData.get("firstName")).trim();
  const lastName = String(formData.get("lastName")).trim();
  const phone = String(formData.get("phone")).trim();
  const normalizedPhone = normalizePhoneNumber(phone);

  if (!normalizedPhone) {
    appUi.toast("צריך למלא טלפון תקין.", { variant: "error" });
    return;
  }

  if (!supabaseEnabled) {
    appUi.toast("חיבור Supabase עדיין לא זמין בדף הזה.", { variant: "error" });
    return;
  }

  try {
    await supabaseApi.signInOrRegisterCustomer({
      firstName,
      lastName,
      phone,
      password
    });
    session.role = "customer";
    session.customerPhone = normalizedPhone;
    session.authUserId = (await supabaseApi.getCurrentUser())?.id || null;
    uiState.customerBookingsView = "active";
    uiState.bookingDraft.fullName = [firstName, lastName].filter(Boolean).join(" ").trim();
    uiState.bookingDraft.phone = phone;
    rememberCustomerSession(normalizedPhone);
    closeAuthModal();
    await refreshStateFromSupabase();
    setupPersonalRealtimeSubscriptions();
    notificationCenter?.rememberCurrentNotifications();
    notificationCenter?.askAfterOwnerLogin();
    if (isCustomerBlocked(normalizedPhone)) {
      appUi.toast("התחברת, אבל החשבון חסום כרגע לקביעת תורים חדשים.", { variant: "warning" });
    }
  } catch (error) {
    appUi.toast(error?.message || "לא הצלחנו להתחבר.", { variant: "error" });
  }
});

sellerLoginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(sellerLoginForm);
  const username = String(formData.get("username")).trim();
  const password = String(formData.get("password"));

  if (!supabaseEnabled) {
    appUi.toast("חיבור Supabase עדיין לא זמין בדף הזה.", { variant: "error" });
    return;
  }

  try {
    await supabaseApi.signInOwner({ email: username, password });
    rememberSellerSession();
    sessionStorage.setItem(SELLER_SESSION_KEY, "1");
    window.location.href = "owner.html";
  } catch (error) {
    appUi.toast(error?.message || "פרטי הכניסה לא תקינים.", { variant: "error" });
  }
});

bookingForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (uiState.isBookingSubmitting) {
    return;
  }

  if (session.role !== "customer") {
    openAuthModal("customer");
    return;
  }

  if (!ensureServiceSelected() || !ensureStaffSelected() || !ensureScheduleSelected()) {
    return;
  }

  const serviceBundle = getSelectedServiceBundle();
  const fullName = String(bookingForm.elements.fullName.value).trim();
  const phone = String(bookingForm.elements.phone.value).trim();
  const notes = String(bookingForm.elements.notes.value).trim();

  if (isCustomerBlocked()) {
    appUi.toast("החשבון שלך חסום כרגע לקביעת תורים חדשים.", { variant: "error" });
    return;
  }

  if (!fullName || !phone) {
    appUi.toast("צריך למלא שם מלא וטלפון.", { variant: "error" });
    return;
  }

  uiState.isBookingSubmitting = true;
  rerenderAll();

  try {
    const assignedStaff = resolveAssignedStaff(uiState.selectedDate, uiState.selectedTime, serviceBundle);
    if (!assignedStaff) {
      appUi.toast("השעה שנבחרה כבר לא זמינה. בחרי שעה אחרת.", { variant: "warning" });
      uiState.selectedTime = "";
      rerenderAll();
      goToStep(3);
      return;
    }

    updateCurrentCustomer(fullName, phone);

    const replacedBookingId = uiState.replacementBookingId;
    const sourceBooking = replacedBookingId ? findBookingById(replacedBookingId) : null;
    const nameParts = parseFullName(fullName);
    const created = supabaseEnabled
      ? await supabaseApi.createBooking({
        serviceId: serviceBundle.primaryServiceId,
        serviceIds: serviceBundle.ids,
        firstName: nameParts.firstName,
        lastName: nameParts.lastName,
        phone,
        notes,
        bookingDate: uiState.selectedDate,
        bookingTime: uiState.selectedTime,
        replacesBookingId: replacedBookingId || null
      })
      : null;

    uiState.bookingDraft = {
      fullName: "",
      phone: "",
      notes: ""
    };
    clearReplacementBooking();
    saveState();
    await refreshStateFromSupabase();
    showWizardStep(4);
    const newBooking = state.bookings.find((booking) => booking.id === created?.booking_id) || sourceBooking;
    if (newBooking) {
      showBookingSuccess(newBooking);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  } finally {
    uiState.isBookingSubmitting = false;
    rerenderAll();
  }
});

businessForm.addEventListener("submit", (event) => {
  event.preventDefault();
  state.business = {
    ...state.business,
    name: String(businessForm.elements.name.value).trim(),
    description: String(businessForm.elements.description.value).trim(),
    address: String(businessForm.elements.address.value).trim(),
    phone: String(businessForm.elements.phone.value).trim(),
    instagram_url: normalizeSocialUrl(businessForm.elements.instagramUrl.value)
  };
  saveState();
  rerenderAll();
});

sellerCredentialsForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const username = String(sellerCredentialsForm.elements.username.value).trim();
  const password = String(sellerCredentialsForm.elements.password.value);

  if (!username) {
    appUi.toast("שם משתמש לא יכול להיות ריק.", { variant: "error" });
    return;
  }

  try {
    if (supabaseEnabled && session.role === "seller") {
      await supabaseApi.updateOwnerCredentials({
        email: username,
        password
      });
    }
    state.sellerCredentials.username = username;
    sellerCredentialsForm.elements.password.value = "";
    saveState();
    rerenderAll();
    appUi.toast("פרטי ההתחברות נשמרו ב-Supabase Auth.", { variant: "success" });
  } catch (error) {
    appUi.toast(error?.message || "לא הצלחנו לעדכן את פרטי ההתחברות.", { variant: "error" });
  }
});

addServiceButton.addEventListener("click", () => {
  state.services.push({
    id: window.crypto?.randomUUID ? window.crypto.randomUUID() : `service-${Date.now()}`,
    category: "קטגוריה ראשית",
    name: "שירות חדש",
    price: 0,
    duration: 30
  });
  saveState();
  rerenderAll();
});

servicesEditor.addEventListener("click", (event) => {
  const target = event.target;
  if (!target.classList.contains("remove-service-button")) {
    return;
  }

  const row = target.closest("[data-service-id]");
  if (!row) {
    return;
  }

  const serviceId = row.dataset.serviceId;
  state.services = state.services.filter((service) => service.id !== serviceId);

  if (getSelectedServiceIds().includes(serviceId)) {
    syncSelectedServiceState(getSelectedServiceIds().filter((selectedId) => selectedId !== serviceId));
    uiState.selectedDate = "";
    uiState.selectedTime = "";
  }

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

  const hourId = button.dataset.hourToggle;
  const row = state.workingHours.find((item) => item.id === hourId);
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

sellerCalendarGrid.addEventListener("click", (event) => {
  const button = event.target.closest("[data-seller-date]");
  if (!button) {
    return;
  }

  uiState.sellerCalendarDate = button.dataset.sellerDate;
  renderSellerCalendar();
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

  const nextArrivalStatus = normalizeArrivalStatus(target.value, "approved");
  applyNoShowCounterChange(booking, nextArrivalStatus);
  booking.arrival_status = nextArrivalStatus;
  notifyOwnerAppointmentUpdated(booking, `עודכן מצב הגעה ל${formatArrivalStatus(booking.arrival_status)}`);
  notifyCustomerAppointmentUpdated(booking, `מצב ההגעה עודכן ל${formatArrivalStatus(booking.arrival_status)}`);
  saveState();
  rerenderAll();
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
  maybePromoteWaitlistForBooking(booking);
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

  const nextArrivalStatus = normalizeArrivalStatus(target.value, "approved");
  applyNoShowCounterChange(booking, nextArrivalStatus);
  booking.arrival_status = nextArrivalStatus;
  notifyOwnerAppointmentUpdated(booking, `עודכן מצב הגעה ל${formatArrivalStatus(booking.arrival_status)}`);
  notifyCustomerAppointmentUpdated(booking, `מצב ההגעה עודכן ל${formatArrivalStatus(booking.arrival_status)}`);
  saveState();
  rerenderAll();
});

myBookingsList.addEventListener("click", async (event) => {
  const target = event.target.closest("button");
  if (!target) {
    return;
  }

  if (target.classList.contains("calendar-choice-button")) {
    if (!isBusinessFeatureEnabled("calendarExport")) {
      return;
    }
    openCalendarChoiceModal(target.dataset.bookingId);
    return;
  }

  if (target.classList.contains("replace-booking-button")) {
    if (!isBusinessFeatureEnabled("customerRescheduling")) {
      return;
    }
    const booking = findBookingById(target.dataset.bookingId);
    if (!booking || !isSamePhone(booking.customer_phone, session.customerPhone) || !["pending", "approved"].includes(booking.status)) {
      return;
    }

    syncSelectedServiceState(booking.service_ids?.length ? booking.service_ids : [booking.service_id]);
    uiState.selectedStaffId = booking.staff_id;
    uiState.selectedDate = "";
    uiState.selectedTime = "";
    uiState.selectedMonthKey = monthKey(new Date());
    uiState.replacementBookingId = booking.id;
    hideBookingSuccess();
    rerenderAll();
    goToStep(3);
    return;
  }

  if (target.classList.contains("hide-cancelled-booking-button")) {
    const booking = findBookingById(target.dataset.bookingId);
    if (!booking || !isSamePhone(booking.customer_phone, session.customerPhone)) {
      return;
    }

    if (getCustomerBookingBucket(booking) !== "cancelled") {
      return;
    }

    if (!(await appUi.confirm("להסתיר את התור הזה מהרשימה שלך?", { title: "הסתרת תור" }))) {
      return;
    }

    try {
      if (supabaseEnabled) {
        await supabaseApi.hideMyBooking(booking.id);
        await refreshStateFromSupabase();
      } else {
        booking.hidden_for_customer = true;
        saveState();
        rerenderAll();
      }
    } catch (error) {
      appUi.toast(error?.message || "לא הצלחנו להסתיר את התור.", { variant: "error" });
    }
    return;
  }

  if (target.classList.contains("confirm-arrival-button") || target.classList.contains("decline-arrival-button")) {
    const booking = findBookingById(target.dataset.bookingId);
    const response = target.dataset.attendanceResponse;
    if (!booking || !isSamePhone(booking.customer_phone, session.customerPhone) || !shouldOfferAttendanceConfirmation(booking)) {
      return;
    }

    try {
      if (supabaseEnabled) {
        await supabaseApi.respondAttendance(booking.id, response === "confirmed" ? "confirmed" : "declined");
        await refreshStateFromSupabase();
      } else {
        booking.attendance_confirmation_status = response === "confirmed" ? "confirmed" : "declined";
        booking.attendance_confirmation_answered_at = new Date().toISOString();
        notifyOwnerAppointmentUpdated(
          booking,
          response === "confirmed" ? "הלקוחה אישרה הגעה" : "הלקוחה סימנה שלא תגיע"
        );
        saveState();
        rerenderAll();
      }
    } catch (error) {
      appUi.toast(error?.message || "לא הצלחנו לשמור את אישור ההגעה.", { variant: "error" });
    }
    return;
  }

  if (!target.classList.contains("cancel-booking-button")) {
    return;
  }

  const bookingId = target.dataset.bookingId;
  const booking = findBookingById(bookingId);
  if (!booking || !isSamePhone(booking.customer_phone, session.customerPhone)) {
    return;
  }

  if (!["pending", "approved"].includes(booking.status)) {
    return;
  }

  if (!(await appUi.confirm("האם לבטל את התור הזה?", { title: "ביטול תור" }))) {
    return;
  }

  try {
    if (supabaseEnabled) {
      await supabaseApi.cancelMyBooking(booking.id);
      await refreshStateFromSupabase();
    } else {
      booking.status = "cancelled";
      booking.arrival_status = null;
      notifyOwnerAppointmentCancelled(booking);
      maybePromoteWaitlistForBooking(booking);
      saveState();
      rerenderAll();
    }
  } catch (error) {
    appUi.toast(error?.message || "לא הצלחנו לבטל את התור.", { variant: "error" });
  }
});

window.addEventListener("storage", (event) => {
  if (event.key === LOCAL_STORAGE_KEY) {
    syncStateFromStorage();
  }
});

async function initializeApp() {
  restoreRememberedCustomerSession();
  notificationCenter?.rememberCurrentNotifications();
  rerenderAll();
  showWizardStep(1);

  if (!supabaseEnabled) {
    return;
  }

  setupPublicRealtimeSubscriptions();
  await refreshStateFromSupabase();
  setupPersonalRealtimeSubscriptions();

  supabaseApi.onAuthStateChange(async () => {
    await refreshStateFromSupabase();
    setupPersonalRealtimeSubscriptions();
  });
}

void initializeApp();
