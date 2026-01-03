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
                borderWidth: 1,
                pointRadius: 3,
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
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: "Speed (km/h)",
                            color: "#fbbc04",
                        },
                        ticks: {
                            color: "#fbbc04",
                            callback: (value) => `${value.toFixed(1)}`,
                        },
                        grid: {
                            drawOnChartArea: false, // Prevents grid lines from overlapping with y-axis
                        },
                        suggestedMax: Math.ceil(
                            Math.max(...weeklyData.map((w) => w.avgSpeed)) + 2
                        ),
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

            const avgSpeed = window.helpers.calculateAverageSpeed(activity);
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

        return { percentages, distances, totalDataPoints };
    }

    /* ---------------- Timeline ---------------- */

    renderTimeline(activities) {
        const div = document.getElementById("timelineRide");
        if (!div) return;

        div.innerHTML = "";

        const recent = (activities || []).filter(
            (a) => window.helpers.daysAgo(a.date) <= 28
        );
        const sorted = [...recent].sort((a, b) => b.date - a.date);

        sorted.forEach((activity) => {
            const classification = window.runClassifier.classifyRide(activity);
            const el = this.createRideElement(activity, classification);
            div.appendChild(el);
        });
    }

    createRideElement(ride, classification) {
        const { category, isLong, powerDataType } = classification;
        const cssClass = window.runClassifier.getCategoryClass(category);

        const el = document.createElement("div");
        el.className = `run ${cssClass}`;

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
        /*if (isLong) {
            badges += '<span class="badge long-ride">Long Ride</span>';
        }*/

        el.innerHTML = `
      <span>${window.helpers.formatDateFull(ride.date)} — ${category}</span>
      <span>${badges}<span class="badge">${(ride.distance ?? 0).toFixed(1)} km</span></span>
      ${tooltip}
    `;

        return el;
    }

    createRideTooltip(ride, classification, intervalInfo) {
        const {
            category,
            powerDataType,
            detailedPower,
            hrDataType,
            detailedHR,
        } = classification;

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

        const avgSpeed = window.helpers.calculateAverageSpeed(ride);
        if (avgSpeed) {
            html += `
        <div class="tooltip-row">
          <span class="tooltip-label">Avg Speed:</span>
          <span class="tooltip-value">${avgSpeed.toFixed(1)} km/h</span>
        </div>
      `;
        }

        // Heart Rate Section
        if (hrDataType === "detailed" && detailedHR) {
            html +=
                '<hr style="border:none;border-top:1px solid var(--border);margin:8px 0">';

            // Generate HR+Power graph if both are available
            if (
                powerDataType === "detailed" &&
                detailedPower &&
                ride.powerStream
            ) {
                html += this.generateHRPowerGraph(
                    ride.hrStream,
                    ride.powerStream
                );
            } else {
                // Just HR graph without power
                html += window.hrAnalyzer.generateHRGraph(detailedHR.hrRecords);
            }

            html +=
                '<div style="font-weight:600;margin:16px 0 8px 0;">Heart Rate Distribution</div>';
            html += this.generateHRZoneDoughnut(detailedHR);
        } else if (hrDataType === "basic") {
            const zone = window.hrAnalyzer?.getZone(ride.avgHR) || "?";
            html += `
        <div class="tooltip-row">
          <span class="tooltip-label">Avg HR:</span>
          <span class="tooltip-value">${ride.avgHR} bpm (Zone ${zone})</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-label">Max HR:</span>
          <span class="tooltip-value">${ride.maxHR} bpm</span>
        </div>
      `;
        } else if (hrDataType === "none") {
            html += `
        <div class="tooltip-row">
          <span class="tooltip-label">HR Data:</span>
          <span class="tooltip-value" style="color:#ea4335">Not available</span>
        </div>
      `;
        }

        // Power Section
        if (powerDataType === "detailed" && detailedPower) {
            // Only show separator if HR graph wasn't already shown
                html +=
                    '<hr style="border:none;border-top:1px solid var(--border);margin:8px 0">';

                // Show power graph if HR graph wasn't shown
                if (ride.powerStream) {
                    html += this.generatePowerGraph(ride.powerStream);
                }

            html +=
                '<div style="font-weight:600;margin:16px 0 8px 0;">Power Distribution</div>';
            html += this.generatePowerZoneDoughnut(detailedPower);
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
        } else if (powerDataType === "none") {
            html += `
        <div class="tooltip-row">
          <span class="tooltip-label">Power Data:</span>
          <span class="tooltip-value" style="color:#ea4335">Not available</span>
        </div>
      `;
        }

        html += "</div>";
        return html;
    }

    generateHRZoneDoughnut(detailedHR) {
        const zones = [
            { label: "Z1", percent: detailedHR.percentZ1, color: "#4285f4" },
            { label: "Z2", percent: detailedHR.percentZ2, color: "#34a853" },
            { label: "Z3", percent: detailedHR.percentZ3, color: "#fbbc04" },
            { label: "Z4", percent: detailedHR.percentZ4, color: "#ff6d00" },
            { label: "Z5", percent: detailedHR.percentZ5, color: "#ea4335" },
            { label: "Z6", percent: detailedHR.percentZ6, color: "#9c27b0" },
        ];

        const activeZones = zones.filter((z) => z.percent > 0);

        if (activeZones.length === 0) {
            return '<div style="text-align:center;color:#666;padding:10px;">No zone data</div>';
        }

        let cumulativePercent = 0;
        const radius = 50;
        const innerRadius = 35;
        const cx = 60;
        const cy = 60;

        let paths = "";
        activeZones.forEach((zone) => {
            const startAngle =
                (cumulativePercent / 100) * 2 * Math.PI - Math.PI / 2;
            const endAngle =
                ((cumulativePercent + zone.percent) / 100) * 2 * Math.PI -
                Math.PI / 2;

            const x1 = cx + radius * Math.cos(startAngle);
            const y1 = cy + radius * Math.sin(startAngle);
            const x2 = cx + radius * Math.cos(endAngle);
            const y2 = cy + radius * Math.sin(endAngle);

            const ix1 = cx + innerRadius * Math.cos(startAngle);
            const iy1 = cy + innerRadius * Math.sin(startAngle);
            const ix2 = cx + innerRadius * Math.cos(endAngle);
            const iy2 = cy + innerRadius * Math.sin(endAngle);

            const largeArc = zone.percent > 50 ? 1 : 0;

            paths += `
                <path d="M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} 
                         L ${ix2} ${iy2} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${ix1} ${iy1} Z"
                      fill="${zone.color}" stroke="none"/>
            `;

            cumulativePercent += zone.percent;
        });

        let legend =
            '<div style="display:flex;flex-direction:column;gap:6px;">';
        activeZones.forEach((zone) => {
            legend += `
                <div style="display:flex;align-items:center;gap:6px;font-size:12px;">
                    <div style="width:12px;height:12px;border-radius:2px;background:${zone.color};flex-shrink:0;"></div>
                    <span style="white-space:nowrap;">${zone.label}: ${zone.percent.toFixed(1)}%</span>
                </div>
            `;
        });
        legend += "</div>";

        return `
            <div style="margin-top:12px;display:flex;align-items:center;gap:16px;justify-content:center;">
                <div style="flex-shrink:0;">
                    <svg width="120" height="120" viewBox="0 0 120 120">
                        ${paths}
                    </svg>
                </div>
                ${legend}
            </div>
        `;
    }

    generatePowerZoneDoughnut(detailedPower) {
        const zones = [
            { label: "Z1", percent: detailedPower.percentZ1, color: "#bdbdbd" },
            { label: "Z2", percent: detailedPower.percentZ2, color: "#4285f4" },
            { label: "Z3", percent: detailedPower.percentZ3, color: "#34a853" },
            { label: "Z4", percent: detailedPower.percentZ4, color: "#ff9900" },
            { label: "Z5", percent: detailedPower.percentZ5, color: "#ea4335" },
            { label: "Z6", percent: detailedPower.percentZ6, color: "#9c27b0" },
        ];

        const activeZones = zones.filter((z) => z.percent > 0);

        if (activeZones.length === 0) {
            return '<div style="text-align:center;color:#666;padding:10px;">No zone data</div>';
        }

        let cumulativePercent = 0;
        const radius = 50;
        const innerRadius = 35;
        const cx = 60;
        const cy = 60;

        let paths = "";
        activeZones.forEach((zone) => {
            const startAngle =
                (cumulativePercent / 100) * 2 * Math.PI - Math.PI / 2;
            const endAngle =
                ((cumulativePercent + zone.percent) / 100) * 2 * Math.PI -
                Math.PI / 2;

            const x1 = cx + radius * Math.cos(startAngle);
            const y1 = cy + radius * Math.sin(startAngle);
            const x2 = cx + radius * Math.cos(endAngle);
            const y2 = cy + radius * Math.sin(endAngle);

            const ix1 = cx + innerRadius * Math.cos(startAngle);
            const iy1 = cy + innerRadius * Math.sin(startAngle);
            const ix2 = cx + innerRadius * Math.cos(endAngle);
            const iy2 = cy + innerRadius * Math.sin(endAngle);

            const largeArc = zone.percent > 50 ? 1 : 0;

            paths += `
                <path d="M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} 
                         L ${ix2} ${iy2} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${ix1} ${iy1} Z"
                      fill="${zone.color}" stroke="none"/>
            `;

            cumulativePercent += zone.percent;
        });

        let legend =
            '<div style="display:flex;flex-direction:column;gap:6px;">';
        activeZones.forEach((zone) => {
            legend += `
                <div style="display:flex;align-items:center;gap:6px;font-size:12px;">
                    <div style="width:12px;height:12px;border-radius:2px;background:${zone.color};flex-shrink:0;"></div>
                    <span style="white-space:nowrap;">${zone.label}: ${zone.percent.toFixed(1)}%</span>
                </div>
            `;
        });
        legend += "</div>";

        return `
            <div style="margin-top:12px;display:flex;align-items:center;gap:16px;justify-content:center;">
                <div style="flex-shrink:0;">
                    <svg width="120" height="120" viewBox="0 0 120 120">
                        ${paths}
                    </svg>
                </div>
                ${legend}
            </div>
        `;
    }

    generateHRPowerGraph(hrStream, powerStream) {
        if (!hrStream || !hrStream.hr || !powerStream || !powerStream.watts) {
            return "";
        }

        const getGraphWidth = () => {
            const screenWidth =
                window.innerWidth || document.documentElement.clientWidth;
            const containerWidth = screenWidth - 50;
            if (containerWidth >= 600) return 600;
            if (containerWidth < 400) return 400;
            return containerWidth;
        };

        const width = getGraphWidth();
        const height = 200;

        const zones = window.dataProcessor.getZonesBPM();
        const hrMax = window.dataProcessor.hrMax;

        const ftp = window.powerAnalyzer.getFTP();
        const padding = 30;
        const topPadding = 80;
        const rightPadding = 50;
        const graphWidth = width - padding - rightPadding;
        const graphHeight = height - topPadding - padding;

        // Sample data
        let sampledHR = hrStream.hr;
        let sampledWatts = powerStream.watts;

        if (hrStream.hr.length > 200) {
            const step = Math.ceil(hrStream.hr.length / 200);
            sampledHR = hrStream.hr.filter((_, i) => i % step === 0);
            sampledWatts = powerStream.watts.filter((_, i) => i % step === 0);
        }

        const minHR = Math.max(Math.min(...sampledHR) - 10, 100);
        const maxHR = hrMax + 10;
        const hrRange = maxHR - minHR;

        // HR line path
        const hrPathData = sampledHR
            .map((hr, i) => {
                const x = padding + (i / (sampledHR.length - 1)) * graphWidth;
                const y =
                    topPadding +
                    graphHeight -
                    ((hr - minHR) / hrRange) * graphHeight;
                return `${i === 0 ? "M" : "L"} ${x} ${y}`;
            })
            .join(" ");

        // Power line path
        const validWatts = sampledWatts.filter((w) => w >= 0 && w < 2000);
        const minWatts = 0;
        const maxWatts = Math.max(...validWatts, ftp * 1.5);
        const wattsRange = maxWatts - minWatts;
        const powerOffset = 80;

        const powerPathData = sampledWatts
            .map((watts, i) => {
                if (watts < 0 || watts > 2000) return null;
                const x =
                    padding + (i / (sampledWatts.length - 1)) * graphWidth;
                const y =
                    topPadding +
                    graphHeight -
                    ((watts - minWatts) / wattsRange) * graphHeight -
                    powerOffset;
                return `${x} ${y}`;
            })
            .filter((p) => p !== null)
            .map((point, i) => `${i === 0 ? "M" : "L"} ${point}`)
            .join(" ");

        // Power grid lines
        const powerMarkers = [0, 100, 200, 300, 400, 500].filter(
            (w) => w <= maxWatts
        );
        const powerGridLines = powerMarkers
            .map((watts) => {
                const y =
                    topPadding +
                    graphHeight -
                    ((watts - minWatts) / wattsRange) * graphHeight -
                    powerOffset;
                return `<line x1="${padding}" y1="${y}" x2="${padding + graphWidth}" y2="${y}" 
                      stroke="#4285f4" stroke-width="2" stroke-dasharray="1,0.5" opacity="0.4" />`;
            })
            .join("");

        const powerAxisLabels = powerMarkers
            .map((watts) => {
                const y =
                    topPadding +
                    graphHeight -
                    ((watts - minWatts) / wattsRange) * graphHeight -
                    powerOffset;
                return `<text x="${padding + graphWidth + 5}" y="${y + 4}" font-size="11" fill="#4285f4">${watts}W</text>`;
            })
            .join("");

        // HR Zone backgrounds
        const zoneConfig = [
            { upper: zones.z2Upper, color: "rgba(52, 168, 83, 0.1)" },
            { upper: zones.z3Upper, color: "rgba(251, 188, 4, 0.1)" },
            { upper: zones.z4Upper, color: "rgba(255, 153, 0, 0.1)" },
            { upper: zones.z5Upper, color: "rgba(234, 67, 53, 0.1)" },
        ];

        let zoneRects = "";
        let zoneLines = "";
        let prevY = topPadding + graphHeight;

        zoneConfig.forEach((zone) => {
            if (zone.upper >= minHR && zone.upper <= maxHR) {
                const y =
                    topPadding +
                    graphHeight -
                    ((zone.upper - minHR) / hrRange) * graphHeight;
                zoneRects += `<rect x="${padding}" y="${y}" width="${graphWidth}" height="${prevY - y}" fill="${zone.color}" />`;
                zoneLines += `<line x1="${padding}" y1="${y}" x2="${padding + graphWidth}" y2="${y}" stroke="#999" stroke-width="1" stroke-dasharray="3,3" opacity="0.5" />`;
                zoneLines += `<text x="${padding - 5}" y="${y + 4}" text-anchor="end" font-size="10" fill="#9aa0a6">${Math.round(zone.upper)}</text>`;
                prevY = y;
            }
        });

        const graphId = "graph-" + Math.random().toString(36).substr(2, 9);
        const dataPoints = sampledHR
            .map((hr, i) => `${hr}|${sampledWatts[i] || 0}`)
            .join(",");

        return `
  <svg id="${graphId}" width="${width}" height="${height}" style="display: block; margin: 0 auto; cursor: crosshair; max-width: 100%;" data-points="${dataPoints}">
    <defs>
      <filter id="shadow-${graphId}">
        <feDropShadow dx="0" dy="1" stdDeviation="2" flood-opacity="0.3"/>
      </filter>
    </defs>
    ${zoneRects}
    ${zoneLines}
    ${powerGridLines}
    <path d="${powerPathData}" fill="none" stroke="#4285f4" stroke-width="2.5" opacity="0.9" />
    <path d="${hrPathData}" fill="none" stroke="#ea4335" stroke-width="2.5" />
    
    <line id="cursor-${graphId}" x1="0" y1="${topPadding}" x2="0" y2="${topPadding + graphHeight}" 
          stroke="#666" stroke-width="1.5" opacity="0" pointer-events="none" />
    
    <circle id="cursor-hr-${graphId}" cx="0" cy="0" r="5" fill="#ea4335" stroke="white" 
            stroke-width="2" opacity="0" pointer-events="none" filter="url(#shadow-${graphId})" />
    
    <circle id="cursor-power-${graphId}" cx="0" cy="0" r="5" fill="#4285f4" stroke="white" 
            stroke-width="2" opacity="0" pointer-events="none" filter="url(#shadow-${graphId})" />
    
    <rect id="tooltip-bg-${graphId}" x="0" y="0" width="120" height="70" rx="6" 
          fill="rgba(32,33,36,0.95)" stroke="rgba(255,255,255,0.1)" stroke-width="1" 
          opacity="0" pointer-events="none" filter="url(#shadow-${graphId})" />
    
    <text id="tooltip-hr-${graphId}" x="0" y="0" font-size="13" fill="#ea4335" 
          font-weight="600" opacity="0" pointer-events="none"></text>
    <text id="tooltip-power-${graphId}" x="0" y="0" font-size="13" fill="#4285f4" 
          font-weight="600" opacity="0" pointer-events="none"></text>
    <text id="tooltip-time-${graphId}" x="0" y="0" font-size="11" fill="#aaa" 
          opacity="0" pointer-events="none"></text>
    
    <rect x="${padding}" y="${topPadding}" width="${graphWidth}" height="${graphHeight}" 
          fill="transparent" style="cursor: crosshair;" />
    
    <line x1="${padding}" y1="${topPadding}" x2="${padding}" y2="${topPadding + graphHeight}" stroke="#2a2f3a" stroke-width="1.5" />
    <line x1="${padding}" y1="${topPadding + graphHeight}" x2="${padding + graphWidth}" y2="${topPadding + graphHeight}" stroke="#2a2f3a" stroke-width="1.5" />
    <text x="${padding - 25}" y="${topPadding - 10}" font-size="10" fill="#ea4335" font-weight="bold">HR</text>
    <text x="${padding - 5}" y="${topPadding + 4}" text-anchor="end" font-size="11" fill="#9aa0a6">${Math.round(maxHR)}</text>
    <text x="${padding - 5}" y="${topPadding + graphHeight + 5}" text-anchor="end" font-size="11" fill="#9aa0a6">${Math.round(minHR)}</text>
    <text x="${padding + graphWidth + 25}" y="${topPadding - powerOffset - 10}" font-size="10" fill="#4285f4" font-weight="bold">Power</text>
    ${powerAxisLabels}
    <text x="${padding + graphWidth + 5}" y="${topPadding - powerOffset - 10}" font-size="9" fill="#4285f4" opacity="0.6">watts</text>
  </svg>
  <script>
  (function() {
    const svg = document.getElementById('${graphId}');
    const cursor = document.getElementById('cursor-${graphId}');
    const cursorHR = document.getElementById('cursor-hr-${graphId}');
    const cursorPower = document.getElementById('cursor-power-${graphId}');
    const tooltipBg = document.getElementById('tooltip-bg-${graphId}');
    const tooltipHR = document.getElementById('tooltip-hr-${graphId}');
    const tooltipPower = document.getElementById('tooltip-power-${graphId}');
    const tooltipTime = document.getElementById('tooltip-time-${graphId}');
    
    const padding = ${padding};
    const topPadding = ${topPadding};
    const graphWidth = ${graphWidth};
    const graphHeight = ${graphHeight};
    const minHR = ${minHR};
    const maxHR = ${maxHR};
    const hrRange = ${hrRange};
    const powerOffset = ${powerOffset};
    const maxWatts = ${maxWatts};
    const wattsRange = ${wattsRange};
    const minWatts = ${minWatts};
    
    const dataPoints = svg.getAttribute('data-points').split(',').map(p => {
      const [hr, watts] = p.split('|');
      return { hr: parseFloat(hr), watts: parseFloat(watts) };
    });
    
    const formatTime = (index, total) => {
      const totalSeconds = (index / total) * ${hrStream.hr.length};
      const mins = Math.floor(totalSeconds / 60);
      const secs = Math.floor(totalSeconds % 60);
      return mins + ':' + secs.toString().padStart(2, '0');
    };
    
    svg.addEventListener('mousemove', (e) => {
      const rect = svg.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      if (x < padding || x > padding + graphWidth || y < topPadding || y > topPadding + graphHeight) {
        cursor.setAttribute('opacity', '0');
        cursorHR.setAttribute('opacity', '0');
        cursorPower.setAttribute('opacity', '0');
        tooltipBg.setAttribute('opacity', '0');
        tooltipHR.setAttribute('opacity', '0');
        tooltipPower.setAttribute('opacity', '0');
        tooltipTime.setAttribute('opacity', '0');
        return;
      }
      
      const relX = x - padding;
      const index = Math.round((relX / graphWidth) * (dataPoints.length - 1));
      const dataPoint = dataPoints[index];
      
      const pointX = padding + (index / (dataPoints.length - 1)) * graphWidth;
      const hrY = topPadding + graphHeight - ((dataPoint.hr - minHR) / hrRange) * graphHeight;
      const powerY = topPadding + graphHeight - ((dataPoint.watts - minWatts) / wattsRange) * graphHeight - powerOffset;
      
      cursor.setAttribute('x1', pointX);
      cursor.setAttribute('x2', pointX);
      cursor.setAttribute('opacity', '0.6');
      
      cursorHR.setAttribute('cx', pointX);
      cursorHR.setAttribute('cy', hrY);
      cursorHR.setAttribute('opacity', '1');
      
      cursorPower.setAttribute('cx', pointX);
      cursorPower.setAttribute('cy', powerY);
      cursorPower.setAttribute('opacity', '1');
      
      let tooltipX = pointX + 15;
      let tooltipY = topPadding + 10;
      const tooltipWidth = 140;
      
      if (pointX > padding + graphWidth - 160) {
        tooltipX = pointX - tooltipWidth - 15;
      }
      
      tooltipBg.setAttribute('x', tooltipX);
      tooltipBg.setAttribute('y', tooltipY);
      tooltipBg.setAttribute('width', tooltipWidth);
      tooltipBg.setAttribute('height', 70);
      tooltipBg.setAttribute('opacity', '1');
      
      tooltipHR.setAttribute('x', tooltipX + 10);
      tooltipHR.setAttribute('y', tooltipY + 20);
      tooltipHR.textContent = 'HR: ' + Math.round(dataPoint.hr) + ' bpm';
      tooltipHR.setAttribute('opacity', '1');
      
      tooltipPower.setAttribute('x', tooltipX + 10);
      tooltipPower.setAttribute('y', tooltipY + 40);
      tooltipPower.textContent = 'Power: ' + Math.round(dataPoint.watts) + 'W';
      tooltipPower.setAttribute('opacity', '1');
      
      tooltipTime.setAttribute('x', tooltipX + 10);
      tooltipTime.setAttribute('y', tooltipY + 58);
      tooltipTime.textContent = 'Time: ' + formatTime(index, dataPoints.length - 1);
      tooltipTime.setAttribute('opacity', '1');
    });
    
    svg.addEventListener('mouseleave', () => {
      cursor.setAttribute('opacity', '0');
      cursorHR.setAttribute('opacity', '0');
      cursorPower.setAttribute('opacity', '0');
      tooltipBg.setAttribute('opacity', '0');
      tooltipHR.setAttribute('opacity', '0');
      tooltipPower.setAttribute('opacity', '0');
      tooltipTime.setAttribute('opacity', '0');
    });
  })();
  </script>
`;
    }

    generatePowerGraph(powerStream) {
        if (!powerStream || !powerStream.watts) {
            return "";
        }

        const getGraphWidth = () => {
            const screenWidth =
                window.innerWidth || document.documentElement.clientWidth;
            const containerWidth = screenWidth - 50;
            if (containerWidth >= 600) return 600;
            if (containerWidth < 400) return 400;
            return containerWidth;
        };

        const width = getGraphWidth();
        const height = 200;
        const ftp = window.powerAnalyzer.getFTP();
        const padding = 30;
        const topPadding = 40;
        const rightPadding = 50;
        const graphWidth = width - padding - rightPadding;
        const graphHeight = height - topPadding - padding;

        // Sample data
        let sampledWatts = powerStream.watts;

        if (powerStream.watts.length > 200) {
            const step = Math.ceil(powerStream.watts.length / 200);
            sampledWatts = powerStream.watts.filter((_, i) => i % step === 0);
        }

        const validWatts = sampledWatts.filter((w) => w >= 0 && w < 2000);
        const minWatts = 0;
        const maxWatts = Math.max(...validWatts, ftp * 1.5);
        const wattsRange = maxWatts - minWatts;

        // Power line path
        const powerPathData = sampledWatts
            .map((watts, i) => {
                if (watts < 0 || watts > 2000) return null;
                const x =
                    padding + (i / (sampledWatts.length - 1)) * graphWidth;
                const y =
                    topPadding +
                    graphHeight -
                    ((watts - minWatts) / wattsRange) * graphHeight;
                return `${x} ${y}`;
            })
            .filter((p) => p !== null)
            .map((point, i) => `${i === 0 ? "M" : "L"} ${point}`)
            .join(" ");

        // Power grid lines
        const powerMarkers = [0, 100, 200, 300, 400, 500].filter(
            (w) => w <= maxWatts
        );
        const powerGridLines = powerMarkers
            .map((watts) => {
                const y =
                    topPadding +
                    graphHeight -
                    ((watts - minWatts) / wattsRange) * graphHeight;
                return `<line x1="${padding}" y1="${y}" x2="${padding + graphWidth}" y2="${y}" 
                      stroke="#4285f4" stroke-width="1" stroke-dasharray="3,3" opacity="0.3" />`;
            })
            .join("");

        const powerAxisLabels = powerMarkers
            .map((watts) => {
                const y =
                    topPadding +
                    graphHeight -
                    ((watts - minWatts) / wattsRange) * graphHeight;
                return `<text x="${padding + graphWidth + 5}" y="${y + 4}" font-size="11" fill="#4285f4">${watts}W</text>`;
            })
            .join("");

        const graphId = "graph-" + Math.random().toString(36).substr(2, 9);
        const dataPoints = sampledWatts.map((w) => w.toString()).join(",");

        return `
  <svg id="${graphId}" width="${width}" height="${height}" style="display: block; margin: 0 auto; cursor: crosshair; max-width: 100%;" data-points="${dataPoints}">
    <defs>
      <filter id="shadow-${graphId}">
        <feDropShadow dx="0" dy="1" stdDeviation="2" flood-opacity="0.3"/>
      </filter>
    </defs>
    ${powerGridLines}
    <path d="${powerPathData}" fill="none" stroke="#4285f4" stroke-width="2.5" opacity="0.9" />
    
    <line id="cursor-${graphId}" x1="0" y1="${topPadding}" x2="0" y2="${topPadding + graphHeight}" 
          stroke="#666" stroke-width="1.5" opacity="0" pointer-events="none" />
    
    <circle id="cursor-power-${graphId}" cx="0" cy="0" r="5" fill="#4285f4" stroke="white" 
            stroke-width="2" opacity="0" pointer-events="none" filter="url(#shadow-${graphId})" />
    
    <rect id="tooltip-bg-${graphId}" x="0" y="0" width="120" height="50" rx="6" 
          fill="rgba(32,33,36,0.95)" stroke="rgba(255,255,255,0.1)" stroke-width="1" 
          opacity="0" pointer-events="none" filter="url(#shadow-${graphId})" />
    
    <text id="tooltip-power-${graphId}" x="0" y="0" font-size="13" fill="#4285f4" 
          font-weight="600" opacity="0" pointer-events="none"></text>
    <text id="tooltip-time-${graphId}" x="0" y="0" font-size="11" fill="#aaa" 
          opacity="0" pointer-events="none"></text>
    
    <rect x="${padding}" y="${topPadding}" width="${graphWidth}" height="${graphHeight}" 
          fill="transparent" style="cursor: crosshair;" />
    
    <line x1="${padding}" y1="${topPadding}" x2="${padding}" y2="${topPadding + graphHeight}" stroke="#2a2f3a" stroke-width="1.5" />
    <line x1="${padding}" y1="${topPadding + graphHeight}" x2="${padding + graphWidth}" y2="${topPadding + graphHeight}" stroke="#2a2f3a" stroke-width="1.5" />
    <text x="${padding - 10}" y="${topPadding - 10}" font-size="10" fill="#4285f4" font-weight="bold">Power</text>
    ${powerAxisLabels}
  </svg>
  <script>
  (function() {
    const svg = document.getElementById('${graphId}');
    const cursor = document.getElementById('cursor-${graphId}');
    const cursorPower = document.getElementById('cursor-power-${graphId}');
    const tooltipBg = document.getElementById('tooltip-bg-${graphId}');
    const tooltipPower = document.getElementById('tooltip-power-${graphId}');
    const tooltipTime = document.getElementById('tooltip-time-${graphId}');
    
    const padding = ${padding};
    const topPadding = ${topPadding};
    const graphWidth = ${graphWidth};
    const graphHeight = ${graphHeight};
    const maxWatts = ${maxWatts};
    const wattsRange = ${wattsRange};
    const minWatts = ${minWatts};
    
    const dataPoints = svg.getAttribute('data-points').split(',').map(w => parseFloat(w));
    
    const formatTime = (index, total) => {
      const totalSeconds = (index / total) * ${powerStream.watts.length};
      const mins = Math.floor(totalSeconds / 60);
      const secs = Math.floor(totalSeconds % 60);
      return mins + ':' + secs.toString().padStart(2, '0');
    };
    
    svg.addEventListener('mousemove', (e) => {
      const rect = svg.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      if (x < padding || x > padding + graphWidth || y < topPadding || y > topPadding + graphHeight) {
        cursor.setAttribute('opacity', '0');
        cursorPower.setAttribute('opacity', '0');
        tooltipBg.setAttribute('opacity', '0');
        tooltipPower.setAttribute('opacity', '0');
        tooltipTime.setAttribute('opacity', '0');
        return;
      }
      
      const relX = x - padding;
      const index = Math.round((relX / graphWidth) * (dataPoints.length - 1));
      const watts = dataPoints[index];
      
      const pointX = padding + (index / (dataPoints.length - 1)) * graphWidth;
      const powerY = topPadding + graphHeight - ((watts - minWatts) / wattsRange) * graphHeight;
      
      cursor.setAttribute('x1', pointX);
      cursor.setAttribute('x2', pointX);
      cursor.setAttribute('opacity', '0.6');
      
      cursorPower.setAttribute('cx', pointX);
      cursorPower.setAttribute('cy', powerY);
      cursorPower.setAttribute('opacity', '1');
      
      let tooltipX = pointX + 15;
      let tooltipY = topPadding + 10;
      const tooltipWidth = 140;
      
      if (pointX > padding + graphWidth - 160) {
        tooltipX = pointX - tooltipWidth - 15;
      }
      
      tooltipBg.setAttribute('x', tooltipX);
      tooltipBg.setAttribute('y', tooltipY);
      tooltipBg.setAttribute('width', tooltipWidth);
      tooltipBg.setAttribute('height', 50);
      tooltipBg.setAttribute('opacity', '1');
      
      tooltipPower.setAttribute('x', tooltipX + 10);
      tooltipPower.setAttribute('y', tooltipY + 20);
      tooltipPower.textContent = 'Power: ' + Math.round(watts) + 'W';
      tooltipPower.setAttribute('opacity', '1');
      
      tooltipTime.setAttribute('x', tooltipX + 10);
      tooltipTime.setAttribute('y', tooltipY + 38);
      tooltipTime.textContent = 'Time: ' + formatTime(index, dataPoints.length - 1);
      tooltipTime.setAttribute('opacity', '1');
    });
    
    svg.addEventListener('mouseleave', () => {
      cursor.setAttribute('opacity', '0');
      cursorPower.setAttribute('opacity', '0');
      tooltipBg.setAttribute('opacity', '0');
      tooltipPower.setAttribute('opacity', '0');
      tooltipTime.setAttribute('opacity', '0');
    });
  })();
  </script>
`;
    }

    /* ---------------- Training load ---------------- */

    renderTrainingLoadAnalysis(activities) {
        const container = document.getElementById("trainingLoadAnalysisRide");
        if (!container) return;

        const analysis = window.trainingLoadAnalyzer.analyze(
            activities || [],
            "ride"
        );

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
