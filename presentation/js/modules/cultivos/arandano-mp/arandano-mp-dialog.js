const ICON_CLASS = {
  success: "agv-mp-dialog__icon--success",
  error: "agv-mp-dialog__icon--error",
  warning: "agv-mp-dialog__icon--warning",
  info: "agv-mp-dialog__icon--info"
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

export function showMpDialog({
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
    overlay.className = "agv-mp-dialog-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");

    const dialog = document.createElement("div");
    dialog.className = `agv-mp-dialog${wide ? " agv-mp-dialog--wide" : ""}`;

    const iconEl = document.createElement("div");
    iconEl.className = `agv-mp-dialog__icon ${ICON_CLASS[icon] || ICON_CLASS.info}`;
    iconEl.textContent = ICON_GLYPH[icon] || ICON_GLYPH.info;

    const titleEl = document.createElement("h3");
    titleEl.className = "agv-mp-dialog__title";
    titleEl.textContent = title;

    dialog.appendChild(iconEl);
    dialog.appendChild(titleEl);

    if (text) {
      const textEl = document.createElement("p");
      textEl.className = "agv-mp-dialog__text";
      textEl.textContent = text;
      dialog.appendChild(textEl);
    }

    if (html) {
      const htmlEl = document.createElement("div");
      htmlEl.className = "agv-mp-dialog__html";
      htmlEl.innerHTML = html;
      dialog.appendChild(htmlEl);
    }

    const actions = document.createElement("div");
    actions.className = "agv-mp-dialog__actions";

    if (showConfirmButton) {
      const confirmBtn = document.createElement("button");
      confirmBtn.type = "button";
      confirmBtn.className = "agv-mp-dialog__btn agv-mp-dialog__btn--primary";
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

export function showMpConfirmDialog({
  icon = "info",
  title = "",
  text = "",
  html = "",
  confirmButtonText = "Confirmar",
  cancelButtonText = "Cancelar",
  wide = false
}) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "agv-mp-dialog-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");

    const dialog = document.createElement("div");
    dialog.className = `agv-mp-dialog${wide ? " agv-mp-dialog--wide" : ""}`;

    if (icon) {
      const iconEl = document.createElement("div");
      iconEl.className = `agv-mp-dialog__icon ${ICON_CLASS[icon] || ICON_CLASS.info}`;
      iconEl.textContent = ICON_GLYPH[icon] || ICON_GLYPH.info;
      dialog.appendChild(iconEl);
    }

    const titleEl = document.createElement("h3");
    titleEl.className = "agv-mp-dialog__title";
    titleEl.textContent = title;
    dialog.appendChild(titleEl);

    if (text) {
      const textEl = document.createElement("p");
      textEl.className = "agv-mp-dialog__text";
      textEl.textContent = text;
      dialog.appendChild(textEl);
    }

    if (html) {
      const htmlEl = document.createElement("div");
      htmlEl.className = "agv-mp-dialog__html";
      htmlEl.innerHTML = html;
      dialog.appendChild(htmlEl);
    }

    const actions = document.createElement("div");
    actions.className = "agv-mp-dialog__actions";

    const confirmBtn = document.createElement("button");
    confirmBtn.type = "button";
    confirmBtn.className = "agv-mp-dialog__btn agv-mp-dialog__btn--primary";
    confirmBtn.textContent = confirmButtonText;
    confirmBtn.addEventListener("click", () => {
      removeOverlay(overlay);
      resolve({ isConfirmed: true });
    });
    actions.appendChild(confirmBtn);

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "agv-mp-dialog__btn agv-mp-dialog__btn--ghost";
    cancelBtn.textContent = cancelButtonText;
    cancelBtn.addEventListener("click", () => {
      removeOverlay(overlay);
      resolve({ isDismissed: true });
    });
    actions.appendChild(cancelBtn);

    dialog.appendChild(actions);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) {
        removeOverlay(overlay);
        resolve({ isDismissed: true });
      }
    });
  });
}

/** Diálogo con varias acciones (p. ej. exportar cartilla actual vs todas). */
export function showMpExportChoiceDialog({ title = "", html = "", choices = [] }) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "agv-mp-dialog-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");

    const dialog = document.createElement("div");
    dialog.className = "agv-mp-dialog agv-mp-dialog--wide";

    const titleEl = document.createElement("h3");
    titleEl.className = "agv-mp-dialog__title";
    titleEl.textContent = title;
    dialog.appendChild(titleEl);

    if (html) {
      const htmlEl = document.createElement("div");
      htmlEl.className = "agv-mp-dialog__html";
      htmlEl.innerHTML = html;
      dialog.appendChild(htmlEl);
    }

    const actions = document.createElement("div");
    actions.className = "agv-mp-dialog__actions agv-mp-dialog__actions--stack";

    choices.forEach((choice, index) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `agv-mp-dialog__btn ${
        index === 0 ? "agv-mp-dialog__btn--primary" : "agv-mp-dialog__btn--ghost"
      }`;
      btn.textContent = choice.label;
      btn.addEventListener("click", () => {
        removeOverlay(overlay);
        resolve({ action: choice.id });
      });
      actions.appendChild(btn);
    });

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "agv-mp-dialog__btn agv-mp-dialog__btn--ghost";
    cancelBtn.textContent = "Cancelar";
    cancelBtn.addEventListener("click", () => {
      removeOverlay(overlay);
      resolve({ action: "cancel" });
    });
    actions.appendChild(cancelBtn);

    dialog.appendChild(actions);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) {
        removeOverlay(overlay);
        resolve({ action: "cancel" });
      }
    });
  });
}
