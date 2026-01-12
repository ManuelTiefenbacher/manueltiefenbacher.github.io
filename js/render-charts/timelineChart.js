class TimelineChart {
    constructor() {
        this.chart = null;
    }

    renderChart(activities, sportType = "ride") {
        const canvasId = `timeline${sportType.charAt(0).toUpperCase() + sportType.slice(1)}`;
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        canvas.innerHTML = "";

        const recent = (activities || []).filter(
            (a) => window.helpers.daysAgo(a.date) <= 28
        );
        const sorted = [...recent].sort((a, b) => b.date - a.date);

        const methodMap = {
            ride: {
                classifier: "classifyRide",
                renderer: window.runClassifier,
            },
            run: { classifier: "classifyRun", renderer: window.runClassifier },
            swim: {
                classifier: "classifySwim",
                renderer: window.runClassifier,
            },
        };

        const methods = methodMap[sportType.toLowerCase()];
        if (!methods) {
            console.error(`Unknown sport type: ${sportType}`);
            return;
        }

        sorted.forEach((activity) => {
            const classification =
                methods.renderer[methods.classifier](activity);
            const el = this.createElement(activity, classification, sportType);
            canvas.appendChild(el);
        });
    }

    createElement(activity, classification, sportType = "ride") {
        const { category } = classification;
        const cssClass = window.runClassifier.getCategoryClass(category);

        const el = document.createElement("div");
        el.className = `run ${cssClass}`;

        const intervalInfo =
            sportType === "run"
                ? window.intervalDetector.detectInterval(activity)
                : null;

        const tooltip = this.createTooltip(
            activity,
            classification,
            sportType,
            intervalInfo
        );
        const badges = this.createBadges(
            activity,
            classification,
            sportType,
            intervalInfo
        );

        el.innerHTML = `
            <span>${window.helpers.formatDateFull(activity.date)} — ${category}</span>
            <span>
                ${badges}
                <span class="badge">${(activity.distance ?? 0).toFixed(1)} km</span>
            </span>
            ${tooltip}
        `;

        this.attachTooltipBehavior(el);
        return el;
    }

    createBadges(activity, classification, sportType, intervalInfo) {
        const badges = [];

        // HR Data badges
        badges.push(this.createHRBadge(activity));

        // Power Data badges
        if (sportType !== "run") {
            badges.push(this.createPowerBadge(classification.powerDataType));
        }

        // Run-specific badges
        if (sportType === "run") {
            if (intervalInfo?.isInterval) {
                badges.push(
                    '<span class="badge interval-badge">⚡ Interval</span>'
                );
            }
            if (classification.isLong) {
                badges.push('<span class="badge long-run">Long Run</span>');
            }
        }

        return badges.join("");
    }

    createHRBadge(activity) {
        if (!activity.avgHR) {
            return '<span class="badge no-hr">No HR</span>';
        } else if (!activity.hrStream) {
            return '<span class="badge basic-hr">Basic HR</span>';
        } else {
            return '<span class="badge detailed-hr">Detailed HR</span>';
        }
    }

    createPowerBadge(powerDataType) {
        const badgeMap = {
            none: '<span class="badge no-power">No Power</span>',
            basic: '<span class="badge basic-power">Basic Power</span>',
            detailed:
                '<span class="badge detailed-power">Detailed Power</span>',
        };
        return badgeMap[powerDataType] || "";
    }

    attachTooltipBehavior(el) {
        let hideTimeout = null;

        setTimeout(() => {
            const tooltipEl = el.querySelector(".tooltip");
            if (!tooltipEl) return;

            el.addEventListener("mouseenter", () => {
                if (hideTimeout) {
                    clearTimeout(hideTimeout);
                    hideTimeout = null;
                }
                tooltipEl.style.display = "block";
                tooltipEl.style.pointerEvents = "auto";
            });

            el.addEventListener("mouseleave", (e) => {
                const toElement = e.relatedTarget;
                if (toElement && tooltipEl.contains(toElement)) return;

                hideTimeout = setTimeout(() => {
                    tooltipEl.style.display = "none";
                }, 100);
            });

            tooltipEl.addEventListener("mouseenter", () => {
                if (hideTimeout) {
                    clearTimeout(hideTimeout);
                    hideTimeout = null;
                }
                tooltipEl.style.pointerEvents = "auto";
            });

            tooltipEl.addEventListener("mouseleave", () => {
                hideTimeout = setTimeout(() => {
                    tooltipEl.style.display = "none";
                }, 100);
            });
        }, 0);
    }

    // ==================== TOOLTIP CREATION ====================

    createTooltip(activity, classification, sportType, intervalInfo) {
        const sections = [
            this.renderBasicInfo(
                activity,
                classification,
                sportType,
                intervalInfo
            ),
            this.renderSportSpecificMetrics(
                activity,
                classification,
                sportType
            ),
            this.renderDetailedDataGraphs(activity, classification),
            this.renderBasicDataFallback(activity, classification),
        ].filter(Boolean);

        return `<div class="tooltip">${sections.join("")}</div>`;
    }

    // ==================== BASIC INFO SECTION ====================

    renderBasicInfo(activity, classification, sportType, intervalInfo) {
        const duration = this.formatDuration(activity.duration ?? 0);
        const distance = (activity.distance ?? 0).toFixed(2);

        let html = `
            <div class="tooltip-row">
                <span class="tooltip-label">Type:</span>
                <span class="tooltip-value">${classification.category}</span>
            </div>
            <div class="tooltip-row">
                <span class="tooltip-label">Duration:</span>
                <span class="tooltip-value">${duration}</span>
            </div>
            <div class="tooltip-row">
                <span class="tooltip-label">Distance:</span>
                <span class="tooltip-value">${distance} km</span>
            </div>
        `;

        if (intervalInfo?.isInterval) {
            html += this.renderIntervalInfo(intervalInfo);
        }

        html += this.renderSpeedOrPace(activity, sportType);

        return html;
    }

    formatDuration(duration) {
        const minutes = Math.floor(duration);
        const seconds = Math.round((duration - minutes) * 60);
        return `${minutes}:${seconds.toString().padStart(2, "0")} minutes`;
    }

    renderIntervalInfo(intervalInfo) {
        return `
            <div class="tooltip-row" style="background: rgba(251, 188, 4, 0.1); padding: 4px; border-radius: 4px; margin: 8px 0;">
                <span class="tooltip-label">⚡ Intervals:</span>
                <span class="tooltip-value">${intervalInfo.details}</span>
            </div>
        `;
    }

    renderSpeedOrPace(activity, sportType) {
        const avgSpeed = window.helpers.calculateAverageSpeed(activity);
        const avgPace = window.helpers.calculateAveragePace(activity);

        if (avgSpeed && sportType === "ride") {
            return `
                <div class="tooltip-row">
                    <span class="tooltip-label">Avg Speed:</span>
                    <span class="tooltip-value">${avgSpeed.toFixed(1)} km/h</span>
                </div>
            `;
        }

        if (avgPace && sportType === "run") {
            return `
                <div class="tooltip-row">
                    <span class="tooltip-label">Avg Pace:</span>
                    <span class="tooltip-value">${avgPace.toFixed(1)} km/h</span>
                </div>
            `;
        }

        return "";
    }

    // ==================== SPORT-SPECIFIC METRICS ====================

    renderSportSpecificMetrics(activity, classification, sportType) {
        if (sportType === "run") {
            return this.renderRunningMetrics(activity);
        } else {
            return this.renderCyclingMetrics(activity, classification);
        }
    }

    // ==================== RUNNING METRICS ====================

    renderRunningMetrics(activity) {
        const thresholdPace = 5;
        const maxHR = window.settingsManager.getMaxHR();
        const restingHR = window.settingsManager.getRestingHR();

        if (!activity.paceStream && !activity.avgPace && !activity.avgHR) {
            return "";
        }

        const runningMetrics =
            window.advancedRunningMetrics.calculateAllMetrics(
                activity,
                thresholdPace,
                maxHR,
                restingHR
            );

        if (!runningMetrics || Object.keys(runningMetrics).length === 0) {
            return "";
        }

        return `
            <hr style="border:none;border-top:1px solid var(--border);margin:8px 0">
            <div style="font-weight:600;margin:8px 0;">Running Metrics</div>
            ${this.renderRunningTrainingMetrics(runningMetrics)}
            ${this.renderRunningDynamics(runningMetrics)}
        `;
    }

    renderRunningTrainingMetrics(metrics) {
        const parts = [];

        // rTSS or hrTSS
        if (metrics.rTSS) {
            parts.push(this.renderMetricRow("rTSS", metrics.rTSS, true));
        } else if (metrics.hrTSS) {
            parts.push(
                this.renderMetricRow(
                    "hrTSS",
                    `${metrics.hrTSS} <span style="opacity:0.7;font-size:0.85em;">(HR-based)</span>`,
                    true
                )
            );
        }

        // Normalized Graded Pace
        if (metrics.ngp) {
            const ngpMinutes = Math.floor(metrics.ngp / 60);
            const ngpSeconds = Math.round(metrics.ngp % 60);
            parts.push(
                this.renderMetricRow(
                    "Normalized Pace",
                    `${ngpMinutes}:${ngpSeconds.toString().padStart(2, "0")} /km`
                )
            );
        }

        // Pace Variability Index
        if (metrics.pvi) {
            const pviDescription =
                metrics.pvi < 1.05
                    ? "Steady"
                    : metrics.pvi < 1.1
                      ? "Variable"
                      : "Very Variable";
            parts.push(
                this.renderMetricRow(
                    "Pace Variability",
                    `${metrics.pvi.toFixed(2)} <span style="opacity:0.7;font-size:0.85em;">(${pviDescription})</span>`
                )
            );
        }

        // Efficiency Factor
        if (metrics.ef) {
            parts.push(
                this.renderMetricRow("Efficiency Factor", metrics.ef.toFixed(2))
            );
        }

        // Aerobic Decoupling
        if (metrics.decoupling !== null && metrics.decoupling !== undefined) {
            parts.push(
                this.renderMetricRow(
                    "Decoupling",
                    `${metrics.decoupling.toFixed(1)}% <span style="opacity:0.7;font-size:0.85em;">(${metrics.decouplingCategory})</span>`
                )
            );
        }

        return parts.join("");
    }

    renderRunningDynamics(metrics) {
        const hasDynamics =
            metrics.avgCadence ||
            metrics.avgStrideLength ||
            metrics.avgVO ||
            metrics.avgGCT ||
            metrics.gctBalance;

        if (!hasDynamics) return "";

        const parts = [
            '<div style="font-weight:600;margin:12px 0 8px 0;">Running Dynamics</div>',
        ];

        if (metrics.avgCadence) {
            parts.push(
                this.renderMetricRow(
                    "Cadence",
                    `${metrics.avgCadence} spm <span style="opacity:0.7;font-size:0.85em;">(${metrics.cadenceCategory})</span>`
                )
            );
        }

        if (metrics.avgStrideLength) {
            parts.push(
                this.renderMetricRow(
                    "Stride Length",
                    `${metrics.avgStrideLength} m`
                )
            );
        }

        if (metrics.avgVO) {
            parts.push(
                this.renderMetricRow(
                    "Vert. Oscillation",
                    `${metrics.avgVO} cm <span style="opacity:0.7;font-size:0.85em;">(${metrics.voCategory})</span>`
                )
            );
        }

        if (metrics.avgGCT) {
            parts.push(
                this.renderMetricRow(
                    "Ground Contact",
                    `${metrics.avgGCT} ms <span style="opacity:0.7;font-size:0.85em;">(${metrics.gctCategory})</span>`
                )
            );
        }

        if (metrics.gctBalance) {
            const balanceWarning =
                metrics.gctBalance.imbalance > 2 ? " ⚠️" : "";
            parts.push(
                this.renderMetricRow(
                    "GC Balance",
                    `${metrics.gctBalance.avgLeft.toFixed(1)}% / ${metrics.gctBalance.avgRight.toFixed(1)}%${balanceWarning}`
                )
            );
        }

        return parts.join("");
    }

    // ==================== CYCLING METRICS ====================

    renderCyclingMetrics(activity, classification) {
        const { powerDataType } = classification;
        const ftp = window.powerAnalyzer?.getFTP() ?? 0;
        const riderWeight = window.settingsManager.getWeight();

        // Try power-based metrics first
        if (powerDataType !== "none" && activity.avgPower) {
            const advancedMetrics = window.advancedMetrics.calculateAllMetrics(
                activity,
                ftp,
                riderWeight
            );

            if (advancedMetrics && Object.keys(advancedMetrics).length > 0) {
                return this.renderPowerBasedMetrics(advancedMetrics);
            }
        }

        // Fall back to HR-based TSS
        return this.renderHRBasedTSS(activity);
    }

    renderPowerBasedMetrics(metrics) {
        const parts = [
            '<hr style="border:none;border-top:1px solid var(--border);margin:8px 0">',
            '<div style="font-weight:600;margin:8px 0;">Training Metrics</div>',
        ];

        // TSS
        if (metrics.tss) {
            parts.push(
                this.renderMetricRow(
                    "TSS",
                    `${metrics.tss} <span style="opacity:0.7;font-size:0.85em;">(${metrics.tssCategory})</span>`,
                    true
                )
            );
        }

        // Intensity Factor
        if (metrics.if) {
            parts.push(
                this.renderMetricRow(
                    "Intensity Factor",
                    `${metrics.if.toFixed(2)} <span style="opacity:0.7;font-size:0.85em;">(${metrics.ifCategory})</span>`
                )
            );
        }

        // Normalized Power
        if (metrics.np) {
            parts.push(
                this.renderMetricRow("Normalized Power", `${metrics.np} W`)
            );
        }

        // Variability Index
        if (metrics.vi) {
            const viDescription =
                metrics.vi < 1.05
                    ? "Steady"
                    : metrics.vi < 1.1
                      ? "Variable"
                      : "Very Variable";
            parts.push(
                this.renderMetricRow(
                    "Variability",
                    `${metrics.vi.toFixed(2)} <span style="opacity:0.7;font-size:0.85em;">(${viDescription})</span>`
                )
            );
        }

        // Work
        if (metrics.work) {
            parts.push(
                this.renderMetricRow(
                    "Work",
                    `${metrics.work} kJ <span style="opacity:0.7;font-size:0.85em;">(≈ ${Math.round(metrics.work / 4.184)} kcal)</span>`
                )
            );
        }

        // W/kg
        if (metrics.avgWkg) {
            parts.push(
                this.renderMetricRow(
                    "Power/Weight",
                    `${metrics.avgWkg.toFixed(2)} W/kg`
                )
            );
        }

        if (metrics.npWkg) {
            parts.push(
                this.renderMetricRow(
                    "NP/Weight",
                    `${metrics.npWkg.toFixed(2)} W/kg`
                )
            );
        }

        return parts.join("");
    }

    renderHRBasedTSS(activity) {
        const { hrDataType } = this.getDataTypes(activity);

        if (hrDataType === "none" || !activity.avgHR || !activity.movingTime) {
            return "";
        }

        const maxHR = window.hrAnalyzer?.getMaxHR() ?? 190;
        const restingHR = window.hrAnalyzer?.getRestingHR() ?? 50;

        const hrTSS = window.hrBasedMetrics.calculateHRTSS(
            activity.movingTime,
            activity.avgHR,
            maxHR,
            restingHR
        );

        if (!hrTSS) return "";

        return `
            <hr style="border:none;border-top:1px solid var(--border);margin:8px 0">
            <div style="font-weight:600;margin:8px 0;">Training Metrics</div>
            ${this.renderMetricRow("hrTSS", `${hrTSS} <span style="opacity:0.7;font-size:0.85em;">(HR-based)</span>`, true)}
        `;
    }

    renderMetricRow(label, value, highlight = false) {
        const className = highlight
            ? "tooltip-row highlight-metric"
            : "tooltip-row";
        return `
            <div class="${className}">
                <span class="tooltip-label">${label}:</span>
                <span class="tooltip-value">${value}</span>
            </div>
        `;
    }

    // ==================== DETAILED DATA GRAPHS ====================

    renderDetailedDataGraphs(activity, classification) {
        const { hrDataType, detailedHR, powerDataType, detailedPower } =
            classification;

        const hasDetailedHR = hrDataType === "detailed" && detailedHR;
        const hasDetailedPower = powerDataType === "detailed" && detailedPower;

        if (!hasDetailedHR && !hasDetailedPower) {
            return "";
        }

        return `
            <hr style="border:none;border-top:1px solid var(--border);margin:8px 0">
            ${this.renderGraphs(activity, hasDetailedHR, hasDetailedPower)}
            ${this.renderZoneDoughnuts(activity, hasDetailedHR, hasDetailedPower, detailedHR, detailedPower)}
        `;
    }

    renderGraphs(activity, hasDetailedHR, hasDetailedPower) {
        // Combined HR+Power graph
        if (
            hasDetailedHR &&
            hasDetailedPower &&
            activity.powerStream &&
            activity.hrStream
        ) {
            return window.powerAnalyzer.generateHRPowerGraph(
                activity.hrStream,
                activity.powerStream
            );
        }

        // HR + Pace graph
        if (hasDetailedHR && activity.hrStream && activity.paceStream) {
            return window.hrAnalyzer.generateHRGraph(
                activity.hrStream.heartrate,
                activity.paceStream.pace
            );
        }

        // Just HR graph
        if (hasDetailedHR && activity.hrStream) {
            return window.hrAnalyzer.generateHRGraph(activity.hrStream);
        }

        // Just power graph
        if (hasDetailedPower && activity.powerStream) {
            return window.powerAnalyzer.generatePowerGraph(
                activity.powerStream
            );
        }

        return "";
    }

    renderZoneDoughnuts(
        activity,
        hasDetailedHR,
        hasDetailedPower,
        detailedHR,
        detailedPower
    ) {
        if (hasDetailedHR && hasDetailedPower) {
            return `
                <div style="font-weight:600;margin:16px 0 8px 0;">Zone Distribution</div>
                <div style="display:flex;gap:24px;justify-content:center;flex-wrap:wrap;">
                    <div style="flex:1;min-width:250px;max-width:400px;">
                        <div style="font-weight:600;margin-bottom:8px;text-align:center;color:#ea4335;">Heart Rate</div>
                        ${window.hrAnalyzer.generateHRZoneDoughnut(detailedHR)}
                    </div>
                    <div style="flex:1;min-width:250px;max-width:400px;">
                        <div style="font-weight:600;margin-bottom:8px;text-align:center;color:#4285f4;">Power</div>
                        ${window.powerAnalyzer.generatePowerZoneDoughnut(detailedPower)}
                    </div>
                </div>
            `;
        }

        if (hasDetailedHR) {
            return `
                <div style="font-weight:600;margin:16px 0 8px 0;">Heart Rate Distribution</div>
                ${window.hrAnalyzer.generateHRZoneDoughnut(detailedHR)}
            `;
        }

        if (hasDetailedPower) {
            return `
                <div style="font-weight:600;margin:16px 0 8px 0;">Power Distribution</div>
                ${window.powerAnalyzer.generatePowerZoneDoughnut(detailedPower)}
            `;
        }

        return "";
    }

    // ==================== BASIC DATA FALLBACK ====================

    renderBasicDataFallback(activity, classification) {
        const { hrDataType, powerDataType } = classification;
        const parts = [];

        // Only show basic data if no detailed data was shown
        const hasDetailedHR = hrDataType === "detailed";
        const hasDetailedPower = powerDataType === "detailed";

        if (!hasDetailedHR) {
            if (hrDataType === "basic") {
                parts.push(this.renderBasicHR(activity));
            } else if (hrDataType === "none") {
                parts.push(
                    this.renderMetricRow(
                        "HR Data",
                        '<span style="color:#ea4335">Not available</span>'
                    )
                );
            }
        }

        if (!hasDetailedPower && !hasDetailedHR) {
            if (powerDataType === "basic") {
                parts.push(this.renderBasicPower(activity));
            } else if (powerDataType === "none" && hrDataType !== "none") {
                parts.push(
                    this.renderMetricRow(
                        "Power Data",
                        '<span style="color:#ea4335">Not available</span>'
                    )
                );
            }
        }

        return parts.join("");
    }

    renderBasicHR(activity) {
        const zone = window.hrAnalyzer?.getZone(activity.avgHR) || "?";
        return `
            ${this.renderMetricRow("Avg HR", `${activity.avgHR} bpm (Zone ${zone})`)}
            ${this.renderMetricRow("Max HR", `${activity.maxHR} bpm`)}
        `;
    }

    renderBasicPower(activity) {
        const ftp = window.powerAnalyzer?.getFTP() ?? 0;
        const zone = this.getPowerZone(activity.avgWatts, ftp);
        return `
            ${this.renderMetricRow("Avg Power", `${activity.avgWatts} W (Zone ${zone})`)}
            ${this.renderMetricRow("Max Power", `${activity.maxWatts} W`)}
        `;
    }

    // ==================== HELPER METHODS ====================

    getDataTypes(activity) {
        return {
            hrDataType: !activity.avgHR
                ? "none"
                : !activity.hrStream
                  ? "basic"
                  : "detailed",
            powerDataType: !activity.avgPower
                ? "none"
                : !activity.powerStream
                  ? "basic"
                  : "detailed",
        };
    }

    getPowerZone(watts, ftp) {
        if (!ftp || ftp === 0) return "?";
        const percentage = (watts / ftp) * 100;
        if (percentage < 55) return "1";
        if (percentage < 75) return "2";
        if (percentage < 90) return "3";
        if (percentage < 105) return "4";
        if (percentage < 120) return "5";
        if (percentage < 150) return "6";
        return "7";
    }
}

// Initialize and export singleton
window.timelineChart = new TimelineChart();
