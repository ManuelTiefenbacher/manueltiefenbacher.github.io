// js/ui/renderer-rides.js
// UI rendering for cycling activities
class RideRenderer {
    constructor() {
        this.chart = null;
    }

    /* ---------------- Small UI helpers ---------------- */

    _setText(id, value) {
        const el = document.getElementById(id);
        if (!el) return;
        el.textContent = value ?? "—";
    }

    _setKm(id, value) {
        const el = document.getElementById(id);
        if (!el) return;
        const num = Number(value ?? 0);
        el.textContent = `${num.toFixed(1)} km`;
    }

    /* ---------------- Basic info (RIDES) ---------------- */

    renderBasicInfo(summary) {
        if (!summary || !summary.last6Months || !summary.last7Days) {
            console.warn(
                "renderRideBasicInfo: invalid summary object",
                summary
            );
            this._setKm("avgWeeklyRide", 0);
            this._setKm("rideDistanceWeek", 0);
            this._setText("ridesWeek", 0);
            this._setText("restDaysRide", "—");
            const ftp = window.powerAnalyzer.getFTP() ?? 0;
            if (ftp > 0) this._setText("ftp", `${ftp} W`);
            return;
        }

        const avgWeekly = Number(summary.last6Months?.avgWeekly ?? 0);
        this._setKm("avgWeeklyRide", avgWeekly);

        const dist7 = Number(summary.last7Days?.distance ?? 0);
        this._setKm("rideDistanceWeek", dist7);

        const ridesWeek = Number(summary.last7Days?.rides ?? 0);
        this._setText("ridesWeek", ridesWeek);

        const daysSinceRest = this.calculateDaysSinceRest();
        this._setText("restDaysRide", daysSinceRest);

        // Update FTP display
        const ftp = window.powerAnalyzer.getFTP() ?? 0;
        if (ftp > 0) this._setText("ftp", `${ftp} W`);
    }

    /* ---------------- Rest-day logic ---------------- */

    calculateDaysSinceRest() {
        const list = window.dataProcessor?.rides;

        if (!Array.isArray(list) || list.length === 0) return "—";

        const sorted = [...list].sort((a, b) => b.date - a.date);
        const mostRecent = sorted[0];
        const daysSinceLast = window.helpers.daysAgo(mostRecent.date);

        if (daysSinceLast > 1) {
            return 0;
        }

        let consecutiveDays = 0;
        for (let i = 0; i < sorted.length - 1; i++) {
            const current = sorted[i];
            const next = sorted[i + 1];
            const gapDays = window.helpers.daysBetween(next.date, current.date);

            if (gapDays > 1) {
                consecutiveDays = i + 1;
                break;
            }
        }

        return consecutiveDays || sorted.length;
    }

    /* ---------------- Charts ---------------- */

    renderCharts(activities, avgWeekly = null) {
        if (avgWeekly === null) {
            const s = window.dataProcessor.getSummaryRides();
            avgWeekly = s?.last6Months?.avgWeekly ?? 0;
        }

        this.renderAverageDistanceChart(activities || [], Number(avgWeekly));
        this.renderIntensityChart(activities || []);
    }

    renderAverageDistanceChart(activities, avgWeekly) {
        const chartSettings = window.settingsManager.getChartRanges();
        const monthsToShow = chartSettings.distanceChartMonths;

        const rangeStart = new Date();
        rangeStart.setMonth(rangeStart.getMonth() - monthsToShow);

        const recent = (activities || []).filter((a) => a.date >= rangeStart);
        const weeklyData = this.calculateWeeklyPowerData(recent);

        const labels = weeklyData.map((w) =>
            window.helpers.formatDate(w.weekStart)
        );

        if (this.chart) {
            this.chart.destroy();
        }

        const canvas = document.getElementById("chartRide");
        if (!canvas) return;

        const datasets = [
            {
                label: "No Power Data",
                data: weeklyData.map((w) => w.noPower),
                backgroundColor: "rgba(154, 160, 166, 0.5)",
                stack: "distance",
                yAxisID: "y",
            },
            {
                label: "Z1 (Active Recovery)",
                data: weeklyData.map((w) => w.z1),
                backgroundColor: "rgba(189, 189, 189, 0.7)",
                stack: "distance",
                yAxisID: "y",
            },
            {
                label: "Z2 (Endurance)",
                data: weeklyData.map((w) => w.z2),
                backgroundColor: "rgba(66, 133, 244, 0.7)",
                stack: "distance",
                yAxisID: "y",
            },
            {
                label: "Z3 (Tempo)",
                data: weeklyData.map((w) => w.z3),
                backgroundColor: "rgba(52, 168, 83, 0.7)",
                stack: "distance",
                yAxisID: "y",
            },
            {
                label: "Z4 (Threshold)",
                data: weeklyData.map((w) => w.z4),
                backgroundColor: "rgba(255, 153, 0, 0.7)",
                stack: "distance",
                yAxisID: "y",
            },
            {
                label: "Z5 (VO2 Max)",
                data: weeklyData.map((w) => w.z5),
                backgroundColor: "rgba(234, 67, 53, 0.7)",
                stack: "distance",
                yAxisID: "y",
            },
            {
                label: "Z6 (Anaerobic)",
                data: weeklyData.map((w) => w.z6),
                backgroundColor: "rgba(156, 39, 176, 0.7)",
                stack: "distance",
                yAxisID: "y",
            },
            {
                type: "line",
                label: `Ø ${monthsToShow} Month${monthsToShow !== 1 ? "s" : ""}`,
                data: Array(labels.length).fill(avgWeekly),
                borderColor: "rgba(138, 180, 248, 1)",
                borderWidth: 2,
                borderDash: [5, 5],
                pointRadius: 0,
                fill: false,
                yAxisID: "y",
            },
            {
                type: "line",
                label: "Avg Speed (km/h)",
                data: weeklyData.map((w) => w.avgSpeed),
                borderColor: "rgba(251, 188, 4, 1)",
                backgroundColor: "rgba(251, 188, 4, 0.1)",
                borderWidth: 3,
                pointRadius: 4,
                pointBackgroundColor: "rgba(251, 188, 4, 1)",
                fill: false,
                yAxisID: "y2",
                tension: 0.3,
            },
        ];

        this.chart = new Chart(canvas, {
            type: "bar",
            data: { labels, datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: "index",
                    intersect: false,
                },
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

                                if (label === "Avg Speed (km/h)") {
                                    return `${label}: ${value.toFixed(1)} km/h`;
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
                        beginAtZero: false,
                        ticks: {
                            color: "#fbbc04",
                            callback: (value) => `${value.toFixed(1)} km/h`,
                        },
                        grid: {
                            display: false,
                        },
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

    calculateWeeklyPowerData(activities) {
        const weekMap = new Map();
        const ftp = window.powerAnalyzer.getFTP() ?? 0;

        (activities || []).forEach((activity) => {
            const weekStart = window.helpers.getWeekStart(activity.date);
            const weekKey = weekStart.toISOString().split("T")[0];

            if (!weekMap.has(weekKey)) {
                weekMap.set(weekKey, {
                    weekStart,
                    total: 0,
                    z1: 0,
                    z2: 0,
                    z3: 0,
                    z4: 0,
                    z5: 0,
                    z6: 0,
                    noPower: 0,
                    speeds: [],
                    totalDuration: 0,
                });
            }

            const weekData = weekMap.get(weekKey);
            weekData.total += activity.distance || 0;
            weekData.totalDuration += activity.duration || 0;

            const avgSpeed =
                window.intervalDetector.calculateAverageSpeed(activity);
            if (avgSpeed) {
                weekData.speeds.push(avgSpeed);
            }

            const hasPowerData = activity.avgWatts || activity.powerStream;

            if (!hasPowerData) {
                weekData.noPower += activity.distance || 0;
            } else if (
                activity.powerStream &&
                activity.powerStream.watts.length > 0
            ) {
                // Detailed power analysis
                const analysis = this.analyzePowerStream(
                    activity.powerStream,
                    ftp
                );
                if (analysis) {
                    weekData.z1 +=
                        (activity.distance || 0) * (analysis.percentZ1 / 100);
                    weekData.z2 +=
                        (activity.distance || 0) * (analysis.percentZ2 / 100);
                    weekData.z3 +=
                        (activity.distance || 0) * (analysis.percentZ3 / 100);
                    weekData.z4 +=
                        (activity.distance || 0) * (analysis.percentZ4 / 100);
                    weekData.z5 +=
                        (activity.distance || 0) * (analysis.percentZ5 / 100);
                    weekData.z6 +=
                        (activity.distance || 0) * (analysis.percentZ6 / 100);
                }
            } else if (activity.avgWatts) {
                // Basic power zone based on average
                const zone = this.getPowerZone(activity.avgWatts, ftp);
                const zoneKey = `z${zone}`;
                weekData[zoneKey] += activity.distance || 0;
            } else {
                console.log("No Power over timeline chart created");
            }
        });

        const result = Array.from(weekMap.values()).map((week) => ({
            ...week,
            avgSpeed:
                week.speeds.length > 0
                    ? week.speeds.reduce((sum, s) => sum + s, 0) /
                      week.speeds.length
                    : null,
        }));

        return result.sort((a, b) => a.weekStart - b.weekStart);
    }

    getPowerZone(watts, ftp) {
        if (!ftp || ftp === 0) return 1;
        const percent = (watts / ftp) * 100;

        if (percent < 55) return 1; // Active Recovery
        if (percent < 75) return 2; // Endurance
        if (percent < 90) return 3; // Tempo
        if (percent < 105) return 4; // Threshold
        if (percent < 120) return 5; // VO2 Max
        return 6; // Anaerobic
    }

    analyzePowerStream(powerStream, ftp) {
        if (!powerStream || powerStream.watts.length === 0 || !ftp || ftp === 0)
            return null;

        const zones = { z1: 0, z2: 0, z3: 0, z4: 0, z5: 0, z6: 0 };

        powerStream.watts.forEach((watts) => {
            const zone = this.getPowerZone(watts, ftp);
            zones[`z${zone}`]++;
        });

        const total = powerStream.watts.length;
        return {
            percentZ1: (zones.z1 / total) * 100,
            percentZ2: (zones.z2 / total) * 100,
            percentZ3: (zones.z3 / total) * 100,
            percentZ4: (zones.z4 / total) * 100,
            percentZ5: (zones.z5 / total) * 100,
            percentZ6: (zones.z6 / total) * 100,
        };
    }

    renderIntensityChart(activities) {
        const canvas = document.getElementById("intensityChartRide");
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        const existing = Chart.getChart(canvas);
        if (existing) existing.destroy();

        const chartSettings = window.settingsManager.getChartRanges();
        const weeksToShow = chartSettings.intensityChartWeeks;
        const daysToShow = weeksToShow * 7;

        const inRange = window.dataProcessor.getRidesInRange(daysToShow);
        const distribution = this.calculatePowerZoneDistribution(inRange);

        if (distribution.totalDataPoints === 0) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.font = "16px system-ui";
            ctx.fillStyle = "#9aa0a6";
            ctx.textAlign = "center";
            ctx.fillText(
                `No detailed power data available for the last ${weeksToShow} week${weeksToShow !== 1 ? "s" : ""}`,
                canvas.width / 2,
                canvas.height / 2
            );
            return;
        }

        const zones = ["z1", "z2", "z3", "z4", "z5", "z6"];
        const labels = [
            "Z1: Active Recovery",
            "Z2: Endurance",
            "Z3: Tempo",
            "Z4: Threshold",
            "Z5: VO2 Max",
            "Z6: Anaerobic",
        ];
        const data = zones.map((z) => distribution.percentages[z]);
        const distances = zones.map((z) => distribution.distances[z]);
        const colors = [
            "rgba(189, 189, 189, 0.8)",
            "rgba(66, 133, 244, 0.8)",
            "rgba(52, 168, 83, 0.8)",
            "rgba(255, 153, 0, 0.8)",
            "rgba(234, 67, 53, 0.8)",
            "rgba(156, 39, 176, 0.8)",
        ];

        const textColor =
            getComputedStyle(document.documentElement)
                .getPropertyValue("--text")
                .trim() || "#e8eaed";

        const isSmallScreen = window.innerWidth < 768;

        new Chart(ctx, {
            type: "doughnut",
            data: {
                labels,
                datasets: [
                    {
                        data,
                        backgroundColor: colors,
                        borderWidth: 2,
                        borderColor: "#202124",
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                cutout: "50%",
                layout: {
                    padding: { top: 10, bottom: 10, left: 10, right: 10 },
                },
                plugins: {
                    legend: {
                        display: true,
                        position: isSmallScreen ? "bottom" : "right",
                        labels: {
                            color: textColor,
                            padding: 12,
                            font: {
                                size: 12,
                                family: "system-ui, -apple-system, sans-serif",
                            },
                            usePointStyle: false,
                            boxWidth: 15,
                            boxHeight: 15,
                            generateLabels: (chart) => {
                                return chart.data.labels
                                    .map((label, i) => {
                                        const value =
                                            chart.data.datasets[0].data[i];
                                        if (value < 0.1) return null;
                                        const zoneName = label.split(":")[0];
                                        return {
                                            text: `${zoneName}: ${value.toFixed(1)}% | ${distances[i].toFixed(1)} km`,
                                            fillStyle: colors[i],
                                            strokeStyle: colors[i],
                                            fontColor: textColor,
                                            hidden: false,
                                            index: i,
                                        };
                                    })
                                    .filter(Boolean);
                            },
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
                                const percent = context.parsed.toFixed(1);
                                return `Time: ${percent}%`;
                            },
                            afterLabel: (context) => {
                                const distance = distances[context.dataIndex];
                                return `Distance: ${distance.toFixed(1)} km`;
                            },
                        },
                    },
                    datalabels: {
                        color: "#ffffff",
                        font: { weight: "bold", size: 14 },
                        formatter: (value) =>
                            value < 2 ? "" : value.toFixed(1) + "%",
                        offset: 0,
                        anchor: "center",
                        align: "center",
                    },
                },
            },
            plugins: [ChartDataLabels],
        });
    }

    calculatePowerZoneDistribution(activities) {
        const ftp = window.powerAnalyzer.getFTP() ?? 0;
        const zones = { z1: 0, z2: 0, z3: 0, z4: 0, z5: 0, z6: 0 };
        const distances = { z1: 0, z2: 0, z3: 0, z4: 0, z5: 0, z6: 0 };
        let totalDataPoints = 0;

        (activities || []).forEach((activity) => {
            if (activity.powerStream && activity.powerStream.watts.length > 0) {
                activity.powerStream.watts.forEach((watts) => {
                    const zone = this.getPowerZone(watts, ftp);
                    zones[`z${zone}`]++;
                    totalDataPoints++;
                });

                const analysis = this.analyzePowerStream(
                    activity.powerStream,
                    ftp
                );

                if (analysis && activity.distance) {
                    distances.z1 +=
                        (activity.distance * analysis.percentZ1) / 100;
                    distances.z2 +=
                        (activity.distance * analysis.percentZ2) / 100;
                    distances.z3 +=
                        (activity.distance * analysis.percentZ3) / 100;
                    distances.z4 +=
                        (activity.distance * analysis.percentZ4) / 100;
                    distances.z5 +=
                        (activity.distance * analysis.percentZ5) / 100;
                    distances.z6 +=
                        (activity.distance * analysis.percentZ6) / 100;
                }
            }
        });

        const percentages = {};
        Object.keys(zones).forEach((z) => {
            percentages[z] =
                totalDataPoints > 0 ? (zones[z] / totalDataPoints) * 100 : 0;
        });

        console.log({ percentages, distances, totalDataPoints });

        return { percentages, distances, totalDataPoints };
    }

    /* ---------------- Timeline ---------------- */

    renderTimeline(activities) {
        const div = document.getElementById("timelineRide");
        if (!div) return;

        div.innerHTML = "";

        const recent = (activities || []).filter(
            (a) => window.helpers.daysAgo(a.date) <= 100
        );
        const sorted = [...recent].sort((a, b) => b.date - a.date);

        sorted.forEach((activity) => {
            const classification = window.runClassifier.classify(activity);
            const el = this.createRideElement(activity, classification);
            div.appendChild(el);
        });
    }

    createRideElement(ride, classification) {
        const { category, isLong, powerDataType } = classification;
        const cssClass = window.runClassifier.getCategoryClass(category);

        const el = document.createElement("div");
        el.className = `ride ${cssClass}`;

        const intervalInfo = window.intervalDetector.detectInterval(ride);
        const tooltip = this.createRideTooltip(
            ride,
            classification,
            intervalInfo
        );

        let badges = "";

        if (intervalInfo.isInterval) {
            badges += '<span class="badge interval-badge">⚡ Interval</span>';
        }

        if (powerDataType === "none") {
            badges += '<span class="badge no-power">No Power</span>';
        } else if (powerDataType === "basic") {
            badges += '<span class="badge basic-power">Basic Power</span>';
        }
        if (isLong) {
            badges += '<span class="badge long-ride">Long Ride</span>';
        }

        el.innerHTML = `
      <span>${window.helpers.formatDateFull(ride.date)} — ${category}${isLong ? " (Long)" : ""}</span>
      <span>${badges}<span class="badge">${(ride.distance ?? 0).toFixed(1)} km</span></span>
      ${tooltip}
    `;

        return el;
    }

    createRideTooltip(ride, classification, intervalInfo) {
        const { category, powerDataType, detailedPower } = classification;

        let html = '<div class="tooltip">';

        html += `
      <div class="tooltip-row">
        <span class="tooltip-label">Type:</span>
        <span class="tooltip-value">${category}</span>
      </div>
      <div class="tooltip-row">
        <span class="tooltip-label">Distance:</span>
        <span class="tooltip-value">${(ride.distance ?? 0).toFixed(2)} km</span>
      </div>
    `;

        if (intervalInfo && intervalInfo.isInterval) {
            html += `
        <div class="tooltip-row" style="background: rgba(251, 188, 4, 0.1); padding: 4px; border-radius: 4px; margin: 8px 0;">
          <span class="tooltip-label">⚡ Intervals:</span>
          <span class="tooltip-value">${intervalInfo.details}</span>
        </div>
      `;
        }

        const avgSpeed = window.intervalDetector.calculateAverageSpeed(ride);
        if (avgSpeed) {
            html += `
        <div class="tooltip-row">
          <span class="tooltip-label">Avg Speed:</span>
          <span class="tooltip-value">${avgSpeed.toFixed(1)} km/h</span>
        </div>
      `;
        }

        if (powerDataType === "none") {
            html += `
        <div class="tooltip-row">
          <span class="tooltip-label">Power Data:</span>
          <span class="tooltip-value" style="color:#ea4335">Not available</span>
        </div>
      `;
        } else if (powerDataType === "basic") {
            const ftp = window.powerAnalyzer.getFTP() ?? 0;
            const zone = this.getPowerZone(ride.avgWatts, ftp);
            html += `
        <div class="tooltip-row">
          <span class="tooltip-label">Avg Power:</span>
          <span class="tooltip-value">${ride.avgWatts} W (Zone ${zone})</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-label">Max Power:</span>
          <span class="tooltip-value">${ride.maxWatts} W</span>
        </div>
      `;
        } else if (powerDataType === "detailed" && detailedPower) {
            html +=
                '<hr style="border:none;border-top:1px solid var(--border);margin:8px 0">';

            html += `
        <div class="tooltip-row">
          <span class="tooltip-label">Time in Z1:</span>
          <span class="tooltip-value">${detailedPower.percentZ1.toFixed(1)}%</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-label">Time in Z2:</span>
          <span class="tooltip-value">${detailedPower.percentZ2.toFixed(1)}%</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-label">Time in Z3:</span>
          <span class="tooltip-value">${detailedPower.percentZ3.toFixed(1)}%</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-label">Time in Z4:</span>
          <span class="tooltip-value">${detailedPower.percentZ4.toFixed(1)}%</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-label">Time in Z5:</span>
          <span class="tooltip-value">${detailedPower.percentZ5.toFixed(1)}%</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-label">Time in Z6:</span>
          <span class="tooltip-value">${detailedPower.percentZ6.toFixed(1)}%</span>
        </div>
      `;
        }

        html += "</div>";
        return html;
    }

    /* ---------------- Training load ---------------- */

    renderTrainingLoadAnalysis(activities) {
        const container = document.getElementById("trainingLoadAnalysisRide");
        if (!container) return;

        const analysis = window.trainingLoadAnalyzer.analyze(activities || []);

        const statusIcon = { green: "🟢", yellow: "🟡", red: "🔴" };
        let html = '<div class="training-analysis">';

        Object.values(analysis).forEach((item) => {
            const tooltipHTML = item.tooltip
                .replace(/\n/g, "<br>")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/&lt;strong&gt;/g, "<strong>")
                .replace(/&lt;\/strong&gt;/g, "</strong>")
                .replace(/&lt;br&gt;/g, "<br>");

            html += `
        <div class="analysis-card ${item.status}">
          <div class="analysis-header">
            <span class="status-icon">${statusIcon[item.status]}</span>
            <h3>${item.metric}</h3>
          </div>
          <p class="analysis-message">${item.message}</p>
          <div class="analysis-tooltip">${tooltipHTML}</div>
        </div>
      `;
        });

        html += "</div>";
        container.innerHTML = html;
    }
}

// Initialize and export singleton
window.rideRenderer = new RideRenderer();
