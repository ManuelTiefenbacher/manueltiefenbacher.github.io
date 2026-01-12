// js/ui/renderer-rides.js
// UI rendering for cycling activities
class RideRenderer {
    constructor() {
        this.chart = null;
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

        const daysSinceRest =
            window.trainingLoadAnalyzer.calculateDaysSinceRest(
                window.dataProcessor?.rides
            );
        this._setText("restDaysRide", daysSinceRest);

        // Update FTP display
        const ftp = window.powerAnalyzer.getFTP() ?? 0;
        if (ftp > 0) this._setText("ftp", `${ftp} W`);
    }

    /* ---------------- Charts ---------------- */

    renderCharts(activities, avgWeekly = null) {
        if (avgWeekly === null) {
            const s = window.dataProcessor.getSummaryRides();
            avgWeekly = s?.last6Months?.avgWeekly ?? 0;
        }
        window.averageDistanceChart.renderChart(
            activities || [],
            Number(avgWeekly),
            "ride"
        );
        window.intensityChart.renderChart(activities || [], "ride");
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

// Choose a readable tick interval (seconds) based on total duration
function chooseTimeTickInterval(totalSeconds) {
    const candidates = [
        10,
        15,
        30,
        60,
        120,
        180,
        300,
        600,
        900,
        1200,
        1800, // 1m..30m
        3600, // 60m
    ];
    for (const c of candidates) {
        const tickCount = Math.floor(totalSeconds / c);
        if (tickCount >= 5 && tickCount <= 8) return c;
    }
    // fallback aiming ~6 ticks
    return Math.max(10, Math.round(totalSeconds / 6));
}

function formatMMSS(seconds) {
    const s = Math.max(0, Math.round(seconds));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return m + ":" + r.toString().padStart(2, "0");
}

// Attach deterministic hover handling to keep tooltip visible when hovering either plot area or tooltip.
function attachStableHover({
    svg,
    plotAreaEl,
    tooltipGroup,
    cursors = [], // e.g., [cursor, cursorHR, cursorPower]
    show,
    hide,
}) {
    let isOverPlot = false;
    let isOverTooltip = false;

    const updateVisibility = () => {
        if (isOverPlot || isOverTooltip) {
            show();
        } else {
            hide();
        }
    };

    // Plot area hover state
    plotAreaEl.addEventListener("mouseenter", () => {
        isOverPlot = true;
        updateVisibility();
    });
    plotAreaEl.addEventListener("mouseleave", () => {
        isOverPlot = false;
        updateVisibility();
    });

    // Tooltip hover state
    tooltipGroup.addEventListener("mouseenter", () => {
        isOverTooltip = true;
        updateVisibility();
    });
    tooltipGroup.addEventListener("mouseleave", () => {
        isOverTooltip = false;
        updateVisibility();
    });

    // If the entire SVG is left (e.g., fast movement), clear both.
    svg.addEventListener("mouseleave", () => {
        isOverPlot = false;
        isOverTooltip = false;
        updateVisibility();
    });

    // Utility: call this when you update tooltip position/content during mousemove.
    return {
        ensureVisible() {
            // If you’re actively interacting (mousemove inside plot), mark as over plot
            isOverPlot = true;
            updateVisibility();
        },
        hideAll() {
            isOverPlot = false;
            isOverTooltip = false;
            updateVisibility();
        },
    };
}

// Initialize and export singleton
window.rideRenderer = new RideRenderer();
