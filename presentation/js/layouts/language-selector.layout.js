import { i18nService } from "../services/i18n.service.js";
import { languagesConfig, getLanguageByCode } from "../config/languages.config.js";
import { lucideIcon } from "../utils/lucide-icon.util.js";

function buildFlagIconMarkup(flagClass) {
  return `<span class="fi ${flagClass} language-selector__flag-icon" aria-hidden="true"></span>`;
}

export function buildLanguageSelectorMarkup(currentLanguageCode) {
  const activeLanguage = getLanguageByCode(currentLanguageCode) ?? languagesConfig[0];

  const optionsMarkup = languagesConfig
    .map((language) => {
      const isSelected = language.code === currentLanguageCode;
      const optionId = `btnLanguage${language.code.replace("-", "")}`;
      return `
        <button
          type="button"
          class="language-selector__option${isSelected ? " is-selected" : ""}"
          data-language-code="${language.code}"
          id="${optionId}"
          aria-label="${language.label}"
        >
          ${buildFlagIconMarkup(language.flagClass)}
          <span class="language-selector__option-text">
            <span class="language-selector__option-label">${language.label}</span>
            <span class="language-selector__option-code">${language.shortCode}</span>
          </span>
          ${lucideIcon("check", "language-selector__option-check")}
        </button>
      `;
    })
    .join("");

  return `
    <div class="language-selector" id="languageSelector">
      <button
        type="button"
        class="language-selector__trigger"
        id="btnLanguageSelector"
        aria-haspopup="listbox"
        aria-label="${i18nService.translate("labels.language")}: ${activeLanguage.label}"
      >
        ${buildFlagIconMarkup(activeLanguage.flagClass)}
        <span class="language-selector__code">${activeLanguage.shortCode}</span>
        ${lucideIcon("chevron-down", "language-selector__chevron")}
      </button>
      <div class="language-selector__dropdown" id="languageSelectorDropdown" role="listbox">
        ${optionsMarkup}
      </div>
    </div>
  `;
}
