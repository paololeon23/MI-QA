export const languagesConfig = [
  {
    code: "es-PE",
    label: "Español (Perú)",
    shortCode: "ES",
    flagClass: "fi-pe",
    locale: "es-PE",
    isDefault: true
  },
  {
    code: "en-US",
    label: "English (US)",
    shortCode: "EN",
    flagClass: "fi-us",
    locale: "en-US",
    isDefault: false
  },
  {
    code: "fr-MA",
    label: "Français (Maroc)",
    shortCode: "MA",
    flagClass: "fi-ma",
    locale: "fr-MA",
    isDefault: false
  },
  {
    code: "zh-CN",
    label: "中文（简体）",
    shortCode: "ZH",
    flagClass: "fi-cn",
    locale: "zh-CN",
    isDefault: false
  }
];

export function getLanguageByCode(languageCode) {
  return languagesConfig.find((language) => language.code === languageCode);
}
