import { createTraceReviewController } from "./trazabilidad-review.factory.js";

export const ModuleController = createTraceReviewController({
  countryKey: "CHILE",
  titleKey: "trazabilidadReview.titleChile",
  inputLabelKey: "trazabilidadReview.inputLabelChileShort",
  examplePlaceholder: "6I559521B8021"
});
