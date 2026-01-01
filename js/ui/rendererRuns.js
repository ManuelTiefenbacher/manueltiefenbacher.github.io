
// js/ui/renderer-runs.js
// UI rendering for running activities

class RunRenderer {
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

    /* ---------------- Basic info (RUNS) ---------------- */

    /**
     * Render basic info stats for RUNS
     */
    renderBasicInfo(summary) {
        if (!summary || !summary.last6Months || !summary.last7Days) {
            console.warn("renderBasicInfo: invalid summary object", summary);
            this._setKm("avgWeekly", 0);
            this._setKm("distanceWeek", 0);
            this._setText("runsWeek", 0);
            this._setText("restDays", "—");
            const hrMax = window.dataProcessor?.hrMax ?? 0;
            if (hrMax > 0) this._setText("maxHR", `${hrMax} bpm`);
            return;
        }

        // Average weekly distance
        const avgWeekly = Number(summary.last6Months?.avgWeekly ?? 0);
        this._setKm("avgWeekly", avgWeekly);

        // Last 7 days distance
        const dist7 = Number(summary.last7Days?.distance ?? 0);
        this._setKm("distanceWeek", dist7);

        // Runs last week
        const runsWeek = Number(summary.last7Days?.runs ?? 0);
        this._setText("runsWeek", runsWeek);

        // Days since rest day (runs)
        const daysSinceRest = this.calculateDaysSinceRest();
        this._setText("restDays", daysSinceRest);

        // Update HR Max display
        const hrMax = window.dataProcessor?.hrMax ?? 0;
        if (hrMax > 0) this._setText("maxHR", `${hrMax} bpm`);
    }

    /* ---------------- Rest-day logic ---------------- */

    calculateDaysSinceRest() {
        const list = window.dataProcessor?.runs;

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
            const s = window.dataProcessor.getSummary();
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
        const weeklyData = this.calculateWeeklyZoneData(recent);

        const labels = weeklyData.map((w) =>
            window.helpers.formatDate(w.weekStart)
        );

        if (this.chart) {
            this.chart.destroy();
        }

        const canvas = document.getElementById("chart");
        if (!canvas) return;

        const datasets = [
            {
                label: "No HR Data",
                data: weeklyData.map((w) => w.noHR),
                backgroundColor: "rgba(154, 160, 166, 0.5)",
                stack: "distance",
                yAxisID: "y",
            },
            {
                label: "Z1",
                data: weeklyData.map((w) => w.z1),
                backgroundColor: "rgba(189, 189, 189, 0.7)",
                stack: "distance",
                yAxisID: "y",
            },
            {
                label: "Z2",
                data: weeklyData.map((w) => w.z2),
                backgroundColor: "rgba(66, 133, 244, 0.7)",
                stack: "distance",
                yAxisID: "y",
            },
            {
                label: "Z3",
                data: weeklyData.map((w) => w.z3),
                backgroundColor: "rgba(52, 168, 83, 0.7)",
                stack: "distance",
                yAxisID: "y",
            },
            {
                label: "Z4",
                data: weeklyData.map((w) => w.z4),
                backgroundColor: "rgba(255, 153, 0, 0.7)",
                stack: "distance",
                yAxisID: "y",
            },
            {
                label: "Z5",
                data: weeklyData.map((w) => w.z5),
                backgroundColor: "rgba(234, 67, 53, 0.7)",
                stack: "distance",
                yAxisID: "y",
            },
            {
                label: "Z6",
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
                label: "Avg Pace (min/km)",
                data: weeklyData.map((w) => w.avgPace),
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

                                if (label === "Avg Pace (min/km)") {
                                    const minutes = Math.floor(value);
                                    const seconds = Math.round(
                                        (value - minutes) * 60
                                    );
                                    return `${label}: ${minutes}:${seconds.toString().padStart(2, "0")}/km`;
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
                            callback: (value) => {
                                const minutes = Math.floor(value);
                                const seconds = Math.round(
                                    (value - minutes) * 60
                                );
                                return `${minutes}:${seconds.toString().padStart(2, "0")}`;
                            },
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

    calculateWeeklyZoneData(activities) {
        const weekMap = new Map();

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
                    noHR: 0,
                    paces: [],
                    totalDuration: 0,
                });
            }

            const weekData = weekMap.get(weekKey);
            weekData.total += activity.distance || 0;
            weekData.totalDuration += activity.duration || 0;

            const avgPace =
                window.intervalDetector.calculateAveragePace(activity);
            if (avgPace) {
                weekData.paces.push(avgPace);
            }

            const hrDataType = window.hrAnalyzer.getHRDataType(activity);

            if (hrDataType === "none") {
                weekData.noHR += activity.distance || 0;
            } else if (hrDataType === "detailed") {
                const analysis = window.hrAnalyzer.analyzeHRStream(
                    activity.hrStream
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
            } else {
                const zone = window.hrAnalyzer.getZone(activity.avgHR);
                const zoneKey = `z${zone}`;
                weekData[zoneKey] += activity.distance || 0;
            }
        });

        const result = Array.from(weekMap.values()).map((week) => ({
            ...week,
            avgPace:
                week.paces.length > 0
                    ? week.paces.reduce((sum, p) => sum + p, 0) /
                      week.paces.length
                    : null,
        }));

        return result.sort((a, b) => a.weekStart - b.weekStart);
    }

    renderIntensityChart(activities) {
        const canvas = document.getElementById("intensityChart");
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        const existing = Chart.getChart(canvas);
        if (existing) existing.destroy();

        const chartSettings = window.settingsManager.getChartRanges();
        const weeksToShow = chartSettings.intensityChartWeeks;
        const daysToShow = weeksToShow * 7;

        const inRange = window.dataProcessor.getRunsInRange(daysToShow);
        const distribution =
            window.hrAnalyzer.calculateZoneDistribution(inRange);

        if (distribution.totalDataPoints === 0) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.font = "16px system-ui";
            ctx.fillStyle = "#9aa0a6";
            ctx.textAlign = "center";
            ctx.fillText(
                `No detailed HR data available for the last ${weeksToShow} week${weeksToShow !== 1 ? "s" : ""}`,
                canvas.width / 2,
                canvas.height / 2
            );
            return;
        }

        const zones = ["z1", "z2", "z3", "z4", "z5", "z6"];
        const labels = zones.map((_, i) =>
            window.hrAnalyzer.getZoneLabel(i + 1)
        );
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

    /* ---------------- Timeline ---------------- */

    renderTimeline(activities) {
        const div = document.getElementById("timeline");
        if (!div) return;

        div.innerHTML = "";

        const recent = (activities || []).filter(
            (a) => window.helpers.daysAgo(a.date) <= 28
        );
        const sorted = [...recent].sort((a, b) => b.date - a.date);

        sorted.forEach((activity) => {
            const classification = window.runClassifier.classify(activity);
            const el = this.createRunElement(activity, classification);
            div.appendChild(el);
        });
    }

    createRunElement(run, classification) {
        const { category, isLong, hrDataType } = classification;
        const cssClass = window.runClassifier.getCategoryClass(category);

        const el = document.createElement("div");
        el.className = `run ${cssClass}`;

        const intervalInfo = window.intervalDetector.detectInterval(run);
        const tooltip = this.createRunTooltip(
            run,
            classification,
            intervalInfo
        );

        let badges = "";

        if (intervalInfo.isInterval) {
            badges += '<span class="badge interval-badge">⚡ Interval</span>';
        }

        if (hrDataType === "none") {
            badges += '<span class="badge no-hr">No HR</span>';
        } else if (hrDataType === "basic") {
            badges += '<span class="badge basic-hr">Basic HR</span>';
        }
        if (classification.isLong) {
            badges += '<span class="badge long-run">Long Run</span>';
        }

        el.innerHTML = `
      <span>${window.helpers.formatDateFull(run.date)} — ${category}${classification.isLong ? " (Long)" : ""}</span>
      <span>${badges}<span class="badge">${(run.distance ?? 0).toFixed(1)} km</span></span>
      ${tooltip}
    `;

        return el;
    }

    /* ---------------- Pace helpers (new) ---------------- */

    /**
     * Format a pace value (in min/km) as "m:ss/km".
     * Falls back to a local formatter if intervalDetector.formatPace isn't available.
     */
    formatPaceValue(value) {
        if (value == null || isNaN(value)) return "—";
        if (window.intervalDetector?.formatPace) {
            return window.intervalDetector.formatPace(value);
        }
        const minutes = Math.floor(value);
        const seconds = Math.round((value - minutes) * 60);
        return `${minutes}:${seconds.toString().padStart(2, "0")}/km`;
    }

    /**
     * Convert pace to minutes per km.
     * Supports values already in min/km, or seconds/km (auto-detect via heuristic).
     */
    toMinutesPerKm(rawValue) {
        if (rawValue == null || isNaN(rawValue)) return null;
        const v = Number(rawValue);
        // Heuristic:
        // - if v <= 20 it's likely already minutes per km (e.g., 3.2 … 10.0)
        // - if v > 20 it's likely seconds per km (e.g., 240 … 420)
        if (v <= 20) return v;  // assume min/km
        return v / 60;          // seconds/km -> min/km
    }

    /**
     * Simple moving average smoothing (optional) to reduce spikes.
     * windowSize = 5 by default; set to 0/1 to disable.
     */
    smooth(values, windowSize = 5) {
        if (!Array.isArray(values) || values.length === 0 || windowSize <= 1) return values;
        const half = Math.floor(windowSize / 2);
        const out = new Array(values.length).fill(null);
        for (let i = 0; i < values.length; i++) {
            let sum = 0, count = 0;
            for (let j = i - half; j <= i + half; j++) {
                if (j >= 0 && j < values.length) {
                    const v = values[j];
                    if (v != null && !isNaN(v)) {
                        sum += v; count++;
                    }
                }
            }
            out[i] = count > 0 ? sum / count : values[i];
        }
        return out;
    }

    /**
     * Downsample aligned pairs (time, pace) to at most maxPoints while preserving shape.
     * Uses a simple stride; for very large arrays, consider LTTB if needed.
     */
    downsamplePairs(times, paces, maxPoints = 220) {
        const n = Math.min(times.length, paces.length);
        if (n <= maxPoints) return { times, paces };
        const stride = Math.max(1, Math.floor(n / maxPoints));
        const dsTimes = [];
        const dsPaces = [];
        for (let i = 0; i < n; i += stride) {
            dsTimes.push(times[i]);
            dsPaces.push(paces[i]);
        }
        // Ensure we include last point
        if (dsTimes[dsTimes.length - 1] !== times[n - 1]) {
            dsTimes.push(times[n - 1]);
            dsPaces.push(paces[n - 1]);
        }
        return { times: dsTimes, paces: dsPaces };
    }

    /**
     * Generate an inline SVG sparkline for pace over time from {pace, time}.
     * - pace: array of pace values (min/km or seconds/km; auto-detected)
     * - time: array of timestamps (seconds from start OR epoch/ms; we normalize)
     *
     * Faster paces are shown lower (inverted Y). X axis spans the run duration.
     */
    generatePaceGraphFromStream(paceStream) {
        const paceArr = Array.isArray(paceStream?.pace) ? paceStream.pace : null;
        const timeArr = Array.isArray(paceStream?.time) ? paceStream.time : null;

        if (!paceArr || !timeArr || paceArr.length < 3 || timeArr.length < 3) {
            return `
              <div class="tooltip-row">
                <span class="tooltip-label">Pace Stream:</span>
                <span class="tooltip-value" style="color:#9aa0a6">Not enough data</span>
              </div>
            `;
        }

        const n = Math.min(paceArr.length, timeArr.length);
        const t0 = Number(timeArr[0]);
        const stepRaw = Number(timeArr[1]) - Number(timeArr[0]); // detect ms vs s
        const msLikely = stepRaw > 100; // simple heuristic: >100 implies ms

        // Normalize times to seconds-from-start
        const times = [];
        for (let i = 0; i < n; i++) {
            let t = Number(timeArr[i]) - t0;
            if (msLikely) t = t / 1000;
            times.push(t);
        }
        const totalT = times[times.length - 1];
        if (!isFinite(totalT) || totalT <= 0) {
            return `
              <div class="tooltip-row">
                <span class="tooltip-label">Pace Stream:</span>
                <span class="tooltip-value" style="color:#9aa0a6">Invalid time data</span>
              </div>
            `;
        }

        // Convert pace to min/km and clean
        const minsKmRaw = paceArr
            .slice(0, n)
            .map((v) => this.toMinutesPerKm(v));

        const timesClean = [];
        const minsKmClean = [];
        for (let i = 0; i < n; i++) {
            const v = minsKmRaw[i];
            const tt = times[i];
            if (v != null && isFinite(v) && tt != null && isFinite(tt) && v > 0) {
                minsKmClean.push(v);
                timesClean.push(tt);
            }
        }
        if (minsKmClean.length < 3) {
            return `
              <div class="tooltip-row">
                <span class="tooltip-label">Pace Stream:</span>
                <span class="tooltip-value" style="color:#9aa0a6">Not enough valid data</span>
              </div>
            `;
        }

        // Optional smoothing
        const minsKmSmooth = this.smooth(minsKmClean, 5);

        // Downsample to keep SVG light
        const { times: tDS, paces: pDS } = this.downsamplePairs(timesClean, minsKmSmooth, 220);

        // Dimensions
        const w = 260;
        const h = 68;
        const padL = 8, padR = 8, padT = 6, padB = 6;

        // Scales
        const minPace = Math.min(...pDS);
        const maxPace = Math.max(...pDS);
        const spanPace = Math.max(1e-9, maxPace - minPace);
        const xScale = (tt) =>
            padL + (w - padL - padR) * (tt / totalT);
        const yScale = (v) => {
            // invert: faster (smaller min/km) is lower on the chart
            const t = (v - minPace) / spanPace;
            return padT + (h - padT - padB) * (1 - t);
        };

        // Path
        let d = "";
        for (let i = 0; i < pDS.length; i++) {
            const x = xScale(tDS[i]);
            const y = yScale(pDS[i]);
            d += (i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`);
        }

        // Median band
        const sorted = [...pDS].sort((a, b) => a - b);
        const median =
            sorted.length % 2
                ? sorted[(sorted.length - 1) / 2]
                : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;

        const medianY = yScale(median);
        const bandTop = Math.max(padT, medianY - 2);
        const bandHeight = Math.max(1, Math.min(h - padB, medianY + 2) - bandTop);

        // Stats
        const avg =
            pDS.reduce((acc, v) => acc + v, 0) / pDS.length;
        const last = pDS[pDS.length - 1];
        const minStr = this.formatPaceValue(minPace);
        const maxStr = this.formatPaceValue(maxPace);
        const avgStr = this.formatPaceValue(avg);
        const lastStr = this.formatPaceValue(last);

        // Build SVG
        const svg = `
          <svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Pace sparkline over time">
            <rect x="0" y="0" width="${w}" height="${h}" fill="transparent"/>
            <!-- Median band -->
            <rect x="${padL}" y="${bandTop}" width="${w - padL - padR}" height="${bandHeight}"
                  fill="rgba(251, 188, 4, 0.12)"/>
            <!-- Pace path -->
            <path d="${d}" fill="none" stroke="rgba(251, 188, 4, 1)" stroke-width="2"/>
            <!-- Last point -->
            <circle cx="${xScale(tDS[tDS.length - 1])}" cy="${yScale(last)}" r="2.5" fill="rgba(251, 188, 4, 1)"/>
          </svg>
        `;

        // Stats rows
        const stats = `
          <div class="tooltip-row" style="margin-top:6px">
            <span class="tooltip-label">Min / Avg / Max:</span>
            <span class="tooltip-value">${minStr} • ${avgStr} • ${maxStr}</span>
          </div>
          <div class="tooltip-row">
            <span class="tooltip-label">Last pace:</span>
            <span class="tooltip-value">${lastStr}</span>
          </div>
        `;

        // Container block for the tooltip
        return `
          <hr style="border:none;border-top:1px solid var(--border);margin:8px 0">
          <div class="tooltip-row" style="flex-direction:column;gap:6px">
            <span class="tooltip-label" style="margin-bottom:2px">Pace over time:</span>
            <div class="tooltip-value" style="width:100%">${svg}</div>
          </div>
          ${stats}
        `;
    }

    /* ---------------- Tooltip ---------------- */

    createRunTooltip(run, classification, intervalInfo) {
        const { category, hrDataType, detailedHR } = classification;

        let html = '<div class="tooltip">';

        html += `
      <div class="tooltip-row">
        <span class="tooltip-label">Type:</span>
        <span class="tooltip-value">${category}</span>
      </div>
      <div class="tooltip-row">
        <span class="tooltip-label">Distance:</span>
        <span class="tooltip-value">${(run.distance ?? 0).toFixed(2)} km</span>
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

        const avgPace = window.intervalDetector.calculateAveragePace(run);
        if (avgPace) {
            html += `
        <div class="tooltip-row">
          <span class="tooltip-label">Avg Pace:</span>
          <span class="tooltip-value">${window.intervalDetector.formatPace(avgPace)}</span>
        </div>
      `;
        }

        // Pace stream (sparkline) — expects { pace: [], time: [] }
        if (run.paceStream && Array.isArray(run.paceStream.pace) && Array.isArray(run.paceStream.time)) {
            html += this.generatePaceGraphFromStream(run.paceStream);
        }

        if (hrDataType === "none") {
            html += `
        <div class="tooltip-row">
          <span class="tooltip-label">HR Data:</span>
          <span class="tooltip-value" style="color:#ea4335">Not available</span>
        </div>
      `;
        } else if (hrDataType === "basic") {
            const zone = window.hrAnalyzer.getZone(run.avgHR);
            html += `
        <div class="tooltip-row">
          <span class="tooltip-label">Avg HR:</span>
          <span class="tooltip-value">${run.avgHR} bpm (Zone ${zone})</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-label">Max HR:</span>
          <span class="tooltip-value">${run.maxHR} bpm</span>
        </div>
      `;
        } else if (hrDataType === "detailed" && detailedHR) {
            html +=
                '<hr style="border:none;border-top:1px solid var(--border);margin:8px 0">';
            html += window.hrAnalyzer.generateHRGraph(detailedHR.hrRecords);

            html += `
        <div class="tooltip-row">
          <span class="tooltip-label">Time in Z1:</span>
          <span class="tooltip-value">${detailedHR.percentZ1.toFixed(1)}%</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-label">Time in Z2:</span>
          <span class="tooltip-value">${detailedHR.percentZ2.toFixed(1)}%</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-label">Time in Z3:</span>
          <span class="tooltip-value">${detailedHR.percentZ3.toFixed(1)}%</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-label">Time in Z4:</span>
          <span class="tooltip-value">${detailedHR.percentZ4.toFixed(1)}%</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-label">Time in Z5:</span>
          <span class="tooltip-value">${detailedHR.percentZ5.toFixed(1)}%</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-label">Time in Z6:</span>
          <span class="tooltip-value">${detailedHR.percentZ6.toFixed(1)}%</span>
        </div>
      `;
        }

        html += "</div>";
        return html;
    }

    /* ---------------- Training load ---------------- */

    renderTrainingLoadAnalysis(activities) {
        const container = document.getElementById("trainingLoadAnalysis");
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
window.runRenderer = new RunRenderer();
