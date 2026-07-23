import { appConfig } from "../config/app.config.js";
import { maskBrandText } from "../utils/brand-pixel.util.js";

class InternationalizationService {
  constructor() {
    this.isInitialized = false;
    this.activeLanguage = appConfig.defaultLanguage;
    this.fallbackDictionary = {};
    this.loadedLanguages = new Set();
  }

  async fetchLanguageDictionary(languageCode) {
    const response = await fetch(
      `presentation/i18n/${languageCode}.json?v=${appConfig.cacheBustingVersion}`
    );
    if (!response.ok) {
      throw new Error(`Language package not found: ${languageCode}`);
    }
    return response.json();
  }

  async registerLanguageResources(languageCode) {
    if (this.loadedLanguages.has(languageCode) || !window.i18next) {
      return;
    }

    const translation = await this.fetchLanguageDictionary(languageCode);
    window.i18next.addResourceBundle(
      languageCode,
      "translation",
      translation,
      true,
      true
    );
    this.loadedLanguages.add(languageCode);
  }

  buildI18nextConfig(defaultLanguage, initialTranslation) {
    return {
      lng: defaultLanguage,
      fallbackLng: appConfig.defaultLanguage,
      supportedLngs: appConfig.supportedLanguages,
      load: "currentOnly",
      nonExplicitSupportedLngs: false,
      keySeparator: false,
      nsSeparator: false,
      interpolation: { escapeValue: false },
      resources: {
        [defaultLanguage]: { translation: initialTranslation }
      }
    };
  }

  async initialize(defaultLanguage = appConfig.defaultLanguage) {
    const initialTranslation = await this.fetchLanguageDictionary(defaultLanguage);
    this.fallbackDictionary = initialTranslation;
    this.loadedLanguages.add(defaultLanguage);

    if (!window.i18next) {
      this.activeLanguage = defaultLanguage;
      this.isInitialized = true;
      return;
    }

    await window.i18next.init(
      this.buildI18nextConfig(defaultLanguage, initialTranslation)
    );

    this.isInitialized = true;
    this.activeLanguage = defaultLanguage;
  }

  async loadLanguage(languageCode) {
    if (!this.isInitialized) {
      await this.initialize(languageCode);
      return;
    }

    await this.registerLanguageResources(languageCode);
    // Reutilizar bundle ya cargado (evita 2º fetch del mismo JSON)
    if (window.i18next?.getResourceBundle) {
      const bundle = window.i18next.getResourceBundle(languageCode, "translation");
      if (bundle) this.fallbackDictionary = bundle;
    }

    if (window.i18next?.isInitialized) {
      await window.i18next.changeLanguage(languageCode);
    }

    this.activeLanguage = languageCode;
  }

  translate(translationKey, vars = {}) {
    const replacements = {
      year: String(appConfig.appYear ?? new Date().getFullYear()),
      ...vars
    };

    let translated;
    if (window.i18next?.isInitialized) {
      const value = window.i18next.t(translationKey, replacements);
      translated = value !== translationKey ? value : this.fallbackDictionary[translationKey] ?? translationKey;
    } else {
      translated = this.fallbackDictionary[translationKey] ?? translationKey;
    }

    Object.entries(replacements).forEach(([name, value]) => {
      translated = String(translated).split(`{{${name}}}`).join(String(value));
    });
    return maskBrandText(translated);
  }

  getActiveLanguage() {
    return this.activeLanguage;
  }
}

export const i18nService = new InternationalizationService();
