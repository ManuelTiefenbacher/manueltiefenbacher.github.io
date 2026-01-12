// ===== ADVANCED POWER METRICS =====
// Add this as a new module or add to your existing powerAnalyzer

const advancedMetrics = {
    /**
     * Calculate Normalized Power (NP)
     * NP is a weighted average power that accounts for variability
     * @param {number[]} powerStream - Array of power values in watts
     * @returns {number} Normalized Power in watts
     */
    calculateNormalizedPower(powerStream) {
        if (!powerStream || powerStream.watts.length < 30) return null;

        // Step 1: Calculate 30-second rolling average
        const rollingAvg = [];
        for (let i = 0; i < powerStream.watts.length; i++) {
            const start = Math.max(0, i - 29);
            const window = powerStream.watts.slice(start, i + 1);
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
        const normalizedPower = Math.pow(avgFourthPower, 0.25);

        return Math.round(normalizedPower);
    },

    /**
     * Calculate Intensity Factor (IF)
     * IF = NP / FTP
     * @param {number} normalizedPower - Normalized Power in watts
     * @param {number} ftp - Functional Threshold Power in watts
     * @returns {number} Intensity Factor (0.0 to 1.0+)
     */
    calculateIntensityFactor(normalizedPower, ftp) {
        if (!normalizedPower || !ftp || ftp === 0) return null;
        return normalizedPower / ftp;
    },

    /**
     * Calculate Training Stress Score (TSS)
     * TSS = (duration_sec × NP × IF) / (FTP × 3600) × 100
     * @param {number} durationSeconds - Ride duration in seconds
     * @param {number} normalizedPower - Normalized Power in watts
     * @param {number} intensityFactor - Intensity Factor
     * @param {number} ftp - Functional Threshold Power in watts
     * @returns {number} Training Stress Score
     */
    calculateTSS(durationSeconds, normalizedPower, intensityFactor, ftp) {
        if (!durationSeconds || !normalizedPower || !intensityFactor || !ftp)
            return null;

        const tss =
            ((durationSeconds * normalizedPower * intensityFactor) /
                (ftp * 3600)) *
            100;
        return Math.round(tss);
    },

    /**
     * Calculate Variability Index (VI)
     * VI = NP / Average Power
     * VI close to 1.0 = steady effort, higher = more variable
     * @param {number} normalizedPower - Normalized Power in watts
     * @param {number} avgPower - Average Power in watts
     * @returns {number} Variability Index
     */
    calculateVariabilityIndex(normalizedPower, avgPower) {
        if (!normalizedPower || !avgPower || avgPower === 0) return null;
        return normalizedPower / avgPower;
    },

    /**
     * Calculate Work (kJ - Kilojoules)
     * Work = Average Power × Duration (in seconds) / 1000
     * Approximately equal to calories burned
     * @param {number} avgPower - Average Power in watts
     * @param {number} durationSeconds - Ride duration in seconds
     * @returns {number} Work in kilojoules
     */
    calculateWork(avgPower, durationSeconds) {
        if (!avgPower || !durationSeconds) return null;
        return Math.round((avgPower * durationSeconds) / 1000);
    },

    /**
     * Calculate Watts per Kilogram (W/kg)
     * @param {number} power - Power in watts (can be avg or NP)
     * @param {number} weightKg - Rider weight in kilograms
     * @returns {number} Power to weight ratio
     */
    calculateWattsPerKg(power, weightKg) {
        if (!power || !weightKg || weightKg === 0) return null;
        return power / weightKg;
    },

    /**
     * Get IF category description
     * @param {number} intensityFactor - Intensity Factor
     * @returns {string} Category description
     */
    getIFCategory(intensityFactor) {
        if (!intensityFactor) return "Unknown";
        if (intensityFactor < 0.65) return "Recovery";
        if (intensityFactor < 0.75) return "Endurance";
        if (intensityFactor < 0.85) return "Tempo";
        if (intensityFactor < 0.95) return "Threshold";
        if (intensityFactor < 1.05) return "VO2 Max";
        return "Anaerobic";
    },

    /**
     * Get TSS category description
     * @param {number} tss - Training Stress Score
     * @returns {string} Category description
     */
    getTSSCategory(tss) {
        if (!tss) return "Unknown";
        if (tss < 150) return "Low";
        if (tss < 300) return "Medium";
        if (tss < 450) return "High";
        return "Very High";
    },

    /**
     * Calculate all advanced metrics at once
     * @param {Object} ride - Ride object with powerStream, avgWatts, movingTime
     * @param {number} ftp - Functional Threshold Power
     * @param {number} weightKg - Rider weight (optional)
     * @returns {Object} All calculated metrics
     */
    calculateAllMetrics(ride, ftp, weightKg = null) {
        const metrics = {};

        // Basic calculations
        if (ride.powerStream && ride.powerStream.watts.length > 0) {
            metrics.np = this.calculateNormalizedPower(ride.powerStream);

            if (metrics.np && ftp) {
                metrics.if = this.calculateIntensityFactor(metrics.np, ftp);
                metrics.ifCategory = this.getIFCategory(metrics.if);

                if (ride.duration) {
                    metrics.tss = this.calculateTSS(
                        ride.movingTime,
                        metrics.np,
                        metrics.if,
                        ftp
                    );
                    metrics.tssCategory = this.getTSSCategory(metrics.tss);
                }
            }

            if (metrics.np && ride.avgPower) {
                metrics.vi = this.calculateVariabilityIndex(
                    metrics.np,
                    ride.avgPower
                );
            }
        }

        if (ride.avgPower && ride.duration) {
            metrics.work = this.calculateWork(ride.avgPower, ride.movingTime);
        }

        if (weightKg) {
            if (ride.avgPower) {
                metrics.avgWkg = this.calculateWattsPerKg(
                    ride.avgPower,
                    weightKg
                );
            }
            if (metrics.np) {
                metrics.npWkg = this.calculateWattsPerKg(metrics.np, weightKg);
            }
        }

        return metrics;
    },
};

// ===== HR-BASED TSS CALCULATION =====
// For rides without power data, you can estimate TSS from heart rate

const hrBasedMetrics = {
    /**
     * Calculate HR-based Training Stress Score (hrTSS)
     * hrTSS = duration_hours × average_HR_percentage² × 100
     * where average_HR_percentage = (avgHR - restingHR) / (maxHR - restingHR)
     * @param {number} durationSeconds - Ride duration in seconds
     * @param {number} avgHR - Average heart rate
     * @param {number} maxHR - Maximum heart rate (typically 220 - age)
     * @param {number} restingHR - Resting heart rate (typically 40-60)
     * @returns {number} hrTSS
     */
    calculateHRTSS(durationSeconds, avgHR, maxHR, restingHR = 50) {
        if (!durationSeconds || !avgHR || !maxHR) return null;

        const durationHours = durationSeconds / 3600;
        const hrReserve = maxHR - restingHR;
        const avgHRPercentage = (avgHR - restingHR) / hrReserve;

        // Clamp percentage between 0 and 1
        const clampedPercentage = Math.max(0, Math.min(1, avgHRPercentage));

        const hrTSS = durationHours * Math.pow(clampedPercentage, 2) * 100;
        return Math.round(hrTSS);
    },
};

// Export for use in your application
if (typeof window !== "undefined") {
    window.advancedMetrics = advancedMetrics;
    window.hrBasedMetrics = hrBasedMetrics;
}
