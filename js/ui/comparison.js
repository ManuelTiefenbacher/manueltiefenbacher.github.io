// js/ui/comparison.js
// Period comparison functionality with equal-length periods and sport type selection

class PeriodComparison {
    constructor() {
        this.comparisonCharts = [];
        this.currentSport = "run"; // default sport
    }

    /**
     * Initialize comparison UI
     */
    init() {
        const compareBtn = document.getElementById("comparePeriodsBtn");
        if (compareBtn) {
            compareBtn.addEventListener("click", () =>
                this.openComparisonModal()
            );
        }

        const closeBtn = document.getElementById("closeComparisonModal");
        if (closeBtn) {
            closeBtn.addEventListener("click", () =>
                this.closeComparisonModal()
            );
        }

        const generateBtn = document.getElementById("generateComparisonBtn");
        if (generateBtn) {
            generateBtn.addEventListener("click", () =>
                this.generateComparison()
            );
        }

        // Setup period length change listener
        const periodLengthSelect =
            document.getElementById("periodLengthSelect");
        if (periodLengthSelect) {
            periodLengthSelect.addEventListener("change", () =>
                this.updatePeriodOptions()
            );
        }
    }

    /**
     * Open comparison modal
     */
    openComparisonModal() {
        const modal = document.getElementById("comparisonModal");
        if (modal) {
            modal.style.display = "flex";

            // Restore previous selections if they exist
            const periodLengthSelect =
                document.getElementById("periodLengthSelect");
            const sportTypeSelect = document.getElementById("sportTypeSelect");
            const savedLength = sessionStorage.getItem(
                "comparison_period_length"
            );
            const savedSport = sessionStorage.getItem("comparison_sport_type");

            if (savedLength && periodLengthSelect) {
                periodLengthSelect.value = savedLength;
            }
            if (savedSport && sportTypeSelect) {
                sportTypeSelect.value = savedSport;
                this.currentSport = savedSport;
            }

            this.updatePeriodOptions(); // Initialize options

            // Restore period selections after options are populated
            setTimeout(() => {
                const period1Select = document.getElementById("period1Select");
                const period2Select = document.getElementById("period2Select");
                const savedPeriod1 =
                    sessionStorage.getItem("comparison_period1");
                const savedPeriod2 =
                    sessionStorage.getItem("comparison_period2");

                if (savedPeriod1 && period1Select) {
                    period1Select.value = savedPeriod1;
                }
                if (savedPeriod2 && period2Select) {
                    period2Select.value = savedPeriod2;
                }
            }, 100);
        }
    }

    /**
     * Close comparison modal
     */
    closeComparisonModal() {
        const modal = document.getElementById("comparisonModal");
        if (modal) {
            modal.style.display = "none";
        }
    }

    /**
     * Update period options based on selected length
     */
    updatePeriodOptions() {
        const periodLengthSelect =
            document.getElementById("periodLengthSelect");
        const period1Select = document.getElementById("period1Select");
        const period2Select = document.getElementById("period2Select");

        if (!periodLengthSelect || !period1Select || !period2Select) return;

        const periodLength = periodLengthSelect.value;
        const options = this.getPeriodOptionsForLength(periodLength);

        // Update both selects
        [period1Select, period2Select].forEach((select) => {
            select.innerHTML = '<option value="">-- Select Period --</option>';
            options.forEach((opt) => {
                const option = document.createElement("option");
                option.value = opt.value;
                option.textContent = opt.label;
                select.appendChild(option);
            });
        });
    }

    /**
     * Get period options for a given length
     */
    getPeriodOptionsForLength(length) {
        const now = new Date();
        const options = [];

        switch (length) {
            case "7":
                // Last 8 weeks, week by week
                for (let i = 0; i < 8; i++) {
                    const weeksAgo = i;
                    const endDate = new Date(now);
                    endDate.setDate(endDate.getDate() - weeksAgo * 7);
                    const startDate = new Date(endDate);
                    startDate.setDate(startDate.getDate() - 7);

                    options.push({
                        value: `7-${weeksAgo}`,
                        label:
                            weeksAgo === 0
                                ? "This Week"
                                : weeksAgo === 1
                                  ? "Last Week"
                                  : `${weeksAgo} Weeks Ago`,
                    });
                }
                break;

            case "14":
                // Last 12 two-week periods
                for (let i = 0; i < 12; i++) {
                    const periodsAgo = i;
                    options.push({
                        value: `14-${periodsAgo}`,
                        label:
                            periodsAgo === 0
                                ? "Last 14 Days"
                                : periodsAgo === 1
                                  ? "14 Days Ago"
                                  : `${periodsAgo * 14} Days Ago`,
                    });
                }
                break;

            case "30":
                // Last 12 months
                for (let i = 0; i < 12; i++) {
                    const monthsAgo = i;
                    const date = new Date(now);
                    date.setMonth(date.getMonth() - monthsAgo);
                    const monthName = date.toLocaleDateString("en-US", {
                        month: "long",
                        year: "numeric",
                    });

                    options.push({
                        value: `30-${monthsAgo}`,
                        label:
                            monthsAgo === 0
                                ? "This Month"
                                : monthsAgo === 1
                                  ? "Last Month"
                                  : monthName,
                    });
                }
                break;

            case "90":
                // Last 8 quarters
                for (let i = 0; i < 8; i++) {
                    const quartersAgo = i;
                    const endDate = new Date(now);
                    endDate.setMonth(endDate.getMonth() - quartersAgo * 3);
                    const startDate = new Date(endDate);
                    startDate.setMonth(startDate.getMonth() - 3);

                    const quarter = Math.floor(endDate.getMonth() / 3) + 1;
                    const year = endDate.getFullYear();

                    options.push({
                        value: `90-${quartersAgo}`,
                        label:
                            quartersAgo === 0
                                ? "This Quarter"
                                : quartersAgo === 1
                                  ? "Last Quarter"
                                  : `Q${quarter} ${year}`,
                    });
                }
                break;

            case "180":
                // Last 4 half-years
                for (let i = 0; i < 4; i++) {
                    const halfsAgo = i;
                    const endDate = new Date(now);
                    endDate.setMonth(endDate.getMonth() - halfsAgo * 6);
                    const half = endDate.getMonth() < 6 ? 1 : 2;
                    const year = endDate.getFullYear();

                    options.push({
                        value: `180-${halfsAgo}`,
                        label:
                            halfsAgo === 0
                                ? "Last 6 Months"
                                : `H${half} ${year}`,
                    });
                }
                break;

            case "365":
                // Last 3 years
                for (let i = 0; i < 3; i++) {
                    const yearsAgo = i;
                    const year = now.getFullYear() - yearsAgo;

                    options.push({
                        value: `365-${yearsAgo}`,
                        label: yearsAgo === 0 ? "Last 12 Months" : `${year}`,
                    });
                }
                break;
        }

        return options;
    }

    /**
     * Generate comparison
     */
    generateComparison() {
        const periodLengthSelect =
            document.getElementById("periodLengthSelect");
        const period1Select = document.getElementById("period1Select");
        const period2Select = document.getElementById("period2Select");
        const sportTypeSelect = document.getElementById("sportTypeSelect");

        if (
            !periodLengthSelect ||
            !period1Select ||
            !period2Select ||
            !sportTypeSelect
        )
            return;

        const periodLength = periodLengthSelect.value;
        const period1 = period1Select.value;
        const period2 = period2Select.value;
        const sportType = sportTypeSelect.value;

        if (!period1 || !period2) {
            window.feedbackManager.showError(
                "Please select both periods to compare"
            );
            return;
        }

        if (period1 === period2) {
            window.feedbackManager.showError(
                "Please select different periods to compare"
            );
            return;
        }

        // Save selections to sessionStorage
        sessionStorage.setItem("comparison_period_length", periodLength);
        sessionStorage.setItem("comparison_period1", period1);
        sessionStorage.setItem("comparison_period2", period2);
        sessionStorage.setItem("comparison_sport_type", sportType);

        // Update current sport
        this.currentSport = sportType;

        // Close modal
        this.closeComparisonModal();

        // Generate comparison
        this.renderComparison(periodLength, period1, period2, sportType);

        // Navigate to comparison page
        if (typeof navigateToPage === "function") {
            navigateToPage("page-comparison");
        }
    }

    /**
     * Parse period value and get date range
     */
    getPeriodDateRange(periodValue) {
        const [days, offsetStr] = periodValue.split("-");
        const offset = parseInt(offsetStr);
        const periodDays = parseInt(days);

        const now = new Date();
        const endDate = new Date(now);
        const startDate = new Date(now);

        // Calculate end date based on offset
        if (periodDays === 7) {
            // Weeks
            endDate.setDate(endDate.getDate() - offset * 7);
            startDate.setDate(endDate.getDate() - 7);
        } else if (periodDays === 14) {
            // 14-day periods
            endDate.setDate(endDate.getDate() - offset * 14);
            startDate.setDate(endDate.getDate() - 14);
        } else if (periodDays === 30) {
            // Months (approximate as 30 days)
            endDate.setMonth(endDate.getMonth() - offset);
            startDate.setMonth(endDate.getMonth() - 1);
        } else if (periodDays === 90) {
            // Quarters
            endDate.setMonth(endDate.getMonth() - offset * 3);
            startDate.setMonth(endDate.getMonth() - 3);
        } else if (periodDays === 180) {
            // Half years
            endDate.setMonth(endDate.getMonth() - offset * 6);
            startDate.setMonth(endDate.getMonth() - 6);
        } else if (periodDays === 365) {
            // Years
            endDate.setFullYear(endDate.getFullYear() - offset);
            startDate.setFullYear(endDate.getFullYear() - 1);
        }

        return { startDate, endDate, days: periodDays };
    }

    /**
     * Get activities based on sport type
     */
    getActivitiesBySport(sportType) {
        if (!window.dataProcessor) return [];

        switch (sportType) {
            case "run":
                return window.dataProcessor.runs || [];
            case "ride":
                return window.dataProcessor.rides || [];
            case "swim":
                return window.dataProcessor.swims || [];
            default:
                return window.dataProcessor.runs || [];
        }
    }

    /**
     * Get sport display name
     */
    getSportDisplayName(sportType) {
        const names = {
            run: "Running",
            ride: "Cycling",
            swim: "Swimming",
        };
        return names[sportType] || sportType;
    }

    /**
     * Render comparison between two periods
     */
    renderComparison(periodLength, period1Value, period2Value, sportType) {
        const period1Range = this.getPeriodDateRange(period1Value);
        const period2Range = this.getPeriodDateRange(period2Value);

        const period1Label = document.querySelector(
            `#period1Select option[value="${period1Value}"]`
        ).textContent;
        const period2Label = document.querySelector(
            `#period2Select option[value="${period2Value}"]`
        ).textContent;

        // Get data for both periods
        const period1Data = this.getPeriodData(
            period1Range.startDate,
            period1Range.endDate,
            sportType
        );
        const period2Data = this.getPeriodData(
            period2Range.startDate,
            period2Range.endDate,
            sportType
        );

        // Clear existing charts
        this.clearComparisonCharts();

        // Update title
        const titleEl = document.getElementById("comparisonTitle");
        if (titleEl) {
            titleEl.textContent = `${this.getSportDisplayName(sportType)}: ${period1Label} vs ${period2Label}`;
        }

        // Render comparison stats
        this.renderComparisonStats(
            period1Data,
            period2Data,
            period1Label,
            period2Label,
            sportType
        );

        // Render comparison charts
        this.renderComparisonCharts(
            period1Data,
            period2Data,
            period1Label,
            period2Label,
            sportType
        );
    }

    /**
     * Get data for a specific date range and sport type
     */
    getPeriodData(startDate, endDate, sportType) {
        const activities = this.getActivitiesBySport(sportType).filter(
            (a) => a.date >= startDate && a.date <= endDate
        );

        // Calculate stats
        const totalDistance = activities.reduce(
            (sum, a) => sum + a.distance,
            0
        );
        const totalDuration = activities.reduce(
            (sum, a) => sum + a.duration,
            0
        );
        const avgPace = totalDistance > 0 ? totalDuration / totalDistance : 0;

        // Get zone distribution
        const hrDistribution = window.hrAnalyzer
            ? window.hrAnalyzer.calculateZoneDistribution(activities)
            : { percentages: {} };

        // Classify activities (mainly for running)
        let activityTypes = { z2: 0, intensity: 0, race: 0, mixed: 0 };
        let intervals = 0;

        if (
            sportType === "run" &&
            window.runClassifier &&
            window.intervalDetector
        ) {
            const classifications =
                window.runClassifier.classifyMultiple(activities);
            activityTypes = {
                z2: classifications.filter((c) =>
                    c.classification.category.includes("Z2")
                ).length,
                intensity: classifications.filter((c) =>
                    c.classification.category.includes("Intensity")
                ).length,
                race: classifications.filter((c) =>
                    c.classification.category.includes("Race")
                ).length,
                mixed: classifications.filter((c) =>
                    c.classification.category.includes("Mixed")
                ).length,
            };
            intervals = activities.filter(
                (a) => window.intervalDetector.detectInterval(a).isInterval
            ).length;
        }

        return {
            activities,
            totalActivities: activities.length,
            totalDistance,
            totalDuration,
            avgDistance:
                activities.length > 0 ? totalDistance / activities.length : 0,
            avgPace,
            hrDistribution,
            activityTypes,
            intervals,
        };
    }

    /**
     * Render comparison statistics
     */
    renderComparisonStats(data1, data2, label1, label2, sportType) {
        const container = document.getElementById("comparisonStats");
        if (!container) return;

        const activityLabel =
            sportType === "run"
                ? "Runs"
                : sportType === "ride"
                  ? "Rides"
                  : "Swims";

        const stats = [
            {
                label: `Total ${activityLabel}`,
                value1: data1.totalActivities,
                value2: data2.totalActivities,
                unit: "",
            },
            {
                label: "Total Distance",
                value1: data1.totalDistance.toFixed(1),
                value2: data2.totalDistance.toFixed(1),
                unit: "km",
            },
            {
                label: `Avg Distance/${activityLabel.slice(0, -1)}`,
                value1: data1.avgDistance.toFixed(1),
                value2: data2.avgDistance.toFixed(1),
                unit: "km",
            },
            {
                label: "Avg Pace",
                value1: this.formatPace(data1.avgPace),
                value2: this.formatPace(data2.avgPace),
                unit: "",
            },
        ];

        // Add run-specific stats
        if (sportType === "run") {
            stats.push(
                {
                    label: "Z2 Runs",
                    value1: data1.activityTypes.z2,
                    value2: data2.activityTypes.z2,
                    unit: "",
                },
                {
                    label: "Intensity Runs",
                    value1: data1.activityTypes.intensity,
                    value2: data2.activityTypes.intensity,
                    unit: "",
                },
                {
                    label: "Race Efforts",
                    value1: data1.activityTypes.race,
                    value2: data2.activityTypes.race,
                    unit: "",
                },
                {
                    label: "Interval Sessions",
                    value1: data1.intervals,
                    value2: data2.intervals,
                    unit: "",
                }
            );
        }

        let html = `
      <div class="comparison-stats-grid">
        <div class="comparison-header">
          <div></div>
          <div class="period-label">${label1}</div>
          <div class="period-label">${label2}</div>
          <div class="period-label">Change</div>
        </div>
    `;

        stats.forEach((stat) => {
            const change = this.calculateChange(stat.value1, stat.value2);
            const changeClass =
                change > 0 ? "positive" : change < 0 ? "negative" : "neutral";

            html += `
        <div class="comparison-row">
          <div class="stat-label">${stat.label}</div>
          <div class="stat-value">${stat.value1} ${stat.unit}</div>
          <div class="stat-value">${stat.value2} ${stat.unit}</div>
          <div class="stat-change ${changeClass}">${change > 0 ? "+" : ""}${change.toFixed(1)}%</div>
        </div>
      `;
        });

        html += "</div>";
        container.innerHTML = html;
    }

    /**
     * Render comparison charts
     */
    renderComparisonCharts(data1, data2, label1, label2, sportType) {
        // Zone distribution comparison
        this.renderZoneComparisonChart(data1, data2, label1, label2);

        // Activity type distribution comparison (mainly for running)
        if (sportType === "run") {
            this.renderRunTypeComparisonChart(data1, data2, label1, label2);
        } else {
            // For other sports, show a simple activity count chart
            this.renderActivityCountChart(data1, data2, label1, label2);
        }
    }

    /**
     * Render zone distribution comparison
     */
    renderZoneComparisonChart(data1, data2, label1, label2) {
        const canvas = document.getElementById("zoneComparisonChart");
        if (!canvas) return;

        const ctx = canvas.getContext("2d");

        const zones = ["z1", "z2", "z3", "z4", "z5", "z6"];
        const labels = zones.map((_, i) => `Z${i + 1}`);

        const data1Percentages = zones.map(
            (z) => data1.hrDistribution.percentages[z] || 0
        );
        const data2Percentages = zones.map(
            (z) => data2.hrDistribution.percentages[z] || 0
        );

        const chart = new Chart(ctx, {
            type: "bar",
            data: {
                labels,
                datasets: [
                    {
                        label: label1,
                        data: data1Percentages,
                        backgroundColor: "rgba(66, 133, 244, 0.7)",
                        borderColor: "rgba(66, 133, 244, 1)",
                        borderWidth: 2,
                    },
                    {
                        label: label2,
                        data: data2Percentages,
                        backgroundColor: "rgba(234, 67, 53, 0.7)",
                        borderColor: "rgba(234, 67, 53, 1)",
                        borderWidth: 2,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        labels: { color: "#ffffff" },
                    },
                    title: {
                        display: true,
                        text: "Heart Rate Zone Distribution",
                        color: "#ffffff",
                        font: { size: 16 },
                    },
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            color: "#9aa0a6",
                            callback: (value) => value + "%",
                        },
                        grid: { color: "#2a2f3a" },
                    },
                    x: {
                        ticks: { color: "#9aa0a6" },
                        grid: { color: "#2a2f3a" },
                    },
                },
            },
        });

        this.comparisonCharts.push(chart);
    }

    /**
     * Render run type distribution comparison
     */
    renderRunTypeComparisonChart(data1, data2, label1, label2) {
        const canvas = document.getElementById("runTypeComparisonChart");
        if (!canvas) return;

        const ctx = canvas.getContext("2d");

        const labels = ["Z2", "Intensity", "Race", "Mixed"];
        const data1Values = [
            data1.activityTypes.z2,
            data1.activityTypes.intensity,
            data1.activityTypes.race,
            data1.activityTypes.mixed,
        ];
        const data2Values = [
            data2.activityTypes.z2,
            data2.activityTypes.intensity,
            data2.activityTypes.race,
            data2.activityTypes.mixed,
        ];

        const chart = new Chart(ctx, {
            type: "bar",
            data: {
                labels,
                datasets: [
                    {
                        label: label1,
                        data: data1Values,
                        backgroundColor: "rgba(52, 168, 83, 0.7)",
                        borderColor: "rgba(52, 168, 83, 1)",
                        borderWidth: 2,
                    },
                    {
                        label: label2,
                        data: data2Values,
                        backgroundColor: "rgba(251, 188, 4, 0.7)",
                        borderColor: "rgba(251, 188, 4, 1)",
                        borderWidth: 2,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        labels: { color: "#ffffff" },
                    },
                    title: {
                        display: true,
                        text: "Run Type Distribution",
                        color: "#ffffff",
                        font: { size: 16 },
                    },
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            color: "#9aa0a6",
                            stepSize: 1,
                        },
                        grid: { color: "#2a2f3a" },
                    },
                    x: {
                        ticks: { color: "#9aa0a6" },
                        grid: { color: "#2a2f3a" },
                    },
                },
            },
        });

        this.comparisonCharts.push(chart);
    }

    /**
     * Render simple activity count chart
     */
    renderActivityCountChart(data1, data2, label1, label2) {
        const canvas = document.getElementById("runTypeComparisonChart");
        if (!canvas) return;

        const ctx = canvas.getContext("2d");

        const chart = new Chart(ctx, {
            type: "bar",
            data: {
                labels: [
                    "Total Activities",
                    "Total Distance (km)",
                    "Avg Distance (km)",
                ],
                datasets: [
                    {
                        label: label1,
                        data: [
                            data1.totalActivities,
                            data1.totalDistance,
                            data1.avgDistance,
                        ],
                        backgroundColor: "rgba(52, 168, 83, 0.7)",
                        borderColor: "rgba(52, 168, 83, 1)",
                        borderWidth: 2,
                    },
                    {
                        label: label2,
                        data: [
                            data2.totalActivities,
                            data2.totalDistance,
                            data2.avgDistance,
                        ],
                        backgroundColor: "rgba(251, 188, 4, 0.7)",
                        borderColor: "rgba(251, 188, 4, 1)",
                        borderWidth: 2,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        labels: { color: "#ffffff" },
                    },
                    title: {
                        display: true,
                        text: "Activity Metrics",
                        color: "#ffffff",
                        font: { size: 16 },
                    },
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { color: "#9aa0a6" },
                        grid: { color: "#2a2f3a" },
                    },
                    x: {
                        ticks: { color: "#9aa0a6" },
                        grid: { color: "#2a2f3a" },
                    },
                },
            },
        });

        this.comparisonCharts.push(chart);
    }

    /**
     * Clear comparison charts
     */
    clearComparisonCharts() {
        this.comparisonCharts.forEach((chart) => {
            if (chart) chart.destroy();
        });
        this.comparisonCharts = [];
    }

    /**
     * Calculate percentage change
     */
    calculateChange(val1, val2) {
        const v1 = parseFloat(val1);
        const v2 = parseFloat(val2);

        if (v1 === 0) return v2 > 0 ? 100 : 0;
        return ((v2 - v1) / v1) * 100;
    }

    /**
     * Format pace
     */
    formatPace(pace) {
        if (!pace || pace === 0) return "-";
        const minutes = Math.floor(pace);
        const seconds = Math.round((pace - minutes) * 60);
        return `${minutes}:${seconds.toString().padStart(2, "0")}`;
    }
}

// Initialize and export singleton
window.periodComparison = new PeriodComparison();

// Auto-initialize on page load
document.addEventListener("DOMContentLoaded", () => {
    window.periodComparison.init();
});
