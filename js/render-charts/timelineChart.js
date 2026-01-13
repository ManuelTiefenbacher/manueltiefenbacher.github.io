class TimelineChart {
    constructor() {
        this.chart = null;
        this.currentPeriod = 28; // Default to 4 weeks
        this.cachedActivities = null; // Store activities for re-rendering
        this.periodPresets = [
            { label: "1 Week", days: 7 },
            { label: "2 Weeks", days: 14 },
            { label: "4 Weeks", days: 28 },
            { label: "8 Weeks", days: 56 },
            { label: "3 Months", days: 90 },
            { label: "6 Months", days: 180 },
        ];
    }

    // Create period selector buttons
    createPeriodSelector(sportType = "ride") {
        const containerId = `timelinePeriodSelector${sportType.charAt(0).toUpperCase() + sportType.slice(1)}`;
        let container = document.getElementById(containerId);

        if (!container) {
            const timeline = document.getElementById(
                `timeline${sportType.charAt(0).toUpperCase() + sportType.slice(1)}`
            );
            if (!timeline) return;

            container = document.createElement("div");
            container.id = containerId;
            container.style.cssText =
                "display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; justify-content: center; align-items: center;";
            timeline.parentNode.insertBefore(container, timeline);
        }

        container.innerHTML = "";
        const isPreset = this.periodPresets.some(
            (p) => p.days === this.currentPeriod
        );

        this.periodPresets.forEach((preset) => {
            const button = document.createElement("button");
            button.textContent = preset.label;
            button.style.cssText = `padding: 8px 16px; border: 1px solid #5f6368; border-radius: 4px; background: ${this.currentPeriod === preset.days ? "#4285f4" : "transparent"}; color: ${this.currentPeriod === preset.days ? "#fff" : "#e8eaed"}; cursor: pointer; font-size: 13px; font-family: system-ui, -apple-system, sans-serif; transition: all 0.2s;`;

            button.addEventListener("mouseenter", () => {
                if (this.currentPeriod !== preset.days)
                    button.style.background = "rgba(66, 133, 244, 0.1)";
            });
            button.addEventListener("mouseleave", () => {
                if (this.currentPeriod !== preset.days)
                    button.style.background = "transparent";
            });
            button.addEventListener("click", () => {
                this.currentPeriod = preset.days;
                // Don't call createPeriodSelector here to avoid infinite loop
                // Just re-render with the new period
                const canvasId = `timeline${sportType.charAt(0).toUpperCase() + sportType.slice(1)}`;
                const canvas = document.getElementById(canvasId);
                if (!canvas) return;

                canvas.innerHTML = "";
                const recent = (this.cachedActivities || []).filter(
                    (a) => window.helpers.daysAgo(a.date) <= this.currentPeriod
                );
                const sorted = [...recent].sort((a, b) => b.date - a.date);

                const methodMap = {
                    ride: {
                        classifier: "classifyRide",
                        renderer: window.runClassifier,
                    },
                    run: {
                        classifier: "classifyRun",
                        renderer: window.runClassifier,
                    },
                    swim: {
                        classifier: "classifySwim",
                        renderer: window.runClassifier,
                    },
                };

                const methods = methodMap[sportType.toLowerCase()];
                if (methods) {
                    sorted.forEach((activity) => {
                        const classification =
                            methods.renderer[methods.classifier](activity);
                        const el = this.createElement(
                            activity,
                            classification,
                            sportType
                        );
                        canvas.appendChild(el);
                    });
                }

                // Update button states
                this.createPeriodSelector(sportType);
            });
            container.appendChild(button);
        });

        // Custom input
        const customWrapper = document.createElement("div");
        customWrapper.style.cssText =
            "display: flex; gap: 4px; align-items: center;";

        const customLabel = document.createElement("span");
        customLabel.textContent = "Custom:";
        customLabel.style.cssText =
            "color: #e8eaed; font-size: 13px; font-family: system-ui, -apple-system, sans-serif;";

        const customInput = document.createElement("input");
        customInput.type = "number";
        customInput.min = "1";
        customInput.max = "365";
        customInput.placeholder = "Days";
        customInput.style.cssText = `width: 70px; padding: 8px 12px; border: 1px solid #5f6368; border-radius: 4px; background: ${!isPreset ? "#4285f4" : "transparent"}; color: #e8eaed; font-size: 13px; font-family: system-ui, -apple-system, sans-serif; text-align: center;`;
        if (!isPreset) customInput.value = this.currentPeriod;

        const daysLabel = document.createElement("span");
        daysLabel.textContent = "days";
        daysLabel.style.cssText =
            "color: #e8eaed; font-size: 13px; font-family: system-ui, -apple-system, sans-serif;";

        const applyButton = document.createElement("button");
        applyButton.textContent = "Apply";
        applyButton.style.cssText =
            "padding: 8px 16px; border: 1px solid #5f6368; border-radius: 4px; background: transparent; color: #e8eaed; cursor: pointer; font-size: 13px; font-family: system-ui, -apple-system, sans-serif; transition: all 0.2s;";

        applyButton.addEventListener(
            "mouseenter",
            () => (applyButton.style.background = "rgba(66, 133, 244, 0.1)")
        );
        applyButton.addEventListener(
            "mouseleave",
            () => (applyButton.style.background = "transparent")
        );

        const applyCustomPeriod = () => {
            const days = parseInt(customInput.value);
            if (days && days > 0 && days <= 365) {
                this.currentPeriod = days;

                // Re-render activities with new period
                const canvasId = `timeline${sportType.charAt(0).toUpperCase() + sportType.slice(1)}`;
                const canvas = document.getElementById(canvasId);
                if (!canvas) return;

                canvas.innerHTML = "";
                const recent = (this.cachedActivities || []).filter(
                    (a) => window.helpers.daysAgo(a.date) <= this.currentPeriod
                );
                const sorted = [...recent].sort((a, b) => b.date - a.date);

                const methodMap = {
                    ride: {
                        classifier: "classifyRide",
                        renderer: window.runClassifier,
                    },
                    run: {
                        classifier: "classifyRun",
                        renderer: window.runClassifier,
                    },
                    swim: {
                        classifier: "classifySwim",
                        renderer: window.runClassifier,
                    },
                };

                const methods = methodMap[sportType.toLowerCase()];
                if (methods) {
                    sorted.forEach((activity) => {
                        const classification =
                            methods.renderer[methods.classifier](activity);
                        const el = this.createElement(
                            activity,
                            classification,
                            sportType
                        );
                        canvas.appendChild(el);
                    });
                }

                // Update button states
                this.createPeriodSelector(sportType);
            } else {
                customInput.style.borderColor = "#ea4335";
                setTimeout(
                    () => (customInput.style.borderColor = "#5f6368"),
                    1000
                );
            }
        };

        applyButton.addEventListener("click", applyCustomPeriod);
        customInput.addEventListener("keypress", (e) => {
            if (e.key === "Enter") applyCustomPeriod();
        });

        customWrapper.appendChild(customLabel);
        customWrapper.appendChild(customInput);
        customWrapper.appendChild(daysLabel);
        customWrapper.appendChild(applyButton);
        container.appendChild(customWrapper);
    }

    renderChart(activities, sportType = "ride") {
        // Cache activities for re-rendering (only if new activities provided)
        if (activities !== null && activities !== undefined) {
            this.cachedActivities = activities;
        }

        // Create period selector first
        this.createPeriodSelector(sportType);

        const canvasId = `timeline${sportType.charAt(0).toUpperCase() + sportType.slice(1)}`;
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        canvas.innerHTML = "";

        // Use cached activities for filtering
        const recent = (this.cachedActivities || []).filter(
            (a) => window.helpers.daysAgo(a.date) <= this.currentPeriod
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

        el.innerHTML = `<span>${window.helpers.formatDateFull(activity.date)} — ${category}</span><span>${badges}<span class="badge">${(activity.distance ?? 0).toFixed(1)} km</span></span>${tooltip}`;
        this.attachTooltipBehavior(el);
        return el;
    }

    createBadges(activity, classification, sportType, intervalInfo) {
        const badges = [];
        badges.push(this.createHRBadge(activity));
        if (sportType !== "run")
            badges.push(this.createPowerBadge(classification.powerDataType));
        if (sportType === "run") {
            if (intervalInfo?.isInterval)
                badges.push(
                    '<span class="badge interval-badge">⚡ Interval</span>'
                );
            if (classification.isLong)
                badges.push('<span class="badge long-run">Long Run</span>');
        }
        return badges.join("");
    }

    createHRBadge(activity) {
        if (!activity.avgHR) return '<span class="badge no-hr">No HR</span>';
        else if (!activity.hrStream)
            return '<span class="badge basic-hr">Basic HR</span>';
        else return '<span class="badge detailed-hr">Detailed HR</span>';
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
                hideTimeout = setTimeout(
                    () => (tooltipEl.style.display = "none"),
                    100
                );
            });
            tooltipEl.addEventListener("mouseenter", () => {
                if (hideTimeout) {
                    clearTimeout(hideTimeout);
                    hideTimeout = null;
                }
                tooltipEl.style.pointerEvents = "auto";
            });
            tooltipEl.addEventListener("mouseleave", () => {
                hideTimeout = setTimeout(
                    () => (tooltipEl.style.display = "none"),
                    100
                );
            });
        }, 0);
    }

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

    renderBasicInfo(activity, classification, sportType, intervalInfo) {
        const duration = this.formatDuration(activity.duration ?? 0);
        const distance = (activity.distance ?? 0).toFixed(2);
        let html = `<div class="tooltip-row"><span class="tooltip-label">Type:</span><span class="tooltip-value">${classification.category}</span></div><div class="tooltip-row"><span class="tooltip-label">Duration:</span><span class="tooltip-value">${duration}</span></div><div class="tooltip-row"><span class="tooltip-label">Distance:</span><span class="tooltip-value">${distance} km</span></div>`;
        if (intervalInfo?.isInterval)
            html += this.renderIntervalInfo(intervalInfo);
        html += this.renderSpeedOrPace(activity, sportType);
        return html;
    }

    formatDuration(duration) {
        const minutes = Math.floor(duration);
        const seconds = Math.round((duration - minutes) * 60);
        return `${minutes}:${seconds.toString().padStart(2, "0")} minutes`;
    }

    renderIntervalInfo(intervalInfo) {
        return `<div class="tooltip-row" style="background: rgba(251, 188, 4, 0.1); padding: 4px; border-radius: 4px; margin: 8px 0;"><span class="tooltip-label">⚡ Intervals:</span><span class="tooltip-value">${intervalInfo.details}</span></div>`;
    }

    renderSpeedOrPace(activity, sportType) {
        const avgSpeed = window.helpers.calculateAverageSpeed(activity);
        const avgPace = window.helpers.calculateAveragePace(activity);
        if (avgSpeed && sportType === "ride")
            return `<div class="tooltip-row"><span class="tooltip-label">Avg Speed:</span><span class="tooltip-value">${avgSpeed.toFixed(1)} km/h</span></div>`;
        if (avgPace && sportType === "run")
            return `<div class="tooltip-row"><span class="tooltip-label">Avg Pace:</span><span class="tooltip-value">${avgPace.toFixed(1)} km/h</span></div>`;
        return "";
    }

    renderSportSpecificMetrics(activity, classification, sportType) {
        if (sportType === "run") return this.renderRunningMetrics(activity);
        else return this.renderCyclingMetrics(activity, classification);
    }

    renderRunningMetrics(activity) {
        const thresholdPace = 5;
        const maxHR = window.settingsManager.getMaxHR();
        const restingHR = window.settingsManager.getRestingHR();
        if (!activity.paceStream && !activity.avgPace && !activity.avgHR)
            return "";
        const runningMetrics =
            window.advancedRunningMetrics.calculateAllMetrics(
                activity,
                thresholdPace,
                maxHR,
                restingHR
            );
        if (!runningMetrics || Object.keys(runningMetrics).length === 0)
            return "";
        return `<hr style="border:none;border-top:1px solid var(--border);margin:8px 0"><div style="font-weight:600;margin:8px 0;">Running Metrics</div>${this.renderRunningTrainingMetrics(runningMetrics)}${this.renderRunningDynamics(runningMetrics)}`;
    }

    renderRunningTrainingMetrics(metrics) {
        const parts = [];
        if (metrics.rTSS)
            parts.push(this.renderMetricRow("rTSS", metrics.rTSS, true));
        else if (metrics.hrTSS)
            parts.push(
                this.renderMetricRow(
                    "hrTSS",
                    `${metrics.hrTSS} <span style="opacity:0.7;font-size:0.85em;">(HR-based)</span>`,
                    true
                )
            );
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
        if (metrics.ef)
            parts.push(
                this.renderMetricRow("Efficiency Factor", metrics.ef.toFixed(2))
            );
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
        if (metrics.avgCadence)
            parts.push(
                this.renderMetricRow(
                    "Cadence",
                    `${metrics.avgCadence} spm <span style="opacity:0.7;font-size:0.85em;">(${metrics.cadenceCategory})</span>`
                )
            );
        if (metrics.avgStrideLength)
            parts.push(
                this.renderMetricRow(
                    "Stride Length",
                    `${metrics.avgStrideLength} m`
                )
            );
        if (metrics.avgVO)
            parts.push(
                this.renderMetricRow(
                    "Vert. Oscillation",
                    `${metrics.avgVO} cm <span style="opacity:0.7;font-size:0.85em;">(${metrics.voCategory})</span>`
                )
            );
        if (metrics.avgGCT)
            parts.push(
                this.renderMetricRow(
                    "Ground Contact",
                    `${metrics.avgGCT} ms <span style="opacity:0.7;font-size:0.85em;">(${metrics.gctCategory})</span>`
                )
            );
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

    renderCyclingMetrics(activity, classification) {
        const { powerDataType } = classification;
        const ftp = window.powerAnalyzer?.getFTP() ?? 0;
        const riderWeight = window.settingsManager.getWeight();
        if (powerDataType !== "none" && activity.avgPower) {
            const advancedMetrics = window.advancedMetrics.calculateAllMetrics(
                activity,
                ftp,
                riderWeight
            );
            if (advancedMetrics && Object.keys(advancedMetrics).length > 0)
                return this.renderPowerBasedMetrics(advancedMetrics);
        }
        return this.renderHRBasedTSS(activity);
    }

    renderPowerBasedMetrics(metrics) {
        const parts = [
            '<hr style="border:none;border-top:1px solid var(--border);margin:8px 0">',
            '<div style="font-weight:600;margin:8px 0;">Training Metrics</div>',
        ];
        if (metrics.tss)
            parts.push(
                this.renderMetricRow(
                    "TSS",
                    `${metrics.tss} <span style="opacity:0.7;font-size:0.85em;">(${metrics.tssCategory})</span>`,
                    true
                )
            );
        if (metrics.if)
            parts.push(
                this.renderMetricRow(
                    "Intensity Factor",
                    `${metrics.if.toFixed(2)} <span style="opacity:0.7;font-size:0.85em;">(${metrics.ifCategory})</span>`
                )
            );
        if (metrics.np)
            parts.push(
                this.renderMetricRow("Normalized Power", `${metrics.np} W`)
            );
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
        if (metrics.work)
            parts.push(
                this.renderMetricRow(
                    "Work",
                    `${metrics.work} kJ <span style="opacity:0.7;font-size:0.85em;">(≈ ${Math.round(metrics.work / 4.184)} kcal)</span>`
                )
            );
        if (metrics.avgWkg)
            parts.push(
                this.renderMetricRow(
                    "Power/Weight",
                    `${metrics.avgWkg.toFixed(2)} W/kg`
                )
            );
        if (metrics.npWkg)
            parts.push(
                this.renderMetricRow(
                    "NP/Weight",
                    `${metrics.npWkg.toFixed(2)} W/kg`
                )
            );
        return parts.join("");
    }

    renderHRBasedTSS(activity) {
        const { hrDataType } = this.getDataTypes(activity);
        if (hrDataType === "none" || !activity.avgHR || !activity.movingTime)
            return "";
        const maxHR = window.hrAnalyzer?.getMaxHR() ?? 190;
        const restingHR = window.hrAnalyzer?.getRestingHR() ?? 50;
        const hrTSS = window.hrBasedMetrics.calculateHRTSS(
            activity.movingTime,
            activity.avgHR,
            maxHR,
            restingHR
        );
        if (!hrTSS) return "";
        return `<hr style="border:none;border-top:1px solid var(--border);margin:8px 0"><div style="font-weight:600;margin:8px 0;">Training Metrics</div>${this.renderMetricRow("hrTSS", `${hrTSS} <span style="opacity:0.7;font-size:0.85em;">(HR-based)</span>`, true)}`;
    }

    renderMetricRow(label, value, highlight = false) {
        const className = highlight
            ? "tooltip-row highlight-metric"
            : "tooltip-row";
        return `<div class="${className}"><span class="tooltip-label">${label}:</span><span class="tooltip-value">${value}</span></div>`;
    }

    renderDetailedDataGraphs(activity, classification) {
        const { hrDataType, detailedHR, powerDataType, detailedPower } =
            classification;
        const hasDetailedHR = hrDataType === "detailed" && detailedHR;
        const hasDetailedPower = powerDataType === "detailed" && detailedPower;
        if (!hasDetailedHR && !hasDetailedPower) return "";
        return `<hr style="border:none;border-top:1px solid var(--border);margin:8px 0">${this.renderGraphs(activity, hasDetailedHR, hasDetailedPower)}${this.renderZoneDoughnuts(activity, hasDetailedHR, hasDetailedPower, detailedHR, detailedPower)}`;
    }

    renderGraphs(activity, hasDetailedHR, hasDetailedPower) {
        if (
            hasDetailedHR &&
            hasDetailedPower &&
            activity.powerStream &&
            activity.hrStream
        )
            return window.powerAnalyzer.generateHRPowerGraph(
                activity.hrStream,
                activity.powerStream
            );
        if (hasDetailedHR && activity.hrStream && activity.paceStream)
            return window.hrAnalyzer.generateHRGraph(
                activity.hrStream.heartrate,
                activity.paceStream.pace
            );
        if (hasDetailedHR && activity.hrStream)
            return window.hrAnalyzer.generateHRGraph(activity.hrStream);
        if (hasDetailedPower && activity.powerStream)
            return window.powerAnalyzer.generatePowerGraph(
                activity.powerStream
            );
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
            return `<div style="font-weight:600;margin:16px 0 8px 0;">Zone Distribution</div><div style="display:flex;gap:24px;justify-content:center;flex-wrap:wrap;"><div style="flex:1;min-width:250px;max-width:400px;"><div style="font-weight:600;margin-bottom:8px;text-align:center;color:#ea4335;">Heart Rate</div>${window.hrAnalyzer.generateHRZoneDoughnut(detailedHR)}</div><div style="flex:1;min-width:250px;max-width:400px;"><div style="font-weight:600;margin-bottom:8px;text-align:center;color:#4285f4;">Power</div>${window.powerAnalyzer.generatePowerZoneDoughnut(detailedPower)}</div></div>`;
        }
        if (hasDetailedHR)
            return `<div style="font-weight:600;margin:16px 0 8px 0;">Heart Rate Distribution</div>${window.hrAnalyzer.generateHRZoneDoughnut(detailedHR)}`;
        if (hasDetailedPower)
            return `<div style="font-weight:600;margin:16px 0 8px 0;">Power Distribution</div>${window.powerAnalyzer.generatePowerZoneDoughnut(detailedPower)}`;
        return "";
    }

    renderBasicDataFallback(activity, classification) {
        const { hrDataType, powerDataType } = classification;
        const parts = [];
        const hasDetailedHR = hrDataType === "detailed";
        const hasDetailedPower = powerDataType === "detailed";
        if (!hasDetailedHR) {
            if (hrDataType === "basic")
                parts.push(this.renderBasicHR(activity));
            else if (hrDataType === "none")
                parts.push(
                    this.renderMetricRow(
                        "HR Data",
                        '<span style="color:#ea4335">Not available</span>'
                    )
                );
        }
        if (!hasDetailedPower && !hasDetailedHR) {
            if (powerDataType === "basic")
                parts.push(this.renderBasicPower(activity));
            else if (powerDataType === "none" && hrDataType !== "none")
                parts.push(
                    this.renderMetricRow(
                        "Power Data",
                        '<span style="color:#ea4335">Not available</span>'
                    )
                );
        }
        return parts.join("");
    }

    renderBasicHR(activity) {
        const zone = window.hrAnalyzer?.getZone(activity.avgHR) || "?";
        return `${this.renderMetricRow("Avg HR", `${activity.avgHR} bpm (Zone ${zone})`)}${this.renderMetricRow("Max HR", `${activity.maxHR} bpm`)}`;
    }

    renderBasicPower(activity) {
        const ftp = window.powerAnalyzer?.getFTP() ?? 0;
        const zone = this.getPowerZone(activity.avgWatts, ftp);
        return `${this.renderMetricRow("Avg Power", `${activity.avgWatts} W (Zone ${zone})`)}${this.renderMetricRow("Max Power", `${activity.maxWatts} W`)}`;
    }

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

window.timelineChart = new TimelineChart();
