class AverageDistanceChart {
    constructor() {
        this.chart = null;
        this.currentPeriod = 90; // Default to 3 months (in days), -1 means "all time"
        this.cachedActivities = null;
        this.cachedAvgWeekly = null;
        this.periodPresets = [
            { label: "1 Month", days: 30 },
            { label: "2 Months", days: 60 },
            { label: "3 Months", days: 90 },
            { label: "6 Months", days: 180 },
            { label: "1 Year", days: 365 },
            { label: "All Time", days: -1 },
        ];
    }

    // Create period selector with dropdown
    createPeriodSelector(sportType = "ride") {
        const containerId = `avgDistPeriodSelector${sportType.charAt(0).toUpperCase() + sportType.slice(1)}`;
        let container = document.getElementById(containerId);

        if (!container) {
            const canvas = document.getElementById(
                `averageDistanceChart${sportType.charAt(0).toUpperCase() + sportType.slice(1)}`
            );
            if (!canvas) return;

            container = document.createElement("div");
            container.id = containerId;
            container.style.cssText =
                "display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; justify-content: center; align-items: center;";
            canvas.parentNode.insertBefore(container, canvas);
        }

        container.innerHTML = "";
        const isPreset = this.periodPresets.some(
            (p) => p.days === this.currentPeriod
        );

        // Create dropdown
        const dropdown = document.createElement("select");
        dropdown.style.cssText = `
            padding: 8px 12px;
            border: 1px solid #5f6368;
            border-radius: 4px;
            background: #202124;
            color: #e8eaed;
            cursor: pointer;
            font-size: 13px;
            font-family: system-ui, -apple-system, sans-serif;
            min-width: 120px;
        `;

        // Add preset options
        this.periodPresets.forEach((preset) => {
            const option = document.createElement("option");
            option.value = preset.days;
            option.textContent = preset.label;
            option.selected = this.currentPeriod === preset.days;
            dropdown.appendChild(option);
        });

        // Add custom option if current period is not a preset
        if (!isPreset) {
            const customOption = document.createElement("option");
            customOption.value = this.currentPeriod;
            customOption.textContent = `Custom (${this.currentPeriod} days)`;
            customOption.selected = true;
            dropdown.appendChild(customOption);
        }

        dropdown.addEventListener("change", (e) => {
            this.currentPeriod = parseInt(e.target.value);
            this.renderChartWithCachedData(sportType);
        });

        container.appendChild(dropdown);

        // Custom input
        const customWrapper = document.createElement("div");
        customWrapper.style.cssText =
            "display: flex; gap: 4px; align-items: center;";

        const customLabel = document.createElement("span");
        customLabel.textContent = "Custom:";
        customLabel.style.cssText =
            "color: #e8eaed; font-size: 13px; font-family: system-ui, -apple-system, sans-serif;";

        const customInput = document.createElement("input");
        customInput.type = "number";
        customInput.min = "1";
        customInput.max = "730";
        customInput.placeholder = "Days";
        customInput.style.cssText =
            "width: 70px; padding: 8px 12px; border: 1px solid #5f6368; border-radius: 4px; background: transparent; color: #e8eaed; font-size: 13px; font-family: system-ui, -apple-system, sans-serif; text-align: center;";
        if (!isPreset) customInput.value = this.currentPeriod;

        const daysLabel = document.createElement("span");
        daysLabel.textContent = "days";
        daysLabel.style.cssText =
            "color: #e8eaed; font-size: 13px; font-family: system-ui, -apple-system, sans-serif;";

        const applyButton = document.createElement("button");
        applyButton.textContent = "Apply";
        applyButton.style.cssText =
            "padding: 8px 16px; border: 1px solid #5f6368; border-radius: 4px; background: transparent; color: #e8eaed; cursor: pointer; font-size: 13px; font-family: system-ui, -apple-system, sans-serif; transition: all 0.2s;";

        applyButton.addEventListener(
            "mouseenter",
            () => (applyButton.style.background = "rgba(66, 133, 244, 0.1)")
        );
        applyButton.addEventListener(
            "mouseleave",
            () => (applyButton.style.background = "transparent")
        );

        const applyCustomPeriod = () => {
            const days = parseInt(customInput.value);
            if (days && days > 0 && days <= 730) {
                this.currentPeriod = days;
                this.renderChartWithCachedData(sportType);
                this.createPeriodSelector(sportType);
            } else {
                customInput.style.borderColor = "#ea4335";
                setTimeout(
                    () => (customInput.style.borderColor = "#5f6368"),
                    1000
                );
            }
        };

        applyButton.addEventListener("click", applyCustomPeriod);
        customInput.addEventListener("keypress", (e) => {
            if (e.key === "Enter") applyCustomPeriod();
        });

        customWrapper.appendChild(customLabel);
        customWrapper.appendChild(customInput);
        customWrapper.appendChild(daysLabel);
        customWrapper.appendChild(applyButton);
        container.appendChild(customWrapper);
    }

    renderChartWithCachedData(sportType) {
        if (this.cachedActivities) {
            this.renderChart(
                this.cachedActivities,
                this.cachedAvgWeekly,
                sportType
            );
        }
    }

    renderChart(activities, avgWeekly, sportType = "ride") {
        // Cache data for re-rendering
        if (activities !== null && activities !== undefined) {
            this.cachedActivities = activities;
            this.cachedAvgWeekly = avgWeekly;
        }

        // Create period selector
        this.createPeriodSelector(sportType);

        let recent;
        if (this.currentPeriod === -1) {
            // All time - use all activities
            recent = this.cachedActivities || [];
        } else {
            // Specific period - filter by date range
            const rangeStart = new Date();
            rangeStart.setDate(rangeStart.getDate() - this.currentPeriod);
            recent = (this.cachedActivities || []).filter(
                (a) => a.date >= rangeStart
            );
        }

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
                metricKey: "avgPace",
                metricColor: "rgba(251, 188, 4, 1)",
                metricBgColor: "rgba(251, 188, 4, 0.1)",
                metricFormatter: (value) => `${value.toFixed(2)}min/km`,
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
                metricKey: "avgPace",
                metricColor: "rgba(251, 188, 4, 1)",
                metricBgColor: "rgba(251, 188, 4, 0.1)",
                metricFormatter: (value) => `${value.toFixed(2)}min/km`,
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

        // Get period label for display
        const periodLabel = this.getPeriodLabel(this.currentPeriod);

        // Add average line
        datasets.push({
            type: "line",
            label: `Ø ${periodLabel}`,
            data: Array(labels.length).fill(this.cachedAvgWeekly),
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
            .filter((v) => v !== null && v !== undefined && !Number.isNaN(v));

        const defaultBounds =
            sportType === "ride" ? { min: 0, max: 300 } : { min: 3, max: 7 };

        const maxMetric =
            metricValues.length > 0
                ? Math.max(...metricValues)
                : defaultBounds.max;

        const minMetric =
            metricValues.length > 0
                ? Math.min(...metricValues)
                : defaultBounds.min;

        let suggestedMaxMetric;
        if (sportType === "ride") {
            suggestedMaxMetric = Math.ceil((maxMetric + 20) / 50) * 50;
        } else {
            suggestedMaxMetric = Math.ceil((maxMetric + 0.2) * 10) / 10;
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
                        beginAtZero: true,
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
                            sportType !== "ride"
                                ? Math.max(
                                      0,
                                      Math.floor((minMetric - 0.2) * 10) / 10
                                  )
                                : undefined,
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

    // Helper to get human-readable period label
    getPeriodLabel(days) {
        if (days === -1) return "All Time";
        if (days === 30) return "1 Month";
        if (days === 60) return "2 Months";
        if (days === 90) return "3 Months";
        if (days === 180) return "6 Months";
        if (days === 365) return "1 Year";

        // Fallback for custom periods
        if (days >= 365) {
            const years = (days / 365).toFixed(1);
            return `${years} Year${years !== "1.0" ? "s" : ""}`;
        }
        if (days >= 30) {
            const months = Math.round(days / 30);
            return `${months} Month${months !== 1 ? "s" : ""}`;
        }
        return `${days} Days`;
    }

    destroy() {
        if (this.chart) {
            this.chart.destroy();
            this.chart = null;
        }
    }
}

window.averageDistanceChart = new AverageDistanceChart();
