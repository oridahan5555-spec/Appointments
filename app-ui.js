(function () {
  let layer = null;
  let toastStack = null;
  let confirmOverlay = null;

  function ensureLayer() {
    if (layer) {
      return;
    }

    layer = document.createElement("div");
    layer.className = "app-ui-message-layer";
    layer.innerHTML = `
      <div class="app-toast-stack" aria-live="polite" aria-atomic="false"></div>
      <div class="app-confirm-overlay is-hidden" role="presentation"></div>
    `;
    document.body.appendChild(layer);
    toastStack = layer.querySelector(".app-toast-stack");
    confirmOverlay = layer.querySelector(".app-confirm-overlay");
  }

  function toast(message, options = {}) {
    ensureLayer();

    const variant = ["success", "error", "warning", "info"].includes(options.variant)
      ? options.variant
      : "info";
    const title = options.title || {
      success: "הפעולה הושלמה",
      error: "משהו לא הסתדר",
      warning: "כדאי לשים לב",
      info: "עדכון"
    }[variant];
    const toastElement = document.createElement("article");
    toastElement.className = `app-toast is-${variant}`;
    toastElement.setAttribute("role", variant === "error" ? "alert" : "status");
    toastElement.innerHTML = `
      <span class="app-toast-icon" aria-hidden="true"></span>
      <div class="app-toast-copy">
        <strong></strong>
        <p></p>
      </div>
      <button class="app-toast-close" type="button" aria-label="סגירת הודעה">×</button>
    `;
    toastElement.querySelector("strong").textContent = title;
    toastElement.querySelector("p").textContent = String(message || "");
    toastStack.appendChild(toastElement);

    let timeoutId = null;
    const close = () => {
      if (!toastElement.isConnected || toastElement.classList.contains("is-leaving")) {
        return;
      }

      clearTimeout(timeoutId);
      toastElement.classList.add("is-leaving");
      setTimeout(() => toastElement.remove(), 190);
    };

    toastElement.querySelector(".app-toast-close").addEventListener("click", close);
    timeoutId = setTimeout(close, Number(options.duration || 4200));
    return close;
  }

  function confirmAction(message, options = {}) {
    ensureLayer();

    return new Promise((resolve) => {
      const title = options.title || "אישור פעולה";
      const confirmText = options.confirmText || "אישור";
      const cancelText = options.cancelText || "ביטול";
      const confirmClass = options.variant === "danger" || /ביטול|מחיק|איפוס/.test(title)
        ? "danger-button"
        : "primary-button";

      confirmOverlay.innerHTML = `
        <section class="app-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="appConfirmTitle">
          <div class="app-confirm-visual" aria-hidden="true">!</div>
          <div class="app-confirm-copy">
            <h3 id="appConfirmTitle"></h3>
            <p></p>
          </div>
          <div class="app-confirm-actions">
            <button class="ghost-button" type="button" data-app-confirm="cancel"></button>
            <button class="${confirmClass}" type="button" data-app-confirm="approve"></button>
          </div>
        </section>
      `;
      confirmOverlay.querySelector("h3").textContent = title;
      confirmOverlay.querySelector("p").textContent = String(message || "");
      confirmOverlay.querySelector('[data-app-confirm="cancel"]').textContent = cancelText;
      confirmOverlay.querySelector('[data-app-confirm="approve"]').textContent = confirmText;
      confirmOverlay.classList.remove("is-hidden");
      document.body.classList.add("is-ui-dialog-open");

      const approveButton = confirmOverlay.querySelector('[data-app-confirm="approve"]');
      const cancelButton = confirmOverlay.querySelector('[data-app-confirm="cancel"]');

      const finish = (result) => {
        confirmOverlay.classList.add("is-hidden");
        confirmOverlay.innerHTML = "";
        document.body.classList.remove("is-ui-dialog-open");
        document.removeEventListener("keydown", onKeyDown);
        resolve(result);
      };

      const onKeyDown = (event) => {
        if (event.key === "Escape") {
          finish(false);
        }
      };

      approveButton.addEventListener("click", () => finish(true), { once: true });
      cancelButton.addEventListener("click", () => finish(false), { once: true });
      confirmOverlay.addEventListener("click", (event) => {
        if (event.target === confirmOverlay) {
          finish(false);
        }
      }, { once: true });
      document.addEventListener("keydown", onKeyDown);
      cancelButton.focus();
    });
  }

  function installPressFeedback() {
    const pressableSelector = "button:not(.notification-bell-button), a.primary-button, a.ghost-button";

    document.addEventListener("pointerdown", (event) => {
      const pressable = event.target.closest(pressableSelector);
      if (!pressable || pressable.disabled || event.button !== 0) {
        return;
      }

      const bounds = pressable.getBoundingClientRect();
      const rippleSize = Math.max(bounds.width, bounds.height) * 1.35;
      const ripple = document.createElement("span");
      ripple.className = "button-press-ripple";
      ripple.style.width = `${rippleSize}px`;
      ripple.style.height = `${rippleSize}px`;
      ripple.style.left = `${event.clientX - bounds.left}px`;
      ripple.style.top = `${event.clientY - bounds.top}px`;
      pressable.classList.add("has-press-feedback");
      pressable.appendChild(ripple);

      ripple.addEventListener("animationend", () => {
        ripple.remove();
        if (!pressable.querySelector(".button-press-ripple")) {
          pressable.classList.remove("has-press-feedback");
        }
      }, { once: true });
    });

    document.addEventListener("keydown", (event) => {
      if (!(event.target instanceof Element) || !event.target.matches("button, a.primary-button, a.ghost-button") || !["Enter", " "].includes(event.key)) {
        return;
      }
      event.target.classList.add("is-keyboard-pressed");
    });

    document.addEventListener("keyup", (event) => {
      event.target?.classList?.remove("is-keyboard-pressed");
    });
  }

  function installPasswordToggles() {
    document.querySelectorAll('input[type="password"]').forEach((input) => {
      if (input.closest(".password-field-control")) {
        return;
      }

      const wrapper = document.createElement("span");
      wrapper.className = "password-field-control";
      input.parentNode.insertBefore(wrapper, input);
      wrapper.appendChild(input);

      const toggleButton = document.createElement("button");
      toggleButton.className = "password-visibility-button";
      toggleButton.type = "button";
      toggleButton.setAttribute("aria-label", "הצגת סיסמה");
      toggleButton.setAttribute("aria-pressed", "false");
      toggleButton.title = "הצגת סיסמה";
      toggleButton.innerHTML = `
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M2.1 12s3.6-6 9.9-6 9.9 6 9.9 6-3.6 6-9.9 6-9.9-6-9.9-6Z"></path>
          <circle cx="12" cy="12" r="3"></circle>
        </svg>
      `;
      wrapper.appendChild(toggleButton);

      toggleButton.addEventListener("click", () => {
        const shouldShow = input.type === "password";
        input.type = shouldShow ? "text" : "password";
        const label = shouldShow ? "הסתרת סיסמה" : "הצגת סיסמה";
        toggleButton.setAttribute("aria-label", label);
        toggleButton.setAttribute("aria-pressed", String(shouldShow));
        toggleButton.title = label;
        input.focus({ preventScroll: true });
        input.setSelectionRange(input.value.length, input.value.length);
      });
    });
  }

  installPressFeedback();
  installPasswordToggles();

  window.AppUi = {
    toast,
    confirm: confirmAction
  };
})();
