export function lucideIcon(name, className = "") {
  const classes = className ? `lucide-icon ${className}` : "lucide-icon";
  return `<i data-lucide="${name}" class="${classes}" aria-hidden="true"></i>`;
}

export function hydrateLucideIcons(root = document) {
  if (!window.lucide?.createIcons) {
    return;
  }

  const options = {
    attrs: {
      class: "lucide",
      "stroke-width": "2"
    },
    nameAttr: "data-lucide"
  };

  if (root instanceof Element && root !== document.documentElement) {
    options.root = root;
  }

  window.lucide.createIcons(options);
}
