// js/analysis/hrAnalysis.js
// Unified heart rate analysis - eliminates all duplicate functions

class HRAnalyzer {
    constructor(dataProcessor) {
        this.dataProcessor = dataProcessor;
    }

    /**
     * Determine what type of HR data is available for a run
     * @returns {'none' | 'basic' | 'detailed'}
     */
    getHRDataType(run) {
        if (run.hrStream?.heartrate?.length > 0) {
            return "detailed";
        }
        if (run.avgHR > 0 && run.maxHR > 0) {
            return "basic";
        }
        return "none";
    }

    getMaxHR() {
        return window.userSettings.getMaxHR();
    }

    getRestingHR() {
        return window.userSettings.getRestingHR();
    }

    /**
     * Analyze detailed HR stream and return zone distribution
     */
    analyzeHRStream(hrStream, zonesBPM = null) {
        if (!hrStream?.heartrate?.length) {
            return null;
        }

        const zones = zonesBPM || this.dataProcessor.getZonesBPM();
        const hrRecords = hrStream.heartrate.filter((hr) => hr > 0 && hr < 250);

        if (hrRecords.length === 0) {
            return null;
        }

        // Zone 1 is recovery (< 80% of Z2 upper bound)
        const z1Upper = zones.z2Upper * 0.8;

        // Count time in each zone
        let counts = { z1: 0, z2: 0, z3: 0, z4: 0, z5: 0, z6: 0 };

        hrRecords.forEach((hr) => {
            if (hr <= z1Upper) counts.z1++;
            else if (hr <= zones.z2Upper) counts.z2++;
            else if (hr <= zones.z3Upper) counts.z3++;
            else if (hr <= zones.z4Upper) counts.z4++;
            else if (hr <= zones.z5Upper) counts.z5++;
            else counts.z6++;
        });

        const total = hrRecords.length;

        return {
            percentZ1: (counts.z1 / total) * 100,
            percentZ2: (counts.z2 / total) * 100,
            percentZ3: (counts.z3 / total) * 100,
            percentZ4: (counts.z4 / total) * 100,
            percentZ5: (counts.z5 / total) * 100,
            percentZ6: (counts.z6 / total) * 100,
            avgHR: hrRecords.reduce((sum, hr) => sum + hr, 0) / total,
            maxHR: Math.max(...hrRecords),
            minHR: Math.min(...hrRecords),
            totalDataPoints: total,
            hrRecords: hrRecords, // For graphing
        };
    }

    /**
     * Get zone number from HR value
     */
    getZone(hr, zonesBPM = null) {
        const zones = zonesBPM || this.dataProcessor.getZonesBPM();

        if (hr <= zones.z2Upper) return 2;
        if (hr <= zones.z3Upper) return 3;
        if (hr <= zones.z4Upper) return 4;
        if (hr <= zones.z5Upper) return 5;
        return 6;
    }

    /**
     * Get zone label with percentage and BPM range
     */
    getZoneLabel(zoneNum) {
        const zones = this.dataProcessor.getZonesBPM();
        const hrMax = this.dataProcessor.hrMax;

        const pct = (val) => Math.round((val / hrMax) * 100);
        const bpm = (val) => Math.round(val);

        const labels = {
            1: `Z1: <${pct(zones.z2Upper * 0.8)}% (<${bpm(zones.z2Upper * 0.8)} bpm)`,
            2: `Z2: ${pct(zones.z2Upper * 0.8)}-${pct(zones.z2Upper)}% (${bpm(zones.z2Upper * 0.8)}-${bpm(zones.z2Upper)} bpm)`,
            3: `Z3: ${pct(zones.z2Upper)}-${pct(zones.z3Upper)}% (${bpm(zones.z2Upper)}-${bpm(zones.z3Upper)} bpm)`,
            4: `Z4: ${pct(zones.z3Upper)}-${pct(zones.z4Upper)}% (${bpm(zones.z3Upper)}-${bpm(zones.z4Upper)} bpm)`,
            5: `Z5: ${pct(zones.z4Upper)}-95% (${bpm(zones.z4Upper)}-${bpm(hrMax * 0.95)} bpm)`,
            6: `Z6: >95% (>${bpm(hrMax * 0.95)} bpm)`,
        };

        return labels[zoneNum] || "Unknown";
    }

    /**
     * Calculate zone distribution for a collection of runs
     */
    calculateZoneDistribution(runs) {
        const zones = this.dataProcessor.getZonesBPM();
        let totalDataPoints = 0;
        let counts = { z1: 0, z2: 0, z3: 0, z4: 0, z5: 0, z6: 0 };
        let distances = { z1: 0, z2: 0, z3: 0, z4: 0, z5: 0, z6: 0 };

        runs.forEach((run) => {
            const hrDataType = this.getHRDataType(run);

            if (hrDataType === "detailed") {
                const analysis = this.analyzeHRStream(run.hrStream, zones);
                if (analysis) {
                    totalDataPoints += analysis.totalDataPoints;

                    // Add to counts
                    counts.z1 +=
                        analysis.totalDataPoints * (analysis.percentZ1 / 100);
                    counts.z2 +=
                        analysis.totalDataPoints * (analysis.percentZ2 / 100);
                    counts.z3 +=
                        analysis.totalDataPoints * (analysis.percentZ3 / 100);
                    counts.z4 +=
                        analysis.totalDataPoints * (analysis.percentZ4 / 100);
                    counts.z5 +=
                        analysis.totalDataPoints * (analysis.percentZ5 / 100);
                    counts.z6 +=
                        analysis.totalDataPoints * (analysis.percentZ6 / 100);

                    // Distribute distance proportionally
                    distances.z1 += run.distance * (analysis.percentZ1 / 100);
                    distances.z2 += run.distance * (analysis.percentZ2 / 100);
                    distances.z3 += run.distance * (analysis.percentZ3 / 100);
                    distances.z4 += run.distance * (analysis.percentZ4 / 100);
                    distances.z5 += run.distance * (analysis.percentZ5 / 100);
                    distances.z6 += run.distance * (analysis.percentZ6 / 100);
                }
            } else if (hrDataType === "basic") {
                // Use average HR to assign entire run to one zone
                const zone = this.getZone(run.avgHR, zones);
                const zoneKey = `z${zone}`;
                distances[zoneKey] += run.distance;
            }
        });

        // Calculate percentages
        const percentages = {};
        for (let zone in counts) {
            percentages[zone] =
                totalDataPoints > 0
                    ? (counts[zone] / totalDataPoints) * 100
                    : 0;
        }

        return {
            percentages,
            distances,
            totalDataPoints,
            runsAnalyzed: runs.length,
            runsWithDetailedHR: runs.filter(
                (r) => this.getHRDataType(r) === "detailed"
            ).length,
        };
    }

    /**
     * Generate HR and Pace graph SVG for a run
     */
    generateHRGraph(hrRecords, paceRecords = null, height = 200) {
        // Calculate dynamic width based on screen size
        const getGraphWidth = () => {
            const screenWidth =
                window.innerWidth || document.documentElement.clientWidth;
            const containerWidth = screenWidth - 50; // Account for padding/margins

            if (containerWidth >= 600) {
                return 600;
            } else if (containerWidth < 400) {
                return 400;
            } else {
                return containerWidth;
            }
        };

        const width = getGraphWidth();

        const zones = this.dataProcessor.getZonesBPM();
        const hrMax = this.dataProcessor.hrMax;
        const padding = 30;
        const topPadding = 80; // Extra space for pace line and tooltip
        const rightPadding = paceRecords ? 50 : 30;
        const graphWidth = width - padding - rightPadding;
        const graphHeight = height - topPadding - padding;

        // Sample data but keep original indices for lookup
        let sampledRecords = hrRecords;
        let sampledPaceRecords = paceRecords;
        let indexMap = hrRecords.map((_, i) => i);

        if (hrRecords.length > 200) {
            const step = Math.ceil(hrRecords.length / 200);
            sampledRecords = hrRecords.filter((_, i) => i % step === 0);
            indexMap = hrRecords
                .map((_, i) => i)
                .filter((_, i) => i % step === 0);
            if (paceRecords) {
                sampledPaceRecords = paceRecords.filter(
                    (_, i) => i % step === 0
                );
            }
        }

        const minHR = Math.max(Math.min(...sampledRecords) - 10, 100);
        const maxHR = hrMax + 10;
        const hrRange = maxHR - minHR;

        // Create HR line path
        const hrPathData = sampledRecords
            .map((hr, i) => {
                const x =
                    padding + (i / (sampledRecords.length - 1)) * graphWidth;
                const y =
                    topPadding +
                    graphHeight -
                    ((hr - minHR) / hrRange) * graphHeight;
                return `${i === 0 ? "M" : "L"} ${x} ${y}`;
            })
            .join(" ");

        // Create pace line path if pace data is provided
        let pacePathData = "";
        let paceAxisLabels = "";
        let paceGridLines = ""; // Add this new variable
        let maxPace = 0;
        const paceOffset = 80; // Vertical offset in pixels to make pace more visible

        if (sampledPaceRecords && sampledPaceRecords.length > 0) {
            const validPaces = sampledPaceRecords.filter(
                (p) => p && p > 0 && p < 1000
            );

            if (validPaces.length > 0) {
                const minPace = 0;
                maxPace = Math.max(...validPaces);
                const paceRange = maxPace - minPace;

                pacePathData = sampledPaceRecords
                    .map((pace, i) => {
                        if (!pace || pace <= 0 || pace > 1000) return null;
                        const x =
                            padding +
                            (i / (sampledPaceRecords.length - 1)) * graphWidth;
                        const y =
                            topPadding +
                            graphHeight -
                            ((pace - minPace) / paceRange) * graphHeight -
                            paceOffset;
                        return `${x} ${y}`;
                    })
                    .filter((p) => p !== null)
                    .map((point, i) => `${i === 0 ? "M" : "L"} ${point}`)
                    .join(" ");

                const formatPace = (pace) => {
                    const mins = Math.floor(pace);
                    const secs = Math.round((pace - mins) * 60);
                    return `${mins}:${secs.toString().padStart(2, "0")}`;
                };

                // Add horizontal grid lines for pace at 0, 4, 5, and 6 min/km
                const paceMarkers = [0, 4, 6, 8, 10].filter(
                    (p) => p <= maxPace
                );
                paceGridLines = paceMarkers
                    .map((paceValue) => {
                        const y =
                            topPadding +
                            graphHeight -
                            ((paceValue - minPace) / paceRange) * graphHeight -
                            paceOffset;
                        return `
                <line x1="${padding}" y1="${y}" x2="${padding + graphWidth}" y2="${y}" 
                      stroke="#4285f4" stroke-width="2" stroke-dasharray="1,0.5" opacity="0.4" />
            `;
                    })
                    .join("");

                const midPace = maxPace / 2;

                paceAxisLabels = `
            ${paceMarkers
                .map((paceValue) => {
                    const y =
                        topPadding +
                        graphHeight -
                        ((paceValue - minPace) / paceRange) * graphHeight -
                        paceOffset;
                    return `<text x="${padding + graphWidth + 5}" y="${y + 4}" font-size="11" fill="#4285f4">${formatPace(paceValue)}</text>`;
                })
                .join("")}
            <text x="${padding + graphWidth + 5}" y="${topPadding - paceOffset - 10}" font-size="9" fill="#4285f4" opacity="0.6">min/km</text>
        `;
            }
        }

        // Zone colors and rectangles
        const zoneConfig = [
            {
                upper: zones.z2Upper,
                color: "rgba(52, 168, 83, 0.1)",
                label: "Z2",
            },
            {
                upper: zones.z3Upper,
                color: "rgba(251, 188, 4, 0.1)",
                label: "Z3",
            },
            {
                upper: zones.z4Upper,
                color: "rgba(255, 153, 0, 0.1)",
                label: "Z4",
            },
            {
                upper: zones.z5Upper,
                color: "rgba(234, 67, 53, 0.1)",
                label: "Z5",
            },
        ];

        let zoneRects = "";
        let zoneLines = "";
        let prevY = topPadding + graphHeight;

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

        // Generate unique ID for this graph instance
        const graphId = "graph-" + Math.random().toString(36).substr(2, 9);

        // Create data attributes for interactivity
        const dataPoints = sampledRecords
            .map((hr, i) => {
                const pace =
                    sampledPaceRecords && sampledPaceRecords[i]
                        ? sampledPaceRecords[i]
                        : null;
                return `${hr}|${pace || 0}`;
            })
            .join(",");

        return `
  <svg id="${graphId}" width="${width}" height="${height}" style="display: block; margin: 0 auto; cursor: crosshair; max-width: 100%;" data-points="${dataPoints}">
    <defs>
      <filter id="shadow-${graphId}">
        <feDropShadow dx="0" dy="1" stdDeviation="2" flood-opacity="0.3"/>
      </filter>
    </defs>
    ${zoneRects}
    ${zoneLines}
    ${paceGridLines}
    ${pacePathData ? `<path d="${pacePathData}" fill="none" stroke="#4285f4" stroke-width="2.5" opacity="0.9" />` : ""}
    <path d="${hrPathData}" fill="none" stroke="#ea4335" stroke-width="2.5" />
    
    <!-- Vertical cursor line -->
    <line id="cursor-${graphId}" x1="0" y1="${topPadding}" x2="0" y2="${topPadding + graphHeight}" 
          stroke="#666" stroke-width="1.5" opacity="0" pointer-events="none" />
    
    <!-- Cursor dot for HR -->
    <circle id="cursor-hr-${graphId}" cx="0" cy="0" r="5" fill="#ea4335" stroke="white" 
            stroke-width="2" opacity="0" pointer-events="none" filter="url(#shadow-${graphId})" />
    
    <!-- Cursor dot for Pace -->
    ${
        pacePathData
            ? `<circle id="cursor-pace-${graphId}" cx="0" cy="0" r="5" fill="#4285f4" stroke="white" 
            stroke-width="2" opacity="0" pointer-events="none" filter="url(#shadow-${graphId})" />`
            : ""
    }
    
    <!-- Tooltip background -->
    <rect id="tooltip-bg-${graphId}" x="0" y="0" width="120" height="50" rx="6" 
          fill="rgba(32,33,36,0.95)" stroke="rgba(255,255,255,0.1)" stroke-width="1" 
          opacity="0" pointer-events="none" filter="url(#shadow-${graphId})" />
    
    <!-- Tooltip text -->
    <text id="tooltip-hr-${graphId}" x="0" y="0" font-size="13" fill="#ea4335" 
          font-weight="600" opacity="0" pointer-events="none"></text>
    <text id="tooltip-pace-${graphId}" x="0" y="0" font-size="13" fill="#4285f4" 
          font-weight="600" opacity="0" pointer-events="none"></text>
    <text id="tooltip-time-${graphId}" x="0" y="0" font-size="11" fill="#aaa" 
          opacity="0" pointer-events="none"></text>
    
    <!-- Invisible overlay for mouse events -->
    <rect x="${padding}" y="${topPadding}" width="${graphWidth}" height="${graphHeight}" 
          fill="transparent" style="cursor: crosshair;" />
    
    <line x1="${padding}" y1="${topPadding}" x2="${padding}" y2="${topPadding + graphHeight}" stroke="#2a2f3a" stroke-width="1.5" />
    <line x1="${padding}" y1="${topPadding + graphHeight}" x2="${padding + graphWidth}" y2="${topPadding + graphHeight}" stroke="#2a2f3a" stroke-width="1.5" />
    <text x="${padding - 25}" y="${topPadding - 10}" font-size="10" fill="#ea4335" font-weight="bold">HR</text>
    <text x="${padding - 5}" y="${topPadding + 4}" text-anchor="end" font-size="11" fill="#9aa0a6">${Math.round(maxHR)}</text>
    <text x="${padding - 5}" y="${topPadding + graphHeight + 5}" text-anchor="end" font-size="11" fill="#9aa0a6">${Math.round(minHR)}</text>
    ${pacePathData ? `<text x="${padding + graphWidth + 25}" y="${topPadding - paceOffset - 10}" font-size="10" fill="#4285f4" font-weight="bold">Pace</text>` : ""}
    ${paceAxisLabels}
  </svg>
  <script>
  (function() {
    const svg = document.getElementById('${graphId}');
    const cursor = document.getElementById('cursor-${graphId}');
    const cursorHR = document.getElementById('cursor-hr-${graphId}');
    const cursorPace = document.getElementById('cursor-pace-${graphId}');
    const tooltipBg = document.getElementById('tooltip-bg-${graphId}');
    const tooltipHR = document.getElementById('tooltip-hr-${graphId}');
    const tooltipPace = document.getElementById('tooltip-pace-${graphId}');
    const tooltipTime = document.getElementById('tooltip-time-${graphId}');
    
    const padding = ${padding};
    const topPadding = ${topPadding};
    const graphWidth = ${graphWidth};
    const graphHeight = ${graphHeight};
    const minHR = ${minHR};
    const maxHR = ${maxHR};
    const hrRange = ${hrRange};
    const paceOffset = ${paceOffset};
    const maxPace = ${maxPace};
    const hasPace = ${pacePathData ? "true" : "false"};
    
    const dataPoints = svg.getAttribute('data-points').split(',').map(p => {
      const [hr, pace] = p.split('|');
      return { hr: parseFloat(hr), pace: parseFloat(pace) };
    });
    
    const formatPace = (pace) => {
      const mins = Math.floor(pace);
      const secs = Math.round((pace - mins) * 60);
      return mins + ':' + secs.toString().padStart(2, '0');
    };
    
    const formatTime = (index, total) => {
      const totalSeconds = (index / total) * ${hrRecords.length};
      const mins = Math.floor(totalSeconds / 60);
      const secs = Math.floor(totalSeconds % 60);
      return mins + ':' + secs.toString().padStart(2, '0');
    };
    
    svg.addEventListener('mousemove', (e) => {
      const rect = svg.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      if (x < padding || x > padding + graphWidth || y < topPadding || y > topPadding + graphHeight) {
        cursor.setAttribute('opacity', '0');
        cursorHR.setAttribute('opacity', '0');
        if (cursorPace) cursorPace.setAttribute('opacity', '0');
        tooltipBg.setAttribute('opacity', '0');
        tooltipHR.setAttribute('opacity', '0');
        tooltipPace.setAttribute('opacity', '0');
        tooltipTime.setAttribute('opacity', '0');
        return;
      }
      
      const relX = x - padding;
      const index = Math.round((relX / graphWidth) * (dataPoints.length - 1));
      const dataPoint = dataPoints[index];
      
      const pointX = padding + (index / (dataPoints.length - 1)) * graphWidth;
      const hrY = topPadding + graphHeight - ((dataPoint.hr - minHR) / hrRange) * graphHeight;
      
      // Update vertical cursor line
      cursor.setAttribute('x1', pointX);
      cursor.setAttribute('x2', pointX);
      cursor.setAttribute('opacity', '0.6');
      
      // Update HR dot
      cursorHR.setAttribute('cx', pointX);
      cursorHR.setAttribute('cy', hrY);
      cursorHR.setAttribute('opacity', '1');
      
      let tooltipHeight = 50;
      let tooltipWidth = 120;
      
      // Update Pace dot if available
      if (hasPace && dataPoint.pace > 0 && cursorPace) {
        const paceRange = maxPace;
        const paceY = topPadding + graphHeight - ((dataPoint.pace / paceRange) * graphHeight) - paceOffset;
        cursorPace.setAttribute('cx', pointX);
        cursorPace.setAttribute('cy', paceY);
        cursorPace.setAttribute('opacity', '1');
        tooltipHeight = 70;
      } else if (cursorPace) {
        cursorPace.setAttribute('opacity', '0');
      }
      
      // Position tooltip
      let tooltipX = pointX + 15;
      let tooltipY = topPadding + 10;
      
      // Adjust tooltip position if near right edge
      if (pointX > padding + graphWidth - 140) {
        tooltipX = pointX - tooltipWidth - 15;
      }
      
      tooltipBg.setAttribute('x', tooltipX);
      tooltipBg.setAttribute('y', tooltipY);
      tooltipBg.setAttribute('width', tooltipWidth);
      tooltipBg.setAttribute('height', tooltipHeight);
      tooltipBg.setAttribute('opacity', '1');
      
      // Update tooltip text
      tooltipHR.setAttribute('x', tooltipX + 10);
      tooltipHR.setAttribute('y', tooltipY + 20);
      tooltipHR.textContent = 'HR: ' + Math.round(dataPoint.hr) + ' bpm';
      tooltipHR.setAttribute('opacity', '1');
      
      if (hasPace && dataPoint.pace > 0) {
        tooltipPace.setAttribute('x', tooltipX + 10);
        tooltipPace.setAttribute('y', tooltipY + 40);
        tooltipPace.textContent = 'Pace: ' + formatPace(dataPoint.pace);
        tooltipPace.setAttribute('opacity', '1');
        
        tooltipTime.setAttribute('x', tooltipX + 10);
        tooltipTime.setAttribute('y', tooltipY + 58);
      } else {
        tooltipPace.setAttribute('opacity', '0');
        tooltipTime.setAttribute('x', tooltipX + 10);
        tooltipTime.setAttribute('y', tooltipY + 40);
      }
      
      tooltipTime.textContent = 'Time: ' + formatTime(index, dataPoints.length - 1);
      tooltipTime.setAttribute('opacity', '1');
    });
    
    svg.addEventListener('mouseleave', () => {
      cursor.setAttribute('opacity', '0');
      cursorHR.setAttribute('opacity', '0');
      if (cursorPace) cursorPace.setAttribute('opacity', '0');
      tooltipBg.setAttribute('opacity', '0');
      tooltipHR.setAttribute('opacity', '0');
      tooltipPace.setAttribute('opacity', '0');
      tooltipTime.setAttribute('opacity', '0');
    });
  })();
  </script>
`;
    }

    generateHRZoneDoughnut(detailedHR) {
        const zones = [
            {
                label: "Z1",
                percent: detailedHR.percentZ1,
                color: "rgba(189, 189, 189, 0.8)",
            },
            {
                label: "Z2",
                percent: detailedHR.percentZ2,
                color: "rgba(66, 133, 244, 0.8)",
            },
            {
                label: "Z3",
                percent: detailedHR.percentZ3,
                color: "rgba(52, 168, 83, 0.8)",
            },
            {
                label: "Z4",
                percent: detailedHR.percentZ4,
                color: "rgba(255, 153, 0, 0.8)",
            },
            {
                label: "Z5",
                percent: detailedHR.percentZ5,
                color: "rgba(234, 67, 53, 0.8)",
            },
            {
                label: "Z6",
                percent: detailedHR.percentZ6,
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
}

// Export singleton
window.hrAnalyzer = new HRAnalyzer(window.dataProcessor);
