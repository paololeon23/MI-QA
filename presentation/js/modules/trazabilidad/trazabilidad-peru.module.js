import { createTraceReviewController } from "./trazabilidad-review.factory.js";

export const ModuleController = createTraceReviewController({
  countryKey: "PERU",
  titleKey: "trazabilidadReview.titlePeru",
  inputLabelKey: "trazabilidadReview.inputLabelPeru",
  examplePlaceholder: "6A07A00125216"
});
