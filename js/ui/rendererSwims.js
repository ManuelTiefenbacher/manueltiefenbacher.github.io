// js/ui/renderer-swims.js
// UI rendering for swimming activities

class SwimRenderer {
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

    /* ---------------- Basic info (SWIMS) ---------------- */

    renderBasicInfo(summary) {
        if (!summary || !summary.last6Months || !summary.last7Days) {
            console.warn(
                "renderSwimBasicInfo: invalid summary object",
                summary
            );
            this._setKm("avgWeeklySwim", 0);
            this._setKm("swimDistanceWeek", 0);
            this._setText("swimsWeek", 0);
            this._setText("restDaysSwim", "—");
            return;
        }

        const avgWeekly = Number(summary.last6Months?.avgWeekly ?? 0);
        this._setKm("avgWeeklySwim", avgWeekly);

        const dist7 = Number(summary.last7Days?.distance ?? 0);
        this._setKm("swimDistanceWeek", dist7);

        const swimsWeek = Number(summary.last7Days?.swims ?? 0);
        this._setText("swimsWeek", swimsWeek);

        const daysSinceRest =
            window.trainingLoadAnalyzer.calculateDaysSinceRest(
                window.dataProcessor?.rides
            );
        this._setText("restDaysSwim", daysSinceRest);
    }

    /* ---------------- Charts ---------------- */

    renderCharts(activities, avgWeekly = null) {
        if (avgWeekly === null) {
            const s = window.dataProcessor.getSummarySwims();
            avgWeekly = s?.last6Months?.avgWeekly ?? 0;
        }

        window.averageDistanceChart.renderChart(
            activities || [],
            Number(avgWeekly),
            "swim"
        );
        window.intensityChart.renderChart(activities || [], "swim");
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
                window.intervalDetector.calculateAverageSwimPace(activity);
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

    /* ---------------- Timeline ---------------- */

    renderTimeline(activities) {
        const div = document.getElementById("timelineSwim");
        if (!div) return;

        div.innerHTML = "";

        const recent = (activities || []).filter(
            (a) => window.helpers.daysAgo(a.date) <= 28
        );
        const sorted = [...recent].sort((a, b) => b.date - a.date);

        sorted.forEach((activity) => {
            const classification = window.swimClassifier.classify(activity);
            const el = this.createSwimElement(activity, classification);
            div.appendChild(el);
        });
    }

    createSwimElement(swim, classification) {
        const { category, isLong, hrDataType, detailedHR } = classification;
        const cssClass = window.swimClassifier.getCategoryClass(category);

        const el = document.createElement("div");
        el.className = `swim ${cssClass}`;

        const intervalInfo = window.intervalDetector.detectInterval(swim);
        const tooltip = this.createSwimTooltip(
            swim,
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
        if (isLong) {
            badges += '<span class="badge long-swim">Long Swim</span>';
        }

        el.innerHTML = `
      <span>${window.helpers.formatDateFull(swim.date)} — ${category}${isLong ? " (Long)" : ""}</span>
      <span>${badges}<span class="badge">${(swim.distance ?? 0).toFixed(1)} km</span></span>
      ${tooltip}
    `;

        return el;
    }

    createSwimTooltip(swim, classification, intervalInfo) {
        const { category, hrDataType, detailedHR } = classification;

        let html = '<div class="tooltip">';

        html += `
      <div class="tooltip-row">
        <span class="tooltip-label">Type:</span>
        <span class="tooltip-value">${category}</span>
      </div>
      <div class="tooltip-row">
        <span class="tooltip-label">Distance:</span>
        <span class="tooltip-value">${(swim.distance ?? 0).toFixed(2)} km</span>
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

        const avgPace = window.intervalDetector.calculateAverageSwimPace(swim);
        if (avgPace) {
            html += `
        <div class="tooltip-row">
          <span class="tooltip-label">Avg Pace:</span>
          <span class="tooltip-value">${window.intervalDetector.formatSwimPace(avgPace)}</span>
        </div>
      `;
        }

        if (hrDataType === "none") {
            html += `
        <div class="tooltip-row">
          <span class="tooltip-label">HR Data:</span>
          <span class="tooltip-value" style="color:#ea4335">Not available</span>
        </div>
      `;
        } else if (hrDataType === "basic") {
            const zone = window.hrAnalyzer.getZone(swim.avgHR);
            html += `
        <div class="tooltip-row">
          <span class="tooltip-label">Avg HR:</span>
          <span class="tooltip-value">${swim.avgHR} bpm (Zone ${zone})</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-label">Max HR:</span>
          <span class="tooltip-value">${swim.maxHR} bpm</span>
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
        const container = document.getElementById("trainingLoadAnalysisSwim");
        if (!container) return;

        const analysis = window.trainingLoadAnalyzer.analyze(
            activities || [],
            "swim"
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
window.swimRenderer = new SwimRenderer();
