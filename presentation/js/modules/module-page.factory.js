export class GenericModuleController {
  constructor(moduleContext) {
    this.moduleContext = moduleContext;
  }

  mount() {
    const moduleRoot = document.getElementById("moduleRoot");
    if (!moduleRoot) {
      return;
    }
    moduleRoot.classList.add("fade-in");
  }

  destroy() {}
}
