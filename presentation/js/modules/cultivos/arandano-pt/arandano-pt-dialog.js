const ICON_CLASS = {
  success: "agv-pt-dialog__icon--success",
  error: "agv-pt-dialog__icon--error",
  warning: "agv-pt-dialog__icon--warning",
  info: "agv-pt-dialog__icon--info"
};

const ICON_GLYPH = { success: "✓", error: "✕", warning: "!", info: "i" };

function removeOverlay(overlay) {
  overlay.remove();
}

export function showPtDialog({
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
    overlay.className = "agv-pt-dialog-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");

    const dialog = document.createElement("div");
    dialog.className = `agv-pt-dialog${wide ? " agv-pt-dialog--wide" : ""}`;

    const iconEl = document.createElement("div");
    iconEl.className = `agv-pt-dialog__icon ${ICON_CLASS[icon] || ICON_CLASS.info}`;
    iconEl.textContent = ICON_GLYPH[icon] || ICON_GLYPH.info;

    const titleEl = document.createElement("h3");
    titleEl.className = "agv-pt-dialog__title";
    titleEl.textContent = title;

    dialog.appendChild(iconEl);
    dialog.appendChild(titleEl);

    if (text) {
      const textEl = document.createElement("p");
      textEl.className = "agv-pt-dialog__text";
      textEl.textContent = text;
      dialog.appendChild(textEl);
    }
    if (html) {
      const htmlEl = document.createElement("div");
      htmlEl.className = "agv-pt-dialog__html";
      htmlEl.innerHTML = html;
      dialog.appendChild(htmlEl);
    }

    const actions = document.createElement("div");
    actions.className = "agv-pt-dialog__actions";
    if (showConfirmButton) {
      const confirmBtn = document.createElement("button");
      confirmBtn.type = "button";
      confirmBtn.className = "agv-pt-dialog__btn agv-pt-dialog__btn--primary";
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

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        removeOverlay(overlay);
        resolve({ isDismissed: true });
      }
    });

    if (timer > 0) {
      window.setTimeout(() => {
        if (document.body.contains(overlay)) {
          removeOverlay(overlay);
          resolve({ isConfirmed: true });
        }
      }, timer);
    }
  });
}

export function showPtConfirmDialog({
  icon = "info",
  title = "",
  html = "",
  confirmButtonText = "Continuar",
  cancelButtonText = "Cancelar",
  wide = false
}) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "agv-pt-dialog-overlay";

    const dialog = document.createElement("div");
    dialog.className = `agv-pt-dialog${wide ? " agv-pt-dialog--wide" : ""}`;

    const iconEl = document.createElement("div");
    iconEl.className = `agv-pt-dialog__icon ${ICON_CLASS[icon] || ICON_CLASS.info}`;
    iconEl.textContent = ICON_GLYPH[icon] || ICON_GLYPH.info;

    const titleEl = document.createElement("h3");
    titleEl.className = "agv-pt-dialog__title";
    titleEl.textContent = title;

    dialog.appendChild(iconEl);
    dialog.appendChild(titleEl);

    if (html) {
      const htmlEl = document.createElement("div");
      htmlEl.className = "agv-pt-dialog__html";
      htmlEl.innerHTML = html;
      dialog.appendChild(htmlEl);
    }

    const actions = document.createElement("div");
    actions.className = "agv-pt-dialog__actions agv-pt-dialog__actions--split";

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "agv-pt-dialog__btn agv-pt-dialog__btn--ghost";
    cancelBtn.textContent = cancelButtonText;
    cancelBtn.addEventListener("click", () => {
      removeOverlay(overlay);
      resolve({ isConfirmed: false });
    });

    const confirmBtn = document.createElement("button");
    confirmBtn.type = "button";
    confirmBtn.className = "agv-pt-dialog__btn agv-pt-dialog__btn--primary";
    confirmBtn.textContent = confirmButtonText;
    confirmBtn.addEventListener("click", () => {
      removeOverlay(overlay);
      resolve({ isConfirmed: true });
    });

    actions.append(cancelBtn, confirmBtn);
    dialog.appendChild(actions);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
  });
}

/** Diálogo exportar cartilla actual vs todas las cargadas. */
export function showPtExportChoiceDialog({ title = "", html = "", choices = [] }) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "agv-pt-dialog-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");

    const dialog = document.createElement("div");
    dialog.className = "agv-pt-dialog agv-pt-dialog--wide";

    const titleEl = document.createElement("h3");
    titleEl.className = "agv-pt-dialog__title";
    titleEl.textContent = title;
    dialog.appendChild(titleEl);

    if (html) {
      const htmlEl = document.createElement("div");
      htmlEl.className = "agv-pt-dialog__html";
      htmlEl.innerHTML = html;
      dialog.appendChild(htmlEl);
    }

    const actions = document.createElement("div");
    actions.className = "agv-pt-dialog__actions agv-pt-dialog__actions--stack";

    choices.forEach((choice, index) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `agv-pt-dialog__btn ${
        index === 0 ? "agv-pt-dialog__btn--primary" : "agv-pt-dialog__btn--ghost"
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
    cancelBtn.className = "agv-pt-dialog__btn agv-pt-dialog__btn--ghost";
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
