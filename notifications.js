(function () {
  const OWNER_NOTIFICATION_USER_ID = "owner";
  const NOTIFICATION_PROMPT_KEY_PREFIX = "booking_app_notification_prompted_v2:";

  function createNotificationId() {
    if (window.crypto?.randomUUID) {
      return window.crypto.randomUUID();
    }

    return `notification-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function normalizeNotification(item) {
    let metadata = item?.metadata;
    if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
      metadata = {};
    }

    return {
      id: String(item?.id || createNotificationId()),
      title: String(item?.title || "התראה חדשה").trim(),
      message: String(item?.message || "").trim(),
      created_at: String(item?.created_at || new Date().toISOString()),
      is_read: Boolean(item?.is_read ?? item?.read),
      user_id: String(item?.user_id || item?.userId || "").trim(),
      type: String(item?.type || "general").trim(),
      booking_id: String(item?.booking_id || item?.bookingId || metadata.booking_id || "").trim(),
      action_url: String(item?.action_url || item?.actionUrl || "").trim(),
      event_key: String(item?.event_key || item?.eventKey || "").trim(),
      metadata: { ...metadata }
    };
  }

  function normalizeNotificationList(notifications) {
    if (!Array.isArray(notifications)) {
      return [];
    }

    const seen = new Set();
    return notifications
      .map(normalizeNotification)
      .filter((notification) => notification.user_id && notification.title)
      .filter((notification) => {
        if (seen.has(notification.id)) {
          return false;
        }

        seen.add(notification.id);
        return true;
      })
      .sort((left, right) => String(right.created_at).localeCompare(String(left.created_at)));
  }

  function formatNotificationTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "";
    }

    return new Intl.DateTimeFormat("he-IL", {
      dateStyle: "short",
      timeStyle: "short"
    }).format(date);
  }

  function getTypeLabel(type) {
    const labels = {
      appointment_booked: "תור חדש",
      appointment_cancelled: "ביטול תור",
      appointment_rescheduled: "שינוי תור",
      appointment_updated: "עדכון תור",
      appointment_rejected: "דחיית תור",
      booking_created: "התור התקבל",
      booking_approved: "התור אושר",
      booking_rejected: "התור נדחה",
      booking_cancelled: "התור בוטל",
      attendance_confirmed: "אישור הגעה",
      attendance_declined: "אי הגעה",
      waitlist_joined: "רשימת המתנה",
      waitlist_opened: "התפנה מקום",
      reminder: "תזכורת לתור",
      browser: "דפדפן",
      general: "כללי"
    };

    if (String(type).startsWith("booking_changed_")) {
      return "שינוי תור";
    }
    return labels[type] || labels[String(type).split(":")[0]] || "התראה";
  }

  function createNoopCenter() {
    return {
      notify: () => null,
      render: () => undefined,
      markAsRead: () => undefined,
      markAllAsRead: () => undefined,
      deleteNotification: () => undefined,
      askAfterOwnerLogin: () => undefined,
      rememberCurrentNotifications: () => undefined,
      showNewBrowserNotifications: () => undefined
    };
  }

  function createUiMessageCenter() {
    const existingRoot = document.getElementById("appUiMessageLayer");
    if (existingRoot) {
      return existingRoot.__appUiApi || createNoopCenter();
    }

    const root = document.createElement("div");
    root.id = "appUiMessageLayer";
    root.className = "app-ui-message-layer";
    root.innerHTML = `
      <div class="app-toast-stack" aria-live="polite" aria-atomic="true"></div>
      <div class="app-confirm-overlay is-hidden" role="presentation">
        <section class="app-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="appConfirmTitle" aria-describedby="appConfirmMessage">
          <div class="app-confirm-visual" aria-hidden="true">!</div>
          <div class="app-confirm-copy">
            <h3 id="appConfirmTitle">אישור פעולה</h3>
            <p id="appConfirmMessage"></p>
          </div>
          <div class="app-confirm-actions">
            <button class="ghost-button" type="button" data-app-confirm-action="cancel">ביטול</button>
            <button class="primary-button" type="button" data-app-confirm-action="confirm">אישור</button>
          </div>
        </section>
      </div>
    `;

    document.body.appendChild(root);

    const stack = root.querySelector(".app-toast-stack");
    const overlay = root.querySelector(".app-confirm-overlay");
    const confirmTitle = root.querySelector("#appConfirmTitle");
    const confirmMessage = root.querySelector("#appConfirmMessage");
    const confirmButton = root.querySelector('[data-app-confirm-action="confirm"]');
    const cancelButton = root.querySelector('[data-app-confirm-action="cancel"]');
    let pendingConfirmResolve = null;

    function closeConfirm(result) {
      if (overlay.classList.contains("is-hidden")) {
        return;
      }

      overlay.classList.add("is-hidden");
      document.body.classList.remove("is-ui-dialog-open");
      const resolve = pendingConfirmResolve;
      pendingConfirmResolve = null;
      resolve?.(result);
    }

    function showToast(message, options = {}) {
      const toast = document.createElement("article");
      const variant = String(options.variant || "info");
      const title = String(options.title || "").trim();
      const duration = Number.isFinite(options.duration) ? options.duration : 4200;

      toast.className = `app-toast is-${variant}`;
      toast.setAttribute("role", variant === "error" ? "alert" : "status");
      toast.innerHTML = `
        <div class="app-toast-icon" aria-hidden="true"></div>
        <div class="app-toast-copy">
          ${title ? `<strong>${escapeHtml(title)}</strong>` : ""}
          <p>${escapeHtml(message)}</p>
        </div>
        <button class="app-toast-close" type="button" aria-label="סגירה">×</button>
      `;

      const closeToast = () => {
        toast.classList.add("is-leaving");
        window.setTimeout(() => toast.remove(), 180);
      };

      toast.querySelector(".app-toast-close")?.addEventListener("click", closeToast);
      stack.appendChild(toast);
      window.setTimeout(closeToast, duration);
      return toast;
    }

    function confirm(message, options = {}) {
      confirmTitle.textContent = String(options.title || "אישור פעולה").trim();
      confirmMessage.textContent = String(message || "").trim();
      overlay.classList.remove("is-hidden");
      document.body.classList.add("is-ui-dialog-open");

      return new Promise((resolve) => {
        pendingConfirmResolve = resolve;
      });
    }

    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) {
        closeConfirm(false);
      }
    });

    cancelButton.addEventListener("click", () => closeConfirm(false));
    confirmButton.addEventListener("click", () => closeConfirm(true));
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !overlay.classList.contains("is-hidden")) {
        closeConfirm(false);
      }
    });

    const api = { toast: showToast, confirm, closeConfirm };
    root.__appUiApi = api;
    return api;
  }

  function createNotificationCenter(options) {
    const mount = typeof options.mount === "string" ? document.querySelector(options.mount) : options.mount;
    if (!mount) {
      return createNoopCenter();
    }

    const root = document.createElement("div");
    root.className = "notification-center is-hidden";
    root.innerHTML = `
      <button class="notification-bell-button" type="button" aria-label="התראות" aria-expanded="false">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 22a2.7 2.7 0 0 0 2.55-1.8h-5.1A2.7 2.7 0 0 0 12 22Zm7-5.2-1.7-1.9v-4.3A5.4 5.4 0 0 0 13 5.3V4a1 1 0 1 0-2 0v1.3a5.4 5.4 0 0 0-4.3 5.3v4.3L5 16.8a1 1 0 0 0 .8 1.7h12.4a1 1 0 0 0 .8-1.7ZM8.7 14.1v-3.5a3.3 3.3 0 0 1 6.6 0v3.5l1.1 1.3H7.6l1.1-1.3Z"/>
        </svg>
        <span class="notification-badge is-hidden">0</span>
      </button>
      <section class="notification-panel is-hidden" aria-label="מרכז התראות">
        <div class="notification-panel-head">
          <div>
            <strong>התראות</strong>
            <span class="notification-panel-subtitle">אין התראות חדשות</span>
          </div>
          <button class="ghost-button notification-mark-all-button" type="button" data-notification-action="mark-all">סמן הכל כנקרא</button>
        </div>
        <div class="notification-list"></div>
      </section>
    `;

    if (options.insert === "append") {
      mount.appendChild(root);
    } else {
      mount.insertBefore(root, mount.firstChild);
    }

    const banner = document.createElement("div");
    banner.className = "browser-notification-banner is-hidden";
    const header = root.closest("header") || document.querySelector("header");
    if (header?.parentNode) {
      header.insertAdjacentElement("afterend", banner);
    } else {
      document.body.prepend(banner);
    }

    const bellButton = root.querySelector(".notification-bell-button");
    const badge = root.querySelector(".notification-badge");
    const panel = root.querySelector(".notification-panel");
    const list = root.querySelector(".notification-list");
    const subtitle = root.querySelector(".notification-panel-subtitle");
    const markAllButton = root.querySelector(".notification-mark-all-button");
    const browserSeenIds = new Set();
    const pendingActions = new Set();

    function getCurrentUserId() {
      return String(options.getUserId?.() || "").trim();
    }

    function getAllNotifications() {
      return normalizeNotificationList(options.getNotifications?.());
    }

    function setAllNotifications(nextNotifications) {
      options.setNotifications?.(normalizeNotificationList(nextNotifications));
      options.save?.();
    }

    async function persistAction(actionName, fallback, ...args) {
      const action = options[actionName];
      if (typeof action !== "function") {
        fallback(...args);
        return true;
      }

      try {
        const result = await action(...args);
        if (result !== false) {
          fallback(...args);
        }
        return true;
      } catch (error) {
        options.onError?.(error);
        return false;
      }
    }

    function getCurrentUserNotifications() {
      const currentUserId = getCurrentUserId();
      if (!currentUserId) {
        return [];
      }

      return getAllNotifications().filter((notification) => notification.user_id === currentUserId);
    }

    function setPanelOpen(isOpen) {
      panel.classList.toggle("is-hidden", !isOpen);
      bellButton.setAttribute("aria-expanded", String(isOpen));
    }

    function isBrowserNotificationsActiveForCurrentUser() {
      if (typeof options.isOwnerLoggedIn === "function") {
        return Boolean(options.isOwnerLoggedIn?.());
      }

      return Boolean(getCurrentUserId());
    }

    function getPermissionPromptStorageKey() {
      return `${NOTIFICATION_PROMPT_KEY_PREFIX}${getCurrentUserId() || OWNER_NOTIFICATION_USER_ID}`;
    }

    function renderPermissionBanner() {
      const browserNotificationsActive = isBrowserNotificationsActiveForCurrentUser();
      if (!options.browser || !browserNotificationsActive) {
        banner.classList.add("is-hidden");
        banner.innerHTML = "";
        return;
      }

      if (!("Notification" in window)) {
        banner.innerHTML = `
          <div>
            <strong>התראות דפדפן לא זמינות כאן</strong>
            <p>הדפדפן או סביבת ההפעלה לא תומכים בהתראות דפדפן.</p>
          </div>
        `;
        banner.classList.remove("is-hidden");
        return;
      }

      if (Notification.permission === "granted") {
        banner.classList.add("is-hidden");
        banner.innerHTML = "";
        return;
      }

      if (Notification.permission === "denied") {
        banner.innerHTML = `
          <div>
            <strong>התראות חסומות בדפדפן</strong>
            <p>כדי להפעיל אותן, לחצו על מנעול האתר ליד שורת הכתובת, פתחו את הרשאות האתר, ובחרו Allow / אפשר עבור Notifications.</p>
          </div>
          <button class="ghost-button" type="button" data-browser-notification-action="refresh">בדיקה מחדש</button>
        `;
        banner.classList.remove("is-hidden");
        return;
      }

      banner.innerHTML = `
        <div>
          <strong>התראות דפדפן כבויות</strong>
            <p>אפשר להפעיל התראות כדי לקבל עדכונים גם כשהפאנל סגור.</p>
          </div>
          <button class="primary-button small-button" type="button" data-browser-notification-action="request">הפעלת התראות</button>
        `;
        banner.classList.remove("is-hidden");
    }

    function renderList() {
      const notifications = getCurrentUserNotifications();
      const unreadCount = notifications.filter((notification) => !notification.is_read).length;
      const pendingCount = Math.max(0, Number(options.getPendingCount?.() || 0));
      const badgeCount = pendingCount || unreadCount;

      badge.textContent = badgeCount > 99 ? "99+" : String(badgeCount);
      badge.classList.toggle("is-hidden", badgeCount === 0);
      badge.title = pendingCount ? `${pendingCount} תורים ממתינים לאישור` : `${unreadCount} התראות שלא נקראו`;
      subtitle.textContent = pendingCount
        ? `${pendingCount} תורים ממתינים לאישור${unreadCount ? ` · ${unreadCount} לא נקראו` : ""}`
        : unreadCount
          ? `${unreadCount} התראות שלא נקראו`
        : notifications.length
          ? "כל ההתראות נקראו"
          : "אין התראות עדיין";
      markAllButton.disabled = unreadCount === 0;

      if (!notifications.length) {
        list.innerHTML = `
          <div class="notification-empty-state">
            <strong>אין התראות כרגע</strong>
            <span>כשתור ייקבע, יבוטל או יעודכן, זה יופיע כאן.</span>
          </div>
        `;
        return;
      }

      list.innerHTML = notifications
        .map((notification) => {
          const isOwner = Boolean(options.isOwnerLoggedIn?.());
          const hasBooking = Boolean(notification.booking_id);
          const isPendingBooking = hasBooking && ["appointment_booked", "appointment_rescheduled"].includes(notification.type);
          const isCancelledBooking = hasBooking && ["appointment_cancelled", "booking_cancelled"].includes(notification.type);
          const customerBookingEvent = hasBooking && /^(booking_|appointment_|reminder)/.test(notification.type);
          const canConfirmAttendance = options.canConfirmAttendance?.(notification) ?? !isCancelledBooking;
          const canCancelBooking = options.canCancelBooking?.(notification) ?? !isCancelledBooking;
          const actionButtons = [];

          if (hasBooking) {
            actionButtons.push(`<button class="ghost-button" type="button" data-notification-action="open-booking" data-notification-id="${escapeHtml(notification.id)}">צפייה בתור</button>`);
          }
          if (isOwner && isPendingBooking) {
            actionButtons.push(`<button class="primary-button" type="button" data-notification-action="approve-booking" data-notification-id="${escapeHtml(notification.id)}">אישור תור</button>`);
            actionButtons.push(`<button class="danger-button" type="button" data-notification-action="reject-booking" data-notification-id="${escapeHtml(notification.id)}">דחיית תור</button>`);
          } else if (isOwner && isCancelledBooking) {
            actionButtons.push(`<button class="ghost-button" type="button" data-notification-action="open-free-slot" data-notification-id="${escapeHtml(notification.id)}">פתיחת השעה שהתפנתה</button>`);
          } else if (!isOwner && customerBookingEvent) {
            if (canConfirmAttendance) {
              actionButtons.push(`<button class="primary-button" type="button" data-notification-action="confirm-attendance" data-notification-id="${escapeHtml(notification.id)}">אישור הגעה עכשיו</button>`);
            }
            if (canCancelBooking) {
              actionButtons.push(`<button class="danger-button" type="button" data-notification-action="cancel-booking" data-notification-id="${escapeHtml(notification.id)}">ביטול תור</button>`);
            }
            actionButtons.push(`<button class="ghost-button" type="button" data-notification-action="add-calendar" data-notification-id="${escapeHtml(notification.id)}">הוספה ליומן</button>`);
          }

          return `
          <article class="notification-item ${notification.is_read ? "" : "is-unread"} ${hasBooking ? "has-booking-link" : ""}" data-notification-id="${escapeHtml(notification.id)}">
            <div class="notification-item-main">
              <div class="notification-item-topline">
                <span class="notification-type">${escapeHtml(getTypeLabel(notification.type))}</span>
                <time>${escapeHtml(formatNotificationTime(notification.created_at))}</time>
              </div>
              <strong>${escapeHtml(notification.title)}</strong>
              <p>${escapeHtml(notification.message)}</p>
            </div>
            <div class="notification-actions">
              ${actionButtons.join("")}
              ${
                notification.is_read
                  ? ""
                  : `<button class="ghost-button" type="button" data-notification-action="read" data-notification-id="${escapeHtml(notification.id)}">נקרא</button>`
              }
              <button class="danger-button" type="button" data-notification-action="delete" data-notification-id="${escapeHtml(notification.id)}">מחיקה</button>
            </div>
          </article>
        `;
        })
        .join("");
    }

    function render() {
      const currentUserId = getCurrentUserId();
      root.classList.toggle("is-hidden", !currentUserId);
      if (!currentUserId) {
        setPanelOpen(false);
      }

      renderList();
      renderPermissionBanner();
    }

    function applyMarkAsRead(notificationId) {
      const currentUserId = getCurrentUserId();
      const notifications = getAllNotifications().map((notification) => {
        if (notification.id === notificationId && notification.user_id === currentUserId) {
          return { ...notification, is_read: true };
        }

        return notification;
      });

      setAllNotifications(notifications);
      render();
    }

    function markAsRead(notificationId) {
      return persistAction("onMarkAsRead", applyMarkAsRead, notificationId);
    }

    function applyMarkAllAsRead() {
      const currentUserId = getCurrentUserId();
      const notifications = getAllNotifications().map((notification) => {
        if (notification.user_id === currentUserId) {
          return { ...notification, is_read: true };
        }

        return notification;
      });

      setAllNotifications(notifications);
      render();
    }

    function markAllAsRead() {
      return persistAction("onMarkAllAsRead", applyMarkAllAsRead, getCurrentUserId());
    }

    function applyDeleteNotification(notificationId) {
      const currentUserId = getCurrentUserId();
      const notifications = getAllNotifications().filter(
        (notification) => !(notification.id === notificationId && notification.user_id === currentUserId)
      );

      setAllNotifications(notifications);
      render();
    }

    function deleteNotification(notificationId) {
      return persistAction("onDeleteNotification", applyDeleteNotification, notificationId);
    }

    function showBrowserNotification(notification) {
      if (!("Notification" in window) || Notification.permission !== "granted") {
        return;
      }

      try {
        const browserNotification = new Notification(notification.title, {
          body: notification.message,
          tag: notification.id,
          lang: "he",
          dir: "rtl"
        });

        browserNotification.onclick = () => {
          window.focus();
          if (notification.booking_id && typeof options.onOpenBooking === "function") {
            Promise.resolve(options.onOpenBooking(notification)).catch((error) => options.onError?.(error));
          } else {
            setPanelOpen(true);
          }
        };
      } catch (error) {
        // Some browsers block notifications on non-secure origins.
      }
    }

    async function notify(data, config = {}) {
      const notification = normalizeNotification({
        ...data,
        id: data?.id || createNotificationId(),
        created_at: data?.created_at || new Date().toISOString(),
        is_read: false
      });

      if (!notification.user_id) {
        return null;
      }

      let persistedNotification = notification;
      if (typeof options.onCreateNotification === "function") {
        try {
          const maybeNotification = await options.onCreateNotification(notification, config);
          if (maybeNotification) {
            persistedNotification = normalizeNotification(maybeNotification);
          }
        } catch (error) {
          options.onError?.(error);
          return null;
        }
      }

      const nextNotifications = [
        persistedNotification,
        ...getAllNotifications().filter((item) => item.id !== persistedNotification.id)
      ];

      setAllNotifications(nextNotifications);
      render();

      if (config.browser !== false && persistedNotification.user_id === getCurrentUserId()) {
        browserSeenIds.add(persistedNotification.id);
        showBrowserNotification(persistedNotification);
      }

      return persistedNotification;
    }

    function rememberCurrentNotifications() {
      getCurrentUserNotifications().forEach((notification) => {
        browserSeenIds.add(notification.id);
      });
    }

    function showNewBrowserNotifications() {
      getCurrentUserNotifications()
        .filter((notification) => !notification.is_read && !browserSeenIds.has(notification.id))
        .forEach((notification) => {
          browserSeenIds.add(notification.id);
          showBrowserNotification(notification);
        });
    }

    function askAfterOwnerLogin() {
      renderPermissionBanner();

      if (!options.browser || !isBrowserNotificationsActiveForCurrentUser() || !("Notification" in window)) {
        return;
      }

      if (Notification.permission !== "default") {
        return;
      }

      const promptStorageKey = getPermissionPromptStorageKey();
      if (localStorage.getItem(promptStorageKey) === "1") {
        return;
      }

      localStorage.setItem(promptStorageKey, "1");
      Notification.requestPermission().then(renderPermissionBanner).catch(renderPermissionBanner);
    }

    bellButton.addEventListener("click", (event) => {
      event.stopPropagation();
      setPanelOpen(panel.classList.contains("is-hidden"));
    });

    root.addEventListener("click", async (event) => {
      const actionButton = event.target.closest("[data-notification-action]");
      if (!actionButton) {
        return;
      }

      const action = actionButton.dataset.notificationAction;
      const notificationId = actionButton.dataset.notificationId;
      const notification = getCurrentUserNotifications().find((item) => item.id === notificationId);

      if (action === "mark-all") {
        void markAllAsRead();
        return;
      }

      if (action === "read" && notificationId) {
        void markAsRead(notificationId);
        return;
      }

      if (action === "delete" && notificationId) {
        void deleteNotification(notificationId);
        return;
      }

      const actionHandlers = {
        "open-booking": options.onOpenBooking,
        "approve-booking": options.onApproveBooking,
        "reject-booking": options.onRejectBooking,
        "open-free-slot": options.onOpenFreeSlot,
        "confirm-attendance": options.onConfirmAttendance,
        "cancel-booking": options.onCancelBooking,
        "add-calendar": options.onAddCalendar
      };
      const handler = actionHandlers[action];
      if (!notification || typeof handler !== "function" || pendingActions.has(`${action}:${notification.id}`)) {
        return;
      }

      const pendingKey = `${action}:${notification.id}`;
      pendingActions.add(pendingKey);
      actionButton.disabled = true;
      try {
        await markAsRead(notification.id);
        await handler(notification);
        setPanelOpen(false);
      } catch (error) {
        options.onError?.(error);
      } finally {
        pendingActions.delete(pendingKey);
        actionButton.disabled = false;
      }
    });

    banner.addEventListener("click", (event) => {
      const button = event.target.closest("[data-browser-notification-action]");
      if (!button) {
        return;
      }

      if (button.dataset.browserNotificationAction === "request" && "Notification" in window) {
        Notification.requestPermission().then(renderPermissionBanner).catch(renderPermissionBanner);
        return;
      }

      renderPermissionBanner();
    });

    document.addEventListener("click", (event) => {
      if (!root.contains(event.target)) {
        setPanelOpen(false);
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        setPanelOpen(false);
      }
    });

    rememberCurrentNotifications();
    render();

    return {
      notify,
      render,
      markAsRead,
      markAllAsRead,
      deleteNotification,
      askAfterOwnerLogin,
      rememberCurrentNotifications,
      showNewBrowserNotifications,
      OWNER_NOTIFICATION_USER_ID
    };
  }

  window.AppNotifications = {
    create: createNotificationCenter,
    normalizeList: normalizeNotificationList,
    ownerUserId: OWNER_NOTIFICATION_USER_ID
  };

  window.AppUi = createUiMessageCenter();
})();
