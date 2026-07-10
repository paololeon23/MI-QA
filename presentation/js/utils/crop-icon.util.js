import { lucideIcon } from "./lucide-icon.util.js";

const CROP_LUCIDE_ICONS = {
  arandano: "cherry",
  uva: "grape",
  esparrago: "sprout"
};

function avocadoIconMarkup(className = "") {
  const classes = className ? `lucide crop-icon crop-icon--palta ${className}` : "lucide crop-icon crop-icon--palta";

  return `
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      class="${classes}"
      aria-hidden="true"
    >
      <path d="M12 21c4.8 0 8.5-3.9 8.5-8.7 0-3.6-2.1-6.7-5.1-7.9-.4-2.6-1.9-4.4-3.4-4.4s-3 1.8-3.4 4.4C5.6 5.4 3.5 8.5 3.5 12.3 3.5 17.1 7.2 21 12 21z" />
      <circle cx="12" cy="12.2" r="2.4" />
    </svg>
  `;
}

export function renderCropIcon(cropId, className = "") {
  if (cropId === "palta") {
    return avocadoIconMarkup(className);
  }

  const iconName = CROP_LUCIDE_ICONS[cropId] ?? "leaf";
  return lucideIcon(iconName, className);
}
