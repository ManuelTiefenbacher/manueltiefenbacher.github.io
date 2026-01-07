// js/analysis/runClassification.js
// Unified run and ride classification logic

class RunClassifier {
    constructor(dataProcessor, hrAnalyzer) {
        this.dataProcessor = dataProcessor;
        this.hrAnalyzer = hrAnalyzer;
    }

    /**
     * Classify a run into training categories
     * Returns: { category, isLong, hrDataType, detailedHR, tendency }
     */
    classifyRun(run, avgWeekly = null) {
        const zones = this.dataProcessor.getZonesBPM();

        // Calculate average weekly if not provided
        if (avgWeekly === null) {
            const summary = this.dataProcessor.getSummary();
            avgWeekly = summary.last6Months.avgWeekly;
        }

        const isLong = run.distance > 0.5 * avgWeekly && run.distance > 10;
        const hrDataType = this.hrAnalyzer.getHRDataType(run);

        // No HR data = Mixed Effort
        if (hrDataType === "none") {
            return {
                category: "Mixed Effort",
                isLong,
                hrDataType: "none",
                detailedHR: null,
                tendency: null,
            };
        }

        let category = "Mixed Effort";
        let tendency = null;
        let detailedHR = null;

        // Use detailed HR analysis if available
        if (hrDataType === "detailed") {
            detailedHR = this.hrAnalyzer.analyzeHRStream(run.hrStream, zones);

            if (detailedHR) {
                const result = this.classifyFromDetailedHR(detailedHR);
                category = result.category;
                tendency = result.tendency;
            }
        }
        // Fallback to basic HR
        else if (hrDataType === "basic") {
            category = this.classifyFromBasicHR(run.avgHR, run.maxHR, zones);
        }

        return {
            category: tendency ? `${category} (→ ${tendency})` : category,
            isLong,
            hrDataType,
            detailedHR,
            tendency,
        };
    }

    /**
     * Classify a ride into training categories based on power data
     * Returns: { category, isLong, powerDataType, detailedPower, hrDataType, detailedHR, tendency }
     */
    classifyRide(ride, avgWeekly = null) {
        const ftp = window.powerAnalyzer?.getFTP() ?? 0;
        const zones = this.dataProcessor.getZonesBPM();

        // Calculate average weekly if not provided
        if (avgWeekly === null) {
            const summary = this.dataProcessor.getSummaryRides();
            avgWeekly = summary?.last6Months?.avgWeekly ?? 0;
        }

        const isLong = ride.distance > 0.5 * avgWeekly && ride.distance > 30;

        // Analyze power data
        const powerDataType = this.getPowerDataType(ride);
        let detailedPower = null;
        let category = "Mixed Effort";
        let tendency = null;

        if (powerDataType === "detailed" && ride.powerStream) {
            detailedPower = this.analyzePowerStream(ride.powerStream, ftp);
            if (detailedPower) {
                const result = this.classifyFromDetailedPower(detailedPower);
                category = result.category;
                tendency = result.tendency;
            }
        } else if (powerDataType === "basic" && ride.avgWatts) {
            category = this.classifyFromBasicPower(
                ride.avgWatts,
                ride.maxWatts,
                ftp
            );
        }

        // Analyze HR data (if available)
        const hrDataType = this.hrAnalyzer.getHRDataType(ride);
        let detailedHR = null;

        if (hrDataType === "detailed" && ride.hrStream) {
            detailedHR = this.hrAnalyzer.analyzeHRStream(ride.hrStream, zones);
        }

        return {
            category: tendency ? `${category} (→ ${tendency})` : category,
            isLong,
            powerDataType,
            detailedPower,
            hrDataType,
            detailedHR,
            tendency,
        };
    }

    /**
     * Get power data type for a ride
     */
    getPowerDataType(ride) {
        if (
            ride.powerStream &&
            ride.powerStream.watts &&
            ride.powerStream.watts.length > 0
        ) {
            return "detailed";
        }
        if (ride.avgWatts && ride.maxWatts) {
            return "basic";
        }
        return "none";
    }

    /**
     * Analyze power stream for a ride
     */
    analyzePowerStream(powerStream, ftp) {
        if (
            !powerStream ||
            !powerStream.watts ||
            powerStream.watts.length === 0 ||
            !ftp ||
            ftp === 0
        ) {
            return null;
        }

        const distribution =
            window.powerAnalyzer.analyzePowerZoneDistribution(powerStream);

        if (!distribution) return null;

        return {
            percentZ1: distribution.percentages.z1,
            percentZ2: distribution.percentages.z2,
            percentZ3: distribution.percentages.z3,
            percentZ4: distribution.percentages.z4,
            percentZ5: distribution.percentages.z5,
            percentZ6: distribution.percentages.z6,
        };
    }

    /**
     * Get power zone from watts value
     */
    getPowerZone(watts, ftp) {
        // Use the powerAnalyzer's method but pass FTP if needed
        return window.powerAnalyzer.getPowerZone(watts);
    }

    /**
     * Classify ride from detailed power stream analysis
     */
    classifyFromDetailedPower(powerAnalysis) {
        const timeAboveZ4 = powerAnalysis.percentZ5 + powerAnalysis.percentZ6;
        const timeZ3toZ5 =
            powerAnalysis.percentZ3 +
            powerAnalysis.percentZ4 +
            powerAnalysis.percentZ5;
        const timeZ5Z6 = powerAnalysis.percentZ5 + powerAnalysis.percentZ6;

        // Z2: 75% in Z2 & ≤5% above Z4
        if (powerAnalysis.percentZ2 >= 75 && timeAboveZ4 <= 5) {
            return { category: "Z2", tendency: null };
        }

        // Race: 80% in Z5-Z6
        if (timeZ5Z6 >= 80) {
            return { category: "Race Effort", tendency: null };
        }

        // Intensity: 80% in Z3-Z5
        if (timeZ3toZ5 >= 80) {
            return { category: "Intensity Effort", tendency: null };
        }

        // Mixed - determine tendency
        const tendencies = [
            { name: "Z2", percent: powerAnalysis.percentZ2 },
            { name: "Intensity", percent: timeZ3toZ5 },
            { name: "Race", percent: timeZ5Z6 },
        ];

        const dominant = tendencies.reduce((max, curr) =>
            curr.percent > max.percent ? curr : max
        );

        return {
            category: "Mixed Effort",
            tendency: dominant.percent > 30 ? dominant.name : null,
        };
    }

    /**
     * Classify ride from basic power data (avg & max only)
     */
    classifyFromBasicPower(avgWatts, maxWatts, ftp) {
        const avgZone = this.getPowerZone(avgWatts, ftp);
        const maxZone = this.getPowerZone(maxWatts, ftp);

        // Z2: average power in Z2
        if (avgZone === 2 && maxZone <= 4) {
            return "Z2";
        }

        // Race: average power in Z5 or Z6
        if (avgZone >= 5) {
            return "Race Effort";
        }

        // Intensity: average power in Z3 or Z4
        if (avgZone === 3 || avgZone === 4) {
            return "Intensity Effort";
        }

        return "Mixed Effort";
    }

    /**
     * Classify run from detailed HR stream analysis
     */
    classifyFromDetailedHR(hrAnalysis) {
        const timeAboveZ4 = hrAnalysis.percentZ5 + hrAnalysis.percentZ6;
        const timeZ3toZ5 =
            hrAnalysis.percentZ3 + hrAnalysis.percentZ4 + hrAnalysis.percentZ5;
        const timeZ5Z6 = hrAnalysis.percentZ5 + hrAnalysis.percentZ6;

        // Z2: 75% in Z2 & ≤5% above Z4
        if (hrAnalysis.percentZ2 >= 75 && timeAboveZ4 <= 5) {
            return { category: "Z2", tendency: null };
        }

        // Race: 80% in Z5-Z6
        if (timeZ5Z6 >= 80) {
            return { category: "Race Effort", tendency: null };
        }

        // Intensity: 80% in Z3-Z5
        if (timeZ3toZ5 >= 80) {
            return { category: "Intensity Effort", tendency: null };
        }

        // Mixed - determine tendency
        const tendencies = [
            { name: "Z2", percent: hrAnalysis.percentZ2 },
            { name: "Intensity", percent: timeZ3toZ5 },
            { name: "Race", percent: timeZ5Z6 },
        ];

        const dominant = tendencies.reduce((max, curr) =>
            curr.percent > max.percent ? curr : max
        );

        return {
            category: "Mixed Effort",
            tendency: dominant.percent > 30 ? dominant.name : null,
        };
    }

    /**
     * Classify run from basic HR data (avg & max only)
     */
    classifyFromBasicHR(avgHR, maxHR, zones) {
        const avgZone = this.hrAnalyzer.getZone(avgHR, zones);
        const maxZone = this.hrAnalyzer.getZone(maxHR, zones);

        // Z2: average HR in Z2
        if (avgZone === 2 && maxZone <= 4) {
            return "Z2";
        }

        // Race: average HR in Z5 or Z6
        if (avgZone >= 5) {
            return "Race Effort";
        }

        // Intensity: average HR in Z3 or Z4
        if (avgZone === 3 || avgZone === 4) {
            return "Intensity Effort";
        }

        return "Mixed Effort";
    }

    /**
     * Classify multiple runs at once
     */
    classifyMultiple(runs, avgWeekly = null) {
        return runs.map((run) => ({
            run,
            classification: this.classifyRun(run, avgWeekly),
        }));
    }

    /**
     * Get CSS class for run category (for styling)
     */
    getCategoryClass(category) {
        const baseCategory = category.split(" (")[0].toLowerCase();

        const classMap = {
            z2: "z2",
            "intensity effort": "intensity-effort",
            "race effort": "race-effort",
            "mixed effort": "mixed-effort",
        };

        return classMap[baseCategory] || "mixed-effort";
    }

    /**
     * Get category color for charts
     */
    getCategoryColor(category) {
        const baseCategory = category.split(" (")[0].toLowerCase();

        const colorMap = {
            z2: "rgba(61, 220, 151, 0.7)",
            "intensity effort": "rgba(251, 188, 4, 0.7)",
            "race effort": "rgba(234, 67, 53, 0.7)",
            "mixed effort": "rgba(179, 157, 219, 0.7)",
        };

        return colorMap[baseCategory] || "rgba(154, 160, 166, 0.7)";
    }

    /**
     * Get training load statistics by category
     */
    getTrainingLoadStats(runs) {
        const classifications = this.classifyMultiple(runs);

        const stats = {
            z2: { count: 0, distance: 0, duration: 0 },
            intensity: { count: 0, distance: 0, duration: 0 },
            race: { count: 0, distance: 0, duration: 0 },
            mixed: { count: 0, distance: 0, duration: 0 },
            noHR: { count: 0, distance: 0, duration: 0 },
        };

        classifications.forEach(({ run, classification }) => {
            const category = classification.category
                .split(" (")[0]
                .toLowerCase();

            let key = "mixed";
            if (category === "z2") key = "z2";
            else if (category === "intensity effort") key = "intensity";
            else if (category === "race effort") key = "race";
            else if (classification.hrDataType === "none") key = "noHR";

            stats[key].count++;
            stats[key].distance += run.distance;
            stats[key].duration += run.duration;
        });

        return stats;
    }
}

// Export singleton
window.runClassifier = new RunClassifier(
    window.dataProcessor,
    window.hrAnalyzer
);
