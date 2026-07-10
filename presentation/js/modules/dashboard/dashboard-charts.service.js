import { chartService } from "../../services/chart.service.js";

const FOREST = "#0B2418";
const LIME = "#D1F366";
const NAVY = "#0E1B40";
const FONT = "Inter, sans-serif";

const baseTooltip = {
  backgroundColor: FOREST,
  titleFont: { family: FONT, size: 12 },
  bodyFont: { family: FONT, size: 11 },
  padding: 10,
  cornerRadius: 10
};

export function renderPlantGrowthChart() {
  chartService.render("chartPlantGrowth", {
    type: "line",
    data: {
      labels: ["Seed Phase (W1)", "Vegetation (W2)", "Final Growth (W3)", "W4", "W5", "W6"],
      datasets: [
        {
          label: "Seed Phase",
          data: [2.5, 3.8, 5.2, 6.0, 6.5, 7.0],
          borderColor: FOREST,
          backgroundColor: "rgba(11, 36, 24, 0.05)",
          tension: 0.42,
          fill: true,
          pointRadius: 5,
          pointBackgroundColor: FOREST,
          borderWidth: 2
        },
        {
          label: "Final Growth",
          data: [1.8, 3.2, 6.8, 7.8, 8.2, 8.6],
          borderColor: LIME,
          borderWidth: 2.5,
          tension: 0.42,
          fill: false,
          pointRadius: 6,
          pointBackgroundColor: LIME,
          pointBorderColor: FOREST,
          pointBorderWidth: 2
        },
        {
          label: "Vegetation",
          data: [1.2, 2.5, 4.0, 5.5, 6.2, 6.9],
          borderColor: "#8BA888",
          tension: 0.42,
          fill: false,
          pointRadius: 4,
          borderWidth: 2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            usePointStyle: true,
            boxWidth: 8,
            font: { family: FONT, size: 10 },
            padding: 10
          }
        },
        tooltip: baseTooltip
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { family: FONT, size: 9 }, color: "#64748B", maxRotation: 0 } },
        y: {
          grid: { color: "rgba(232,237,234,0.8)" },
          ticks: { font: { family: FONT, size: 10 }, color: "#64748B", callback: (v) => `${v} cm` },
          border: { display: false }
        }
      }
    }
  });
}

export function renderProductionSummaryChart() {
  chartService.render("chartProductionSummary", {
    type: "bar",
    data: {
      labels: ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"],
      datasets: [
        {
          label: "Current Year Production",
          data: [3200, 2800, 3500, 4100, 3800, 4500, 4200, 3900, 3600, 4000, 4300, 4800],
          backgroundColor: LIME,
          borderRadius: 3,
          borderSkipped: false,
          barPercentage: 0.85,
          categoryPercentage: 0.7
        },
        {
          label: "Last Year Production",
          data: [2800, 2600, 3000, 3400, 3200, 3800, 3600, 3300, 3100, 3500, 3700, 4000],
          backgroundColor: FOREST,
          borderRadius: 3,
          borderSkipped: false,
          barPercentage: 0.85,
          categoryPercentage: 0.7
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: baseTooltip
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { family: FONT, size: 9, weight: "500" }, color: "#64748B" }
        },
        y: {
          grid: { color: "rgba(232,237,234,0.8)" },
          ticks: { font: { family: FONT, size: 10 }, color: "#64748B", stepSize: 1000 },
          border: { display: false },
          max: 5000
        }
      }
    }
  });
}

export function destroyDashboardCharts() {
  chartService.destroy("chartPlantGrowth");
  chartService.destroy("chartProductionSummary");
}
