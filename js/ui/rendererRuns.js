// js/ui/renderer-runs.js
// UI rendering for running activities

class RunRenderer {
    constructor() {
        this.chart = null;
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
        const daysSinceRest =
            window.trainingLoadAnalyzer.calculateDaysSinceRest(
                window.dataProcessor?.rides
            );
        this._setText("restDays", daysSinceRest);

        // Update HR Max display
        const hrMax = window.dataProcessor?.hrMax ?? 0;
        if (hrMax > 0) this._setText("maxHR", `${hrMax} bpm`);
    }

    /* ---------------- Charts ---------------- */

    renderCharts(activities, avgWeekly = null) {
        if (avgWeekly === null) {
            const s = window.dataProcessor.getSummary();
            avgWeekly = s?.last6Months?.avgWeekly ?? 0;
        }

        window.averageDistanceChart.renderChart(
            activities || [],
            Number(avgWeekly),
            "run"
        );
        window.intensityChart.renderChart(activities || [], "run");
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

            const avgPace = window.helpers.calculateAveragePace(activity);
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
}

// Initialize and export singleton
window.runRenderer = new RunRenderer();
