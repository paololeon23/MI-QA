class ChartService {
  constructor() {
    this.instances = new Map();
  }

  getDevicePixelRatio() {
    const ratio = window.devicePixelRatio || 1;
    return Math.min(Math.max(ratio, 1), 2.5);
  }

  render(chartId, chartConfiguration) {
    const canvasElement = document.getElementById(chartId);
    if (!canvasElement || !window.Chart) {
      return null;
    }

    this.destroy(chartId);

    const responsive = chartConfiguration.options?.responsive ?? false;
    const maintainAspectRatio = chartConfiguration.options?.maintainAspectRatio ?? false;
    const devicePixelRatio = chartConfiguration.options?.devicePixelRatio ?? this.getDevicePixelRatio();

    if (!responsive) {
      this.applyCanvasDimensions(canvasElement, devicePixelRatio);
    }

    const chartInstance = new window.Chart(canvasElement, {
      ...chartConfiguration,
      options: {
        ...chartConfiguration.options,
        responsive,
        maintainAspectRatio,
        devicePixelRatio
      }
    });

    this.instances.set(chartId, chartInstance);
    return chartInstance;
  }

  applyCanvasDimensions(canvasElement, devicePixelRatio = this.getDevicePixelRatio()) {
    const containerElement = canvasElement.parentElement;
    const containerWidth = containerElement?.clientWidth || 400;
    const containerHeight = containerElement?.clientHeight || 240;

    canvasElement.style.width = `${containerWidth}px`;
    canvasElement.style.height = `${containerHeight}px`;
    canvasElement.width = Math.floor(containerWidth * devicePixelRatio);
    canvasElement.height = Math.floor(containerHeight * devicePixelRatio);
  }

  resize(chartId) {
    const chartInstance = this.instances.get(chartId);
    const canvasElement = document.getElementById(chartId);
    if (!chartInstance || !canvasElement) {
      return;
    }

    if (chartInstance.options.responsive) {
      chartInstance.resize();
      return;
    }

    this.applyCanvasDimensions(canvasElement, chartInstance.options.devicePixelRatio);
    chartInstance.resize();
  }

  destroy(chartId) {
    const previousInstance = this.instances.get(chartId);
    if (previousInstance) {
      previousInstance.destroy();
      this.instances.delete(chartId);
    }
  }

  destroyAll() {
    this.instances.forEach((chartInstance) => chartInstance.destroy());
    this.instances.clear();
  }
}

export const chartService = new ChartService();
