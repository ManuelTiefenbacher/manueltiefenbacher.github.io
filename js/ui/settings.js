// js/ui/settings.js
// Settings management (HR Max, Zone configuration, Chart ranges, and Presets)

class SettingsManager {
    constructor() {
        this.DEFAULTS = {
            z2Upper: 0.75,
            z3Upper: 0.85,
            z4Upper: 0.9,
            z5Upper: 0.95,
        };
        this.CHART_DEFAULTS = {
            distanceChartMonths: 6,
            intensityChartWeeks: 4,
        };
        this.PRESETS = {
            "last-month": {
                distanceChartMonths: 1,
                intensityChartWeeks: 4,
                label: "Last Month",
            },
            "last-quarter": {
                distanceChartMonths: 3,
                intensityChartWeeks: 12,
                label: "Last Quarter",
            },
            "last-half": {
                distanceChartMonths: 6,
                intensityChartWeeks: 24,
                label: "Last 6 Months",
            },
            "last-year": {
                distanceChartMonths: 12,
                intensityChartWeeks: 52,
                label: "Last Year",
            },
        };
    }

    /**
     * Initialize settings UI
     */
    init() {
        this.setupHRMaxControls();
        this.setupFtpControls();
        this.setupZoneControls();
        this.setupScanButton();
        this.setupChartRangeControls();
        this.setupPresetButtons();
        this.loadSavedSettings();
    }

    /**
     * Load saved settings into UI
     */
    loadSavedSettings() {
        const zones = window.dataProcessor.zones;
        const hrMax = window.dataProcessor.hrMax;
        const ftp = window.dataProcessor.ftp;

        // Load zone percentages
        const z2Input = document.getElementById("z2UpperInputPct");
        const z3Input = document.getElementById("z3UpperInputPct");
        const z4Input = document.getElementById("z4UpperInputPct");
        const z5Input = document.getElementById("z5UpperInputPct");

        if (z2Input)
            z2Input.value = Math.round(zones.z2Upper * 100 * 100) / 100;
        if (z3Input)
            z3Input.value = Math.round(zones.z3Upper * 100 * 100) / 100;
        if (z4Input)
            z4Input.value = Math.round(zones.z4Upper * 100 * 100) / 100;
        if (z5Input)
            z5Input.value = Math.round(zones.z5Upper * 100 * 100) / 100;

        // Load HR Max
        const maxHrInput = document.getElementById("maxHrInput");
        if (maxHrInput && hrMax) {
            maxHrInput.value = hrMax;
        }

        // Load FTP
        const ftpInput = document.getElementById("ftpInput");
        if (ftpInput && ftp) {
            ftpInput.value = ftp;
        }

        // Load chart ranges
        const chartSettings = this.loadChartRanges();
        const distanceMonthsInput = document.getElementById(
            "distanceChartMonths"
        );
        const intensityWeeksInput = document.getElementById(
            "intensityChartWeeks"
        );

        if (distanceMonthsInput) {
            distanceMonthsInput.value = chartSettings.distanceChartMonths;
        }
        if (intensityWeeksInput) {
            intensityWeeksInput.value = chartSettings.intensityChartWeeks;
        }
    }

    /**
     * Setup HR Max controls
     */
    setupHRMaxControls() {
        const saveBtn = document.getElementById("saveHrBtn");
        const resetBtn = document.getElementById("resetHrBtn");
        const maxHrInput = document.getElementById("maxHrInput");

        if (saveBtn) {
            saveBtn.addEventListener("click", () => {
                const newHRMax = Number(maxHrInput.value);

                if (!newHRMax || newHRMax <= 0 || newHRMax > 250) {
                    window.feedbackManager.showError(
                        "Please enter a valid HR value (1-250)"
                    );
                    return;
                }

                window.dataProcessor.hrMax = newHRMax;
                window.storageManager.saveHRMax(newHRMax);

                // Update display
                const maxHRElement = document.getElementById("maxHR");
                if (maxHRElement) {
                    maxHRElement.textContent = `${newHRMax} bpm`;
                }

                // Re-analyze
                if (typeof window.analyze === "function") {
                    window.analyze();
                }

                window.feedbackManager.showFeedback(
                    `✅ Max HR updated to ${newHRMax} bpm`,
                    "success"
                );
            });
        }

        if (resetBtn) {
            resetBtn.addEventListener("click", () => {
                window.storageManager.clearHRMax();

                const { maxHR } = window.dataProcessor.calculateMaxHR();

                if (maxHrInput) {
                    maxHrInput.value = maxHR;
                }

                const maxHRElement = document.getElementById("maxHR");
                if (maxHRElement) {
                    maxHRElement.textContent = `${maxHR} bpm`;
                }

                if (typeof window.analyze === "function") {
                    window.analyze();
                }

                window.feedbackManager.showFeedback(
                    `✅ Max HR reset to calculated value: ${maxHR} bpm`,
                    "success"
                );
            });
        }
    }

    /**
     * Setup FTP controls
     */
    setupFtpControls() {
        const saveBtn = document.getElementById("saveFtpBtn");
        const resetBtn = document.getElementById("resetFtpBtn");
        const ftpInput = document.getElementById("ftpInput");

        if (saveBtn) {
            saveBtn.addEventListener("click", () => {
                const newFtp = Number(ftpInput.value);

                if (!newFtp || newFtp <= 0 || newFtp > 250) {
                    window.feedbackManager.showError(
                        "Please enter a valid FTP value (1-500)"
                    );
                    return;
                }

                window.dataProcessor.ftp = newFtp;
                window.storageManager.saveFTP(newFtp);

                // Update display
                const maxFtpElement = document.getElementById("FTP");
                if (maxFtpElement) {
                    maxFtpElement.textContent = `${newFtp} watt`;
                }

                // Re-analyze
                if (typeof window.analyze === "function") {
                    window.analyze();
                }

                window.feedbackManager.showFeedback(
                    `✅ FTP updated to ${newFtp} watt`,
                    "success"
                );
            });
        }

        if (resetBtn) {
            resetBtn.addEventListener("click", () => {
                window.storageManager.clearFtp();

                const { ftp } = window.powerAnalysis.estimateFTP();

                if (ftpInput) {
                    ftpInput.value = ftp;
                }

                const maxHRElement = document.getElementById("FTP");
                if (maxHRElement) {
                    maxHRElement.textContent = `${ftp} bpm`;
                }

                if (typeof window.analyze === "function") {
                    window.analyze();
                }

                window.feedbackManager.showFeedback(
                    `✅ FTP reset to calculated value: ${ftp} bpm`,
                    "success"
                );
            });
        }
    }

    /**
     * Setup zone controls
     */
    setupZoneControls() {
        const saveBtn = document.getElementById("saveZonesBtn");
        const resetBtn = document.getElementById("resetZonesBtn");

        const inputs = {
            z2: document.getElementById("z2UpperInputPct"),
            z3: document.getElementById("z3UpperInputPct"),
            z4: document.getElementById("z4UpperInputPct"),
            z5: document.getElementById("z5UpperInputPct"),
        };

        if (saveBtn) {
            saveBtn.addEventListener("click", () => {
                const zones = this.readZonesFromUI(inputs);

                if (!zones) {
                    window.feedbackManager.showError("Invalid zone values");
                    return;
                }

                try {
                    window.dataProcessor.setZones(zones);
                    window.storageManager.saveZones(zones);

                    // Re-analyze
                    if (typeof window.analyze === "function") {
                        window.analyze();
                    }

                    window.feedbackManager.showFeedback(
                        "✅ Zones updated successfully",
                        "success"
                    );
                } catch (err) {
                    window.feedbackManager.showError(
                        "Invalid zone boundaries: " + err.message
                    );
                }
            });
        }

        if (resetBtn) {
            resetBtn.addEventListener("click", () => {
                window.dataProcessor.setZones(this.DEFAULTS);
                window.storageManager.saveZones(this.DEFAULTS);

                // Update UI
                if (inputs.z2) inputs.z2.value = 75;
                if (inputs.z3) inputs.z3.value = 85;
                if (inputs.z4) inputs.z4.value = 90;
                if (inputs.z5) inputs.z5.value = 95;

                // Re-analyze
                if (typeof window.analyze === "function") {
                    window.analyze();
                }

                window.feedbackManager.showFeedback(
                    "✅ Zones reset to defaults",
                    "success"
                );
            });
        }

        // Live validation on input
        Object.values(inputs).forEach((input) => {
            if (input) {
                input.addEventListener(
                    "input",
                    window.helpers.debounce(() => {
                        const zones = this.readZonesFromUI(inputs);
                        if (zones) {
                            try {
                                window.dataProcessor.setZones(zones);
                                // Don't save yet, just validate
                            } catch (err) {
                                // Invalid zones
                            }
                        }
                    }, 500)
                );
            }
        });
    }

    /**
     * Setup chart range controls
     */
    setupChartRangeControls() {
        const saveBtn = document.getElementById("saveChartRangesBtn");
        const resetBtn = document.getElementById("resetChartRangesBtn");
        const distanceMonthsInput = document.getElementById(
            "distanceChartMonths"
        );
        const intensityWeeksInput = document.getElementById(
            "intensityChartWeeks"
        );

        if (saveBtn) {
            saveBtn.addEventListener("click", () => {
                this.applyChartRanges();
            });
        }

        if (resetBtn) {
            resetBtn.addEventListener("click", () => {
                // Reset to defaults
                if (distanceMonthsInput) {
                    distanceMonthsInput.value =
                        this.CHART_DEFAULTS.distanceChartMonths;
                }
                if (intensityWeeksInput) {
                    intensityWeeksInput.value =
                        this.CHART_DEFAULTS.intensityChartWeeks;
                }

                this.saveChartRanges(this.CHART_DEFAULTS);

                // Re-render charts
                const runs = window.dataProcessor.runs;
                if (runs.length > 0) {
                    window.uiRenderer.renderCharts(runs);
                }

                window.feedbackManager.showFeedback(
                    "✅ Chart ranges reset to defaults",
                    "success"
                );
            });
        }
    }

    /**
     * Setup preset buttons
     */
    setupPresetButtons() {
        const presetContainer = document.getElementById("chartPresets");
        if (!presetContainer) return;

        Object.entries(this.PRESETS).forEach(([key, preset]) => {
            const btn = document.createElement("button");
            btn.className = "preset-btn";
            btn.textContent = preset.label;
            btn.addEventListener("click", () => this.applyPreset(key));
            presetContainer.appendChild(btn);
        });
    }

    /**
     * Apply a preset
     */
    applyPreset(presetKey) {
        const preset = this.PRESETS[presetKey];
        if (!preset) return;

        const distanceMonthsInput = document.getElementById(
            "distanceChartMonths"
        );
        const intensityWeeksInput = document.getElementById(
            "intensityChartWeeks"
        );

        if (distanceMonthsInput) {
            distanceMonthsInput.value = preset.distanceChartMonths;
        }
        if (intensityWeeksInput) {
            intensityWeeksInput.value = preset.intensityChartWeeks;
        }

        this.saveChartRanges({
            distanceChartMonths: preset.distanceChartMonths,
            intensityChartWeeks: preset.intensityChartWeeks,
        });

        // Re-render charts
        const runs = window.dataProcessor.runs;
        if (runs.length > 0) {
            window.uiRenderer.renderCharts(runs);
        }

        window.feedbackManager.showFeedback(
            `✅ Applied preset: ${preset.label}`,
            "success"
        );
    }

    /**
     * Apply chart ranges from inputs
     */
    applyChartRanges() {
        const distanceMonthsInput = document.getElementById(
            "distanceChartMonths"
        );
        const intensityWeeksInput = document.getElementById(
            "intensityChartWeeks"
        );

        const distanceMonths = parseInt(distanceMonthsInput.value);
        const intensityWeeks = parseInt(intensityWeeksInput.value);

        // Validate ranges
        if (!distanceMonths || distanceMonths < 1 || distanceMonths > 24) {
            window.feedbackManager.showError(
                "Distance chart months must be between 1 and 24"
            );
            return;
        }

        if (!intensityWeeks || intensityWeeks < 1 || intensityWeeks > 52) {
            window.feedbackManager.showError(
                "Intensity chart weeks must be between 1 and 52"
            );
            return;
        }

        // Save settings
        this.saveChartRanges({
            distanceChartMonths: distanceMonths,
            intensityChartWeeks: intensityWeeks,
        });

        // Re-render charts
        const runs = window.dataProcessor.runs;
        if (runs.length > 0) {
            window.uiRenderer.renderCharts(runs);
        }

        window.feedbackManager.showFeedback(
            `✅ Chart ranges updated: ${distanceMonths} months, ${intensityWeeks} weeks`,
            "success"
        );
    }

    /**
     * Read zones from UI inputs
     */
    readZonesFromUI(inputs) {
        if (!inputs.z2 || !inputs.z3 || !inputs.z4 || !inputs.z5) {
            return null;
        }

        const zones = {
            z2Upper: window.helpers.clamp(
                Number(inputs.z2.value) / 100,
                0.0001,
                0.9999
            ),
            z3Upper: window.helpers.clamp(
                Number(inputs.z3.value) / 100,
                0.0002,
                0.9999
            ),
            z4Upper: window.helpers.clamp(
                Number(inputs.z4.value) / 100,
                0.0003,
                0.9999
            ),
            z5Upper: window.helpers.clamp(
                Number(inputs.z5.value) / 100,
                0.0004,
                0.9999
            ),
        };

        return zones;
    }

    /**
     * Setup scan activities button
     */
    setupScanButton() {
        const scanBtn = document.getElementById("scanActivitiesBtn");

        if (scanBtn) {
            scanBtn.addEventListener("click", () => {
                const runs = window.dataProcessor.runs;

                if (runs.length === 0) {
                    window.feedbackManager.showError(
                        "No activities loaded. Please upload a ZIP file or connect to Strava first."
                    );
                    return;
                }

                window.feedbackManager.showFeedback(
                    "⏳ Scanning all activities for maximum HR...",
                    "info"
                );

                const { maxHR, activity } =
                    window.dataProcessor.calculateMaxHR();

                if (maxHR > 0) {
                    window.storageManager.saveHRMax(maxHR);

                    // Update input
                    const maxHrInput = document.getElementById("maxHrInput");
                    if (maxHrInput) {
                        maxHrInput.value = maxHR;
                    }

                    // Update display
                    const maxHRElement = document.getElementById("maxHR");
                    if (maxHRElement) {
                        maxHRElement.textContent = `${maxHR} bpm`;
                    }

                    // Re-analyze
                    if (typeof window.analyze === "function") {
                        window.analyze();
                    }

                    const activityDate = window.helpers.formatDateFull(
                        activity.date
                    );
                    const activityDistance = activity.distance.toFixed(1);

                    window.feedbackManager.showFeedback(
                        `✅ Max HR found: ${maxHR} bpm (from ${activityDistance} km run on ${activityDate})`,
                        "success"
                    );
                } else {
                    window.feedbackManager.showError(
                        "No heart rate data found in activities"
                    );
                }
            });
        }
    }

    /**
     * Save chart ranges to localStorage
     */
    saveChartRanges(ranges) {
        try {
            localStorage.setItem("chart_ranges", JSON.stringify(ranges));
            return true;
        } catch (err) {
            console.error("Failed to save chart ranges:", err);
            return false;
        }
    }

    /**
     * Load chart ranges from localStorage
     */
    loadChartRanges() {
        try {
            const saved = localStorage.getItem("chart_ranges");
            if (saved) {
                return JSON.parse(saved);
            }
        } catch (err) {
            console.error("Failed to load chart ranges:", err);
        }
        return this.CHART_DEFAULTS;
    }

    /**
     * Get chart ranges (used by renderer)
     */
    getChartRanges() {
        return this.loadChartRanges();
    }
}

// Save FTP
document.getElementById("saveFtpBtn")?.addEventListener("click", () => {
    const ftpInput = document.getElementById("ftpInput");
    const ftp = parseInt(ftpInput.value);

    if (ftp && ftp > 0 && ftp < 600) {
        window.powerAnalyzer.setFTP(ftp);
        window.storageManager.saveFTP(ftp);
        window.feedbackManager.showStatus("FTP saved!", true);
    } else {
        window.feedbackManager.showStatus(
            "Please enter a valid FTP (50-600W)",
            false
        );
    }
});

// Scan rides for FTP
document.getElementById("scanRidesBtn")?.addEventListener("click", () => {
    const estimatedFTP = window.powerAnalyzer.estimateFTP();
    if (estimatedFTP) {
        document.getElementById("estimatedFTP").textContent =
            `${estimatedFTP}W`;
        window.feedbackManager.showStatus(
            `FTP estimated: ${estimatedFTP}W`,
            true
        );
    } else {
        window.feedbackManager.showStatus(
            "No power data available to estimate FTP",
            false
        );
    }
});

// Initialize and export singleton
window.settingsManager = new SettingsManager();

// Auto-initialize on page load
document.addEventListener("DOMContentLoaded", () => {
    window.settingsManager.init();
});
