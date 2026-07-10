import { chartService } from "../../services/chart.service.js";
import {
  formatAreaHa,
  getEtapaAreaSummary,
  getFundoAreaSummary,
  getGlobalStats,
  getTopVarietiesByArea
} from "../../config/crop-hectares.registry.js?v=20260800";

const FONT = "Inter, sans-serif";
const AXIS_COLOR = "#64748b";
const LABEL_COLOR = "#1F3668";
const GRID_COLOR = "rgba(148, 163, 184, 0.22)";

const FUNDO_COLORS = {
  A9: "#1F3668",
  C5: "#3d6a9e",
  C6: "#5eb8d9",
  LN: "#22c55e",
  LC: "#34d399"
};

const FALLBACK_COLORS = ["#1F3668", "#3d6a9e", "#5eb8d9", "#22c55e", "#34d399", "#7de2ff"];

const BAR_GRADIENT_PAIRS = [
  ["#1F3668", "#3d6a9e"],
  ["#3d6a9e", "#5eb8d9"],
  ["#5eb8d9", "#7de2ff"],
  ["#22c55e", "#34d399"],
  ["#1F3668", "#5eb8d9"],
  ["#3d6a9e", "#22c55e"]
];

const baseTooltip = {
  backgroundColor: "#1F3668",
  titleColor: "#ffffff",
  bodyColor: "rgba(255, 255, 255, 0.92)",
  titleFont: { family: FONT, size: 13, weight: "600" },
  bodyFont: { family: FONT, size: 12 },
  padding: 14,
  cornerRadius: 10,
  displayColors: true,
  boxPadding: 6
};

function drawLeaderArrow(ctx, tipX, tipY, angle, size = 5) {
  ctx.beginPath();
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(
    tipX - size * Math.cos(angle - Math.PI / 7),
    tipY - size * Math.sin(angle - Math.PI / 7)
  );
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(
    tipX - size * Math.cos(angle + Math.PI / 7),
    tipY - size * Math.sin(angle + Math.PI / 7)
  );
  ctx.stroke();
}

const donutExternalLabelsPlugin = {
  id: "inicioDonutExternalLabels",
  afterDatasetDraw(chart) {
    const dataset = chart.data.datasets[0];
    const meta = chart.getDatasetMeta(0);
    if (!dataset || !meta?.data?.length) {
      return;
    }

    const { ctx, chartArea } = chart;
    const total = dataset.data.reduce((sum, value) => sum + (Number(value) || 0), 0);
    if (total <= 0) {
      return;
    }

    const centerX = (chartArea.left + chartArea.right) / 2;
    const centerY = (chartArea.top + chartArea.bottom) / 2;

    meta.data.forEach((arc, index) => {
      const value = Number(dataset.data[index]);
      if (!value || value <= 0) {
        return;
      }

      const percent = ((value / total) * 100).toFixed(1);
      if (Number(percent) < 2.5) {
        return;
      }

      const midAngle = (arc.startAngle + arc.endAngle) / 2;
      const cos = Math.cos(midAngle);
      const sin = Math.sin(midAngle);
      const isRight = cos >= 0;

      const arcX = centerX + cos * arc.outerRadius;
      const arcY = centerY + sin * arc.outerRadius;

      const sideWeight = Math.abs(cos);
      const isSideLabel = sideWeight > 0.45;
      const radialExtra = isSideLabel ? 22 : 24;
      const horizontalLen = isSideLabel ? 18 : 28;
      const textGap = isSideLabel ? 7 : 9;

      const elbowRadius = arc.outerRadius + radialExtra;
      const elbowX = centerX + cos * elbowRadius;
      const elbowY = centerY + sin * elbowRadius;
      const endX = isRight ? elbowX + horizontalLen : elbowX - horizontalLen;
      const endY = elbowY;
      const textX = isRight ? endX + textGap : endX - textGap;
      const fundoLabel = String(chart.data.labels[index] ?? "")
        .replace(/^Fundo\s+/i, "")
        .trim();

      ctx.save();
      ctx.strokeStyle = "rgba(100, 116, 139, 0.62)";
      ctx.lineWidth = 1;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(arcX, arcY);
      ctx.lineTo(elbowX, elbowY);
      ctx.lineTo(endX, endY);
      ctx.stroke();

      const arrowAngle = Math.atan2(arcY - elbowY, arcX - elbowX);
      drawLeaderArrow(ctx, arcX, arcY, arrowAngle, 4.5);

      ctx.fillStyle = LABEL_COLOR;
      ctx.font = `700 13px ${FONT}`;
      ctx.textAlign = isRight ? "left" : "right";
      ctx.textBaseline = "middle";
      ctx.fillText(`${percent}%`, textX, endY - 7);

      if (fundoLabel) {
        ctx.fillStyle = AXIS_COLOR;
        ctx.font = `600 10px ${FONT}`;
        ctx.fillText(fundoLabel, textX, endY + 8);
      }

      ctx.restore();
    });
  }
};

const barValueLabelsPlugin = {
  id: "inicioBarValueLabels",
  afterDatasetsDraw(chart) {
    const dataset = chart.data.datasets[0];
    if (!dataset) {
      return;
    }

    const meta = chart.getDatasetMeta(0);
    const { ctx } = chart;
    const isHorizontal = chart.options.indexAxis === "y";

    meta.data.forEach((element, index) => {
      const rawValue = dataset.data[index];
      if (rawValue == null || Number.isNaN(rawValue)) {
        return;
      }

      const label = `${formatAreaHa(rawValue)} ha`;
      ctx.save();
      ctx.font = `600 11px ${FONT}`;
      ctx.fillStyle = "#475569";

      if (isHorizontal) {
        const x = element.x + 10;
        const y = element.y + 4;
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(label, x, y);
      } else {
        const x = element.x;
        const y = element.y - 8;
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillText(label, x, y);
      }

      ctx.restore();
    });
  }
};

function getFundoColor(fundo, index = 0) {
  return FUNDO_COLORS[fundo] ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}

function truncateLabel(label, maxLength = 22) {
  const text = String(label ?? "");
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

function roundUpToStep(value, step = 200) {
  if (!Number.isFinite(value) || value <= 0) {
    return step;
  }
  return Math.ceil(value / step) * step;
}

function getAxisMaxForBars(maxValue, step = 200) {
  return Math.max(step, roundUpToStep(maxValue, step));
}

function buildHorizontalGradient(chart, leftColor, rightColor) {
  const { chartArea } = chart;
  if (!chartArea || chartArea.width <= 0) {
    return leftColor;
  }

  const gradient = chart.ctx.createLinearGradient(chartArea.left, 0, chartArea.right, 0);
  gradient.addColorStop(0, leftColor);
  gradient.addColorStop(1, rightColor);
  return gradient;
}

function buildVerticalGradient(chart, topColor, bottomColor) {
  const { chartArea } = chart;
  if (!chartArea || chartArea.height <= 0) {
    return topColor;
  }

  const gradient = chart.ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
  gradient.addColorStop(0, topColor);
  gradient.addColorStop(1, bottomColor);
  return gradient;
}

function resolveBarGradient(context) {
  const pairIndex =
    typeof context.dataIndex === "number" && context.dataIndex >= 0
      ? context.dataIndex % BAR_GRADIENT_PAIRS.length
      : 0;
  const pair = BAR_GRADIENT_PAIRS[pairIndex] ?? BAR_GRADIENT_PAIRS[0];
  const [leftColor, rightColor] = pair;
  return buildHorizontalGradient(context.chart, leftColor, rightColor);
}

function resolveVerticalBarGradient(context) {
  const pairIndex =
    typeof context.dataIndex === "number" && context.dataIndex >= 0
      ? context.dataIndex % BAR_GRADIENT_PAIRS.length
      : 0;
  const pair = BAR_GRADIENT_PAIRS[pairIndex] ?? BAR_GRADIENT_PAIRS[0];
  const [topColor, bottomColor] = pair;
  return buildVerticalGradient(context.chart, topColor, bottomColor);
}

export function renderInicioFundoAreaChart(filters = {}) {
  const fundoSummary = getFundoAreaSummary(filters);
  if (!fundoSummary.length) {
    chartService.destroy("chartInicioFundoArea");
    return null;
  }
  const totalAreaHa = fundoSummary.reduce((sum, item) => sum + item.totalAreaHa, 0);

  return chartService.render("chartInicioFundoArea", {
    type: "doughnut",
    data: {
      labels: fundoSummary.map((item) => `Fundo ${item.fundo}`),
      datasets: [
        {
          data: fundoSummary.map((item) => item.totalAreaHa),
          backgroundColor: fundoSummary.map((item, index) => getFundoColor(item.fundo, index)),
          borderColor: "#ffffff",
          borderWidth: 3,
          hoverBorderWidth: 0,
          hoverOffset: 6,
          spacing: 3
        }
      ]
    },
    plugins: [donutExternalLabelsPlugin],
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "68%",
      layout: {
        padding: {
          top: 34,
          right: 56,
          bottom: 34,
          left: 56
        }
      },
      animation: {
        duration: 600,
        easing: "easeOutQuart"
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          ...baseTooltip,
          callbacks: {
            label: (context) => {
              const value = context.parsed;
              const percent = totalAreaHa > 0 ? ((value / totalAreaHa) * 100).toFixed(1) : "0.0";
              return ` ${context.label}: ${formatAreaHa(value)} ha (${percent}%)`;
            }
          }
        }
      }
    }
  });
}

export function renderInicioTopVarietiesChart(filters = {}) {
  const topVarieties = getTopVarietiesByArea(5, filters);
  if (!topVarieties.length) {
    chartService.destroy("chartInicioTopVarieties");
    return null;
  }

  const maxValue = Math.max(...topVarieties.map((item) => item.areaHa));
  const axisMax = getAxisMaxForBars(maxValue);

  return chartService.render("chartInicioTopVarieties", {
    type: "bar",
    data: {
      labels: topVarieties.map((item) => item.variedad),
      datasets: [
        {
          label: "Área (ha)",
          data: topVarieties.map((item) => item.areaHa),
          backgroundColor: resolveBarGradient,
          borderRadius: 8,
          borderSkipped: false,
          categoryPercentage: 0.72,
          barPercentage: 0.68
        }
      ]
    },
    plugins: [barValueLabelsPlugin],
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: "y",
      layout: {
        padding: { top: 8, right: 56, bottom: 8, left: 4 }
      },
      animation: {
        duration: 600,
        easing: "easeOutQuart"
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          ...baseTooltip,
          callbacks: {
            title: (items) => topVarieties[items[0]?.dataIndex]?.variedad ?? "",
            label: (context) => ` ${formatAreaHa(context.parsed.x)} ha`
          }
        }
      },
      scales: {
        x: {
          beginAtZero: true,
          max: axisMax,
          grid: {
            color: GRID_COLOR,
            drawTicks: false
          },
          ticks: {
            font: { family: FONT, size: 11 },
            color: AXIS_COLOR,
            padding: 10,
            stepSize: 200,
            callback: (value) => `${value} ha`
          },
          border: { display: false }
        },
        y: {
          grid: { display: false },
          ticks: {
            font: { family: FONT, size: 11, weight: "600" },
            color: LABEL_COLOR,
            padding: 14,
            crossAlign: "far",
            autoSkip: false,
            callback: (value, index) => truncateLabel(topVarieties[index]?.variedad ?? value, 24)
          },
          border: { display: false }
        }
      }
    }
  });
}

export function renderInicioEtapaAreaChart(filters = {}) {
  const etapaSummary = getEtapaAreaSummary(filters);
  if (!etapaSummary.length) {
    chartService.destroy("chartInicioEtapaArea");
    return null;
  }

  const displaySummary = etapaSummary.slice(0, 6);
  const maxValue = Math.max(...displaySummary.map((item) => item.areaHa));
  const axisMax = getAxisMaxForBars(maxValue);

  return chartService.render("chartInicioEtapaArea", {
    type: "bar",
    data: {
      labels: displaySummary.map((item) => item.etapa),
      datasets: [
        {
          label: "Área (ha)",
          data: displaySummary.map((item) => item.areaHa),
          backgroundColor: resolveVerticalBarGradient,
          borderRadius: 8,
          borderSkipped: false,
          categoryPercentage: 0.68,
          barPercentage: 0.62
        }
      ]
    },
    plugins: [barValueLabelsPlugin],
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: {
        padding: { top: 22, right: 12, bottom: 6, left: 4 }
      },
      animation: {
        duration: 600,
        easing: "easeOutQuart"
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          ...baseTooltip,
          callbacks: {
            label: (context) => ` ${formatAreaHa(context.parsed.y)} ha`
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            font: { family: FONT, size: 11, weight: "600" },
            color: LABEL_COLOR,
            padding: 10
          },
          border: { display: false }
        },
        y: {
          beginAtZero: true,
          max: axisMax,
          grid: {
            color: GRID_COLOR,
            drawTicks: false
          },
          ticks: {
            font: { family: FONT, size: 11 },
            color: AXIS_COLOR,
            padding: 10,
            stepSize: 200,
            callback: (value) => `${value} ha`
          },
          border: { display: false }
        }
      }
    }
  });
}

export function renderInicioFundoChartLegend(filters = {}) {
  const legendRoot = document.getElementById("inicioFundoChartLegend");
  if (!legendRoot) {
    return;
  }

  const fundoSummary = getFundoAreaSummary(filters);
  const totalAreaHa = fundoSummary.reduce((sum, item) => sum + item.totalAreaHa, 0);

  legendRoot.innerHTML = fundoSummary
    .map((item) => {
      const percent = totalAreaHa > 0 ? ((item.totalAreaHa / totalAreaHa) * 100).toFixed(1) : "0.0";
      return `
        <li class="inicio-varieties__legend-item" data-fundo="${item.fundo}">
          <span class="inicio-varieties__legend-swatch" aria-hidden="true"></span>
          <span class="inicio-varieties__legend-copy">
            <strong>Fundo ${item.fundo}</strong>
            <span>${formatAreaHa(item.totalAreaHa)} ha · ${percent}%</span>
          </span>
        </li>
      `;
    })
    .join("");
}

export function updateInicioChartCenterLabel(filters = {}) {
  const centerValue = document.getElementById("txtInicioTotalArea");
  if (!centerValue) {
    return;
  }

  const stats = getGlobalStats(filters);
  centerValue.textContent = formatAreaHa(stats.totalAreaHa);
}

export function renderInicioDonutCharts(filters = {}) {
  updateInicioChartCenterLabel(filters);
  renderInicioFundoChartLegend(filters);
  renderInicioFundoAreaChart(filters);
}

export function renderInicioVarietiesChart(filters = {}) {
  renderInicioTopVarietiesChart(filters);
}

export function renderInicioEtapasChart(filters = {}) {
  renderInicioEtapaAreaChart(filters);
}

export function renderInicioVarietyCharts(chartFilters = {}) {
  renderInicioDonutCharts(chartFilters.donut ?? {});
  renderInicioVarietiesChart(chartFilters.varieties ?? {});
  renderInicioEtapasChart(chartFilters.etapas ?? {});
}

export function destroyInicioVarietyCharts() {
  chartService.destroy("chartInicioFundoArea");
  chartService.destroy("chartInicioTopVarieties");
  chartService.destroy("chartInicioEtapaArea");
}

export function resizeInicioVarietyCharts() {
  chartService.resize("chartInicioFundoArea");
  chartService.resize("chartInicioTopVarieties");
  chartService.resize("chartInicioEtapaArea");
}
