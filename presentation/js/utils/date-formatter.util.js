export function calculateJulianDay(referenceDate = new Date()) {
  if (window.luxon?.DateTime) {
    return window.luxon.DateTime.fromJSDate(referenceDate).ordinal;
  }
  const startOfYear = new Date(referenceDate.getFullYear(), 0, 0);
  const differenceMilliseconds = referenceDate - startOfYear;
  return Math.floor(differenceMilliseconds / (1000 * 60 * 60 * 24));
}

export function formatCompactDate(referenceDate = new Date(), locale = "es-PE") {
  if (window.luxon?.DateTime) {
    return window.luxon.DateTime.fromJSDate(referenceDate).setLocale(locale).toFormat("dd LLL yyyy");
  }
  return referenceDate.toLocaleDateString(locale, { day: "2-digit", month: "short", year: "numeric" });
}

export function formatWeatherDate(referenceDate = new Date(), locale = "es-PE") {
  if (window.luxon?.DateTime) {
    return window.luxon.DateTime.fromJSDate(referenceDate).setLocale(locale).toFormat("cccc, dd LLL yyyy");
  }
  return referenceDate.toLocaleDateString(locale, {
    weekday: "long",
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}
