class AverageDistanceChart {
    constructor() {
        this.chart = null;
    }

    renderChart(activities, avgWeekly, sportType = "ride") {
        const chartSettings = window.settingsManager.getChartRanges();
        const monthsToShow = chartSettings.distanceChartMonths;

        const rangeStart = new Date();
        rangeStart.setMonth(rangeStart.getMonth() - monthsToShow);

        const recent = (activities || []).filter((a) => a.date >= rangeStart);

        // Determine the appropriate method and renderer based on sport type
        const methodMap = {
            ride: {
                calculateWeeklyData: "calculateWeeklyPowerData",
                renderer: window.powerAnalyzer,
                metricLabel: "Estimated FTP (W)",
                metricKey: "estimatedFTP",
                metricColor: "rgba(251, 188, 4, 1)",
                metricBgColor: "rgba(251, 188, 4, 0.1)",
                metricFormatter: (value) => `${Math.round(value)}W`,
                metricAxisLabel: "FTP (Watts)",
                zones: ["noPower", "z1", "z2", "z3", "z4", "z5", "z6"],
                zoneLabels: [
                    "No Power Data",
                    "Z1 (Active Recovery)",
                    "Z2 (Endurance)",
                    "Z3 (Tempo)",
                    "Z4 (Threshold)",
                    "Z5 (VO2 Max)",
                    "Z6 (Anaerobic)",
                ],
                zoneColors: [
                    "rgba(154, 160, 166, 0.5)",
                    "rgba(189, 189, 189, 0.7)",
                    "rgba(66, 133, 244, 0.7)",
                    "rgba(52, 168, 83, 0.7)",
                    "rgba(255, 153, 0, 0.7)",
                    "rgba(234, 67, 53, 0.7)",
                    "rgba(156, 39, 176, 0.7)",
                ],
            },
            run: {
                calculateWeeklyData: "calculateWeeklyZoneData",
                renderer: window.runRenderer,
                metricLabel: "Average Pace (min/km)",
                metricKey: "averagePace",
                metricColor: "rgba(251, 188, 4, 1)",
                metricBgColor: "rgba(251, 188, 4, 0.1)",
                metricFormatter: (value) => value,
                metricAxisLabel: "Pace (min/km)",
                zones: ["z1", "z2", "z3", "z4", "z5"],
                zoneLabels: [
                    "Z1 (Easy)",
                    "Z2 (Moderate)",
                    "Z3 (Tempo)",
                    "Z4 (Threshold)",
                    "Z5 (Speed)",
                ],
                zoneColors: [
                    "rgba(189, 189, 189, 0.7)",
                    "rgba(66, 133, 244, 0.7)",
                    "rgba(52, 168, 83, 0.7)",
                    "rgba(255, 153, 0, 0.7)",
                    "rgba(234, 67, 53, 0.7)",
                ],
            },
            swim: {
                calculateWeeklyData: "calculateWeeklyZoneData",
                renderer: window.swimRenderer,
                metricLabel: "Average Pace (min/100m)",
                metricKey: "averagePace",
                metricColor: "rgba(251, 188, 4, 1)",
                metricBgColor: "rgba(251, 188, 4, 0.1)",
                metricFormatter: (value) =>
                    window.helpers.formatSwimPace(value),
                metricAxisLabel: "Pace (min/100m)",
                zones: ["z1", "z2", "z3", "z4", "z5"],
                zoneLabels: [
                    "Z1 (Easy)",
                    "Z2 (Moderate)",
                    "Z3 (Tempo)",
                    "Z4 (Threshold)",
                    "Z5 (Speed)",
                ],
                zoneColors: [
                    "rgba(189, 189, 189, 0.7)",
                    "rgba(66, 133, 244, 0.7)",
                    "rgba(52, 168, 83, 0.7)",
                    "rgba(255, 153, 0, 0.7)",
                    "rgba(234, 67, 53, 0.7)",
                ],
            },
        };

        const config = methodMap[sportType.toLowerCase()];
        if (!config) {
            console.error(`Unknown sport type: ${sportType}`);
            return;
        }

        const weeklyData = config.renderer[config.calculateWeeklyData](recent);
        const labels = weeklyData.map((w) =>
            window.helpers.formatDate(w.weekStart)
        );

        if (this.chart) {
            this.chart.destroy();
        }

        const canvasId = `averageDistanceChart${sportType.charAt(0).toUpperCase() + sportType.slice(1)}`;
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        // Build zone datasets
        const datasets = config.zones.map((zone, index) => ({
            label: config.zoneLabels[index],
            data: weeklyData.map((w) => w[zone]),
            backgroundColor: config.zoneColors[index],
            stack: "distance",
            yAxisID: "y",
        }));

        // Add average line
        datasets.push({
            type: "line",
            label: `Ø ${monthsToShow} Month${monthsToShow !== 1 ? "s" : ""}`,
            data: Array(labels.length).fill(avgWeekly),
            borderColor: "rgba(138, 180, 248, 1)",
            borderWidth: 2,
            borderDash: [5, 5],
            pointRadius: 0,
            fill: false,
            yAxisID: "y",
        });

        // Add metric line (FTP or pace)
        const metricValues = weeklyData
            .map((w) => w[config.metricKey])
            .filter((v) => v !== null && v !== undefined);
        const maxMetric =
            metricValues.length > 0
                ? Math.max(...metricValues)
                : sportType === "ride"
                  ? 300
                  : 6;
        const minMetric =
            metricValues.length > 0
                ? Math.min(...metricValues)
                : sportType === "ride"
                  ? 0
                  : 3;

        let suggestedMaxMetric;
        if (sportType === "ride") {
            suggestedMaxMetric = Math.ceil((maxMetric + 20) / 50) * 50;
        } else {
            suggestedMaxMetric = Math.ceil(maxMetric * 1.1);
        }

        datasets.push({
            type: "line",
            label: config.metricLabel,
            data: weeklyData.map((w) => w[config.metricKey]),
            borderColor: config.metricColor,
            backgroundColor: config.metricBgColor,
            borderWidth: 2,
            pointRadius: 4,
            pointBackgroundColor: config.metricColor,
            fill: false,
            yAxisID: "y2",
            tension: 0.3,
            spanGaps: true,
        });

        this.chart = new Chart(canvas, {
            type: "bar",
            data: { labels, datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: "index", intersect: false },
                plugins: {
                    legend: {
                        display: true,
                        labels: {
                            color: "#ffffff",
                            usePointStyle: true,
                            padding: 15,
                        },
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const label = context.dataset.label || "";
                                const value = context.parsed.y;
                                if (value === 0 || value === null) return null;
                                if (label === config.metricLabel) {
                                    return `${label}: ${config.metricFormatter(value)}`;
                                }
                                return `${label}: ${value.toFixed(1)} km`;
                            },
                            footer: (tooltipItems) => {
                                let total = 0;
                                tooltipItems.forEach((item) => {
                                    if (item.dataset.stack === "distance") {
                                        total += item.parsed.y;
                                    }
                                });
                                return total > 0
                                    ? `Total: ${total.toFixed(1)} km`
                                    : "";
                            },
                        },
                    },
                },
                scales: {
                    y: {
                        stacked: true,
                        beginAtZero: true,
                        position: "left",
                        ticks: {
                            color: "#9aa0a6",
                            callback: (value) => value + " km",
                        },
                        grid: { color: "#2a2f3a" },
                    },
                    y2: {
                        position: "right",
                        beginAtZero: sportType === "ride",
                        reverse: sportType !== "ride",
                        title: {
                            display: true,
                            text: config.metricAxisLabel,
                            color: config.metricColor,
                        },
                        ticks: {
                            color: config.metricColor,
                            callback: (value) => config.metricFormatter(value),
                        },
                        grid: { drawOnChartArea: false },
                        suggestedMax: suggestedMaxMetric,
                        suggestedMin:
                            sportType !== "ride" ? minMetric * 0.9 : undefined,
                    },
                    x: {
                        stacked: true,
                        ticks: { color: "#9aa0a6" },
                        grid: { color: "#2a2f3a" },
                    },
                },
            },
        });
    }

    destroy() {
        if (this.chart) {
            this.chart.destroy();
            this.chart = null;
        }
    }
}

window.averageDistanceChart = new AverageDistanceChart();
