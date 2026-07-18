const JUMP_KEY = "agv-global-search-jump";

export function setGlobalSearchJump(payload) {
  try {
    sessionStorage.setItem(JUMP_KEY, JSON.stringify(payload ?? {}));
  } catch {
    /* ignore quota / privacy mode */
  }
}

export function consumeGlobalSearchJump() {
  try {
    const raw = sessionStorage.getItem(JUMP_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(JUMP_KEY);
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function peekGlobalSearchJump() {
  try {
    const raw = sessionStorage.getItem(JUMP_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
