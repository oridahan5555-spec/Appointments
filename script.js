const LOCAL_STORAGE_KEY = "booking_app_local_working_v2";
const SELLER_SESSION_KEY = "booking_app_seller_session_v1";
const CUSTOMER_SESSION_KEY = "booking_app_customer_session_v1";
const PENDING_BOOKING_DRAFT_KEY = "booking_app_pending_booking_draft_v1";
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
      attendanceConfirmation: true,
      themeAccent: "#b25fd1"
    }
  },
  sellerCredentials: {
    username: "admin",
    password: "03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4"
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
const topbarActions = document.querySelector(".topbar-actions");
const logoutButton = document.getElementById("logoutButton");
const returnToOwnerButton = document.getElementById("returnToOwnerButton");
const sellerSiteLogoutButton = document.getElementById("sellerSiteLogoutButton");
const authModal = document.getElementById("authModal");
const closeModal = document.getElementById("closeModal");
const modalTabs = document.querySelectorAll(".modal-tab");
const customerLoginForm = document.getElementById("customerLoginForm");
const customerRecoveryForm = document.getElementById("customerRecoveryForm");
const sellerLoginForm = document.getElementById("sellerLoginForm");
const calendarChoiceModal = document.getElementById("calendarChoiceModal");
const closeCalendarChoiceModal = document.getElementById("closeCalendarChoiceModal");
const deviceCalendarButton = document.getElementById("deviceCalendarButton");
const googleCalendarButton = document.getElementById("googleCalendarButton");
const cancelCalendarChoiceButton = document.getElementById("cancelCalendarChoiceButton");
let myBookingsButton = document.getElementById("myBookingsButton");
let customerChooserPanel = null;
let customerSignupForm = null;
let customerForgotPasswordButton = null;
let cancelCustomerRecoveryButton = null;
let customerEmailConfirmedButton = null;
let openCustomerSignupButton = null;
let openCustomerExistingLoginButton = null;
let backToCustomerChooserFromSignup = null;
let backToCustomerChooserFromLogin = null;

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
  onOpenBooking: (notification) => focusCustomerBooking(notification.booking_id),
  onConfirmAttendance: (notification) => confirmCustomerAttendanceFromNotification(notification.booking_id),
  onCancelBooking: (notification) => cancelCustomerBookingFromNotification(notification.booking_id),
  onAddCalendar: (notification) => openCustomerBookingCalendar(notification.booking_id),
  canConfirmAttendance: (notification) => getOwnedCustomerBooking(notification.booking_id)?.status === "approved",
  canCancelBooking: (notification) => ["pending", "approved"].includes(getOwnedCustomerBooking(notification.booking_id)?.status),
  onError: (error) => appUi.toast(error?.message || "לא הצלחנו לעדכן את ההתראה.", { variant: "error" }),
  browser: true
});

const appUi = window.AppUi || {
  toast: (message) => console.warn(message),
  confirm: async () => true
};

function getOwnedCustomerBooking(bookingId) {
  return getCustomerBookingsForSession().find((booking) => booking.id === String(bookingId || "")) || null;
}

function focusCustomerBooking(bookingId) {
  const booking = getOwnedCustomerBooking(bookingId);
  if (!booking) {
    throw new Error("התור כבר לא זמין או שאין הרשאה לצפות בו.");
  }

  uiState.customerBookingsView = getCustomerBookingBucket(booking);
  renderCustomerBookings();
  const card = Array.from(myBookingsList.querySelectorAll("[data-booking-card-id]"))
    .find((item) => item.dataset.bookingCardId === booking.id);
  customerBookingsPanel.classList.remove("is-hidden");
  customerBookingsPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  if (card) {
    card.classList.add("is-notification-target");
    card.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => card.classList.remove("is-notification-target"), 2200);
  }
}

async function confirmCustomerAttendanceFromNotification(bookingId) {
  const booking = getOwnedCustomerBooking(bookingId);
  if (!booking || booking.status !== "approved") {
    throw new Error("אפשר לאשר הגעה רק לתור מאושר ופעיל.");
  }
  if (booking.attendance_confirmation_status === "confirmed") {
    throw new Error("ההגעה לתור הזה כבר אושרה.");
  }

  if (supabaseEnabled) {
    await supabaseApi.respondAttendance(booking.id, "confirmed");
    await refreshStateFromSupabase();
  } else {
    booking.attendance_confirmation_status = "confirmed";
    booking.attendance_confirmation_answered_at = new Date().toISOString();
    saveState();
    rerenderAll();
  }
  appUi.toast("ההגעה אושרה בהצלחה.", { variant: "success" });
}

async function cancelCustomerBookingFromNotification(bookingId) {
  const booking = getOwnedCustomerBooking(bookingId);
  if (!booking || !["pending", "approved"].includes(booking.status)) {
    throw new Error("התור הזה כבר אינו פעיל.");
  }
  if (!(await appUi.confirm("האם לבטל את התור הזה?", { title: "ביטול תור" }))) {
    return;
  }

  if (supabaseEnabled) {
    await supabaseApi.cancelMyBooking(booking.id);
    await refreshStateFromSupabase();
  } else {
    booking.status = "cancelled";
    booking.arrival_status = null;
    saveState();
    rerenderAll();
  }
  appUi.toast("ביטול התור נקלט.", { variant: "success" });
}

function openCustomerBookingCalendar(bookingId) {
  const booking = getOwnedCustomerBooking(bookingId);
  if (!booking) {
    throw new Error("לא נמצא תור להוספה ליומן.");
  }
  openCalendarChoiceModal(booking.id);
}

function focusCustomerBookingFromUrl() {
  const bookingId = new URLSearchParams(window.location.search).get("booking");
  if (!bookingId || !getOwnedCustomerBooking(bookingId)) {
    return;
  }
  focusCustomerBooking(bookingId);
  const url = new URL(window.location.href);
  url.searchParams.delete("booking");
  window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
}

function escapePublicHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function showEmailBookingDetails(payload) {
  document.getElementById("emailBookingDetailsModal")?.remove();
  const overlay = document.createElement("div");
  overlay.id = "emailBookingDetailsModal";
  overlay.className = "modal email-booking-details-modal";
  overlay.innerHTML = `
    <div class="modal-backdrop" data-close-email-booking></div>
    <section class="modal-card" role="dialog" aria-modal="true" aria-labelledby="emailBookingTitle">
      <h3 id="emailBookingTitle">פרטי התור</h3>
      <div class="email-booking-details">
        <strong>${escapePublicHtml(payload.service_name || "שירות")}</strong>
        <span>${escapePublicHtml(payload.booking_date || "")} בשעה ${escapePublicHtml(payload.booking_time || "")}</span>
        <span>${escapePublicHtml(payload.business_name || "")}</span>
        ${payload.business_address ? `<span>${escapePublicHtml(payload.business_address)}</span>` : ""}
        ${payload.business_phone ? `<span>${escapePublicHtml(payload.business_phone)}</span>` : ""}
      </div>
      <button class="primary-button" type="button" data-close-email-booking>סגירה</button>
    </section>`;
  overlay.addEventListener("click", (event) => {
    if (event.target.closest("[data-close-email-booking]")) {
      overlay.remove();
    }
  });
  document.body.appendChild(overlay);
}

async function handleEmailEntryLinks() {
  const url = new URL(window.location.href);
  const actionResult = url.searchParams.get("emailAction");
  const emailToken = url.searchParams.get("emailToken");
  const emailIntent = url.searchParams.get("emailIntent");
  const emailActionToken = url.searchParams.get("emailActionToken");
  if (actionResult) {
    const messages = {
      confirmed: "ההגעה אושרה בהצלחה.",
      cancelled: "ביטול התור נקלט בהצלחה.",
      error: "לא הצלחנו לבצע את הפעולה. ייתכן שהקישור כבר נוצל או שפג תוקפו."
    };
    appUi.toast(messages[actionResult] || "הפעולה הושלמה.", { variant: actionResult === "error" ? "error" : "success" });
    url.searchParams.delete("emailAction");
  }
  if (emailToken) {
    try {
      const payload = await supabaseApi.loadBookingFromEmailToken(emailToken);
      showEmailBookingDetails(payload);
    } catch (error) {
      appUi.toast(error?.message || "הקישור לתור אינו תקין או שפג תוקפו.", { variant: "error" });
    }
    url.searchParams.delete("emailToken");
  }
  if (emailActionToken && ["confirm", "cancel"].includes(emailIntent)) {
    const isConfirmation = emailIntent === "confirm";
    const approved = await appUi.confirm(
      isConfirmation ? "לאשר עכשיו שתגיעי לתור?" : "לבטל עכשיו את התור?",
      { title: isConfirmation ? "אישור הגעה" : "ביטול תור" }
    );
    if (approved) {
      try {
        await supabaseApi.performBookingEmailAction(emailActionToken, emailIntent);
        appUi.toast(isConfirmation ? "ההגעה אושרה בהצלחה." : "ביטול התור נקלט בהצלחה.", { variant: "success" });
        await refreshStateFromSupabase().catch(() => {});
      } catch (error) {
        appUi.toast(error?.message || "לא הצלחנו לבצע את הפעולה.", { variant: "error" });
      }
    }
    url.searchParams.delete("emailIntent");
    url.searchParams.delete("emailActionToken");
  }
  window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
}

function initializeCustomerAuthDom() {
  openCustomerLogin.textContent = "\u05d7\u05e9\u05d1\u05d5\u05df \u05dc\u05e7\u05d5\u05d7";

  if (!myBookingsButton && topbarActions) {
    myBookingsButton = document.createElement("button");
    myBookingsButton.type = "button";
    myBookingsButton.id = "myBookingsButton";
    myBookingsButton.className = "ghost-button is-hidden";
    myBookingsButton.textContent = "\u05d4\u05d4\u05d6\u05de\u05e0\u05d5\u05ea \u05e9\u05dc\u05d9";
    topbarActions.insertBefore(myBookingsButton, logoutButton);
  }

  customerLoginForm.insertAdjacentHTML(
    "beforebegin",
    `
      <div id="customerChooserPanel" class="auth-panel is-active">
        <h3>\u05d7\u05e9\u05d1\u05d5\u05df \u05dc\u05e7\u05d5\u05d7</h3>
        <p class="auth-helper">\u05d1\u05d7\u05e8\u05d9 \u05d0\u05dd \u05d6\u05d5 \u05d4\u05db\u05e0\u05d9\u05e1\u05d4 \u05d4\u05e8\u05d0\u05e9\u05d5\u05e0\u05d4 \u05e9\u05dc\u05da, \u05d0\u05d5 \u05d0\u05dd \u05db\u05d1\u05e8 \u05d9\u05e9 \u05dc\u05da \u05d7\u05e9\u05d1\u05d5\u05df \u05e7\u05d9\u05d9\u05dd.</p>
        <div class="auth-choice-grid">
          <button class="primary-button auth-choice-button" id="openCustomerSignupButton" type="button">\u05db\u05e0\u05d9\u05e1\u05d4 \u05e8\u05d0\u05e9\u05d5\u05e0\u05d4</button>
          <button class="ghost-button auth-choice-button" id="openCustomerExistingLoginButton" type="button">\u05db\u05d1\u05e8 \u05d9\u05e9 \u05dc\u05d9 \u05d7\u05e9\u05d1\u05d5\u05df</button>
        </div>
      </div>
      <form id="customerSignupForm" class="auth-panel">
        <h3>\u05db\u05e0\u05d9\u05e1\u05d4 \u05e8\u05d0\u05e9\u05d5\u05e0\u05d4</h3>
        <p class="auth-helper">\u05de\u05de\u05dc\u05d0\u05d9\u05dd \u05e4\u05e8\u05d8\u05d9\u05dd \u05e4\u05e2\u05dd \u05d0\u05d7\u05ea, \u05d9\u05d5\u05e6\u05e8\u05d9\u05dd \u05d7\u05e9\u05d1\u05d5\u05df, \u05d5\u05e0\u05db\u05e0\u05e1\u05d9\u05dd \u05d0\u05d5\u05d8\u05d5\u05de\u05d8\u05d9\u05ea \u05dc\u05d7\u05e9\u05d1\u05d5\u05df \u05d4\u05dc\u05e7\u05d5\u05d7.</p>
        <label class="field">
          <span>\u05e9\u05dd \u05e4\u05e8\u05d8\u05d9</span>
          <input type="text" name="firstName" required>
        </label>
        <label class="field">
          <span>\u05e9\u05dd \u05de\u05e9\u05e4\u05d7\u05d4</span>
          <input type="text" name="lastName" required>
        </label>
        <label class="field">
          <span>\u05d8\u05dc\u05e4\u05d5\u05df</span>
          <input type="tel" name="phone" required>
        </label>
        <label class="field">
          <span>\u05d0\u05d9\u05de\u05d9\u05d9\u05dc</span>
          <input type="email" name="email" autocomplete="email" required>
        </label>
        <label class="field">
          <span>\u05e1\u05d9\u05e1\u05de\u05d4</span>
          <div class="password-field-control">
            <input id="customerSignupPassword" type="password" name="password" required>
            <button
              class="password-visibility-button"
              type="button"
              data-password-toggle="customerSignupPassword"
              aria-label="\u05d4\u05e6\u05d2\u05ea \u05e1\u05d9\u05e1\u05de\u05d4"
              title="\u05d4\u05e6\u05d2\u05ea \u05e1\u05d9\u05e1\u05de\u05d4"
              aria-pressed="false"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
            </button>
          </div>
        </label>
        <label class="field">
          <span>\u05d0\u05d9\u05de\u05d5\u05ea \u05e1\u05d9\u05e1\u05de\u05d4</span>
          <div class="password-field-control">
            <input id="customerSignupConfirmPassword" type="password" name="confirmPassword" required>
            <button
              class="password-visibility-button"
              type="button"
              data-password-toggle="customerSignupConfirmPassword"
              aria-label="\u05d4\u05e6\u05d2\u05ea \u05e1\u05d9\u05e1\u05de\u05d4"
              title="\u05d4\u05e6\u05d2\u05ea \u05e1\u05d9\u05e1\u05de\u05d4"
              aria-pressed="false"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
            </button>
          </div>
        </label>
        <button class="primary-button" type="submit">\u05d9\u05e6\u05d9\u05e8\u05ea \u05d7\u05e9\u05d1\u05d5\u05df</button>
        <button class="ghost-button" id="backToCustomerChooserFromSignup" type="button">\u05d7\u05d6\u05e8\u05d4</button>
      </form>
    `
  );

  customerLoginForm.innerHTML = `
    <h3>\u05db\u05e0\u05d9\u05e1\u05d4 \u05dc\u05dc\u05e7\u05d5\u05d7 \u05e7\u05d9\u05d9\u05dd</h3>
    <p class="auth-helper">\u05d4\u05ea\u05d7\u05d1\u05e8\u05d9 \u05e2\u05dd \u05d4\u05d0\u05d9\u05de\u05d9\u05d9\u05dc \u05d5\u05d4\u05e1\u05d9\u05e1\u05de\u05d4 \u05e9\u05dc \u05d4\u05d7\u05e9\u05d1\u05d5\u05df \u05e9\u05dc\u05da.</p>
    <label class="field">
      <span>\u05d0\u05d9\u05de\u05d9\u05d9\u05dc</span>
      <input type="email" name="email" autocomplete="email" required>
    </label>
    <label class="field">
      <span>\u05e1\u05d9\u05e1\u05de\u05d4</span>
      <div class="password-field-control">
        <input id="customerLoginPassword" type="password" name="password" required>
        <button
          class="password-visibility-button"
          type="button"
          data-password-toggle="customerLoginPassword"
          aria-label="\u05d4\u05e6\u05d2\u05ea \u05e1\u05d9\u05e1\u05de\u05d4"
          title="\u05d4\u05e6\u05d2\u05ea \u05e1\u05d9\u05e1\u05de\u05d4"
          aria-pressed="false"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z"></path>
            <circle cx="12" cy="12" r="3"></circle>
          </svg>
        </button>
      </div>
    </label>
    <button class="primary-button" type="submit">\u05db\u05e0\u05d9\u05e1\u05d4</button>
    <button class="ghost-button is-hidden" id="customerEmailConfirmedButton" type="button">\u05db\u05d1\u05e8 \u05d0\u05d9\u05e9\u05e8\u05ea\u05d9 \u05d1\u05de\u05d9\u05d9\u05dc, \u05d4\u05ea\u05d7\u05d1\u05e8\u05d9 \u05e2\u05db\u05e9\u05d9\u05d5</button>
    <button class="ghost-button" id="customerForgotPasswordButton" type="button">\u05e9\u05db\u05d7\u05ea\u05d9 \u05e1\u05d9\u05e1\u05de\u05d4</button>
    <button class="ghost-button" id="backToCustomerChooserFromLogin" type="button">\u05d7\u05d6\u05e8\u05d4</button>
  `;
  customerLoginForm.classList.remove("is-active");

  customerRecoveryForm.innerHTML = `
    <h3>\u05d1\u05d7\u05d9\u05e8\u05ea \u05e1\u05d9\u05e1\u05de\u05d4 \u05d7\u05d3\u05e9\u05d4</h3>
    <p class="auth-helper">\u05d4\u05e7\u05dc\u05d9\u05d3\u05d9 \u05e1\u05d9\u05e1\u05de\u05d4 \u05d7\u05d3\u05e9\u05d4 \u05e4\u05e2\u05de\u05d9\u05d9\u05dd, \u05e9\u05de\u05e8\u05d9, \u05d5\u05d0\u05d6 \u05ea\u05d5\u05db\u05dc\u05d9 \u05dc\u05d4\u05d9\u05db\u05e0\u05e1 \u05e9\u05d5\u05d1 \u05dc\u05d7\u05e9\u05d1\u05d5\u05df \u05e9\u05dc\u05da.</p>
    <label class="field">
      <span>\u05e1\u05d9\u05e1\u05de\u05d4 \u05d7\u05d3\u05e9\u05d4</span>
      <div class="password-field-control">
        <input id="customerRecoveryNewPassword" type="password" name="newPassword" required>
        <button
          class="password-visibility-button"
          type="button"
          data-password-toggle="customerRecoveryNewPassword"
          aria-label="\u05d4\u05e6\u05d2\u05ea \u05e1\u05d9\u05e1\u05de\u05d4"
          title="\u05d4\u05e6\u05d2\u05ea \u05e1\u05d9\u05e1\u05de\u05d4"
          aria-pressed="false"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z"></path>
            <circle cx="12" cy="12" r="3"></circle>
          </svg>
        </button>
      </div>
    </label>
    <label class="field">
      <span>\u05d0\u05d9\u05de\u05d5\u05ea \u05e1\u05d9\u05e1\u05de\u05d4</span>
      <div class="password-field-control">
        <input id="customerRecoveryConfirmPassword" type="password" name="confirmPassword" required>
        <button
          class="password-visibility-button"
          type="button"
          data-password-toggle="customerRecoveryConfirmPassword"
          aria-label="\u05d4\u05e6\u05d2\u05ea \u05e1\u05d9\u05e1\u05de\u05d4"
          title="\u05d4\u05e6\u05d2\u05ea \u05e1\u05d9\u05e1\u05de\u05d4"
          aria-pressed="false"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z"></path>
            <circle cx="12" cy="12" r="3"></circle>
          </svg>
        </button>
      </div>
    </label>
    <button class="primary-button" type="submit">\u05e9\u05de\u05d5\u05e8 \u05e1\u05d9\u05e1\u05de\u05d4 \u05d7\u05d3\u05e9\u05d4</button>
    <button class="ghost-button" id="cancelCustomerRecoveryButton" type="button">\u05d7\u05d6\u05e8\u05d4 \u05dc\u05db\u05e0\u05d9\u05e1\u05d4</button>
  `;
  customerRecoveryForm.classList.remove("is-hidden");
  customerRecoveryForm.classList.remove("is-active");

  customerChooserPanel = document.getElementById("customerChooserPanel");
  customerSignupForm = document.getElementById("customerSignupForm");
  customerForgotPasswordButton = document.getElementById("customerForgotPasswordButton");
  cancelCustomerRecoveryButton = document.getElementById("cancelCustomerRecoveryButton");
  customerEmailConfirmedButton = document.getElementById("customerEmailConfirmedButton");
  openCustomerSignupButton = document.getElementById("openCustomerSignupButton");
  openCustomerExistingLoginButton = document.getElementById("openCustomerExistingLoginButton");
  backToCustomerChooserFromSignup = document.getElementById("backToCustomerChooserFromSignup");
  backToCustomerChooserFromLogin = document.getElementById("backToCustomerChooserFromLogin");
}
initializeCustomerAuthDom();

function initializePasswordVisibilityToggles(root = document) {
  root.querySelectorAll(".password-visibility-button[data-password-toggle]").forEach((button) => {
    if (button.dataset.passwordToggleBound === "true") {
      return;
    }

    button.dataset.passwordToggleBound = "true";

    button.addEventListener("click", () => {
      const targetId = button.dataset.passwordToggle;
      const targetInput = targetId ? document.getElementById(targetId) : null;
      if (!targetInput) {
        return;
      }

      const shouldReveal = targetInput.type === "password";
      targetInput.type = shouldReveal ? "text" : "password";

      const nextLabel = shouldReveal
        ? "\u05d4\u05e1\u05ea\u05e8\u05ea \u05e1\u05d9\u05e1\u05de\u05d4"
        : "\u05d4\u05e6\u05d2\u05ea \u05e1\u05d9\u05e1\u05de\u05d4";

      button.setAttribute("aria-label", nextLabel);
      button.setAttribute("title", nextLabel);
      button.setAttribute("aria-pressed", shouldReveal ? "true" : "false");
    });
  });
}

initializePasswordVisibilityToggles();

function setCustomerEmailConfirmationButtonVisible(isVisible) {
  customerEmailConfirmedButton?.classList.toggle("is-hidden", !isVisible);
}

function prepareCustomerLoginAfterSignup(email) {
  if (customerLoginForm?.elements?.email) {
    customerLoginForm.elements.email.value = String(email || "").trim().toLowerCase();
  }
  if (customerLoginForm?.elements?.password) {
    customerLoginForm.elements.password.value = "";
  }
  setCustomerEmailConfirmationButtonVisible(true);
  showCustomerLoginPanel();
}

function getCustomerSignupErrorMessage(error) {
  const message = String(error?.message || "").toLowerCase();

  if (message.includes("email confirmation")) {
    return {
      text: "החשבון נוצר בהצלחה. שלחנו לך מייל לאישור החשבון. פתחי את המייל ולחצי על הקישור, ואז תוכלי להתחבר.",
      variant: "success",
      needsEmailConfirmation: true
    };
  }

  if (
    message.includes("already registered")
    || message.includes("already exists")
    || message.includes("user already")
    || message.includes("email exists")
    || message.includes("email address is already")
    || message.includes("database error saving new user")
  ) {
    return {
      text: "כבר קיים חשבון עם האימייל הזה. נסי להתחבר דרך 'כניסה ללקוחה קיימת'.",
      variant: "error",
      needsEmailConfirmation: false
    };
  }

  if (
    message.includes("password")
    && (message.includes("weak") || message.includes("least") || message.includes("short") || message.includes("6"))
  ) {
    return {
      text: "הסיסמה קצרה מדי. בחרי סיסמה חזקה יותר.",
      variant: "error",
      needsEmailConfirmation: false
    };
  }

  if (
    message.includes("claim_customer_account")
    || message.includes("customer_auth")
    || message.includes("permission denied")
  ) {
    return {
      text: "יש כרגע בעיה זמנית ביצירת החשבון. נסי שוב בעוד רגע, ואם זה חוזר על עצמו תגידי לי ואסדר את החיבור.",
      variant: "error",
      needsEmailConfirmation: false
    };
  }

  return {
    text: "לא הצלחנו ליצור את החשבון כרגע. נסי שוב בעוד רגע.",
    variant: "error",
    needsEmailConfirmation: false
  };
}

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
      services: normalizeServices(Array.isArray(parsed.services) && parsed.services.length ? parsed.services : defaults.services),
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
let publicRefreshTimeoutId = null;
let isHydratingPublicState = false;
let isCustomerPasswordRecoveryMode = false;
let publicSupabaseErrorMessage = "";
let publicSupabaseErrorTimestamp = 0;
let publicLoadedFromSupabase = false;

function revealPublicApp() {
  document.documentElement.classList.remove("app-booting");
}

function shouldPreserveRenderedBusiness() {
  return Boolean(
    String(brandName?.textContent || "").trim() ||
    String(businessName?.textContent || "").trim() ||
    (publicLoadedFromSupabase && state.business?.id && String(state.business?.name || "").trim())
  );
}

function showPublicLoadingState(message = "טוען נתוני עסק...") {
  if (shouldPreserveRenderedBusiness()) {
    return;
  }

  brandName.textContent = message;
  businessName.textContent = message;
  businessDescription.textContent = "מושך את שם העסק, השירותים והשעות.";
}

function showPublicSupabaseError(error) {
  const message = appUi.translateMessage?.(error?.message || "לא הצלחנו לטעון את נתוני העסק. נסו לרענן בעוד רגע.")
    || String(error?.message || "לא הצלחנו לטעון את נתוני העסק. נסו לרענן בעוד רגע.");
  const now = Date.now();
  if (message === publicSupabaseErrorMessage && now - publicSupabaseErrorTimestamp < 5000) {
    return;
  }

  publicSupabaseErrorMessage = message;
  publicSupabaseErrorTimestamp = now;
  brandName.textContent = "שגיאת סנכרון";
  businessName.textContent = "לא הצלחנו לטעון את העסק";
  businessDescription.textContent = message;
  appUi.toast(message, { variant: "error" });
}

function clearRealtimeSubscriptions(collection) {
  if (collection === publicRealtimeCleanups && publicRefreshTimeoutId) {
    clearTimeout(publicRefreshTimeoutId);
    publicRefreshTimeoutId = null;
  }

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

  state.services = normalizeServices(Array.isArray(publicState.services) ? publicState.services : state.services);
  state.workingHours = Array.isArray(publicState.workingHours) ? publicState.workingHours : state.workingHours;
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

  isHydratingPublicState = true;
  try {
    await syncSessionFromSupabase();
    const publicState = await supabaseApi.loadPublicState();
    if (!publicState?.business?.id) {
      throw new Error("לא נמצא עסק פעיל להצגה כרגע.");
    }

    mergePublicState(publicState);

    if (session.role === "customer") {
      const customerState = await supabaseApi.loadCustomerState();
      mergeCustomerState(customerState);
    } else {
      state.notifications = [];
      state.waitlistEntries = [];
    }

    publicLoadedFromSupabase = true;
    saveState();
    rerenderAll();
    window.setTimeout(focusCustomerBookingFromUrl, 0);
    notificationCenter?.showNewBrowserNotifications();
  } catch (error) {
    publicLoadedFromSupabase = false;
    showPublicSupabaseError(error);
    throw error;
  } finally {
    isHydratingPublicState = false;
  }
}

function schedulePublicRefresh() {
  if (!supabaseEnabled) {
    return;
  }

  if (publicRefreshTimeoutId) {
    clearTimeout(publicRefreshTimeoutId);
  }

  publicRefreshTimeoutId = setTimeout(() => {
    publicRefreshTimeoutId = null;
    void refreshStateFromSupabase().catch(() => {});
  }, 250);
}

function setupPublicRealtimeSubscriptions() {
  if (!supabaseEnabled) {
    return;
  }

  clearRealtimeSubscriptions(publicRealtimeCleanups);
  ["business", "services", "working_hours", "special_hours", "bookings"].forEach((table) => {
    publicRealtimeCleanups.push(supabaseApi.subscribe(table, () => {
      schedulePublicRefresh();
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
    schedulePublicRefresh();
  }, `customer_auth_user_id=eq.${session.authUserId}`));
  personalRealtimeCleanups.push(supabaseApi.subscribe("notifications", () => {
    schedulePublicRefresh();
  }, `user_id=eq.${session.authUserId}`));
  personalRealtimeCleanups.push(supabaseApi.subscribe("waitlist_entries", () => {
    schedulePublicRefresh();
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

function buildPendingBookingDraft() {
  const fullName = String(bookingForm?.elements?.fullName?.value || uiState.bookingDraft.fullName || "").trim();
  const phone = String(bookingForm?.elements?.phone?.value || uiState.bookingDraft.phone || "").trim();
  const notes = String(bookingForm?.elements?.notes?.value || uiState.bookingDraft.notes || "").trim();
  const serviceIds = getSelectedServiceIds();
  const draft = {
    wizardStep: Number(uiState.wizardStep || 1),
    scheduleMode: String(uiState.scheduleMode || "firstAvailable"),
    selectedServiceIds: serviceIds,
    selectedStaffId: String(uiState.selectedStaffId || DEFAULT_OWNER_STAFF.id),
    selectedDate: String(uiState.selectedDate || ""),
    selectedTime: String(uiState.selectedTime || ""),
    selectedMonthKey: String(uiState.selectedMonthKey || monthKey(new Date())),
    replacementBookingId: uiState.replacementBookingId ? String(uiState.replacementBookingId) : "",
    bookingDraft: {
      fullName,
      phone,
      notes
    }
  };

  const hasMeaningfulState = Boolean(
    serviceIds.length
    || draft.selectedDate
    || draft.selectedTime
    || fullName
    || phone
    || notes
    || draft.wizardStep > 1
  );

  return hasMeaningfulState ? draft : null;
}

function savePendingBookingDraft() {
  const draft = buildPendingBookingDraft();
  if (!draft) {
    sessionStorage.removeItem(PENDING_BOOKING_DRAFT_KEY);
    return;
  }

  sessionStorage.setItem(PENDING_BOOKING_DRAFT_KEY, JSON.stringify(draft));
}

function loadPendingBookingDraft() {
  try {
    const raw = sessionStorage.getItem(PENDING_BOOKING_DRAFT_KEY);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw);
  } catch (error) {
    sessionStorage.removeItem(PENDING_BOOKING_DRAFT_KEY);
    return null;
  }
}

function clearPendingBookingDraft() {
  sessionStorage.removeItem(PENDING_BOOKING_DRAFT_KEY);
}

function restorePendingBookingDraft() {
  const draft = loadPendingBookingDraft();
  if (!draft) {
    return false;
  }

  const nextServiceIds = (Array.isArray(draft.selectedServiceIds) ? draft.selectedServiceIds : [])
    .map((serviceId) => String(serviceId || "").trim())
    .filter((serviceId) => serviceId && state.services.some((service) => service.id === serviceId));

  syncSelectedServiceState(nextServiceIds);

  const requestedStaffId = String(draft.selectedStaffId || DEFAULT_OWNER_STAFF.id);
  uiState.selectedStaffId = state.staff.some((staff) => staff.id === requestedStaffId)
    ? requestedStaffId
    : DEFAULT_OWNER_STAFF.id;
  uiState.selectedDate = String(draft.selectedDate || "");
  uiState.selectedTime = String(draft.selectedTime || "");
  uiState.selectedMonthKey = String(
    draft.selectedMonthKey
    || (uiState.selectedDate ? monthKey(new Date(`${uiState.selectedDate}T00:00:00`)) : monthKey(new Date()))
  );
  uiState.scheduleMode = draft.scheduleMode === "calendar" ? "calendar" : "firstAvailable";
  uiState.replacementBookingId = draft.replacementBookingId || null;
  uiState.bookingDraft = {
    fullName: String(draft.bookingDraft?.fullName || ""),
    phone: String(draft.bookingDraft?.phone || ""),
    notes: String(draft.bookingDraft?.notes || "")
  };

  const requestedStep = Number(draft.wizardStep || 1);
  const normalizedStep = Number.isFinite(requestedStep) ? Math.min(Math.max(requestedStep, 1), 4) : 1;

  hideBookingSuccess();
  rerenderAll();
  showWizardStep(normalizedStep);
  renderBookingSummary();
  return true;
}







function restoreRememberedCustomerSession() {
  if (supabaseEnabled) {
    return;
  }

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





































function getCurrentNotificationUserId() {
  if (session.role === "seller" && session.authUserId) {
    return session.authUserId;
  }

  if (session.role === "customer" && session.authUserId) {
    return session.authUserId;
  }

  return "";
}



function getOwnerNotificationTargetId() {
  return session.authUserId || "owner";
}





function notifyOwnerAppointmentBooked(booking) {
  pushAppNotification(
    getOwnerNotificationTargetId(),
    "נקבע תור חדש",
    `${getBookingCustomerName(booking)} קבעה תור ל${booking.service_name} בתאריך ${getBookingDateTimeText(booking)}.`,
    "appointment_booked"
  );
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

function formatDurationMinutes(minutes) {
  return `${Number(minutes)} דקות`;
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



















function getReplacementSourceBooking() {
  if (!uiState.replacementBookingId) {
    return null;
  }

  return findBookingById(uiState.replacementBookingId);
}

function findPendingChangeRequestForBooking(bookingId) {
  return state.bookings.find((booking) => booking.replaces_booking_id === bookingId && booking.status === "pending") || null;
}



function clearReplacementBooking() {
  uiState.replacementBookingId = null;
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
    duration_minutes: services.reduce((sum, service) => sum + Number(service.duration_minutes || 0), 0),
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

function shouldSkipStaffStep() {
  return getRealStaffMembers().length === 1;
}

function selectOnlyStaffMember() {
  const staffMembers = getRealStaffMembers();
  if (staffMembers.length === 1) {
    uiState.selectedStaffId = staffMembers[0].id;
    return true;
  }
  return false;
}

function getCurrentCustomer() {
  if (!session.customerPhone) {
    return null;
  }
  return state.users.find((user) => isSamePhone(user.phone, session.customerPhone)) || null;
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
    <div class="summary-row"><span>${booking.service_ids?.length > 1 ? "שירותים" : "שירות"}</span><strong>${escapePublicHtml(booking.service_name)}</strong></div>
    <div class="summary-row"><span>אשת צוות</span><strong>${escapePublicHtml(booking.staff_name)}</strong></div>
    <div class="summary-row"><span>תאריך</span><strong>${formatDisplayDate(booking.booking_date)}</strong></div>
    <div class="summary-row"><span>שעה</span><strong>${escapePublicHtml(booking.booking_time)}</strong></div>
    <div class="summary-row"><span>משך כולל</span><strong>${escapePublicHtml(booking.duration_minutes)} דקות</strong></div>
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
  const safeCoverImage = cssImageUrl(coverImage);

  businessCoverImage.style.backgroundImage = safeCoverImage
    ? `linear-gradient(rgba(110, 70, 118, 0.18), rgba(110, 70, 118, 0.18)), ${safeCoverImage}`
    : "";

  businessAvatar.style.backgroundImage = cssImageUrl(profileImage);
}

function renderBusiness() {
  applyThemeColor(state.business.features?.themeAccent);
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
  const skipStaff = shouldSkipStaffStep();
  const visibleSteps = skipStaff ? [1, 3, 4] : [1, 2, 3, 4];
  const currentPosition = visibleSteps.indexOf(uiState.wizardStep);
  document.getElementById("wizardSteps")?.classList.toggle("is-three-steps", skipStaff);

  wizardSteps.forEach((step) => {
    const stepNumber = Number(step.dataset.stepIndicator);
    const position = visibleSteps.indexOf(stepNumber);
    step.classList.toggle("is-hidden", position === -1);
    step.classList.toggle("is-active", stepNumber === uiState.wizardStep);
    step.classList.toggle("is-complete", position !== -1 && position < currentPosition);
    const numberElement = step.querySelector(".wizard-step-number");
    if (numberElement && position !== -1) {
      numberElement.textContent = String(position + 1);
    }
  });

  goToStaffStep.textContent = skipStaff ? "המשך לבחירת תאריך" : "המשך לבחירת צוות";
  backToStaffStep.textContent = skipStaff ? "חזרה לבחירת שירות" : "חזרה לבחירת צוות";
}

function showWizardStep(stepNumber) {
  const resolvedStep = stepNumber === 2 && shouldSkipStaffStep() ? 3 : stepNumber;
  uiState.wizardStep = resolvedStep;
  servicesStep.classList.toggle("is-active", resolvedStep === 1);
  staffStep.classList.toggle("is-active", resolvedStep === 2);
  scheduleStep.classList.toggle("is-active", resolvedStep === 3);
  detailsStep.classList.toggle("is-active", resolvedStep === 4);
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
        <h3 class="category-title">${escapePublicHtml(category)}</h3>
        <div class="services-grid">
          ${services.map((service) => `
            <button class="service-card ${selectedIds.includes(service.id) ? "is-selected" : ""}" type="button" data-service-id="${escapePublicHtml(service.id)}">
              <div class="service-card-head">
                <strong>${escapePublicHtml(service.name)}</strong>
                <span class="service-card-check" aria-hidden="true"></span>
              </div>
              <div class="service-card-meta">
                <span>${formatPrice(service.price)} | ${formatDurationMinutes(service.duration_minutes)}</span>
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
      <button class="staff-card ${staff.id === uiState.selectedStaffId ? "is-selected" : ""}" type="button" data-staff-id="${escapePublicHtml(staff.id)}">
        <div class="staff-avatar" aria-hidden="true">${escapePublicHtml(staff.initials)}</div>
        <strong>${escapePublicHtml(staff.name)}</strong>
        <span>${escapePublicHtml(staff.role)}</span>
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
    <div class="selected-summary-row"><span>${serviceBundle.ids.length > 1 ? "שירותים" : "שירות"}</span><strong>${escapePublicHtml(serviceBundle.name)}</strong></div>
    <div class="selected-summary-row"><span>כמה שירותים</span><strong>${serviceBundle.ids.length}</strong></div>
    <div class="selected-summary-row"><span>מחיר כולל</span><strong>${formatPrice(serviceBundle.price)}</strong></div>
    <div class="selected-summary-row"><span>משך כולל</span><strong>${formatDurationMinutes(serviceBundle.duration_minutes)}</strong></div>
    <div class="selected-summary-row"><span>צוות</span><strong>${escapePublicHtml(staff.name)}</strong></div>
    ${uiState.replacementBookingId ? '<div class="selected-summary-row"><span>מצב</span><strong>שינוי תור קיים</strong></div>' : ""}
  `;
}

function renderBookingSummary() {
  const serviceBundle = getSelectedServiceBundle();
  const staff = getSelectedStaff();
  const dateText = uiState.selectedDate ? formatDisplayDate(uiState.selectedDate) : "-";
  const timeText = uiState.selectedTime || "-";

  bookingSummaryCard.innerHTML = `
    <div class="summary-row"><span>${serviceBundle?.ids.length > 1 ? "שירותים" : "שירות"}</span><strong>${serviceBundle ? escapePublicHtml(serviceBundle.name) : "-"}</strong></div>
    <div class="summary-row"><span>משך כולל</span><strong>${serviceBundle ? formatDurationMinutes(serviceBundle.duration_minutes) : "-"}</strong></div>
    <div class="summary-row"><span>מחיר כולל</span><strong>${serviceBundle ? formatPrice(serviceBundle.price) : "-"}</strong></div>
    <div class="summary-row"><span>אשת צוות</span><strong>${staff ? escapePublicHtml(staff.name) : "-"}</strong></div>
    <div class="summary-row"><span>תאריך</span><strong>${dateText}</strong></div>
    <div class="summary-row"><span>שעה</span><strong>${timeText}</strong></div>
    ${uiState.replacementBookingId ? '<div class="summary-row"><span>סוג פעולה</span><strong>שינוי תור קיים</strong></div>' : ""}
  `;
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

  for (let start = openMinutes; start + Number(serviceBundle.duration_minutes) <= closeMinutes; start += interval) {
    const slotTime = formatMinutesToTime(start);

    if (dateValue === todayDate() && isPastTime(dateValue, slotTime)) {
      continue;
    }

    if (isSlotBlocked(dateValue, slotTime)) {
      continue;
    }

    const assignableStaffIds = getAssignableStaffIds(dateValue, start, Number(serviceBundle.duration_minutes));
    if (assignableStaffIds.includes(staffId)) {
      slots.push(slotTime);
    }
  }

  return slots;
}

function hasAvailabilityOnDate(dateValue) {
  return getAvailableSlots(dateValue).length > 0;
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
    morning: [],
    afternoon: [],
    evening: []
  };

  times.forEach((time) => {
    const hour = Number(time.split(":")[0]);
    if (hour < 12) {
      groups.morning.push(time);
    } else if (hour < 17) {
      groups.afternoon.push(time);
    } else {
      groups.evening.push(time);
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
        <article class="booking-card status-card-${presentation.statusClass}" data-booking-card-id="${escapePublicHtml(booking.id)}">
          <div class="booking-card-head">
            <strong>${escapePublicHtml(booking.service_name)}</strong>
            <div class="booking-card-badges">
              <span class="status-pill status-${presentation.statusClass}">${presentation.statusLabel}</span>
              ${booking.status === "approved" && booking.arrival_status ? `<span class="status-pill arrival-pill arrival-${booking.arrival_status}">${formatArrivalStatus(booking.arrival_status)}</span>` : ""}
            </div>
          </div>
          <div class="booking-meta">
            <span>${formatDisplayDate(booking.booking_date)}</span>
            <span>${escapePublicHtml(booking.booking_time)}</span>
            <span>${escapePublicHtml(booking.staff_name)}</span>
          </div>
          ${booking.status === "approved" && booking.arrival_status ? `<div class="booking-note">מצב הגעה: ${formatArrivalStatus(booking.arrival_status)}</div>` : ""}
          ${attendanceStatusText ? `<div class="booking-note">אישור הגעה: ${attendanceStatusText}</div>` : ""}
          ${booking.notes ? `<div class="booking-note">הערה: ${escapePublicHtml(booking.notes)}</div>` : ""}
          ${preparationMessage ? `<div class="booking-note">הכנה לתור: ${escapePublicHtml(preparationMessage)}</div>` : ""}
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
                  ${canExportCalendar ? `<button class="ghost-button calendar-choice-button" type="button" data-booking-id="${escapePublicHtml(booking.id)}">הוספה ליומן</button>` : ""}
                  ${canChangeThisBooking ? `<button class="ghost-button replace-booking-button" type="button" data-booking-id="${escapePublicHtml(booking.id)}">שינוי תור</button>` : ""}
                  ${canRespondAttendance ? `<button class="ghost-button confirm-arrival-button" type="button" data-booking-id="${escapePublicHtml(booking.id)}" data-attendance-response="confirmed">אני מגיעה</button>` : ""}
                  ${canRespondAttendance ? `<button class="ghost-button decline-arrival-button" type="button" data-booking-id="${escapePublicHtml(booking.id)}" data-attendance-response="declined">לא אוכל להגיע</button>` : ""}
                  <button class="danger-button cancel-booking-button" type="button" data-booking-id="${escapePublicHtml(booking.id)}">ביטול</button>
                </div>
              `
              : presentation.bucket === "completed"
                ? canExportCalendar
                  ? `
                    <div class="booking-card-actions">
                      <button class="ghost-button calendar-choice-button" type="button" data-booking-id="${escapePublicHtml(booking.id)}">הוספה ליומן</button>
                    </div>
                  `
                  : ""
                : `
                  <div class="booking-card-actions">
                    <button class="ghost-button hide-cancelled-booking-button" type="button" data-booking-id="${escapePublicHtml(booking.id)}">מחיקה מהרשימה</button>
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
          <strong>${escapePublicHtml(booking.booking_time)}</strong>
          <div class="booking-card-badges">
            <span class="status-pill status-${booking.status}">${formatStatus(booking.status)}</span>
            ${booking.status === "approved" ? `<span class="status-pill arrival-pill arrival-${booking.arrival_status}">${formatArrivalStatus(booking.arrival_status)}</span>` : ""}
          </div>
        </div>
        <div class="booking-meta">
          <span>${escapePublicHtml(`${booking.customer_first_name} ${booking.customer_last_name}`)}</span>
          <span>${escapePublicHtml(booking.service_name)}</span>
          <span>${escapePublicHtml(booking.staff_name)}</span>
        </div>
        ${booking.notes ? `<div class="booking-note">הערה: ${escapePublicHtml(booking.notes)}</div>` : ""}
        ${
          booking.status === "approved"
            ? `
              <label class="arrival-status-field">
                <span>מצב הגעה</span>
                <select class="arrival-status-select" data-booking-id="${escapePublicHtml(booking.id)}">
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
                <button class="ghost-button calendar-choice-button" type="button" data-booking-id="${escapePublicHtml(booking.id)}">הוספה ליומן</button>
                <button class="danger-button seller-cancel-booking-button" type="button" data-booking-id="${escapePublicHtml(booking.id)}">ביטול תור</button>
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
          <strong>${escapePublicHtml(`${booking.customer_first_name} ${booking.customer_last_name}`)}</strong>
          <div class="booking-card-badges">
            <span class="status-pill status-${booking.status}">${formatStatus(booking.status)}</span>
            ${booking.status === "approved" ? `<span class="status-pill arrival-pill arrival-${booking.arrival_status}">${formatArrivalStatus(booking.arrival_status)}</span>` : ""}
          </div>
        </div>
        <div class="booking-meta">
          <span>${escapePublicHtml(booking.service_name)}</span>
          <span>${formatDisplayDate(booking.booking_date)}</span>
          <span>${escapePublicHtml(booking.booking_time)}</span>
          <span>${escapePublicHtml(booking.staff_name)}</span>
        </div>
        ${booking.notes ? `<div class="booking-note">הערה: ${escapePublicHtml(booking.notes)}</div>` : ""}
        ${
          booking.status === "approved"
            ? `
              <label class="arrival-status-field">
                <span>מצב הגעה</span>
                <select class="arrival-status-select" data-booking-id="${escapePublicHtml(booking.id)}">
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
                <button class="primary-button approve-booking-button" type="button" data-booking-id="${escapePublicHtml(booking.id)}">אישור תור</button>
                <button class="danger-button reject-booking-button" type="button" data-booking-id="${escapePublicHtml(booking.id)}">דחיית תור</button>
                <button class="ghost-button calendar-choice-button" type="button" data-booking-id="${escapePublicHtml(booking.id)}">הוספה ליומן</button>
                <button class="danger-button seller-cancel-booking-button" type="button" data-booking-id="${escapePublicHtml(booking.id)}">ביטול תור</button>
              </div>
            `
            : ["approved"].includes(booking.status)
              ? `
                <div class="seller-actions">
                  <button class="ghost-button calendar-choice-button" type="button" data-booking-id="${escapePublicHtml(booking.id)}">הוספה ליומן</button>
                  <button class="danger-button seller-cancel-booking-button" type="button" data-booking-id="${escapePublicHtml(booking.id)}">ביטול תור</button>
                </div>
              `
              : ""
        }
        ${
          booking.status === "rejected" && isRejectUndoActiveForBooking(booking.id)
            ? `
              <div class="undo-strip">
                <span>התור נדחה. אפשר לבטל את הדחייה במשך כמה שניות.</span>
                <button class="ghost-button undo-reject-button" type="button" data-booking-id="${escapePublicHtml(booking.id)}">ביטול דחייה</button>
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
      <div class="editor-row" data-service-id="${escapePublicHtml(service.id)}">
        <input type="text" value="${escapePublicHtml(service.name)}" data-service-field="name">
        <input type="text" value="${escapePublicHtml(service.category)}" data-service-field="category">
        <input type="number" min="0" value="${service.price}" data-service-field="price">
        <input type="number" min="5" step="5" value="${service.duration_minutes}" data-service-field="duration_minutes">
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
          <div class="editor-row editor-row-hours" data-hour-id="${escapePublicHtml(row.id)}">
            <input type="text" value="${escapePublicHtml(row.day_label)}" placeholder="יום" data-hour-field="day_label">
            <input type="time" value="${row.opens_at || ""}" data-hour-field="opens_at">
            <input type="time" value="${row.closes_at || ""}" data-hour-field="closes_at">
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
  myBookingsButton?.classList.toggle("is-hidden", !customerUiVisible);
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
  if (selectOnlyStaffMember()) {
    return true;
  }
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
    savePendingBookingDraft();
    const draftName = parseFullName(uiState.bookingDraft.fullName);
    if (customerSignupForm && !customerSignupForm.elements.firstName.value) {
      customerSignupForm.elements.firstName.value = draftName.firstName;
    }
    if (customerSignupForm && !customerSignupForm.elements.lastName.value) {
      customerSignupForm.elements.lastName.value = draftName.lastName;
    }
    if (customerSignupForm && !customerSignupForm.elements.phone.value) {
      customerSignupForm.elements.phone.value = uiState.bookingDraft.phone;
    }
  }

  authModal.classList.remove("is-hidden");
  showAuthTab(role);
}

function closeAuthModal() {
  authModal.classList.add("is-hidden");
  showCustomerChooserPanel();
}

function showAuthTab(tabName) {
  modalTabs.forEach((tab) => {
    tab.classList.toggle("is-active", tab.dataset.authTab === tabName);
  });

  if (tabName === "seller") {
    customerChooserPanel?.classList.remove("is-active");
    customerSignupForm?.classList.remove("is-active");
    customerLoginForm.classList.remove("is-active");
    customerRecoveryForm?.classList.remove("is-active");
    sellerLoginForm.classList.add("is-active");
    return;
  }

  sellerLoginForm.classList.remove("is-active");
  showCustomerChooserPanel();
}

function showCustomerChooserPanel() {
  setCustomerEmailConfirmationButtonVisible(false);
  customerChooserPanel?.classList.add("is-active");
  customerSignupForm?.classList.remove("is-active");
  customerLoginForm?.classList.remove("is-active");
  customerRecoveryForm?.classList.remove("is-active");
}

function showCustomerSignupPanel() {
  setCustomerEmailConfirmationButtonVisible(false);
  customerChooserPanel?.classList.remove("is-active");
  customerSignupForm?.classList.add("is-active");
  customerLoginForm?.classList.remove("is-active");
  customerRecoveryForm?.classList.remove("is-active");
}

function showCustomerLoginPanel() {
  isCustomerPasswordRecoveryMode = false;
  customerChooserPanel?.classList.remove("is-active");
  customerSignupForm?.classList.remove("is-active");
  customerLoginForm?.classList.add("is-active");
  customerRecoveryForm?.classList.remove("is-active");
}

function showCustomerRecoveryPanel() {
  isCustomerPasswordRecoveryMode = true;
  setCustomerEmailConfirmationButtonVisible(false);
  authModal.classList.remove("is-hidden");
  showAuthTab("customer");
  customerChooserPanel?.classList.remove("is-active");
  customerSignupForm?.classList.remove("is-active");
  customerLoginForm?.classList.remove("is-active");
  customerRecoveryForm?.classList.add("is-active");
}

async function finalizeCustomerLogin({ fullName = "", phone = "" } = {}) {
  session.role = "customer";
  session.authUserId = (await supabaseApi.getCurrentUser())?.id || null;
  session.customerPhone = normalizePhoneNumber(phone) || session.customerPhone;
  uiState.customerBookingsView = "active";
  if (fullName) {
    uiState.bookingDraft.fullName = fullName;
  }
  if (phone) {
    uiState.bookingDraft.phone = phone;
  }
  closeAuthModal();
  await refreshStateFromSupabase();
  restorePendingBookingDraft();
  setupPersonalRealtimeSubscriptions();
  if (session.customerPhone) {
    rememberCustomerSession(session.customerPhone);
  }
  notificationCenter?.rememberCurrentNotifications();
}

function finalizeLocalCustomerLogin(user) {
  session.role = "customer";
  session.authUserId = user.id || `local-customer:${normalizePhoneNumber(user.phone)}`;
  session.customerPhone = normalizePhoneNumber(user.phone);
  uiState.customerBookingsView = "active";
  uiState.bookingDraft.fullName = buildCustomerFullName(user.firstName, user.lastName);
  uiState.bookingDraft.phone = user.phone;
  rememberCustomerSession(user.phone);
  closeAuthModal();
  restorePendingBookingDraft();
  notificationCenter?.rememberCurrentNotifications();
  rerenderAll();
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
      email: "",
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
    customer.email = customer.email || "";
    customer.created_at ||= new Date().toISOString();
    customer.no_show_count = Number(customer.no_show_count || 0);
  }
  session.customerPhone = normalizePhoneNumber(phone);
  rememberCustomerSession(session.customerPhone);
}



function resolveAssignedStaff(dateValue, timeValue, service) {
  const startMinutes = parseTimeToMinutes(timeValue);
  const assignableStaffIds = getAssignableStaffIds(dateValue, startMinutes, Number(service.duration_minutes));

  return getRealStaffMembers().find((staff) => staff.id === uiState.selectedStaffId && assignableStaffIds.includes(staff.id)) || null;
}

function resetBookingSelection() {
  syncSelectedServiceState([]);
  uiState.selectedStaffId = DEFAULT_OWNER_STAFF.id;
  uiState.selectedDate = "";
  uiState.selectedTime = "";
  uiState.selectedMonthKey = monthKey(new Date());
  uiState.scheduleMode = "firstAvailable";
  uiState.bookingDraft = {
    fullName: "",
    phone: "",
    notes: ""
  };
  clearReplacementBooking();
  clearPendingBookingDraft();
  showWizardStep(1);
}

openCustomerLogin.addEventListener("click", () => openAuthModal("customer"));
openSellerLogin.addEventListener("click", () => {
  openAuthModal("seller");
});
myBookingsButton?.addEventListener("click", () => {
  customerBookingsPanel.scrollIntoView({ behavior: "smooth", block: "start" });
});
closeModal.addEventListener("click", closeAuthModal);

logoutButton.addEventListener("click", async () => {
  clearRejectUndo(false);
  clearReplacementBooking();
  closeCalendarChoice();
  clearRememberedCustomerSession();
  clearPendingBookingDraft();
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

openCustomerSignupButton?.addEventListener("click", () => {
  showCustomerSignupPanel();
});

openCustomerExistingLoginButton?.addEventListener("click", () => {
  showCustomerLoginPanel();
});

backToCustomerChooserFromSignup?.addEventListener("click", () => {
  showCustomerChooserPanel();
});

backToCustomerChooserFromLogin?.addEventListener("click", () => {
  showCustomerChooserPanel();
});

customerEmailConfirmedButton?.addEventListener("click", () => {
  setCustomerEmailConfirmationButtonVisible(false);
  showCustomerLoginPanel();
  customerLoginForm?.elements?.password?.focus?.();
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
  if (selectOnlyStaffMember()) {
    goToStep(3);
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

backToStaffStep.addEventListener("click", () => goToStep(shouldSkipStaffStep() ? 1 : 2));

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

customerSignupForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(customerSignupForm);
  const firstName = String(formData.get("firstName") || "").trim();
  const lastName = String(formData.get("lastName") || "").trim();
  const phone = String(formData.get("phone") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const confirmPassword = String(formData.get("confirmPassword") || "");
  const normalizedPhone = normalizePhoneNumber(phone);

  if (!firstName || !lastName || !normalizedPhone || !email || !password || !confirmPassword) {
    appUi.toast("צריך למלא את כל הפרטים כדי ליצור חשבון.", { variant: "error" });
    return;
  }

  if (password !== confirmPassword) {
    appUi.toast("הסיסמאות לא תואמות.", { variant: "error" });
    return;
  }

  if (!supabaseEnabled) {
    const existing = state.users.find((user) => user.email === email || isSamePhone(user.phone, normalizedPhone));
    if (existing && existing.email !== email) {
      appUi.toast("כבר קיים חשבון עם הטלפון הזה.", { variant: "error" });
      return;
    }

    const passwordHash = await hashPassword(password);
    const localUser = existing || {
      id: `local-customer-${Date.now()}`,
      owner_note: "",
      is_blocked: false,
      blocked_reason: "",
      blocked_at: "",
      no_show_count: 0,
      created_at: new Date().toISOString()
    };
    Object.assign(localUser, { firstName, lastName, phone: normalizedPhone, email, password: passwordHash });
    if (!existing) state.users.push(localUser);
    finalizeLocalCustomerLogin(localUser);
    saveState();
    appUi.toast("החשבון נוצר בהצלחה. את מחוברת עכשיו ויכולה לקבוע תור.", { variant: "success" });
    return;
  }

  try {
    const registration = await supabaseApi.registerCustomer({ firstName, lastName, phone, email, password });
    if (registration?.needsEmailConfirmation) {
      prepareCustomerLoginAfterSignup(email);
      appUi.toast("החשבון נוצר בהצלחה. שלחנו לך מייל לאישור החשבון. פתחי את המייל ולחצי על הקישור, ואז תוכלי להתחבר.", { variant: "success" });
      return;
    }
    await finalizeCustomerLogin({
      fullName: [firstName, lastName].filter(Boolean).join(" ").trim(),
      phone
    });
    setCustomerEmailConfirmationButtonVisible(false);
    appUi.toast("החשבון נוצר בהצלחה. את מחוברת עכשיו ויכולה לקבוע תור.", { variant: "success" });
    if (isCustomerBlocked(normalizedPhone)) {
      appUi.toast("התחברת, אבל החשבון חסום כרגע לקביעת תורים חדשים.", { variant: "warning" });
    }
  } catch (error) {
    const feedback = getCustomerSignupErrorMessage(error);
    if (feedback.needsEmailConfirmation) {
      prepareCustomerLoginAfterSignup(email);
    }
    appUi.toast(feedback.text, { variant: feedback.variant });
  }
});

customerLoginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(customerLoginForm);
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");

  if (!email || !password) {
    appUi.toast("צריך למלא אימייל וסיסמה.", { variant: "error" });
    return;
  }

  if (!supabaseEnabled) {
    const localUser = state.users.find((user) => user.email === email);
    const validPassword = localUser && await verifyStoredPassword(password, localUser.password, (passwordHash) => {
      localUser.password = passwordHash;
      saveState();
    });
    if (!validPassword) {
      appUi.toast("האימייל או הסיסמה אינם נכונים.", { variant: "error" });
      return;
    }
    finalizeLocalCustomerLogin(localUser);
    return;
  }

  try {
    const draftName = parseFullName(
      String(bookingForm?.elements?.fullName?.value || uiState.bookingDraft.fullName || "").trim()
    );
    const draftPhone = String(bookingForm?.elements?.phone?.value || uiState.bookingDraft.phone || "").trim();
    await supabaseApi.signInCustomer({
      email,
      password,
      phone: draftPhone,
      firstName: draftName.firstName,
      lastName: draftName.lastName
    });
    await finalizeCustomerLogin();
  } catch (error) {
    appUi.toast(error?.message || "לא הצלחנו להתחבר.", { variant: "error" });
  }
});

customerForgotPasswordButton?.addEventListener("click", async () => {
  if (!supabaseEnabled) {
    appUi.toast("איפוס סיסמה במייל זמין רק כשהחיבור ל-Supabase פעיל.", { variant: "warning" });
    return;
  }

  const email = String(customerLoginForm?.elements?.email?.value || "").trim().toLowerCase();
  if (!email) {
    appUi.toast("צריך למלא אימייל כדי לשלוח קישור לאיפוס סיסמה.", { variant: "error" });
    return;
  }

  try {
    clearRememberedCustomerSession();
    session.role = null;
    session.customerPhone = null;
    session.authUserId = null;
    await supabaseApi.signOut().catch(() => {});
    rerenderAll();
    await supabaseApi.sendCustomerPasswordReset(email);
    appUi.toast("שלחנו קישור לאיפוס סיסמה לאימייל שהקלדת.", { variant: "success" });
  } catch (error) {
    appUi.toast(error?.message || "לא הצלחנו לשלוח קישור לאיפוס סיסמה.", { variant: "error" });
  }
});

cancelCustomerRecoveryButton?.addEventListener("click", () => {
  showCustomerLoginPanel();
});

customerRecoveryForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!supabaseEnabled) {
    appUi.toast("חיבור Supabase עדיין לא זמין בדף הזה.", { variant: "error" });
    return;
  }

  const formData = new FormData(customerRecoveryForm);
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

  try {
    await supabaseApi.updateOwnerPassword(newPassword);
    appUi.toast("הסיסמה עודכנה, אפשר להתחבר.", { variant: "success" });
    await supabaseApi.signOut();
    isCustomerPasswordRecoveryMode = false;
    clearRememberedCustomerSession();
    session.role = null;
    session.customerPhone = null;
    session.authUserId = null;
    window.history.replaceState({}, document.title, window.location.pathname);
    showCustomerLoginPanel();
  } catch (error) {
    appUi.toast(error?.message || "לא הצלחנו לעדכן את הסיסמה.", { variant: "error" });
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
    let created = null;

    if (supabaseEnabled) {
      created = await supabaseApi.createBooking({
        serviceId: serviceBundle.primaryServiceId,
        serviceIds: serviceBundle.ids,
        firstName: nameParts.firstName,
        lastName: nameParts.lastName,
        phone,
        notes,
        bookingDate: uiState.selectedDate,
        bookingTime: uiState.selectedTime,
        replacesBookingId: replacedBookingId || null
      });
    } else {
      const bookingId = window.crypto?.randomUUID ? window.crypto.randomUUID() : `booking-${Date.now()}`;
      const localBooking = {
        id: bookingId,
        service_id: serviceBundle.primaryServiceId,
        service_ids: serviceBundle.ids,
        service_names: serviceBundle.names,
        service_name: serviceBundle.name,
        customer_first_name: nameParts.firstName,
        customer_last_name: nameParts.lastName,
        customer_phone: normalizePhoneNumber(phone),
        customer_auth_user_id: session.authUserId || "",
        notes,
        booking_date: uiState.selectedDate,
        booking_time: uiState.selectedTime,
        duration_minutes: serviceBundle.duration_minutes,
        staff_id: assignedStaff.id,
        staff_name: assignedStaff.name,
        status: "pending",
        customer_confirmed: false,
        replaces_booking_id: replacedBookingId || null,
        hidden_for_customer: false,
        arrival_status: "",
        attendance_confirmation_requested_at: "",
        attendance_confirmation_status: "",
        attendance_confirmation_answered_at: "",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      if (sourceBooking) {
        notifyOwnerAppointmentRescheduled(localBooking, sourceBooking);
      } else {
        notifyOwnerAppointmentBooked(localBooking);
      }

      state.bookings = normalizeBookings([...state.bookings, localBooking], state.staff, state.services);
      created = { booking_id: bookingId };
    }

    uiState.bookingDraft = {
      fullName: "",
      phone: "",
      notes: ""
    };
    clearReplacementBooking();
    clearPendingBookingDraft();
    saveState();
    if (supabaseEnabled) {
      await refreshStateFromSupabase();
    } else {
      rerenderAll();
    }
    showWizardStep(4);
    const newBooking = state.bookings.find((booking) => booking.id === created?.booking_id) || sourceBooking;
    if (newBooking) {
      showBookingSuccess(newBooking);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  } catch (error) {
    const isSlotConflict = error?.code === "23P01"
      || /time_slot_not_available|overlap|conflict|already.*booked|כבר.*נלקח/i.test(String(error?.message || ""));

    if (supabaseEnabled) {
      try {
        await refreshStateFromSupabase();
      } catch (refreshError) {
        console.warn("Could not refresh booking availability", refreshError);
      }
    }

    if (isSlotConflict) {
      uiState.selectedTime = "";
      appUi.toast("מצטערים, התור הזה כבר נלקח. אנא בחרי תור אחר.", { variant: "error" });
      goToStep(3);
    } else {
      appUi.toast("שגיאה בשמירת התור. נסי שוב.", { variant: "error" });
    }
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
    } else if (!supabaseEnabled && password) {
      state.sellerCredentials.password = await hashPassword(password);
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
    duration_minutes: 30
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
    duration_minutes: Number(row.querySelector('[data-service-field="duration_minutes"]').value)
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
      notifyOwnerAppointmentCancelled(booking, "הלקוחה");
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
  try {
    if (!supabaseEnabled) {
      restoreRememberedCustomerSession();
      notificationCenter?.rememberCurrentNotifications();
      rerenderAll();
      showWizardStep(1);
      return;
    }

    showPublicLoadingState();
    setupPublicRealtimeSubscriptions();
    try {
      await refreshStateFromSupabase();
      setupPersonalRealtimeSubscriptions();
      notificationCenter?.rememberCurrentNotifications();
      await handleEmailEntryLinks();
      showWizardStep(1);
    } catch (error) {
      clearRealtimeSubscriptions(personalRealtimeCleanups);
    }

    supabaseApi.onAuthStateChange(async (event) => {
      if (event === "PASSWORD_RECOVERY") {
        clearRememberedCustomerSession();
        session.role = null;
        session.customerPhone = null;
        session.authUserId = null;
        showCustomerRecoveryPanel();
        return;
      }
      if (event === "SIGNED_OUT") {
        isCustomerPasswordRecoveryMode = false;
      }
      try {
        if (isCustomerPasswordRecoveryMode) {
          return;
        }
        await refreshStateFromSupabase();
        setupPersonalRealtimeSubscriptions();
      } catch (error) {
        clearRealtimeSubscriptions(personalRealtimeCleanups);
      }
    });
  } finally {
    revealPublicApp();
  }
}

void initializeApp();
