class IntensityChart {
    constructor() {
        this.chart = null;
    }

    renderChart(activities, sportType = "ride") {
        const canvasId = `intensityChart${sportType.charAt(0).toUpperCase() + sportType.slice(1)}`;
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        const existing = Chart.getChart(canvas);
        if (existing) existing.destroy();

        const chartSettings = window.settingsManager.getChartRanges();
        const weeksToShow = chartSettings.intensityChartWeeks;
        const daysToShow = weeksToShow * 7;

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
                `No detailed ${sportType} data available for the last ${weeksToShow} week${weeksToShow !== 1 ? "s" : ""}`,
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
                        label: `Previous ${weeksToShow} week${weeksToShow !== 1 ? "s" : ""}`,
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
                        label: `Current ${weeksToShow} week${weeksToShow !== 1 ? "s" : ""}`,
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
                            callback: (value) => value.toFixed(0) + "%",
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

    destroy() {
        if (this.chart) {
            this.chart.destroy();
            this.chart = null;
        }
    }
}

// Initialize and export singleton
window.intensityChart = new IntensityChart();
