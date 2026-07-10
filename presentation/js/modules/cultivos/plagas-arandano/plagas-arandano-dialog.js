const ICON_CLASS = {
  success: "pmpar-dialog__icon--success",
  error: "pmpar-dialog__icon--error",
  warning: "pmpar-dialog__icon--warning",
  info: "pmpar-dialog__icon--info"
};

const ICON_GLYPH = {
  success: "✓",
  error: "✕",
  warning: "!",
  info: "i"
};

function removeOverlay(overlay) {
  overlay.remove();
}

export function showPlagasDialog({
  icon = "info",
  title = "",
  text = "",
  html = "",
  timer = 0,
  showConfirmButton = true,
  confirmButtonText = "Aceptar",
  wide = false
}) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "pmpar-dialog-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");

    const dialog = document.createElement("div");
    dialog.className = `pmpar-dialog${wide ? " pmpar-dialog--wide" : ""}`;

    const iconEl = document.createElement("div");
    iconEl.className = `pmpar-dialog__icon ${ICON_CLASS[icon] || ICON_CLASS.info}`;
    iconEl.textContent = ICON_GLYPH[icon] || ICON_GLYPH.info;

    const titleEl = document.createElement("h3");
    titleEl.className = "pmpar-dialog__title";
    titleEl.textContent = title;

    dialog.appendChild(iconEl);
    dialog.appendChild(titleEl);

    if (text) {
      const textEl = document.createElement("p");
      textEl.className = "pmpar-dialog__text";
      textEl.textContent = text;
      dialog.appendChild(textEl);
    }

    if (html) {
      const htmlEl = document.createElement("div");
      htmlEl.className = "pmpar-dialog__html";
      htmlEl.innerHTML = html;
      dialog.appendChild(htmlEl);
    }

    const actions = document.createElement("div");
    actions.className = "pmpar-dialog__actions";

    if (showConfirmButton) {
      const confirmBtn = document.createElement("button");
      confirmBtn.type = "button";
      confirmBtn.className = "pmpar-dialog__btn pmpar-dialog__btn--primary";
      confirmBtn.textContent = confirmButtonText;
      confirmBtn.addEventListener("click", () => {
        removeOverlay(overlay);
        resolve({ isConfirmed: true });
      });
      actions.appendChild(confirmBtn);
    }

    dialog.appendChild(actions);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) {
        removeOverlay(overlay);
        resolve({ isDismissed: true });
      }
    });

    if (timer > 0) {
      window.setTimeout(() => {
        if (document.body.contains(overlay)) {
          removeOverlay(overlay);
          resolve({ isConfirmed: true, timedOut: true });
        }
      }, timer);
    }
  });
}

export function showPlagasConfirmDialog({
  title = "",
  html = "",
  confirmButtonText = "Confirmar",
  denyButtonText = "",
  cancelButtonText = "Cancelar",
  wide = true
}) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "pmpar-dialog-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");

    const dialog = document.createElement("div");
    dialog.className = `pmpar-dialog${wide ? " pmpar-dialog--wide" : ""}`;

    const titleEl = document.createElement("h3");
    titleEl.className = "pmpar-dialog__title";
    titleEl.textContent = title;
    dialog.appendChild(titleEl);

    if (html) {
      const htmlEl = document.createElement("div");
      htmlEl.className = "pmpar-dialog__html";
      htmlEl.innerHTML = html;
      dialog.appendChild(htmlEl);
    }

    const actions = document.createElement("div");
    actions.className = "pmpar-dialog__actions";

    const confirmBtn = document.createElement("button");
    confirmBtn.type = "button";
    confirmBtn.className = "pmpar-dialog__btn pmpar-dialog__btn--primary";
    confirmBtn.textContent = confirmButtonText;
    confirmBtn.addEventListener("click", () => {
      removeOverlay(overlay);
      resolve({ isConfirmed: true });
    });
    actions.appendChild(confirmBtn);

    if (denyButtonText) {
      const denyBtn = document.createElement("button");
      denyBtn.type = "button";
      denyBtn.className = "pmpar-dialog__btn pmpar-dialog__btn--secondary";
      denyBtn.textContent = denyButtonText;
      denyBtn.addEventListener("click", () => {
        removeOverlay(overlay);
        resolve({ isDenied: true });
      });
      actions.appendChild(denyBtn);
    }

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "pmpar-dialog__btn pmpar-dialog__btn--ghost";
    cancelBtn.textContent = cancelButtonText;
    cancelBtn.addEventListener("click", () => {
      removeOverlay(overlay);
      resolve({ isDismissed: true });
    });
    actions.appendChild(cancelBtn);

    dialog.appendChild(actions);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
  });
}
