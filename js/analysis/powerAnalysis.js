// js/analysis/powerAnalysis.js
// Cycling power analysis - TSS, Normalized Power, FTP estimation

class PowerAnalyzer {
    constructor(dataProcessor) {
        this.dataProcessor = dataProcessor;
        this.ftp = 200; // Default FTP in watts
    }

    /**
     * Calculate Normalized Power (NP)
     * NP is a 30-second rolling average raised to the 4th power, then averaged and rooted
     */
    calculateNormalizedPower(powerStream) {
        if (
            !powerStream ||
            !powerStream.watts ||
            powerStream.watts.length < 30
        ) {
            return null;
        }

        const watts = powerStream.watts.filter((w) => w >= 0);
        if (watts.length < 30) return null;

        // Calculate 30-second rolling average
        const rollingAvg = [];
        const windowSize = 30;

        for (let i = 0; i < watts.length; i++) {
            const start = Math.max(0, i - Math.floor(windowSize / 2));
            const end = Math.min(watts.length, i + Math.ceil(windowSize / 2));
            const window = watts.slice(start, end);
            const avg = window.reduce((sum, w) => sum + w, 0) / window.length;
            rollingAvg.push(avg);
        }

        // Raise each value to the 4th power
        const fourthPower = rollingAvg.map((w) => Math.pow(w, 4));

        // Average and take 4th root
        const avgFourthPower =
            fourthPower.reduce((sum, w) => sum + w, 0) / fourthPower.length;
        const np = Math.pow(avgFourthPower, 0.25);

        return Math.round(np);
    }

    /**
     * Calculate Intensity Factor (IF)
     * IF = NP / FTP
     */
    calculateIntensityFactor(normalizedPower, ftp = null) {
        const ftpValue = ftp || this.ftp;
        if (!normalizedPower || !ftpValue || ftpValue === 0) return null;
        return normalizedPower / ftpValue;
    }

    /**
     * Calculate Training Stress Score (TSS)
     * TSS = (duration_seconds × NP × IF) / (FTP × 3600) × 100
     */
    calculateTSS(normalizedPower, duration, ftp = null) {
        const ftpValue = ftp || this.ftp;
        if (!normalizedPower || !duration || !ftpValue || ftpValue === 0)
            return null;

        const intensityFactor = this.calculateIntensityFactor(
            normalizedPower,
            ftpValue
        );
        if (!intensityFactor) return null;

        const durationSeconds = duration * 60; // convert minutes to seconds
        const tss =
            ((durationSeconds * normalizedPower * intensityFactor) /
                (ftpValue * 3600)) *
            100;

        return Math.round(tss);
    }

    /**
     * Calculate Variability Index (VI)
     * VI = NP / Average Power
     */
    calculateVariabilityIndex(normalizedPower, avgPower) {
        if (!normalizedPower || !avgPower || avgPower === 0) return null;
        return normalizedPower / avgPower;
    }

    /**
     * Estimate FTP from best 20-minute power
     * FTP ≈ 95% of 20-minute average power
     */
    estimateFTPFrom20Min(powerStream) {
        if (!powerStream || !powerStream.watts || !powerStream.time) {
            return null;
        }

        const watts = powerStream.watts;
        const time = powerStream.time;

        if (watts.length < 1200) return null; // Need at least 20 minutes of data

        // Find best 20-minute average (1200 seconds)
        let bestAvg = 0;
        const windowSize = 1200;

        for (let i = 0; i <= time.length - windowSize; i++) {
            const endTime = time[i] + windowSize;
            let endIndex = i;

            // Find end index
            while (endIndex < time.length && time[endIndex] < endTime) {
                endIndex++;
            }

            if (endIndex - i >= 1200) {
                const windowWatts = watts.slice(i, endIndex);
                const avg =
                    windowWatts.reduce((sum, w) => sum + w, 0) /
                    windowWatts.length;
                if (avg > bestAvg) {
                    bestAvg = avg;
                }
            }
        }

        // FTP is approximately 95% of 20-minute power
        return bestAvg > 0 ? Math.round(bestAvg * 0.95) : null;
    }

    /**
     * Estimate FTP from best 5-minute power (for VO2max efforts)
     * Less accurate but useful when no 20-min efforts available
     */
    estimateFTPFrom5Min(powerStream) {
        if (!powerStream || !powerStream.watts || !powerStream.time) {
            return null;
        }

        const watts = powerStream.watts;
        const time = powerStream.time;

        if (watts.length < 300) return null; // Need at least 5 minutes

        // Find best 5-minute average
        let bestAvg = 0;
        const windowSize = 300;

        for (let i = 0; i <= time.length - windowSize; i++) {
            const endTime = time[i] + windowSize;
            let endIndex = i;

            while (endIndex < time.length && time[endIndex] < endTime) {
                endIndex++;
            }

            if (endIndex - i >= 300) {
                const windowWatts = watts.slice(i, endIndex);
                const avg =
                    windowWatts.reduce((sum, w) => sum + w, 0) /
                    windowWatts.length;
                if (avg > bestAvg) {
                    bestAvg = avg;
                }
            }
        }

        // FTP is approximately 76% of 5-minute power
        return bestAvg > 0 ? Math.round(bestAvg * 0.76) : null;
    }

    /**
     * Scan all rides to estimate FTP
     */
    estimateFTP() {
        const rides = this.dataProcessor.rides.filter(
            (r) =>
                r.powerStream &&
                r.powerStream.watts &&
                r.powerStream.watts.length > 300
        );

        if (rides.length === 0) {
            console.log("No rides with power data found");
            return null;
        }

        let best20Min = 0;
        let best5Min = 0;

        rides.forEach((ride) => {
            const ftp20 = this.estimateFTPFrom20Min(ride.powerStream);
            const ftp5 = this.estimateFTPFrom5Min(ride.powerStream);

            if (ftp20 && ftp20 > best20Min) {
                best20Min = ftp20;
            }
            if (ftp5 && ftp5 > best5Min) {
                best5Min = ftp5;
            }
        });

        // Prefer 20-minute estimate if available
        const estimatedFTP = best20Min > 0 ? best20Min : best5Min;

        if (estimatedFTP > 0) {
            this.ftp = estimatedFTP;
            console.log(`💪 Estimated FTP: ${estimatedFTP}W`);
            document.getElementById("estimatedFTP").textContent =
                `${estimatedFTP}W`;
            return estimatedFTP;
        }

        return null;
    }

    /**
     * Analyze a single ride's power data
     */
    analyzeRide(ride) {
        if (!ride.powerStream || !ride.powerStream.watts) {
            return {
                hasData: false,
                avgPower: ride.avgPower || null,
                maxPower: ride.maxPower || null,
            };
        }

        const np = this.calculateNormalizedPower(ride.powerStream);
        const vi = this.calculateVariabilityIndex(np, ride.avgPower);
        const intensityFactor = this.calculateIntensityFactor(np);
        const tss = this.calculateTSS(np, ride.duration);

        return {
            hasData: true,
            avgPower: ride.avgPower,
            maxPower: ride.maxPower,
            normalizedPower: np,
            variabilityIndex: vi,
            intensityFactor: intensityFactor,
            tss: tss,
            ftp: this.ftp,
        };
    }

    /**
     * Get power zone for a given wattage
     */
    getPowerZone(watts) {
        const ftp = this.ftp;
        const percentage = (watts / ftp) * 100;

        if (percentage < 55) return 1; // Active Recovery
        if (percentage < 75) return 2; // Endurance
        if (percentage < 90) return 3; // Tempo
        if (percentage < 105) return 4; // Lactate Threshold
        if (percentage < 120) return 5; // VO2 Max
        return 6; // Anaerobic Capacity
    }

    /**
     * Get power zone label
     */
    getPowerZoneLabel(zone) {
        const labels = {
            1: "Z1: Active Recovery (<55% FTP)",
            2: "Z2: Endurance (55-75% FTP)",
            3: "Z3: Tempo (75-90% FTP)",
            4: "Z4: Threshold (90-105% FTP)",
            5: "Z5: VO2 Max (105-120% FTP)",
            6: "Z6: Anaerobic (>120% FTP)",
        };
        return labels[zone] || "Unknown";
    }

    /**
     * Calculate power zone distribution for a ride
     */
    analyzePowerZoneDistribution(powerStream) {
        if (!powerStream || !powerStream.watts) {
            return null;
        }

        const watts = powerStream.watts.filter((w) => w >= 0);
        if (watts.length === 0) return null;

        const counts = { z1: 0, z2: 0, z3: 0, z4: 0, z5: 0, z6: 0 };

        watts.forEach((w) => {
            const zone = this.getPowerZone(w);
            counts[`z${zone}`]++;
        });

        const total = watts.length;
        const percentages = {};

        for (let zone in counts) {
            percentages[zone] = (counts[zone] / total) * 100;
        }

        return {
            percentages,
            counts,
            totalDataPoints: total,
        };
    }

    /**
     * Set FTP manually
     */
    setFTP(ftp) {
        if (ftp > 0 && ftp < 600) {
            this.ftp = ftp;
            console.log(`FTP set to ${ftp}W`);
            return true;
        }
        return false;
    }

    /**
     * Get FTP
     */
    getFTP() {
        return this.ftp;
    }

    calculateWeeklyPowerData(activities) {
        const weekMap = new Map();
        const ftp = window.powerAnalyzer.getFTP() ?? 0;

        (activities || []).forEach((activity) => {
            const weekStart = window.helpers.getWeekStart(activity.date);
            const weekKey = weekStart.toISOString().split("T")[0];

            if (!weekMap.has(weekKey)) {
                weekMap.set(weekKey, {
                    weekStart,
                    total: 0,
                    z1: 0,
                    z2: 0,
                    z3: 0,
                    z4: 0,
                    z5: 0,
                    z6: 0,
                    noPower: 0,
                    speeds: [],
                    totalDuration: 0,
                    ftpEstimates: [],
                    ridesWithPower: [],
                });
            }

            const weekData = weekMap.get(weekKey);
            weekData.total += activity.distance || 0;
            weekData.totalDuration += activity.duration || 0;

            const avgSpeed = window.helpers.calculateAverageSpeed(activity);
            if (avgSpeed) weekData.speeds.push(avgSpeed);

            if (
                activity.powerStream &&
                activity.powerStream.watts &&
                activity.powerStream.watts.length > 300
            ) {
                weekData.ridesWithPower.push(activity);

                let ftpEstimate = window.powerAnalyzer.estimateFTPFrom20Min(
                    activity.powerStream
                );
                if (!ftpEstimate || ftpEstimate === 0) {
                    ftpEstimate = window.powerAnalyzer.estimateFTPFrom5Min(
                        activity.powerStream
                    );
                }
                if (ftpEstimate && ftpEstimate > 0) {
                    weekData.ftpEstimates.push(ftpEstimate);
                }
            }

            const hasPowerData = activity.powerStream;

            if (!hasPowerData) {
                weekData.noPower += activity.distance || 0;
            } else if (
                activity.powerStream &&
                activity.powerStream.watts.length > 0
            ) {
                const analysis = this.analyzePowerStream(
                    activity.powerStream,
                    ftp
                );
                if (analysis) {
                    weekData.z1 +=
                        (activity.distance || 0) * (analysis.percentZ1 / 100);
                    weekData.z2 +=
                        (activity.distance || 0) * (analysis.percentZ2 / 100);
                    weekData.z3 +=
                        (activity.distance || 0) * (analysis.percentZ3 / 100);
                    weekData.z4 +=
                        (activity.distance || 0) * (analysis.percentZ4 / 100);
                    weekData.z5 +=
                        (activity.distance || 0) * (analysis.percentZ5 / 100);
                    weekData.z6 +=
                        (activity.distance || 0) * (analysis.percentZ6 / 100);
                }
            } else if (activity.avgPower) {
                const zone = this.getPowerZone(activity.avgWatts, ftp);
                const zoneKey = `z${zone}`;
                weekData[zoneKey] += activity.distance || 0;
            }
        });

        const result = Array.from(weekMap.values()).map((week) => ({
            ...week,
            avgSpeed:
                week.speeds.length > 0
                    ? week.speeds.reduce((sum, s) => sum + s, 0) /
                      week.speeds.length
                    : null,
            estimatedFTP:
                week.ftpEstimates.length > 0
                    ? Math.max(...week.ftpEstimates)
                    : null,
        }));

        return result.sort((a, b) => a.weekStart - b.weekStart);
    }

    analyzePowerStream(powerStream, ftp) {
        if (!powerStream || powerStream.watts.length === 0 || !ftp || ftp === 0)
            return null;

        const zones = { z1: 0, z2: 0, z3: 0, z4: 0, z5: 0, z6: 0 };
        powerStream.watts.forEach((watts) => {
            const zone = this.getPowerZone(watts, ftp);
            zones[`z${zone}`]++;
        });

        const total = powerStream.watts.length;
        return {
            percentZ1: (zones.z1 / total) * 100,
            percentZ2: (zones.z2 / total) * 100,
            percentZ3: (zones.z3 / total) * 100,
            percentZ4: (zones.z4 / total) * 100,
            percentZ5: (zones.z5 / total) * 100,
            percentZ6: (zones.z6 / total) * 100,
        };
    }

    calculatePowerZoneDistribution(activities) {
        const ftp = window.powerAnalyzer.getFTP() ?? 0;
        const zones = { z1: 0, z2: 0, z3: 0, z4: 0, z5: 0, z6: 0 };
        const distances = { z1: 0, z2: 0, z3: 0, z4: 0, z5: 0, z6: 0 };
        let totalDataPoints = 0;

        (activities || []).forEach((activity) => {
            if (activity.powerStream && activity.powerStream.watts.length > 0) {
                activity.powerStream.watts.forEach((watts) => {
                    const zone = this.getPowerZone(watts, ftp);
                    zones[`z${zone}`]++;
                    totalDataPoints++;
                });

                const analysis = this.analyzePowerStream(
                    activity.powerStream,
                    ftp
                );
                if (analysis && activity.distance) {
                    distances.z1 +=
                        (activity.distance * analysis.percentZ1) / 100;
                    distances.z2 +=
                        (activity.distance * analysis.percentZ2) / 100;
                    distances.z3 +=
                        (activity.distance * analysis.percentZ3) / 100;
                    distances.z4 +=
                        (activity.distance * analysis.percentZ4) / 100;
                    distances.z5 +=
                        (activity.distance * analysis.percentZ5) / 100;
                    distances.z6 +=
                        (activity.distance * analysis.percentZ6) / 100;
                }
            }
        });

        const percentages = {};
        Object.keys(zones).forEach((z) => {
            percentages[z] =
                totalDataPoints > 0 ? (zones[z] / totalDataPoints) * 100 : 0;
        });

        return { percentages, distances, totalDataPoints };
    }

    generatePowerGraph(powerStream) {
        if (!powerStream || !powerStream.watts) return "";

        const getGraphWidth = () => {
            const screenWidth =
                window.innerWidth || document.documentElement.clientWidth;
            const containerWidth = screenWidth - 50;
            if (containerWidth >= 600) return 600;
            if (containerWidth < 400) return 400;
            return containerWidth;
        };

        const width = getGraphWidth();
        const height = 220;
        const ftp = window.powerAnalyzer.getFTP();

        const padding = 30;
        const topPadding = 40;
        const rightPadding = 50;
        const bottomPadding = 20;
        const graphWidth = width - padding - rightPadding;
        const graphHeight = height - topPadding - bottomPadding;

        const originalLen = powerStream.watts.length;
        const step = originalLen > 200 ? Math.ceil(originalLen / 200) : 1;
        let sampledWatts = powerStream.watts;
        if (step > 1)
            sampledWatts = powerStream.watts.filter((_, i) => i % step === 0);

        const timeArr = Array.isArray(powerStream.time)
            ? powerStream.time
            : null;
        const hz = powerStream.hz || 1;

        let totalSeconds, secondsForIndex;
        if (timeArr && timeArr.length >= originalLen) {
            const t0 = timeArr[0],
                t1 = timeArr[originalLen - 1];
            totalSeconds = Math.max(0, t1 - t0);
            secondsForIndex = (i) =>
                timeArr[Math.min(originalLen - 1, i * step)] - t0;
        } else {
            totalSeconds = originalLen / hz;
            secondsForIndex = (i) => (i * step) / hz;
        }

        const xForIndex = (i) =>
            padding + (i / (sampledWatts.length - 1)) * graphWidth;

        const validWatts = sampledWatts.filter((w) => w >= 0 && w < 2000);
        const minWatts = 0;
        const maxWatts = Math.max(...validWatts, ftp * 1.5);
        const wattsRange = maxWatts - minWatts;

        const powerPathData = sampledWatts
            .map((watts, i) => {
                if (watts < 0 || watts > 2000) return null;
                const x = xForIndex(i);
                const y =
                    topPadding +
                    graphHeight -
                    ((watts - minWatts) / wattsRange) * graphHeight;
                return `${x} ${y}`;
            })
            .filter(Boolean)
            .map((pt, i) => `${i === 0 ? "M" : "L"} ${pt}`)
            .join(" ");

        const powerMarkers = [0, 100, 200, 300, 400, 500].filter(
            (w) => w <= maxWatts
        );
        const powerGridLines = powerMarkers
            .map((watts) => {
                const y =
                    topPadding +
                    graphHeight -
                    ((watts - minWatts) / wattsRange) * graphHeight;
                return `<line x1="${padding}" y1="${y}" x2="${padding + graphWidth}" y2="${y}" stroke="#4285f4" stroke-width="1" stroke-dasharray="3,3" opacity="0.3" />`;
            })
            .join("");
        const powerAxisLabels = powerMarkers
            .map((watts) => {
                const y =
                    topPadding +
                    graphHeight -
                    ((watts - minWatts) / wattsRange) * graphHeight;
                return `<text x="${padding + graphWidth + 5}" y="${y + 4}" font-size="11" fill="#4285f4">${watts}W</text>`;
            })
            .join("");

        // X-axis ticks
        const tickInterval = (function chooseTimeTickInterval(totalSeconds) {
            const candidates = [
                10, 15, 30, 60, 120, 180, 300, 600, 900, 1200, 1800, 3600,
            ];
            for (const c of candidates) {
                const n = Math.floor(totalSeconds / c);
                if (n >= 5 && n <= 8) return c;
            }
            return Math.max(10, Math.round(totalSeconds / 6));
        })(totalSeconds);

        const timeTicks = [];
        for (
            let t = 0;
            t <= totalSeconds + 0.5 * tickInterval;
            t += tickInterval
        ) {
            const ratio = Math.min(1, t / totalSeconds);
            const x = padding + ratio * graphWidth;
            timeTicks.push({ x, label: formatMMSS(t) });
        }
        const xAxisTicks = timeTicks
            .map(
                ({ x }) =>
                    `<line x1="${x}" y1="${topPadding + graphHeight}" x2="${x}" y2="${topPadding + graphHeight + 5}" stroke="#9aa0a6" stroke-width="1" />`
            )
            .join("");
        const xAxisLabels = timeTicks
            .map(({ x, label }) => {
                let anchor = "middle";
                if (x <= padding + 2) anchor = "start";
                if (x >= padding + graphWidth - 2) anchor = "end";
                return `<text x="${x}" y="${topPadding + graphHeight + 16}" text-anchor="${anchor}" font-size="11" fill="#9aa0a6">${label}</text>`;
            })
            .join("");

        const graphId = "graph-" + Math.random().toString(36).substr(2, 9);
        const dataPoints = sampledWatts.map((w) => w.toString()).join(",");

        const svgContent = `
<svg id="${graphId}" width="${width}" height="${height}" style="display:block;margin:0 auto;cursor:crosshair;max-width:100%;" data-points="${dataPoints}">
  <defs>
    <filter id="shadow-${graphId}">
      <feDropShadow dx="0" dy="1" stdDeviation="2" flood-opacity="0.3"/>
    </filter>
  </defs>
  ${powerGridLines}
  <path d="${powerPathData}" fill="none" stroke="#4285f4" stroke-width="1.2" opacity="0.9"/>
  <line id="cursor-${graphId}" x1="0" y1="${topPadding}" x2="0" y2="${topPadding + graphHeight}" stroke="#666" stroke-width="1.5" opacity="0" pointer-events="none"/>
  <circle id="cursor-power-${graphId}" cx="0" cy="0" r="5" fill="#4285f4" stroke="white" stroke-width="2" opacity="0" pointer-events="none" filter="url(#shadow-${graphId})"/>

  <!-- Hoverable tooltip -->
  <g id="tooltip-${graphId}" pointer-events="auto" opacity="0">
    <rect id="tooltip-bg-${graphId}" x="0" y="0" width="140" height="50" rx="6"
          fill="rgba(32,33,36,0.95)" stroke="rgba(255,255,255,0.1)" stroke-width="1"
          filter="url(#shadow-${graphId})" />
    <text id="tooltip-power-${graphId}" x="10" y="20" font-size="13" fill="#4285f4" font-weight="600"></text>
    <text id="tooltip-time-${graphId}" x="10" y="38" font-size="11" fill="#aaa"></text>
  </g>

  <!-- Plot area overlay (expanded) -->
  <rect id="plot-area-${graphId}" x="${padding - 3}" y="${topPadding - 3}" width="${graphWidth + 6}" height="${graphHeight + 6}" fill="transparent" style="cursor:crosshair;"/>

  <!-- Axes -->
  <line x1="${padding}" y1="${topPadding}" x2="${padding}" y2="${topPadding + graphHeight}" stroke="#2a2f3a" stroke-width="1.5"/>
  <line x1="${padding}" y1="${topPadding + graphHeight}" x2="${padding + graphWidth}" y2="${topPadding + graphHeight}" stroke="#2a2f3a" stroke-width="1.5"/>
  ${xAxisTicks}
  ${xAxisLabels}

  <text x="${padding - 10}" y="${topPadding - 10}" font-size="10" fill="#4285f4" font-weight="bold">Power</text>
  ${powerAxisLabels}
</svg>`;

        setTimeout(() => {
            const svg = document.getElementById(graphId);
            if (!svg) return;

            const cursor = document.getElementById(`cursor-${graphId}`);
            const cursorPower = document.getElementById(
                `cursor-power-${graphId}`
            );
            const tooltipGroup = document.getElementById(`tooltip-${graphId}`);
            const tooltipPower = document.getElementById(
                `tooltip-power-${graphId}`
            );
            const tooltipTime = document.getElementById(
                `tooltip-time-${graphId}`
            );
            const plotAreaEl = document.getElementById(`plot-area-${graphId}`);

            const dataPointsArr = svg
                .getAttribute("data-points")
                .split(",")
                .map((w) => parseFloat(w));
            const formatTimeFromIndex = (index) => {
                const secs = secondsForIndex(index);
                const s = Math.max(0, Math.round(secs));
                const m = Math.floor(s / 60);
                const r = s % 60;
                return `${m}:${r.toString().padStart(2, "0")}`;
            };

            const hoverController = attachStableHover({
                svg,
                plotAreaEl,
                tooltipGroup,
                cursors: [cursor, cursorPower],
                show() {
                    tooltipGroup.setAttribute("opacity", "1");
                },
                hide() {
                    tooltipGroup.setAttribute("opacity", "0");
                    cursor.setAttribute("opacity", "0");
                    cursorPower.setAttribute("opacity", "0");
                },
            });

            svg.addEventListener("mousemove", (e) => {
                const rect = svg.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;

                const xMin = padding,
                    xMax = padding + graphWidth;
                const yMin = topPadding,
                    yMax = topPadding + graphHeight;

                if (x < xMin || x > xMax || y < yMin || y > yMax) {
                    return; // visibility handled by hoverController events
                }

                const relX = x - padding;
                const index = Math.round(
                    (relX / graphWidth) * (dataPointsArr.length - 1)
                );
                const watts = dataPointsArr[index];

                const pointX = xForIndex(index);
                const powerY =
                    topPadding +
                    graphHeight -
                    ((watts - minWatts) / wattsRange) * graphHeight;

                cursor.setAttribute("x1", pointX);
                cursor.setAttribute("x2", pointX);
                cursor.setAttribute("opacity", "0.6");

                cursorPower.setAttribute("cx", pointX);
                cursorPower.setAttribute("cy", powerY);
                cursorPower.setAttribute("opacity", "1");

                let tooltipX = pointX + 15;
                let tooltipY = topPadding + 10;
                const tooltipWidth = 140;
                if (pointX > padding + graphWidth - (tooltipWidth + 20)) {
                    tooltipX = pointX - tooltipWidth - 15;
                }
                tooltipGroup.setAttribute(
                    "transform",
                    `translate(${tooltipX}, ${tooltipY})`
                );

                tooltipPower.textContent = `Power: ${Math.round(watts)}W`;
                tooltipTime.textContent = `Time: ${formatTimeFromIndex(index)}`;

                hoverController.ensureVisible();
            });
        }, 0);

        return svgContent;
    }

    generatePowerZoneDoughnut(detailedPower) {
        const zones = [
            {
                label: "Z1",
                percent: detailedPower.percentZ1,
                color: "rgba(189, 189, 189, 0.8)",
            },
            {
                label: "Z2",
                percent: detailedPower.percentZ2,
                color: "rgba(66, 133, 244, 0.8)",
            },
            {
                label: "Z3",
                percent: detailedPower.percentZ3,
                color: "rgba(52, 168, 83, 0.8)",
            },
            {
                label: "Z4",
                percent: detailedPower.percentZ4,
                color: "rgba(255, 153, 0, 0.8)",
            },
            {
                label: "Z5",
                percent: detailedPower.percentZ5,
                color: "rgba(234, 67, 53, 0.8)",
            },
            {
                label: "Z6",
                percent: detailedPower.percentZ6,
                color: "rgba(156, 39, 176, 0.8)",
            },
        ];

        const activeZones = zones.filter((z) => z.percent > 0);
        if (activeZones.length === 0) {
            return '<div style="text-align:center;color:#666;padding:10px;">No zone data</div>';
        }

        let cumulativePercent = 0;
        const radius = 50;
        const innerRadius = 35;
        const cx = 60;
        const cy = 60;

        let paths = "";
        activeZones.forEach((zone) => {
            const startAngle =
                (cumulativePercent / 100) * 2 * Math.PI - Math.PI / 2;
            const endAngle =
                ((cumulativePercent + zone.percent) / 100) * 2 * Math.PI -
                Math.PI / 2;

            const x1 = cx + radius * Math.cos(startAngle);
            const y1 = cy + radius * Math.sin(startAngle);
            const x2 = cx + radius * Math.cos(endAngle);
            const y2 = cy + radius * Math.sin(endAngle);

            const ix1 = cx + innerRadius * Math.cos(startAngle);
            const iy1 = cy + innerRadius * Math.sin(startAngle);
            const ix2 = cx + innerRadius * Math.cos(endAngle);
            const iy2 = cy + innerRadius * Math.sin(endAngle);

            const largeArc = zone.percent > 50 ? 1 : 0;

            paths += `
                <path d="M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} 
                         L ${ix2} ${iy2} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${ix1} ${iy1} Z"
                      fill="${zone.color}" stroke="none"/>
            `;

            cumulativePercent += zone.percent;
        });

        let legend =
            '<div style="display:flex;flex-direction:column;gap:6px;">';
        activeZones.forEach((zone) => {
            legend += `
                <div style="display:flex;align-items:center;gap:6px;font-size:12px;">
                    <div style="width:12px;height:12px;border-radius:2px;background:${zone.color};flex-shrink:0;"></div>
                    <span style="white-space:nowrap;">${zone.label}: ${zone.percent.toFixed(1)}%</span>
                </div>
            `;
        });
        legend += "</div>";

        return `
            <div style="margin-top:12px;display:flex;align-items:center;gap:16px;justify-content:center;">
                <div style="flex-shrink:0;">
                    <svg width="120" height="120" viewBox="0 0 120 120">
                        ${paths}
                    </svg>
                </div>
                ${legend}
            </div>
        `;
    }

    generateHRPowerGraph(hrStream, powerStream) {
        if (
            !hrStream ||
            !hrStream.heartrate ||
            !powerStream ||
            !powerStream.watts
        )
            return "";

        const getGraphWidth = () => {
            const screenWidth =
                window.innerWidth || document.documentElement.clientWidth;
            const containerWidth = screenWidth - 50;
            if (containerWidth >= 600) return 600;
            if (containerWidth < 400) return 400;
            return containerWidth;
        };

        const width = getGraphWidth();
        const height = 220;
        const zones = window.dataProcessor.getZonesBPM();
        const hrMax = window.dataProcessor.hrMax;
        const ftp = window.powerAnalyzer.getFTP();

        const padding = 30;
        const topPadding = 80;
        const rightPadding = 50;
        const bottomPadding = 20;
        const graphWidth = width - padding - rightPadding;
        const graphHeight = height - topPadding - bottomPadding;

        // Sampling-aware time (1 Hz fallback)
        const originalLen = Math.min(
            hrStream.heartrate.length,
            powerStream.watts.length
        );
        const step = originalLen > 200 ? Math.ceil(originalLen / 200) : 1;

        let sampledHR = hrStream.heartrate;
        let sampledWatts = powerStream.watts;
        if (step > 1) {
            sampledHR = hrStream.heartrate.filter((_, i) => i % step === 0);
            sampledWatts = powerStream.watts.filter((_, i) => i % step === 0);
        }

        const timeArr = Array.isArray(hrStream.time)
            ? hrStream.time
            : Array.isArray(powerStream.time)
              ? powerStream.time
              : null;
        const hz = hrStream.hz || powerStream.hz || 1;

        let totalSeconds, secondsForIndex;
        if (timeArr && timeArr.length >= originalLen) {
            const t0 = timeArr[0],
                t1 = timeArr[originalLen - 1];
            totalSeconds = Math.max(0, t1 - t0);
            secondsForIndex = (i) =>
                timeArr[Math.min(originalLen - 1, i * step)] - t0;
        } else {
            totalSeconds = originalLen / hz;
            secondsForIndex = (i) => (i * step) / hz;
        }

        const xForIndex = (i) =>
            padding + (i / (sampledHR.length - 1)) * graphWidth;

        // HR scaling
        const minHR = Math.max(Math.min(...sampledHR) - 10, 100);
        const maxHR = hrMax + 10;
        const hrRange = maxHR - minHR;

        const hrPathData = sampledHR
            .map((hr, i) => {
                const x = xForIndex(i);
                const y =
                    topPadding +
                    graphHeight -
                    ((hr - minHR) / hrRange) * graphHeight;
                return `${i === 0 ? "M" : "L"} ${x} ${y}`;
            })
            .join(" ");

        // Power scaling
        const validWatts = sampledWatts.filter((w) => w >= 0 && w < 2000);
        const minWatts = 0;
        const maxWatts = Math.max(...validWatts, ftp * 1.5);
        const wattsRange = maxWatts - minWatts;
        const powerOffset = 80;

        const powerPathData = sampledWatts
            .map((watts, i) => {
                if (watts < 0 || watts > 2000) return null;
                const x = xForIndex(i);
                const y =
                    topPadding +
                    graphHeight -
                    ((watts - minWatts) / wattsRange) * graphHeight -
                    powerOffset;
                return `${x} ${y}`;
            })
            .filter(Boolean)
            .map((pt, i) => `${i === 0 ? "M" : "L"} ${pt}`)
            .join(" ");

        // Power guides
        const powerMarkers = [0, 100, 200, 300, 400, 500].filter(
            (w) => w <= maxWatts
        );
        const powerGridLines = powerMarkers
            .map((watts) => {
                const y =
                    topPadding +
                    graphHeight -
                    ((watts - minWatts) / wattsRange) * graphHeight -
                    powerOffset;
                return `<line x1="${padding}" y1="${y}" x2="${padding + graphWidth}" y2="${y}" stroke="#4285f4" stroke-width="2" stroke-dasharray="1,0.5" opacity="0.4" />`;
            })
            .join("");
        const powerAxisLabels = powerMarkers
            .map((watts) => {
                const y =
                    topPadding +
                    graphHeight -
                    ((watts - minWatts) / wattsRange) * graphHeight -
                    powerOffset;
                return `<text x="${padding + graphWidth + 5}" y="${y + 4}" font-size="11" fill="#4285f4">${watts}W</text>`;
            })
            .join("");

        // HR zones
        const zoneConfig = [
            { upper: zones.z2Upper, color: "rgba(52, 168, 83, 0.1)" },
            { upper: zones.z3Upper, color: "rgba(251, 188, 4, 0.1)" },
            { upper: zones.z4Upper, color: "rgba(255, 153, 0, 0.1)" },
            { upper: zones.z5Upper, color: "rgba(234, 67, 53, 0.1)" },
        ];
        let zoneRects = "",
            zoneLines = "",
            prevY = topPadding + graphHeight;
        zoneConfig.forEach((zone) => {
            if (zone.upper >= minHR && zone.upper <= maxHR) {
                const y =
                    topPadding +
                    graphHeight -
                    ((zone.upper - minHR) / hrRange) * graphHeight;
                zoneRects += `<rect x="${padding}" y="${y}" width="${graphWidth}" height="${prevY - y}" fill="${zone.color}" />`;
                zoneLines += `<line x1="${padding}" y1="${y}" x2="${padding + graphWidth}" y2="${y}" stroke="#999" stroke-width="1" stroke-dasharray="3,3" opacity="0.5" />`;
                zoneLines += `<text x="${padding - 5}" y="${y + 4}" text-anchor="end" font-size="10" fill="#9aa0a6">${Math.round(zone.upper)}</text>`;
                prevY = y;
            }
        });

        // X-axis ticks
        const tickInterval = (function chooseTimeTickInterval(totalSeconds) {
            const candidates = [
                10, 15, 30, 60, 120, 180, 300, 600, 900, 1200, 1800, 3600,
            ];
            for (const c of candidates) {
                const n = Math.floor(totalSeconds / c);
                if (n >= 5 && n <= 8) return c;
            }
            return Math.max(10, Math.round(totalSeconds / 6));
        })(totalSeconds);

        const timeTicks = [];
        for (
            let t = 0;
            t <= totalSeconds + 0.5 * tickInterval;
            t += tickInterval
        ) {
            const ratio = Math.min(1, t / totalSeconds);
            const x = padding + ratio * graphWidth;
            timeTicks.push({ x, label: formatMMSS(t) });
        }
        const xAxisTicks = timeTicks
            .map(
                ({ x }) =>
                    `<line x1="${x}" y1="${topPadding + graphHeight}" x2="${x}" y2="${topPadding + graphHeight + 5}" stroke="#9aa0a6" stroke-width="1" />`
            )
            .join("");
        const xAxisLabels = timeTicks
            .map(({ x, label }) => {
                let anchor = "middle";
                if (x <= padding + 2) anchor = "start";
                if (x >= padding + graphWidth - 2) anchor = "end";
                return `<text x="${x}" y="${topPadding + graphHeight + 16}" text-anchor="${anchor}" font-size="11" fill="#9aa0a6">${label}</text>`;
            })
            .join("");

        const graphId = "graph-" + Math.random().toString(36).substr(2, 9);
        const dataPoints = sampledHR
            .map((hr, i) => `${hr}|${sampledWatts[i] || 0}`)
            .join(",");

        const svgContent = `
<svg id="${graphId}" width="${width}" height="${height}" style="display:block;margin:0 auto;cursor:crosshair;max-width:100%;" data-points="${dataPoints}">
  <defs>
    <filter id="shadow-${graphId}">
      <feDropShadow dx="0" dy="1" stdDeviation="2" flood-opacity="0.3"/>
    </filter>
  </defs>
  ${zoneRects}
  ${zoneLines}
  ${powerGridLines}
  <path d="${powerPathData}" fill="none" stroke="#4285f4" stroke-width="1.5" opacity="0.9"/>
  <path d="${hrPathData}" fill="none" stroke="#ea4335" stroke-width="1.5"/>

  <line id="cursor-${graphId}" x1="0" y1="${topPadding}" x2="0" y2="${topPadding + graphHeight}" stroke="#666" stroke-width="1.5" opacity="0" pointer-events="none"/>
  <circle id="cursor-hr-${graphId}" cx="0" cy="0" r="5" fill="#ea4335" stroke="white" stroke-width="2" opacity="0" pointer-events="none" filter="url(#shadow-${graphId})"/>
  <circle id="cursor-power-${graphId}" cx="0" cy="0" r="5" fill="#4285f4" stroke="white" stroke-width="2" opacity="0" pointer-events="none" filter="url(#shadow-${graphId})"/>

  <!-- Hoverable tooltip -->
  <g id="tooltip-${graphId}" pointer-events="auto" opacity="0">
    <rect id="tooltip-bg-${graphId}" x="0" y="0" width="140" height="70" rx="6"
          fill="rgba(32,33,36,0.95)" stroke="rgba(255,255,255,0.1)" stroke-width="1"
          filter="url(#shadow-${graphId})" />
    <text id="tooltip-hr-${graphId}" x="10" y="20" font-size="13" fill="#ea4335" font-weight="600"></text>
    <text id="tooltip-power-${graphId}" x="10" y="40" font-size="13" fill="#4285f4" font-weight="600"></text>
    <text id="tooltip-time-${graphId}" x="10" y="58" font-size="11" fill="#aaa"></text>
  </g>

  <!-- Plot area overlay (expanded) -->
  <rect id="plot-area-${graphId}" x="${padding - 3}" y="${topPadding - 3}" width="${graphWidth + 6}" height="${graphHeight + 6}" fill="transparent" style="cursor:crosshair;"/>

  <!-- Axes -->
  <line x1="${padding}" y1="${topPadding}" x2="${padding}" y2="${topPadding + graphHeight}" stroke="#2a2f3a" stroke-width="1.5"/>
  <line x1="${padding}" y1="${topPadding + graphHeight}" x2="${padding + graphWidth}" y2="${topPadding + graphHeight}" stroke="#2a2f3a" stroke-width="1.5"/>
  ${xAxisTicks}
  ${xAxisLabels}

  <text x="${padding - 25}" y="${topPadding - 10}" font-size="10" fill="#ea4335" font-weight="bold">HR</text>
  <text x="${padding - 5}" y="${topPadding + 4}" text-anchor="end" font-size="11" fill="#9aa0a6">${Math.round(maxHR)}</text>
  <text x="${padding - 5}" y="${topPadding + graphHeight + 5}" text-anchor="end" font-size="11" fill="#9aa0a6">${Math.round(minHR)}</text>
  <text x="${padding + graphWidth + 25}" y="${topPadding - powerOffset - 10}" font-size="10" fill="#4285f4" font-weight="bold">Power</text>
  ${powerAxisLabels}
</svg>`;

        setTimeout(() => {
            const svg = document.getElementById(graphId);
            if (!svg) return;

            const cursor = document.getElementById(`cursor-${graphId}`);
            const cursorHR = document.getElementById(`cursor-hr-${graphId}`);
            const cursorPower = document.getElementById(
                `cursor-power-${graphId}`
            );

            const tooltipGroup = document.getElementById(`tooltip-${graphId}`);
            const tooltipHR = document.getElementById(`tooltip-hr-${graphId}`);
            const tooltipPower = document.getElementById(
                `tooltip-power-${graphId}`
            );
            const tooltipTime = document.getElementById(
                `tooltip-time-${graphId}`
            );

            const plotAreaEl = document.getElementById(`plot-area-${graphId}`);

            const dataPointsArr = svg
                .getAttribute("data-points")
                .split(",")
                .map((p) => {
                    const [hr, watts] = p.split("|");
                    return { hr: parseFloat(hr), watts: parseFloat(watts) };
                });

            const formatTimeFromIndex = (index) => {
                const secs = secondsForIndex(index);
                const s = Math.max(0, Math.round(secs));
                const m = Math.floor(s / 60);
                const r = s % 60;
                return `${m}:${r.toString().padStart(2, "0")}`;
            };

            // Visibility controls without timeouts
            const hoverController = attachStableHover({
                svg,
                plotAreaEl,
                tooltipGroup,
                cursors: [cursor, cursorHR, cursorPower],
                show() {
                    tooltipGroup.setAttribute("opacity", "1");
                    // cursors are shown via mousemove; no-op here
                },
                hide() {
                    tooltipGroup.setAttribute("opacity", "0");
                    cursor.setAttribute("opacity", "0");
                    cursorHR.setAttribute("opacity", "0");
                    cursorPower.setAttribute("opacity", "0");
                },
            });

            svg.addEventListener("mousemove", (e) => {
                const rect = svg.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;

                // bounds of plot area
                const xMin = padding,
                    xMax = padding + graphWidth;
                const yMin = topPadding,
                    yMax = topPadding + graphHeight;

                if (x < xMin || x > xMax || y < yMin || y > yMax) {
                    // outside plot area; visibility handled by hoverController events
                    return;
                }

                const relX = x - padding;
                const index = Math.round(
                    (relX / graphWidth) * (dataPointsArr.length - 1)
                );
                const dp = dataPointsArr[index];

                const pointX = xForIndex(index);
                const hrY =
                    topPadding +
                    graphHeight -
                    ((dp.hr - minHR) / hrRange) * graphHeight;
                const powerY =
                    topPadding +
                    graphHeight -
                    ((dp.watts - minWatts) / wattsRange) * graphHeight -
                    powerOffset;

                cursor.setAttribute("x1", pointX);
                cursor.setAttribute("x2", pointX);
                cursor.setAttribute("opacity", "0.6");

                cursorHR.setAttribute("cx", pointX);
                cursorHR.setAttribute("cy", hrY);
                cursorHR.setAttribute("opacity", "1");

                cursorPower.setAttribute("cx", pointX);
                cursorPower.setAttribute("cy", powerY);
                cursorPower.setAttribute("opacity", "1");

                // Tooltip placement
                let tooltipX = pointX + 15;
                let tooltipY = topPadding + 10;
                const tooltipWidth = 140;
                if (pointX > padding + graphWidth - (tooltipWidth + 20)) {
                    tooltipX = pointX - tooltipWidth - 15;
                }
                tooltipGroup.setAttribute(
                    "transform",
                    `translate(${tooltipX}, ${tooltipY})`
                );

                // Content
                tooltipHR.textContent = `HR: ${Math.round(dp.hr)} bpm`;
                tooltipPower.textContent = `Power: ${Math.round(dp.watts)}W`;
                tooltipTime.textContent = `Time: ${formatTimeFromIndex(index)}`;

                // ensure visible while interacting
                hoverController.ensureVisible();
            });
        }, 0);

        return svgContent;
    }
}

// Initialize and export singleton
window.powerAnalyzer = new PowerAnalyzer(window.dataProcessor);
