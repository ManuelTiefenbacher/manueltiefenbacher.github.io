// js/ui/dashboard.js

/**
 * Dashboard Page Renderer
 * Displays overview statistics and charts for all sports
 */

const DashboardRenderer = {
    /**
     * Render the complete dashboard
     */
    render() {
        this.renderTotalStats();
        //this.renderSportBreakdown();
        //this.renderActivityDistribution();
        //this.renderMonthlyTrends();
    },

    /**
     * Render total activity statistics
     */
    renderTotalStats() {
        const allActivities = [
            ...(window.processedRuns || []),
            ...(window.processedRides || []),
            ...(window.processedSwims || []),
        ];

        if (allActivities.length === 0) {
            document.getElementById("dash-total-activities").textContent = "0";
            document.getElementById("dash-total-distance").textContent = "—";
            document.getElementById("dash-total-time").textContent = "—";
            document.getElementById("dash-first-activity").textContent = "—";
            document.getElementById("dash-latest-activity").textContent = "—";
            return;
        }

        // Calculate totals
        const totalCount = allActivities.length;
        const totalDistance = allActivities.reduce(
            (sum, act) => sum + (act.distance || 0),
            0
        );
        const totalTime = allActivities.reduce(
            (sum, act) => sum + (act.movingTime || 0),
            0
        );

        // Sort by date to find first and latest
        const sortedActivities = [...allActivities].sort(
            (a, b) => new Date(a.date) - new Date(b.date)
        );

        const firstActivity = sortedActivities[0];
        const latestActivity = sortedActivities[sortedActivities.length - 1];

        // Update DOM
        document.getElementById("dash-total-activities").textContent =
            totalCount;
        document.getElementById("dash-total-distance").textContent =
            `${(totalDistance / 1000).toFixed(1)} km`;
        document.getElementById("dash-total-time").textContent =
            this.formatDuration(totalTime);
        document.getElementById("dash-first-activity").textContent =
            this.formatDate(firstActivity.date);
        document.getElementById("dash-latest-activity").textContent =
            this.formatDate(latestActivity.date);
    },

    /**
     * Render sport-specific breakdown
     */
    renderSportBreakdown() {
        // Running
        this.renderSportStats("run", window.dataProcessor.runs || []);

        // Cycling
        this.renderSportStats("ride", window.dataProcessor.rides || []);

        // Swimming
        this.renderSportStats("swim", window.dataProcessor.swims || []);
    },

    /**
     * Render statistics for a specific sport
     */
    renderSportStats(sport, activities) {
        if (activities.length === 0) {
            document.getElementById(`dash-${sport}-count`).textContent = "0";
            document.getElementById(`dash-${sport}-distance`).textContent = "—";
            document.getElementById(`dash-${sport}-time`).textContent = "—";
            document.getElementById(`dash-${sport}-avg-distance`).textContent =
                "—";
            return;
        }

        const count = activities.distance.length;
        const totalDistance = activities.distance.reduce(
            (sum, act) => sum + (act.distance || 0),
            0
        );
        const totalTime = activities.reduce(
            (sum, act) => sum + (act.movingTime || 0),
            0
        );
        const avgDistance = totalDistance / count;

        document.getElementById(`dash-${sport}-count`).textContent = count;
        document.getElementById(`dash-${sport}-distance`).textContent =
            `${(totalDistance / 1000).toFixed(1)} km`;
        document.getElementById(`dash-${sport}-time`).textContent =
            this.formatDuration(totalTime);
        document.getElementById(`dash-${sport}-avg-distance`).textContent =
            `${(avgDistance / 1000).toFixed(1)} km`;
    },

    /**
     * Render activity distribution pie chart
     */
    renderActivityDistribution() {
        const ctx = document.getElementById("activityDistributionChart");
        if (!ctx) return;

        // Destroy existing chart
        if (window.activityDistributionChart) {
            //window.activityDistributionChart.destroy();
        }

        // Get counts for last 12 months
        const cutoffDate = new Date();
        cutoffDate.setMonth(cutoffDate.getMonth() - 12);

        const runs = (window.dataProcessor.runs || []).filter(
            (r) => new Date(r.date) >= cutoffDate
        );
        const rides = (window.dataProcessor.rides || []).filter(
            (r) => new Date(r.date) >= cutoffDate
        );
        const swims = (window.dataProcessor.swims || []).filter(
            (s) => new Date(s.date) >= cutoffDate
        );

        const data = {
            labels: ["Running", "Cycling", "Swimming"],
            datasets: [
                {
                    data: [runs.length, rides.length, swims.length],
                    backgroundColor: [
                        "rgba(66, 133, 244, 0.7)",
                        "rgba(234, 67, 53, 0.7)",
                        "rgba(52, 168, 83, 0.7)",
                    ],
                    borderColor: [
                        "rgba(66, 133, 244, 1)",
                        "rgba(234, 67, 53, 1)",
                        "rgba(52, 168, 83, 1)",
                    ],
                    borderWidth: 2,
                },
            ],
        };

        window.activityDistributionChart = new Chart(ctx, {
            type: "pie",
            data: data,
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        position: "bottom",
                        labels: {
                            font: {
                                size: 14,
                            },
                            padding: 15,
                        },
                    },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                const label = context.label || "";
                                const value = context.parsed || 0;
                                const total = context.dataset.data.reduce(
                                    (a, b) => a + b,
                                    0
                                );
                                const percentage =
                                    total > 0
                                        ? ((value / total) * 100).toFixed(1)
                                        : 0;
                                return `${label}: ${value} activities (${percentage}%)`;
                            },
                        },
                    },
                },
            },
        });
    },

    /**
     * Render monthly activity trends
     */
    renderMonthlyTrends() {
        const ctx = document.getElementById("monthlyTrendsChart");
        if (!ctx) return;

        // Destroy existing chart
        if (window.monthlyTrendsChart) {
            //window.monthlyTrendsChart.destroy();
        }

        // Get last 12 months of data
        const months = [];
        const runData = [];
        const rideData = [];
        const swimData = [];

        for (let i = 11; i >= 0; i--) {
            const date = new Date();
            date.setMonth(date.getMonth() - i);
            const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
            const monthEnd = new Date(
                date.getFullYear(),
                date.getMonth() + 1,
                0
            );

            months.push(this.formatMonth(date));

            // Count activities in this month
            const runsCount = (window.dataProcessor.runs || []).filter((r) => {
                const actDate = new Date(r.date);
                return actDate >= monthStart && actDate <= monthEnd;
            }).length;

            const ridesCount = (window.dataProcessor.rides || []).filter((r) => {
                const actDate = new Date(r.date);
                return actDate >= monthStart && actDate <= monthEnd;
            }).length;

            const swimsCount = (window.dataProcessor.swims || []).filter((s) => {
                const actDate = new Date(s.date);
                return actDate >= monthStart && actDate <= monthEnd;
            }).length;

            runData.push(runsCount);
            rideData.push(ridesCount);
            swimData.push(swimsCount);
        }

        window.monthlyTrendsChart = new Chart(ctx, {
            type: "bar",
            data: {
                labels: months,
                datasets: [
                    {
                        label: "Running",
                        data: runData,
                        backgroundColor: "rgba(66, 133, 244, 0.7)",
                        borderColor: "rgba(66, 133, 244, 1)",
                        borderWidth: 1,
                    },
                    {
                        label: "Cycling",
                        data: rideData,
                        backgroundColor: "rgba(234, 67, 53, 0.7)",
                        borderColor: "rgba(234, 67, 53, 1)",
                        borderWidth: 1,
                    },
                    {
                        label: "Swimming",
                        data: swimData,
                        backgroundColor: "rgba(52, 168, 83, 0.7)",
                        borderColor: "rgba(52, 168, 83, 1)",
                        borderWidth: 1,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                scales: {
                    x: {
                        stacked: true,
                        grid: {
                            display: false,
                        },
                    },
                    y: {
                        stacked: true,
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1,
                        },
                    },
                },
                plugins: {
                    legend: {
                        position: "top",
                    },
                    tooltip: {
                        mode: "index",
                        intersect: false,
                    },
                },
            },
        });
    },

    /**
     * Format duration in seconds to readable string
     */
    formatDuration(seconds) {
        if (!seconds) return "—";

        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);

        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        }
        return `${minutes}m`;
    },

    /**
     * Format date to readable string
     */
    formatDate(dateString) {
        if (!dateString) return "—";

        const date = new Date(dateString);
        const options = { year: "numeric", month: "short", day: "numeric" };
        return date.toLocaleDateString("en-US", options);
    },

    /**
     * Format month for chart labels
     */
    formatMonth(date) {
        const options = { month: "short", year: "numeric" };
        return date.toLocaleDateString("en-US", options);
    },
};

// Export for use in app.js
window.DashboardRenderer = DashboardRenderer;
