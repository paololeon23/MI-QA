import { createTraceReviewController } from "./trazabilidad-review.factory.js";

export const ModuleController = createTraceReviewController({
  countryKey: "PERU",
  titleKey: "trazabilidadReview.titlePeru",
  inputLabelKey: "trazabilidadReview.inputLabelPeru",
  examplePlaceholder: "4A07A00125216"
});
