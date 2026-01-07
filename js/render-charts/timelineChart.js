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

        // Determine the appropriate method and renderer based on sport type
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
        const { category, isLong, powerDataType } = classification;
        const cssClass = window.runClassifier.getCategoryClass(category);

        const el = document.createElement("div");
        el.className = `run ${cssClass}`;

        const tooltip = this.createTooltip(activity, classification, sportType);

        let badges = "";

        // HR Data badges
        if (!activity.avgHR) {
            badges += '<span class="badge no-hr">No HR</span>';
        } else if (!activity.hrStream) {
            badges += '<span class="badge basic-hr">Basic HR</span>';
        } else if (activity.hrStream) {
            badges += '<span class="badge detailed-hr">Detailed HR</span>';
        }

        // Power Data badges
        if (powerDataType === "none") {
            badges += '<span class="badge no-power">No Power</span>';
        } else if (powerDataType === "basic") {
            badges += '<span class="badge basic-power">Basic Power</span>';
        } else if (powerDataType === "detailed") {
            badges +=
                '<span class="badge detailed-power">Detailed Power</span>';
        }

        if (sportType === "run") {
            const intervalInfo =
                window.intervalDetector.detectInterval(activity);

            // Interval badges
            if (intervalInfo.isInterval) {
                badges +=
                    '<span class="badge interval-badge">⚡ Interval</span>';
            }

            // Long Run badges
            if (classification.isLong) {
                badges += '<span class="badge long-run">Long Run</span>';
            }
        }

        el.innerHTML = `<span>${window.helpers.formatDateFull(activity.date)} — ${category}</span><span>${badges}<span class="badge">${(activity.distance ?? 0).toFixed(1)} km</span></span>${tooltip}`;

        // Improve tooltip hover behavior
        setTimeout(() => {
            const tooltipEl = el.querySelector(".tooltip");
            if (tooltipEl) {
                el.addEventListener("mouseleave", (e) => {
                    const toElement = e.relatedTarget;
                    if (toElement && tooltipEl.contains(toElement)) {
                        return;
                    }
                    tooltipEl.style.pointerEvents = "auto";
                });

                tooltipEl.addEventListener("mouseenter", () => {
                    tooltipEl.style.pointerEvents = "auto";
                });
            }
        }, 0);

        return el;
    }

    createTooltip(activity, classification, SportType, intervalInfo) {
        const {
            category,
            powerDataType,
            detailedPower,
            hrDataType,
            detailedHR,
        } = classification;

        let html = '<div class="tooltip">';

        html += `
      <div class="tooltip-row">
        <span class="tooltip-label">Type:</span>
        <span class="tooltip-value">${category}</span>
      </div>
      <div class="tooltip-row">
        <span class="tooltip-label">Distance:</span>
        <span class="tooltip-value">${(activity.distance ?? 0).toFixed(2)} km</span>
      </div>
    `;

        if (intervalInfo && intervalInfo.isInterval) {
            html += `
    <div class="tooltip-row" style="background: rgba(251, 188, 4, 0.1); padding: 4px; border-radius: 4px; margin: 8px 0;">
      <span class="tooltip-label">⚡ Intervals:</span>
      <span class="tooltip-value">${intervalInfo.details}</span>
    </div>
  `;
        }

        const avgSpeed = window.helpers.calculateAverageSpeed(activity);
        if (avgSpeed) {
            html += `
        <div class="tooltip-row">
          <span class="tooltip-label">Avg Speed:</span>
          <span class="tooltip-value">${avgSpeed.toFixed(1)} km/h</span>
        </div>
      `;
        }

        const ftp = window.powerAnalyzer?.getFTP() ?? 0;
        const riderWeight = window.settingsManager.getWeight();
        const maxHR = window.settingsManager.getMaxHR();
        const restingHR = window.settingsManager.getRestingHR();

        // Calculate advanced metrics if power data is available
        let advancedMetrics = null;
        if (powerDataType !== "none" && activity.avgPower) {
            advancedMetrics = window.advancedMetrics.calculateAllMetrics(
                activity,
                ftp,
                riderWeight
            );
        }

        // Display advanced power metrics
        if (advancedMetrics && Object.keys(advancedMetrics).length > 0) {
            html +=
                '<hr style="border:none;border-top:1px solid var(--border);margin:8px 0">';
            html +=
                '<div style="font-weight:600;margin:8px 0;">Training Metrics</div>';

            // TSS (most important metric)
            if (advancedMetrics.tss) {
                html += `
            <div class="tooltip-row highlight-metric">
              <span class="tooltip-label">TSS:</span>
              <span class="tooltip-value">${advancedMetrics.tss} <span style="opacity:0.7;font-size:0.85em;">(${advancedMetrics.tssCategory})</span></span>
            </div>
          `;
            }

            // Intensity Factor
            if (advancedMetrics.if) {
                html += `
            <div class="tooltip-row">
              <span class="tooltip-label">Intensity Factor:</span>
              <span class="tooltip-value">${advancedMetrics.if.toFixed(2)} <span style="opacity:0.7;font-size:0.85em;">(${advancedMetrics.ifCategory})</span></span>
            </div>
          `;
            }

            // Normalized Power
            if (advancedMetrics.np) {
                html += `
            <div class="tooltip-row">
              <span class="tooltip-label">Normalized Power:</span>
              <span class="tooltip-value">${advancedMetrics.np} W</span>
            </div>
          `;
            }

            // Variability Index
            if (advancedMetrics.vi) {
                const viDescription =
                    advancedMetrics.vi < 1.05
                        ? "Steady"
                        : advancedMetrics.vi < 1.1
                          ? "Variable"
                          : "Very Variable";
                html += `
            <div class="tooltip-row">
              <span class="tooltip-label">Variability:</span>
              <span class="tooltip-value">${advancedMetrics.vi.toFixed(2)} <span style="opacity:0.7;font-size:0.85em;">(${viDescription})</span></span>
            </div>
          `;
            }

            // Work (kJ)
            if (advancedMetrics.work) {
                html += `
            <div class="tooltip-row">
              <span class="tooltip-label">Work:</span>
              <span class="tooltip-value">${advancedMetrics.work} kJ <span style="opacity:0.7;font-size:0.85em;">(≈ ${advancedMetrics.work} kcal)</span></span>
            </div>
          `;
            }

            // W/kg if weight is available
            if (advancedMetrics.avgWkg) {
                html += `
            <div class="tooltip-row">
              <span class="tooltip-label">Power/Weight:</span>
              <span class="tooltip-value">${advancedMetrics.avgWkg.toFixed(2)} W/kg</span>
            </div>
          `;
            }

            if (advancedMetrics.npWkg) {
                html += `
            <div class="tooltip-row">
              <span class="tooltip-label">NP/Weight:</span>
              <span class="tooltip-value">${advancedMetrics.npWkg.toFixed(2)} W/kg</span>
            </div>
          `;
            }
        }
        // HR-based TSS for rides without power
        else if (
            hrDataType !== "none" &&
            activity.avgHR &&
            activity.movingTime
        ) {
            const maxHR = window.hrAnalyzer?.getMaxHR() ?? 190; // You'll need to add this
            const restingHR = window.hrAnalyzer?.getRestingHR() ?? 50; // You'll need to add this

            const hrTSS = window.hrBasedMetrics.calculateHRTSS(
                activity.movingTime,
                activity.avgHR,
                maxHR,
                restingHR
            );

            if (hrTSS) {
                html +=
                    '<hr style="border:none;border-top:1px solid var(--border);margin:8px 0">';
                html +=
                    '<div style="font-weight:600;margin:8px 0;">Training Metrics</div>';
                html += `
            <div class="tooltip-row highlight-metric">
              <span class="tooltip-label">hrTSS:</span>
              <span class="tooltip-value">${hrTSS} <span style="opacity:0.7;font-size:0.85em;">(HR-based)</span></span>
            </div>
          `;
            }
        }

        // Combined graph section (your existing code)
        const hasDetailedHR = hrDataType === "detailed" && detailedHR;
        const hasDetailedPower = powerDataType === "detailed" && detailedPower;

        if (hasDetailedHR || hasDetailedPower) {
            html +=
                '<hr style="border:none;border-top:1px solid var(--border);margin:8px 0">';

            // Always show graph when detailed data is available
            if (
                hasDetailedHR &&
                hasDetailedPower &&
                activity.powerStream &&
                activity.hrStream
            ) {
                // Combined HR+Power graph
                html += window.powerAnalyzer.generateHRPowerGraph(
                    activity.hrStream,
                    activity.powerStream
                );
            } else if (
                hasDetailedHR &&
                activity.hrStream &&
                activity.paceStream
            ) {
                html +=
                    '<hr style="border:none;border-top:1px solid var(--border);margin:8px 0">';
                html += window.hrAnalyzer.generateHRGraph(
                    detailedHR.hrRecords,
                    activity.paceStream.pace
                );

            } else if (hasDetailedHR && activity.hrStream) {
                // Just HR graph without power
                html += window.hrAnalyzer.generateHRGraph(detailedHR.hrRecords);
            } else if (hasDetailedPower && activity.powerStream) {
                // Just power graph without HR
                html += window.powerAnalyzer.generatePowerGraph(
                    activity.powerStream
                );
            }

            // Display doughnuts side by side if both exist
            if (hasDetailedHR && hasDetailedPower) {
                html +=
                    '<div style="font-weight:600;margin:16px 0 8px 0;">Zone Distribution</div>';
                html +=
                    '<div style="display:flex;gap:24px;justify-content:center;flex-wrap:wrap;">';
                html += '<div style="flex:1;min-width:250px;max-width:400px;">';
                html +=
                    '<div style="font-weight:600;margin-bottom:8px;text-align:center;color:#ea4335;">Heart Rate</div>';
                html += window.hrAnalyzer.generateHRZoneDoughnut(detailedHR);
                html += "</div>";
                html += '<div style="flex:1;min-width:250px;max-width:400px;">';
                html +=
                    '<div style="font-weight:600;margin-bottom:8px;text-align:center;color:#4285f4;">Power</div>';
                html +=
                    window.powerAnalyzer.generatePowerZoneDoughnut(
                        detailedPower
                    );
                html += "</div>";
                html += "</div>";
            } else if (hasDetailedHR) {
                html +=
                    '<div style="font-weight:600;margin:16px 0 8px 0;">Heart Rate Distribution</div>';
                html += window.hrAnalyzer.generateHRZoneDoughnut(detailedHR);
            } else if (hasDetailedPower) {
                html +=
                    '<div style="font-weight:600;margin:16px 0 8px 0;">Power Distribution</div>';
                html +=
                    window.powerAnalyzer.generatePowerZoneDoughnut(
                        detailedPower
                    );
            }
        }

        // Basic HR data (your existing code)
        if (hrDataType === "basic") {
            const zone = window.hrAnalyzer?.getZone(activity.avgHR) || "?";
            html += `
        <div class="tooltip-row">
          <span class="tooltip-label">Avg HR:</span>
          <span class="tooltip-value">${activity.avgHR} bpm (Zone ${zone})</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-label">Max HR:</span>
          <span class="tooltip-value">${activity.maxHR} bpm</span>
        </div>
      `;
        } else if (hrDataType === "none") {
            html += `
        <div class="tooltip-row">
          <span class="tooltip-label">HR Data:</span>
          <span class="tooltip-value" style="color:#ea4335">Not available</span>
        </div>
      `;
        }

        // Basic Power data (your existing code)
        if (powerDataType === "basic") {
            const zone = this.getPowerZone(activity.avgWatts, ftp);
            html += `
        <div class="tooltip-row">
          <span class="tooltip-label">Avg Power:</span>
          <span class="tooltip-value">${activity.avgWatts} W (Zone ${zone})</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-label">Max Power:</span>
          <span class="tooltip-value">${activity.maxWatts} W</span>
        </div>
      `;
        } else if (powerDataType === "none" && hrDataType !== "none") {
            html += `
        <div class="tooltip-row">
          <span class="tooltip-label">Power Data:</span>
          <span class="tooltip-value" style="color:#ea4335">Not available</span>
        </div>
      `;
        }

        html += "</div>";
        return html;
    }
}

// Initialize and export singleton
window.timelineChart = new TimelineChart();
