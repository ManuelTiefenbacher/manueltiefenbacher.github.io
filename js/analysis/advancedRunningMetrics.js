// ===== ADVANCED RUNNING METRICS =====
// Running-specific performance analysis module

const advancedRunningMetrics = {
    /**
     * Calculate Grade Adjusted Pace (GAP)
     * Adjusts pace based on elevation gain/loss
     * @param {number} paceSecondsPerKm - Current pace in seconds per km
     * @param {number} gradePercent - Grade as percentage (positive = uphill)
     * @returns {number} Grade adjusted pace in seconds per km
     */
    calculateGradeAdjustedPace(paceSecondsPerKm, gradePercent) {
        if (!paceSecondsPerKm || gradePercent === null) return null;

        // Adjustment factor based on grade
        // Roughly: every 1% grade adds ~3.5% to effort
        const adjustmentFactor = 1 - gradePercent * 0.035;

        return Math.round(paceSecondsPerKm * adjustmentFactor);
    },

    /**
     * Calculate Normalized Graded Pace (NGP)
     * Similar to Normalized Power for cycling
     * @param {Object} paceStream - Object with {pace: [], elevation: [], distance: []} arrays
     * @returns {number} Normalized graded pace in seconds per km
     */
    calculateNormalizedGradedPace(paceStream) {
        if (!paceStream || !paceStream.pace || paceStream.pace.length < 30)
            return null;

        const gradedPaces = [];

        // Calculate grade-adjusted pace for each point
        for (let i = 1; i < paceStream.pace.length; i++) {
            const elevChange =
                paceStream.elevation[i] - paceStream.elevation[i - 1];
            const distChange =
                paceStream.distance[i] - paceStream.distance[i - 1];
            const grade = distChange > 0 ? (elevChange / distChange) * 100 : 0;

            const gap = this.calculateGradeAdjustedPace(
                paceStream.pace[i],
                grade
            );
            gradedPaces.push(gap);
        }

        // Step 1: Calculate 30-second rolling average
        const rollingAvg = [];
        for (let i = 0; i < gradedPaces.length; i++) {
            const start = Math.max(0, i - 29);
            const window = gradedPaces.slice(start, i + 1);
            const avg =
                window.reduce((sum, val) => sum + val, 0) / window.length;
            rollingAvg.push(avg);
        }

        // Step 2: Raise each value to the 4th power
        const fourthPowers = rollingAvg.map((val) => Math.pow(val, 4));

        // Step 3: Average these values
        const avgFourthPower =
            fourthPowers.reduce((sum, val) => sum + val, 0) /
            fourthPowers.length;

        // Step 4: Take the 4th root
        const normalizedPace = Math.pow(avgFourthPower, 0.25);

        return Math.round(normalizedPace);
    },

    /**
     * Calculate Pace Variability Index (PVI)
     * PVI = NGP / Average Pace
     * @param {number} normalizedPace - Normalized graded pace in sec/km
     * @param {number} avgPace - Average pace in sec/km
     * @returns {number} Pace Variability Index
     */
    calculatePaceVariabilityIndex(normalizedPace, avgPace) {
        if (!normalizedPace || !avgPace || avgPace === 0) return null;
        return normalizedPace / avgPace;
    },

    /**
     * Calculate Efficiency Factor (EF)
     * EF = Normalized Graded Pace / Average Heart Rate
     * Higher is better (faster pace for same HR)
     * @param {number} normalizedPace - NGP in sec/km
     * @param {number} avgHR - Average heart rate
     * @returns {number} Efficiency Factor
     */
    calculateEfficiencyFactor(normalizedPace, avgHR) {
        if (!normalizedPace || !avgHR || avgHR === 0) return null;
        return normalizedPace / avgHR;
    },

    /**
     * Calculate Aerobic Decoupling
     * Compares efficiency of first half vs second half
     * Shows fatigue accumulation. <5% is good aerobic fitness
     * @param {Object} run - Run object with time-series data
     * @returns {number} Decoupling percentage
     */
    calculateDecoupling(run) {
        if (!run.paceStream || !run.hrStream) return null;
        if (run.paceStream.pace.length < 60) return null;

        const midpoint = Math.floor(run.paceStream.pace.length / 2);

        // First half
        const firstHalfPace = run.paceStream.pace.slice(0, midpoint);
        const firstHalfHR = run.hrStream.heartrate.slice(0, midpoint);
        const firstAvgPace =
            firstHalfPace.reduce((sum, val) => sum + val, 0) /
            firstHalfPace.length;
        const firstAvgHR =
            firstHalfHR.reduce((sum, val) => sum + val, 0) / firstHalfHR.length;
        const firstEF = firstAvgPace / firstAvgHR;

        // Second half
        const secondHalfPace = run.paceStream.pace.slice(midpoint);
        const secondHalfHR = run.hrStream.heartrate.slice(midpoint);
        const secondAvgPace =
            secondHalfPace.reduce((sum, val) => sum + val, 0) /
            secondHalfPace.length;
        const secondAvgHR =
            secondHalfHR.reduce((sum, val) => sum + val, 0) /
            secondHalfHR.length;
        const secondEF = secondAvgPace / secondAvgHR;

        // Calculate percentage change
        const decoupling = ((secondEF - firstEF) / firstEF) * 100;

        return Math.round(decoupling * 10) / 10; // One decimal place
    },

    /**
     * Calculate Running Training Stress Score (rTSS)
     * Based on pace and threshold pace
     * @param {number} durationSeconds - Run duration in seconds
     * @param {number} normalizedPace - NGP in sec/km
     * @param {number} thresholdPace - Threshold pace in sec/km
     * @returns {number} Running TSS
     */
    calculateRunningTSS(durationSeconds, normalizedPace, thresholdPace) {
        if (!durationSeconds || !normalizedPace || !thresholdPace) return null;

        const durationHours = durationSeconds / 3600;
        const intensityFactor = thresholdPace / normalizedPace;

        const rTSS = durationHours * Math.pow(intensityFactor, 2) * 100;

        return Math.round(rTSS);
    },

    /**
     * Calculate average cadence
     * @param {number[]} cadenceStream - Array of cadence values (steps per minute)
     * @returns {number} Average cadence
     */
    calculateAvgCadence(cadenceStream) {
        if (!cadenceStream || cadenceStream.length === 0) return null;

        const sum = cadenceStream.reduce((acc, val) => acc + val, 0);
        return Math.round(sum / cadenceStream.length);
    },

    /**
     * Calculate average stride length
     * @param {number} distanceMeters - Total distance in meters
     * @param {number} totalSteps - Total number of steps
     * @returns {number} Average stride length in meters
     */
    calculateAvgStrideLength(distanceMeters, totalSteps) {
        if (!distanceMeters || !totalSteps || totalSteps === 0) return null;

        return Math.round((distanceMeters / totalSteps) * 100) / 100; // Two decimals
    },

    /**
     * Get cadence category
     * @param {number} cadence - Average cadence
     * @returns {string} Category description
     */
    getCadenceCategory(cadence) {
        if (!cadence) return "Unknown";
        if (cadence < 160) return "Low (Consider increasing)";
        if (cadence < 170) return "Below Average";
        if (cadence < 180) return "Good";
        if (cadence < 190) return "Excellent";
        return "Elite";
    },

    /**
     * Get decoupling category
     * @param {number} decoupling - Decoupling percentage
     * @returns {string} Category description
     */
    getDecouplingCategory(decoupling) {
        if (decoupling === null) return "Unknown";
        if (decoupling < 5) return "Excellent (Good aerobic base)";
        if (decoupling < 10) return "Good";
        if (decoupling < 15) return "Fair (Some fatigue)";
        return "Poor (Significant fatigue)";
    },

    /**
     * Calculate all running metrics at once
     * @param {Object} run - Run object with streams and basic data
     * @param {number} thresholdPace - Threshold pace in sec/km (optional)
     * @param {number} maxHR - Max heart rate (optional, for hrTSS)
     * @param {number} restingHR - Resting heart rate (optional, for hrTSS)
     * @returns {Object} All calculated metrics
     */
    calculateAllMetrics(
        run,
        thresholdPace = null,
        maxHR = null,
        restingHR = 50
    ) {
        const metrics = {};

        // Pace-based metrics
        if (
            run.paceStream &&
            run.paceStream.pace &&
            run.paceStream.pace.length > 0
        ) {
            if (run.paceStream.elevation && run.paceStream.distance) {
                metrics.ngp = this.calculateNormalizedGradedPace(
                    run.paceStream
                );
            }

            if (metrics.ngp && run.avgPace) {
                metrics.pvi = this.calculatePaceVariabilityIndex(
                    metrics.ngp,
                    run.avgPace
                );
            }

            if (metrics.ngp && run.avgHR) {
                metrics.ef = this.calculateEfficiencyFactor(
                    metrics.ngp,
                    run.avgHR
                );
            }

            if (metrics.ngp && thresholdPace && run.movingTime) {
                metrics.rTSS = this.calculateRunningTSS(
                    run.movingTime,
                    metrics.ngp,
                    thresholdPace
                );
            }
        }

        // Decoupling (requires both pace and HR streams)
        if (run.paceStream && run.hrStream) {
            metrics.decoupling = this.calculateDecoupling(run);
            if (metrics.decoupling !== null) {
                metrics.decouplingCategory = this.getDecouplingCategory(
                    metrics.decoupling
                );
            }
        }

        // HR-based TSS fallback
        if (!metrics.rTSS && run.movingTime && run.avgHR && maxHR) {
            metrics.hrTSS = this.calculateHRTSS(
                run.movingTime,
                run.avgHR,
                maxHR,
                restingHR
            );
        }

        // Running dynamics
        if (run.cadenceStream) {
            metrics.avgCadence = this.calculateAvgCadence(run.cadenceStream);
            if (metrics.avgCadence) {
                metrics.cadenceCategory = this.getCadenceCategory(
                    metrics.avgCadence
                );
            }
        }

        if (run.distanceMeters && run.totalSteps) {
            metrics.avgStrideLength = this.calculateAvgStrideLength(
                run.distanceMeters,
                run.totalSteps
            );
        }

        return metrics;
    },

    /**
     * Calculate HR-based Training Stress Score (hrTSS)
     * For runs without pace data
     * @param {number} durationSeconds - Run duration in seconds
     * @param {number} avgHR - Average heart rate
     * @param {number} maxHR - Maximum heart rate
     * @param {number} restingHR - Resting heart rate
     * @returns {number} hrTSS
     */
    calculateHRTSS(durationSeconds, avgHR, maxHR, restingHR = 50) {
        if (!durationSeconds || !avgHR || !maxHR) return null;

        const durationHours = durationSeconds / 3600;
        const hrReserve = maxHR - restingHR;
        const avgHRPercentage = (avgHR - restingHR) / hrReserve;

        const clampedPercentage = Math.max(0, Math.min(1, avgHRPercentage));

        const hrTSS = durationHours * Math.pow(clampedPercentage, 2) * 100;
        return Math.round(hrTSS);
    },
};

// Export for use in your application
if (typeof window !== "undefined") {
    window.advancedRunningMetrics = advancedRunningMetrics;
}
