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
        this.renderSportBreakdown();
        this.renderActivityDistribution();
        this.renderMonthlyTrends();
        this.renderYearlyComparison();
    },

    /**
     * Render total activity statistics with more meaningful metrics
     */
    renderTotalStats() {
        // This function is now integrated into renderSportBreakdown
    },

    /**
     * Render sport-specific breakdown
     */
    renderSportBreakdown() {
        const container = document.querySelector("#sport-breakdown-table");
        if (!container) {
            console.warn("Sport breakdown table container not found");
            return;
        }

        // Get data for each sport
        const runs = window.dataProcessor.runs || [];
        const rides = window.dataProcessor.rides || [];
        const swims = window.dataProcessor.swims || [];

        const currentYear = new Date().getFullYear();

        // Filter for current year
        const runsThisYear = runs.filter(
            (r) => new Date(r.date).getFullYear() === currentYear
        );
        const ridesThisYear = rides.filter(
            (r) => new Date(r.date).getFullYear() === currentYear
        );
        const swimsThisYear = swims.filter(
            (s) => new Date(s.date).getFullYear() === currentYear
        );

        // Calculate metrics for current year and all time
        const runMetrics = this.calculateDualMetrics(runsThisYear, runs);
        const rideMetrics = this.calculateDualMetrics(ridesThisYear, rides);
        const swimMetrics = this.calculateDualMetrics(swimsThisYear, swims);

        // Calculate totals for current year and all time
        const allActivitiesThisYear = [
            ...runsThisYear,
            ...ridesThisYear,
            ...swimsThisYear,
        ];
        const allActivities = [...runs, ...rides, ...swims];

        const totalCountYear = allActivitiesThisYear.length;
        const totalCountAll = allActivities.length;
        const totalDistanceYear = allActivitiesThisYear.reduce(
            (sum, act) => sum + (act.distance || 0),
            0
        );
        const totalDistanceAll = allActivities.reduce(
            (sum, act) => sum + (act.distance || 0),
            0
        );
        const totalTimeYear = allActivitiesThisYear.reduce(
            (sum, act) => sum + (act.duration || 0),
            0
        );
        const totalTimeAll = allActivities.reduce(
            (sum, act) => sum + (act.duration || 0),
            0
        );
        const avgDistanceYear =
            totalCountYear > 0 ? totalDistanceYear / totalCountYear : 0;
        const avgDistanceAll =
            totalCountAll > 0 ? totalDistanceAll / totalCountAll : 0;
        const avgPaceYear =
            totalDistanceYear > 0 ? totalTimeYear / 60 / totalDistanceYear : 0;
        const avgPaceAll =
            totalDistanceAll > 0 ? totalTimeAll / 60 / totalDistanceAll : 0;

        // Build table HTML
        const tableHTML = `
            <table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="border-bottom: 2px solid #ddd;">
                        <th style="text-align: left; padding: 12px;">Sport</th>
                        <th style="text-align: right; padding: 12px;">Count</th>
                        <th style="text-align: right; padding: 12px;">Total Distance</th>
                        <th style="text-align: right; padding: 12px;">Total Time</th>
                        <th style="text-align: right; padding: 12px;">Avg Distance</th>
                        <th style="text-align: right; padding: 12px;">Avg Pace</th>
                    </tr>
                </thead>
                <tbody>
                    <tr style="border-bottom: 1px solid #eee; background: rgba(66, 133, 244, 0.05);">
                        <td style="padding: 12px; font-weight: 500;">
                            <span style="font-size: 1.2rem; margin-right: 8px;"></span>Running
                        </td>
                        <td style="text-align: right; padding: 12px;">${runMetrics.count}</td>
                        <td style="text-align: right; padding: 12px;">${runMetrics.distance}</td>
                        <td style="text-align: right; padding: 12px;">${runMetrics.time}</td>
                        <td style="text-align: right; padding: 12px;">${runMetrics.avgDistance}</td>
                        <td style="text-align: right; padding: 12px;">${runMetrics.avgPace}</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #eee; background: rgba(234, 67, 53, 0.05);">
                        <td style="padding: 12px; font-weight: 500;">
                            <span style="font-size: 1.2rem; margin-right: 8px;"></span>Cycling
                        </td>
                        <td style="text-align: right; padding: 12px;">${rideMetrics.count}</td>
                        <td style="text-align: right; padding: 12px;">${rideMetrics.distance}</td>
                        <td style="text-align: right; padding: 12px;">${rideMetrics.time}</td>
                        <td style="text-align: right; padding: 12px;">${rideMetrics.avgDistance}</td>
                        <td style="text-align: right; padding: 12px;">${rideMetrics.avgPace}</td>
                    </tr>
                    <tr style="border-bottom: 2px solid #ddd; background: rgba(52, 168, 83, 0.05);">
                        <td style="padding: 12px; font-weight: 500;">
                            <span style="font-size: 1.2rem; margin-right: 8px;"></span>Swimming
                        </td>
                        <td style="text-align: right; padding: 12px;">${swimMetrics.count}</td>
                        <td style="text-align: right; padding: 12px;">${swimMetrics.distance}</td>
                        <td style="text-align: right; padding: 12px;">${swimMetrics.time}</td>
                        <td style="text-align: right; padding: 12px;">${swimMetrics.avgDistance}</td>
                        <td style="text-align: right; padding: 12px;">${swimMetrics.avgPace}</td>
                    </tr>
                    <tr style="background: rgba(0, 0, 0, 0.02); font-weight: 600;">
                        <td style="padding: 12px;">
                            <span style="font-size: 1.2rem; margin-right: 8px;">∑</span>Total
                        </td>
                        <td style="text-align: right; padding: 12px;">${totalCountYear} [${totalCountAll}]</td>
                        <td style="text-align: right; padding: 12px;">${totalDistanceYear.toFixed(1)} [${totalDistanceAll.toFixed(1)}] km</td>
                        <td style="text-align: right; padding: 12px;">${this.formatDuration(totalTimeYear)} [${this.formatDuration(totalTimeAll)}]</td>
                        <td style="text-align: right; padding: 12px;">${avgDistanceYear.toFixed(1)} [${avgDistanceAll.toFixed(1)}] km</td>
                        <td style="text-align: right; padding: 12px;">${avgPaceYear > 0 ? `${Math.floor(avgPaceYear)}:${String(Math.round((avgPaceYear % 1) * 60)).padStart(2, "0")}` : "—"} [${avgPaceAll > 0 ? `${Math.floor(avgPaceAll)}:${String(Math.round((avgPaceAll % 1) * 60)).padStart(2, "0")} min/km` : "—"}]</td>
                    </tr>
                </tbody>
            </table>
        `;

        container.innerHTML = tableHTML;
    },

    /**
     * Calculate metrics for current year and all time
     */
    calculateDualMetrics(activitiesYear, activitiesAll) {
        const yearMetrics = this.calculateSportMetrics(activitiesYear);
        const allMetrics = this.calculateSportMetrics(activitiesAll);

        if (activitiesYear.length === 0 && activitiesAll.length === 0) {
            return {
                count: "0 [0]",
                distance: "— [—]",
                time: "— [—]",
                avgDistance: "— [—]",
                avgPace: "— [—]",
            };
        }

        return {
            count: `${yearMetrics.count} [${allMetrics.count}]`,
            distance: `${yearMetrics.distance} [${allMetrics.distance}]`,
            time: `${yearMetrics.time} [${allMetrics.time}]`,
            avgDistance: `${yearMetrics.avgDistance} [${allMetrics.avgDistance}]`,
            avgPace: `${yearMetrics.avgPace} [${allMetrics.avgPace}]`,
        };
    },

    /**
     * Calculate comprehensive metrics for a sport
     */
    calculateSportMetrics(activities) {
        if (activities.length === 0) {
            return {
                count: "0",
                distance: "—",
                time: "—",
                avgDistance: "—",
                avgPace: "—",
            };
        }

        const count = activities.length;
        const totalDistance = activities.reduce(
            (sum, act) => sum + (act.distance || 0),
            0
        );
        const totalTime = activities.reduce(
            (sum, act) => sum + (act.duration || 0),
            0
        );
        const avgDistance = totalDistance / count;

        // Calculate average pace (min/km)
        const avgPace = totalDistance > 0 ? totalTime / 60 / totalDistance : 0;

        return {
            count: count.toString(),
            distance: `${totalDistance.toFixed(1)} km`,
            time: this.formatDuration(totalTime),
            avgDistance: `${avgDistance.toFixed(1)} km`,
            avgPace:
                avgPace > 0
                    ? `${Math.floor(avgPace)}:${String(Math.round((avgPace % 1) * 60)).padStart(2, "0")} min/km`
                    : "—",
        };
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

        const count = activities.length;
        const totalDistance = activities.reduce(
            (sum, act) => sum + (act.distance || 0),
            0
        );
        const totalTime = activities.reduce(
            (sum, act) => sum + (act.duration || 0),
            0
        );
        const avgDistance = totalDistance / count;

        document.getElementById(`dash-${sport}-count`).textContent = count;
        document.getElementById(`dash-${sport}-distance`).textContent =
            `${totalDistance.toFixed(1)} km`;
        document.getElementById(`dash-${sport}-time`).textContent =
            this.formatDuration(totalTime);
        document.getElementById(`dash-${sport}-avg-distance`).textContent =
            `${avgDistance.toFixed(1)} km`;
    },

    /**
     * Render activity distribution as radar/spider chart
     */
    renderActivityDistribution() {
        const ctx = document.getElementById("activityDistributionChart");
        if (!ctx) return;

        // Destroy existing chart if it exists and has destroy method
        if (
            window.activityDistributionChart &&
            typeof window.activityDistributionChart.destroy === "function"
        ) {
            window.activityDistributionChart.destroy();
        }

        // Get data for last 12 months
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

        // Calculate metrics for each sport
        const runMetrics = this.calculateMetrics(runs);
        const rideMetrics = this.calculateMetrics(rides);
        const swimMetrics = this.calculateMetrics(swims);

        // Normalize metrics to 0-100 scale for better visualization
        const maxDistance = Math.max(
            runMetrics.distance,
            rideMetrics.distance,
            swimMetrics.distance
        );
        const maxTime = Math.max(
            runMetrics.time,
            rideMetrics.time,
            swimMetrics.time
        );
        const maxCount = Math.max(
            runMetrics.count,
            rideMetrics.count,
            swimMetrics.count
        );
        const maxAvgDistance = Math.max(
            runMetrics.avgDistance,
            rideMetrics.avgDistance,
            swimMetrics.avgDistance
        );

        const data = {
            labels: [
                "Activity Count",
                "Total Distance",
                "Total Time",
                "Avg Distance",
            ],
            datasets: [
                {
                    label: "Running",
                    data: [
                        (runMetrics.count / maxCount) * 100,
                        (runMetrics.distance / maxDistance) * 100,
                        (runMetrics.time / maxTime) * 100,
                        (runMetrics.avgDistance / maxAvgDistance) * 100,
                    ],
                    backgroundColor: "rgba(66, 133, 244, 0.2)",
                    borderColor: "rgba(66, 133, 244, 1)",
                    borderWidth: 2,
                    pointBackgroundColor: "rgba(66, 133, 244, 1)",
                    pointBorderColor: "#fff",
                    pointHoverBackgroundColor: "#fff",
                    pointHoverBorderColor: "rgba(66, 133, 244, 1)",
                },
                {
                    label: "Cycling",
                    data: [
                        (rideMetrics.count / maxCount) * 100,
                        (rideMetrics.distance / maxDistance) * 100,
                        (rideMetrics.time / maxTime) * 100,
                        (rideMetrics.avgDistance / maxAvgDistance) * 100,
                    ],
                    backgroundColor: "rgba(234, 67, 53, 0.2)",
                    borderColor: "rgba(234, 67, 53, 1)",
                    borderWidth: 2,
                    pointBackgroundColor: "rgba(234, 67, 53, 1)",
                    pointBorderColor: "#fff",
                    pointHoverBackgroundColor: "#fff",
                    pointHoverBorderColor: "rgba(234, 67, 53, 1)",
                },
                {
                    label: "Swimming",
                    data: [
                        (swimMetrics.count / maxCount) * 100,
                        (swimMetrics.distance / maxDistance) * 100,
                        (swimMetrics.time / maxTime) * 100,
                        (swimMetrics.avgDistance / maxAvgDistance) * 100,
                    ],
                    backgroundColor: "rgba(52, 168, 83, 0.2)",
                    borderColor: "rgba(52, 168, 83, 1)",
                    borderWidth: 2,
                    pointBackgroundColor: "rgba(52, 168, 83, 1)",
                    pointBorderColor: "#fff",
                    pointHoverBackgroundColor: "#fff",
                    pointHoverBorderColor: "rgba(52, 168, 83, 1)",
                },
            ],
        };

        window.activityDistributionChart = new Chart(ctx, {
            type: "radar",
            data: data,
            options: {
                responsive: true,
                maintainAspectRatio: true,
                scales: {
                    r: {
                        beginAtZero: true,
                        max: 100,
                        ticks: {
                            stepSize: 20,
                            display: false,
                        },
                        pointLabels: {
                            font: {
                                size: 12,
                            },
                        },
                    },
                },
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
                                const sport = context.dataset.label;
                                const metric = context.label;

                                // Get actual values
                                let actualValue;
                                let metrics;

                                if (sport === "Running") metrics = runMetrics;
                                else if (sport === "Cycling")
                                    metrics = rideMetrics;
                                else metrics = swimMetrics;

                                switch (metric) {
                                    case "Activity Count":
                                        actualValue = `${metrics.count} activities`;
                                        break;
                                    case "Total Distance":
                                        actualValue = `${metrics.distance.toFixed(1)} km`;
                                        break;
                                    case "Total Time":
                                        actualValue =
                                            DashboardRenderer.formatDuration(
                                                metrics.time
                                            );
                                        break;
                                    case "Avg Distance":
                                        actualValue = `${metrics.avgDistance.toFixed(1)} km`;
                                        break;
                                }

                                return `${sport} - ${metric}: ${actualValue}`;
                            },
                        },
                    },
                },
            },
        });
    },

    /**
     * Render weekly activity trends
     */
    renderMonthlyTrends() {
        const ctx = document.getElementById("monthlyTrendsChart");
        if (!ctx) return;

        // Destroy existing chart if it exists and has destroy method
        if (
            window.monthlyTrendsChart &&
            typeof window.monthlyTrendsChart.destroy === "function"
        ) {
            window.monthlyTrendsChart.destroy();
        }

        // Get last 52 weeks of data (1 year)
        const weeks = [];
        const runData = [];
        const rideData = [];
        const swimData = [];

        for (let i = 51; i >= 0; i--) {
            const weekEnd = new Date();
            weekEnd.setDate(weekEnd.getDate() - i * 7);
            const weekStart = new Date(weekEnd);
            weekStart.setDate(weekStart.getDate() - 6);

            weeks.push(this.formatWeek(weekStart, weekEnd));

            // Count activities in this week
            const runsCount = (window.dataProcessor.runs || []).filter((r) => {
                const actDate = new Date(r.date);
                return actDate >= weekStart && actDate <= weekEnd;
            }).length;

            const ridesCount = (window.dataProcessor.rides || []).filter(
                (r) => {
                    const actDate = new Date(r.date);
                    return actDate >= weekStart && actDate <= weekEnd;
                }
            ).length;

            const swimsCount = (window.dataProcessor.swims || []).filter(
                (s) => {
                    const actDate = new Date(s.date);
                    return actDate >= weekStart && actDate <= weekEnd;
                }
            ).length;

            runData.push(runsCount);
            rideData.push(ridesCount);
            swimData.push(swimsCount);
        }

        // Calculate average activities per week
        const totalActivities =
            runData.reduce((a, b) => a + b, 0) +
            rideData.reduce((a, b) => a + b, 0) +
            swimData.reduce((a, b) => a + b, 0);
        const avgPerWeek = totalActivities / 52;

        // Display average in the UI
        const avgElement = document.getElementById("weekly-average");
        if (avgElement) {
            avgElement.textContent = avgPerWeek.toFixed(1);
        }

        window.monthlyTrendsChart = new Chart(ctx, {
            type: "bar",
            data: {
                labels: weeks,
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
                        ticks: {
                            maxRotation: 45,
                            minRotation: 45,
                            autoSkip: true,
                            maxTicksLimit: 26,
                        },
                        grid: {
                            display: true,
                            color: "rgba(0, 0, 0, 0.05)",
                            drawBorder: true,
                            drawOnChartArea: true,
                            drawTicks: true,
                        },
                    },
                    y: {
                        stacked: true,
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1,
                        },
                        grid: {
                            display: true,
                            color: "rgba(0, 0, 0, 0.1)",
                            drawBorder: true,
                            drawOnChartArea: true,
                            drawTicks: true,
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
                        callbacks: {
                            afterTitle: function () {
                                return `Avg: ${avgPerWeek.toFixed(1)} activities/week`;
                            },
                        },
                    },
                },
            },
        });
    },

    /**
     * Render yearly distance comparison charts
     */
    renderYearlyComparison() {
        this.renderYearlyComparisonChart(
            "run",
            window.dataProcessor.runs || [],
            "yearlyRunChart",
            "rgba(66, 133, 244, 0.7)"
        );
        this.renderYearlyComparisonChart(
            "ride",
            window.dataProcessor.rides || [],
            "yearlyRideChart",
            "rgba(234, 67, 53, 0.7)"
        );
        this.renderYearlyComparisonChart(
            "swim",
            window.dataProcessor.swims || [],
            "yearlySwimChart",
            "rgba(52, 168, 83, 0.7)"
        );
    },

    /**
     * Render a single yearly comparison chart
     */
    renderYearlyComparisonChart(sportType, activities, canvasId, color) {
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;

        // Destroy existing chart
        if (
            window[`${sportType}YearChart`] &&
            typeof window[`${sportType}YearChart`].destroy === "function"
        ) {
            window[`${sportType}YearChart`].destroy();
        }

        const currentYear = new Date().getFullYear();
        const lastYear = currentYear - 1;
        const today = new Date();
        const currentDayOfYear = Math.floor(
            (today - new Date(currentYear, 0, 0)) / (1000 * 60 * 60 * 24)
        );

        // Initialize arrays for each day of the year
        const currentYearData = new Array(366).fill(0);
        const lastYearData = new Array(366).fill(0);

        // Process activities and accumulate distances
        activities.forEach((act) => {
            const actDate = new Date(act.date);
            const actYear = actDate.getFullYear();
            const dayOfYear = Math.floor(
                (actDate - new Date(actYear, 0, 0)) / (1000 * 60 * 60 * 24)
            );
            const distance = act.distance || 0; // Convert to km

            if (actYear === currentYear && dayOfYear <= currentDayOfYear) {
                currentYearData[dayOfYear] += distance;
            } else if (actYear === lastYear) {
                lastYearData[dayOfYear] += distance;
            }
        });

        // Convert to cumulative
        for (let i = 1; i < 366; i++) {
            currentYearData[i] += currentYearData[i - 1];
            lastYearData[i] += lastYearData[i - 1];
        }

        // Trim current year data to only show up to today
        const currentYearTrimmed = currentYearData.slice(
            0,
            currentDayOfYear + 1
        );

        // Create labels (we'll show only some labels to avoid crowding)
        const labels = Array.from({ length: 366 }, (_, i) => i + 1);

        window[`${sportType}YearChart`] = new Chart(ctx, {
            type: "line",
            data: {
                labels: labels,
                datasets: [
                    {
                        label: `${lastYear} (Previous Year)`,
                        data: lastYearData,
                        borderColor: "rgba(150, 150, 150, 0.5)",
                        backgroundColor: "rgba(150, 150, 150, 0.1)",
                        borderWidth: 2,
                        fill: true,
                        tension: 0,
                        pointRadius: 0,
                        pointHoverRadius: 0,
                    },
                    {
                        label: `${currentYear} (Current Year)`,
                        data: currentYearTrimmed,
                        borderColor: color,
                        backgroundColor: color.replace("0.7", "0.2"),
                        borderWidth: 3,
                        fill: true,
                        tension: 0,
                        pointRadius: 0,
                        pointHoverRadius: 0,
                    },
                    {
                        label: "Today",
                        data: Array(currentDayOfYear)
                            .fill(null)
                            .concat([currentYearTrimmed[currentDayOfYear]]),
                        borderColor: "transparent",
                        backgroundColor: color.replace("0.7", "1"),
                        pointRadius: 6,
                        pointHoverRadius: 8,
                        showLine: false,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                interaction: {
                    mode: "index",
                    intersect: false,
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            display: true,
                            color: "rgba(0, 0, 0, 0.1)",
                            drawBorder: true,
                            drawOnChartArea: true,
                            drawTicks: true,
                        },
                        ticks: {
                            callback: function (value) {
                                return value.toFixed(0) + " km";
                            },
                        },
                    },
                    x: {
                        grid: {
                            display: true,
                            color: "rgba(0, 0, 0, 0.05)",
                            drawBorder: true,
                            drawOnChartArea: true,
                            drawTicks: true,
                        },
                        ticks: {
                            callback: function (value, index) {
                                // Show labels for first day of each month
                                const date = new Date(currentYear, 0, value);
                                if (date.getDate() === 1) {
                                    return date.toLocaleDateString("en-US", {
                                        month: "short",
                                    });
                                }
                                return "";
                            },
                            maxRotation: 0,
                            autoSkip: false,
                        },
                    },
                },
                plugins: {
                    legend: {
                        position: "top",
                        labels: {
                            filter: function (item) {
                                return item.text !== "Today";
                            },
                        },
                    },
                    tooltip: {
                        callbacks: {
                            title: function (context) {
                                const dayNum = context[0].parsed.x;
                                const date = new Date(currentYear, 0, dayNum);
                                return date.toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                });
                            },
                            label: function (context) {
                                if (context.dataset.label === "Today") {
                                    return `Today: ${context.parsed.y.toFixed(1)} km`;
                                }
                                return `${context.dataset.label}: ${context.parsed.y.toFixed(1)} km`;
                            },
                        },
                    },
                },
            },
        });
    },

    /**
     * Calculate metrics for a set of activities
     */
    calculateMetrics(activities) {
        if (activities.length === 0) {
            return {
                count: 0,
                distance: 0,
                time: 0,
                avgDistance: 0,
                elevation: 0,
            };
        }

        const count = activities.length;
        const distance = activities.reduce(
            (sum, act) => sum + (act.distance || 0),
            0
        );
        const time = activities.reduce(
            (sum, act) => sum + (act.duration || 0),
            0
        );
        const elevation = activities.reduce(
            (sum, act) => sum + (act.totalElevationGain || 0),
            0
        );
        const avgDistance = distance / count;

        return {
            count,
            distance,
            time,
            avgDistance,
            elevation,
        };
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
     * Format week range for chart labels
     */
    formatWeek(startDate, endDate) {
        const options = { month: "short", day: "numeric" };
        const start = startDate.toLocaleDateString("en-US", options);
        const end = endDate.toLocaleDateString("en-US", options);
        return `${start} - ${end}`;
    },
};

// Export for use in app.js
window.DashboardRenderer = DashboardRenderer;
