class IntensityChart {
    constructor() {
        this.chart = null;
        this.currentPeriod = 28; // Default to 4 weeks
        this.periodPresets = [
            { label: "1 Week", days: 7 },
            { label: "2 Weeks", days: 14 },
            { label: "4 Weeks", days: 28 },
            { label: "8 Weeks", days: 56 },
            { label: "3 Months", days: 90 },
            { label: "6 Months", days: 180 },
        ];
    }

    // Create period selector with dropdown
    createPeriodSelector(sportType = "ride") {
        const containerId = `periodSelector${sportType.charAt(0).toUpperCase() + sportType.slice(1)}`;
        let container = document.getElementById(containerId);

        if (!container) {
            const chartCanvas = document.getElementById(
                `intensityChart${sportType.charAt(0).toUpperCase() + sportType.slice(1)}`
            );
            if (!chartCanvas) return;

            container = document.createElement("div");
            container.id = containerId;
            container.className = "period-selector";
            container.style.cssText =
                "display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; justify-content: center; align-items: center;";

            chartCanvas.parentNode.insertBefore(container, chartCanvas);
        }

        container.innerHTML = "";

        // Check if current period is a preset
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
            this.renderChart(null, sportType);
        });

        container.appendChild(dropdown);

        // Add custom input field
        const customWrapper = document.createElement("div");
        customWrapper.style.cssText =
            "display: flex; gap: 4px; align-items: center;";

        const customLabel = document.createElement("span");
        customLabel.textContent = "Custom:";
        customLabel.style.cssText = `
            color: #e8eaed;
            font-size: 13px;
            font-family: system-ui, -apple-system, sans-serif;
        `;

        const customInput = document.createElement("input");
        customInput.type = "number";
        customInput.min = "1";
        customInput.max = "365";
        customInput.placeholder = "Days";
        customInput.style.cssText = `
            width: 70px;
            padding: 8px 12px;
            border: 1px solid #5f6368;
            border-radius: 4px;
            background: transparent;
            color: #e8eaed;
            font-size: 13px;
            font-family: system-ui, -apple-system, sans-serif;
            text-align: center;
        `;

        if (!isPreset) {
            customInput.value = this.currentPeriod;
        }

        const daysLabel = document.createElement("span");
        daysLabel.textContent = "days";
        daysLabel.style.cssText = `
            color: #e8eaed;
            font-size: 13px;
            font-family: system-ui, -apple-system, sans-serif;
        `;

        const applyButton = document.createElement("button");
        applyButton.textContent = "Apply";
        applyButton.style.cssText = `
            padding: 8px 16px;
            border: 1px solid #5f6368;
            border-radius: 4px;
            background: transparent;
            color: #e8eaed;
            cursor: pointer;
            font-size: 13px;
            font-family: system-ui, -apple-system, sans-serif;
            transition: all 0.2s;
        `;

        applyButton.addEventListener("mouseenter", () => {
            applyButton.style.background = "rgba(66, 133, 244, 0.1)";
        });

        applyButton.addEventListener("mouseleave", () => {
            applyButton.style.background = "transparent";
        });

        const applyCustomPeriod = () => {
            const days = parseInt(customInput.value);
            if (days && days > 0 && days <= 365) {
                this.currentPeriod = days;
                this.createPeriodSelector(sportType);
                this.renderChart(null, sportType);
            } else {
                customInput.style.borderColor = "#ea4335";
                setTimeout(() => {
                    customInput.style.borderColor = "#5f6368";
                }, 1000);
            }
        };

        applyButton.addEventListener("click", applyCustomPeriod);

        customInput.addEventListener("keypress", (e) => {
            if (e.key === "Enter") {
                applyCustomPeriod();
            }
        });

        customWrapper.appendChild(customLabel);
        customWrapper.appendChild(customInput);
        customWrapper.appendChild(daysLabel);
        customWrapper.appendChild(applyButton);
        container.appendChild(customWrapper);
    }

    renderChart(activities, sportType = "ride") {
        // Create period selector if it doesn't exist
        this.createPeriodSelector(sportType);

        const canvasId = `intensityChart${sportType.charAt(0).toUpperCase() + sportType.slice(1)}`;
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        const existing = Chart.getChart(canvas);
        if (existing) existing.destroy();

        const daysToShow = this.currentPeriod;
        const weeksLabel = this.getPeriodLabel(daysToShow);

        // Determine the appropriate method and renderer based on sport type
        const methodMap = {
            ride: {
                getRange: "getRidesInRange",
                calcDistribution: "calculatePowerZoneDistribution",
                renderer: window.powerAnalyzer,
            },
            run: {
                getRange: "getRunsInRange",
                calcDistribution: "calculateZoneDistribution",
                renderer: window.hrAnalyzer,
            },
            swim: {
                getRange: "getSwimsInRange",
                calcDistribution: "calculateZoneDistribution",
                renderer: window.hrAnalyzer,
            },
        };

        const methods = methodMap[sportType.toLowerCase()];
        if (!methods) {
            console.error(`Unknown sport type: ${sportType}`);
            return;
        }

        // Get current period data
        const currentPeriod =
            window.dataProcessor[methods.getRange](daysToShow);
        const currentDistribution =
            methods.renderer[methods.calcDistribution](currentPeriod);

        // Get previous period data (same duration, immediately before current period)
        const previousPeriod = window.dataProcessor[methods.getRange](
            daysToShow * 2,
            daysToShow
        );
        const previousDistribution =
            methods.renderer[methods.calcDistribution](previousPeriod);

        if (currentDistribution.totalDataPoints === 0) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.font = "16px system-ui";
            ctx.fillStyle = "#9aa0a6";
            ctx.textAlign = "center";
            ctx.fillText(
                `No detailed ${sportType} data available for ${weeksLabel}`,
                canvas.width / 2,
                canvas.height / 2
            );
            return;
        }

        // Define zone labels based on sport type
        const zoneConfig = {
            ride: {
                zones: ["z1", "z2", "z3", "z4", "z5", "z6"],
                labels: [
                    "Z1: Active Recovery",
                    "Z2: Endurance",
                    "Z3: Tempo",
                    "Z4: Threshold",
                    "Z5: VO2 Max",
                    "Z6: Anaerobic",
                ],
            },
            run: {
                zones: ["z1", "z2", "z3", "z4", "z5"],
                labels: [
                    "Z1: Easy",
                    "Z2: Moderate",
                    "Z3: Tempo",
                    "Z4: Threshold",
                    "Z5: Speed",
                ],
            },
            swim: {
                zones: ["z1", "z2", "z3", "z4", "z5"],
                labels: [
                    "Z1: Easy",
                    "Z2: Moderate",
                    "Z3: Tempo",
                    "Z4: Threshold",
                    "Z5: Speed",
                ],
            },
        };

        const config = zoneConfig[sportType.toLowerCase()];
        const zones = config.zones;
        const labels = config.labels;

        const currentData = zones.map(
            (z) => currentDistribution.percentages[z] || 0
        );
        const previousData = zones.map(
            (z) => previousDistribution.percentages[z] || 0
        );
        const currentDistances = zones.map(
            (z) => currentDistribution.distances[z] || 0
        );
        const previousDistances = zones.map(
            (z) => previousDistribution.distances[z] || 0
        );

        const textColor =
            getComputedStyle(document.documentElement)
                .getPropertyValue("--text")
                .trim() || "#e8eaed";

        const isSmallScreen = window.innerWidth < 768;

        // Calculate max value for scale, ensuring it's at least 10%
        const maxValue = Math.max(...currentData, ...previousData, 10);

        this.chart = new Chart(ctx, {
            type: "radar",
            data: {
                labels,
                datasets: [
                    {
                        label: `Previous ${weeksLabel}`,
                        data: previousData,
                        backgroundColor: "rgba(156, 163, 175, 0.15)",
                        borderColor: "rgba(156, 163, 175, 0.5)",
                        borderWidth: 2,
                        pointBackgroundColor: "rgba(156, 163, 175, 0.5)",
                        pointBorderColor: "#fff",
                        pointRadius: 3,
                        pointHoverRadius: 5,
                        pointBorderWidth: 1,
                        order: 2,
                    },
                    {
                        label: `Current ${weeksLabel}`,
                        data: currentData,
                        backgroundColor: "rgba(66, 133, 244, 0.2)",
                        borderColor: "rgba(66, 133, 244, 0.8)",
                        borderWidth: 3,
                        pointBackgroundColor: "rgba(66, 133, 244, 0.8)",
                        pointBorderColor: "#fff",
                        pointRadius: 4,
                        pointHoverRadius: 6,
                        pointBorderWidth: 2,
                        order: 1,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                layout: {
                    padding: { top: 20, bottom: 20, left: 20, right: 20 },
                },
                scales: {
                    r: {
                        beginAtZero: true,
                        max: maxValue * 1.1,
                        ticks: {
                            stepSize: 5,
                            color: textColor,
                            backdropColor: "transparent",
                            font: {
                                size: 11,
                                family: "system-ui, -apple-system, sans-serif",
                            },
                            callback: (value, index) => {
                                // Only show label on every second tick (even indices)
                                return index % 2 === 0
                                    ? value.toFixed(0) + "%"
                                    : "";
                            },
                        },
                        grid: {
                            color: "rgba(128, 128, 128, 0.2)",
                            circular: true,
                        },
                        angleLines: {
                            color: "rgba(128, 128, 128, 0.2)",
                        },
                        pointLabels: {
                            color: textColor,
                            font: {
                                size: isSmallScreen ? 10 : 12,
                                family: "system-ui, -apple-system, sans-serif",
                            },
                            callback: (label) => {
                                // Shorten labels on small screens
                                if (isSmallScreen) {
                                    return label.split(":")[0];
                                }
                                return label;
                            },
                        },
                    },
                },
                plugins: {
                    legend: {
                        display: true,
                        position: isSmallScreen ? "bottom" : "top",
                        labels: {
                            color: textColor,
                            padding: 15,
                            font: {
                                size: 13,
                                family: "system-ui, -apple-system, sans-serif",
                            },
                            usePointStyle: true,
                            pointStyle: "circle",
                        },
                    },
                    tooltip: {
                        backgroundColor: "rgba(0, 0, 0, 0.8)",
                        titleColor: textColor,
                        bodyColor: textColor,
                        borderColor: "#444",
                        borderWidth: 1,
                        callbacks: {
                            label: (context) => {
                                const percent = context.parsed.r.toFixed(1);
                                const datasetLabel = context.dataset.label;
                                const zoneIndex = context.dataIndex;

                                if (context.datasetIndex === 0) {
                                    // Previous period
                                    const distance =
                                        previousDistances[zoneIndex];
                                    return [
                                        `${datasetLabel}: ${percent}%`,
                                        `Distance: ${distance.toFixed(1)} km`,
                                    ];
                                } else {
                                    // Current period
                                    const distance =
                                        currentDistances[zoneIndex];
                                    const previousPercent =
                                        previousData[zoneIndex];
                                    const change = percent - previousPercent;
                                    const changeText =
                                        change >= 0
                                            ? `+${change.toFixed(1)}%`
                                            : `${change.toFixed(1)}%`;

                                    return [
                                        `${datasetLabel}: ${percent}%`,
                                        `Distance: ${distance.toFixed(1)} km`,
                                        `Change: ${changeText}`,
                                    ];
                                }
                            },
                        },
                    },
                },
            },
        });
    }

    // Helper to get human-readable period label
    getPeriodLabel(days) {
        if (days === 7) return "1 week";
        if (days === 14) return "2 weeks";
        if (days === 28) return "4 weeks";
        if (days === 56) return "8 weeks";
        if (days === 90) return "3 months";
        if (days === 180) return "6 months";

        // Fallback for custom periods
        if (days % 7 === 0) {
            const weeks = days / 7;
            return `${weeks} week${weeks !== 1 ? "s" : ""}`;
        }
        return `${days} days`;
    }

    destroy() {
        if (this.chart) {
            this.chart.destroy();
            this.chart = null;
        }
    }
}

// Initialize and export singleton
window.intensityChart = new IntensityChart();
