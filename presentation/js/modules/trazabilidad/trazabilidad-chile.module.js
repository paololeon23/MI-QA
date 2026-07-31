import { createTraceReviewController } from "./trazabilidad-review.factory.js";

export const ModuleController = createTraceReviewController({
  countryKey: "CHILE",
  titleKey: "trazabilidadReview.titleChile",
  inputLabelKey: "trazabilidadReview.inputLabelChileShort",
  examplePlaceholder: "6I55A521B8021"
});
