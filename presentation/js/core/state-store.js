class StateStore {
  constructor() {
    this.state = {
      currentLanguage: "es-PE",
      currentRoute: "#/inicio"
    };
  }

  set(partialState) {
    this.state = { ...this.state, ...partialState };
  }

  get() {
    return { ...this.state };
  }
}

export const stateStore = new StateStore();
