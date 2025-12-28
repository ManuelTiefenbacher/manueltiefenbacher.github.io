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
      return 'detailed';
    }
    if (run.avgHR > 0 && run.maxHR > 0) {
      return 'basic';
    }
    return 'none';
  }

  /**
   * Analyze detailed HR stream and return zone distribution
   */
  analyzeHRStream(hrStream, zonesBPM = null) {
    if (!hrStream?.heartrate?.length) {
      return null;
    }

    const zones = zonesBPM || this.dataProcessor.getZonesBPM();
    const hrRecords = hrStream.heartrate.filter(hr => hr > 0 && hr < 250);
    
    if (hrRecords.length === 0) {
      return null;
    }

    // Zone 1 is recovery (< 80% of Z2 upper bound)
    const z1Upper = zones.z2Upper * 0.8;
    
    // Count time in each zone
    let counts = { z1: 0, z2: 0, z3: 0, z4: 0, z5: 0, z6: 0 };
    
    hrRecords.forEach(hr => {
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
      hrRecords: hrRecords // For graphing
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
    
    const pct = (val) => Math.round(val / hrMax * 100);
    const bpm = (val) => Math.round(val);

    const labels = {
      1: `Z1: <${pct(zones.z2Upper * 0.8)}% (<${bpm(zones.z2Upper * 0.8)} bpm)`,
      2: `Z2: ${pct(zones.z2Upper * 0.8)}-${pct(zones.z2Upper)}% (${bpm(zones.z2Upper * 0.8)}-${bpm(zones.z2Upper)} bpm)`,
      3: `Z3: ${pct(zones.z2Upper)}-${pct(zones.z3Upper)}% (${bpm(zones.z2Upper)}-${bpm(zones.z3Upper)} bpm)`,
      4: `Z4: ${pct(zones.z3Upper)}-${pct(zones.z4Upper)}% (${bpm(zones.z3Upper)}-${bpm(zones.z4Upper)} bpm)`,
      5: `Z5: ${pct(zones.z4Upper)}-95% (${bpm(zones.z4Upper)}-${bpm(hrMax * 0.95)} bpm)`,
      6: `Z6: >95% (>${bpm(hrMax * 0.95)} bpm)`
    };

    return labels[zoneNum] || 'Unknown';
  }

  /**
   * Calculate zone distribution for a collection of runs
   */
  calculateZoneDistribution(runs) {
    const zones = this.dataProcessor.getZonesBPM();
    let totalDataPoints = 0;
    let counts = { z1: 0, z2: 0, z3: 0, z4: 0, z5: 0, z6: 0 };
    let distances = { z1: 0, z2: 0, z3: 0, z4: 0, z5: 0, z6: 0 };

    runs.forEach(run => {
      const hrDataType = this.getHRDataType(run);
      
      if (hrDataType === 'detailed') {
        const analysis = this.analyzeHRStream(run.hrStream, zones);
        if (analysis) {
          totalDataPoints += analysis.totalDataPoints;
          
          // Add to counts
          counts.z1 += analysis.totalDataPoints * (analysis.percentZ1 / 100);
          counts.z2 += analysis.totalDataPoints * (analysis.percentZ2 / 100);
          counts.z3 += analysis.totalDataPoints * (analysis.percentZ3 / 100);
          counts.z4 += analysis.totalDataPoints * (analysis.percentZ4 / 100);
          counts.z5 += analysis.totalDataPoints * (analysis.percentZ5 / 100);
          counts.z6 += analysis.totalDataPoints * (analysis.percentZ6 / 100);

          // Distribute distance proportionally
          distances.z1 += run.distance * (analysis.percentZ1 / 100);
          distances.z2 += run.distance * (analysis.percentZ2 / 100);
          distances.z3 += run.distance * (analysis.percentZ3 / 100);
          distances.z4 += run.distance * (analysis.percentZ4 / 100);
          distances.z5 += run.distance * (analysis.percentZ5 / 100);
          distances.z6 += run.distance * (analysis.percentZ6 / 100);
        }
      } else if (hrDataType === 'basic') {
        // Use average HR to assign entire run to one zone
        const zone = this.getZone(run.avgHR, zones);
        const zoneKey = `z${zone}`;
        distances[zoneKey] += run.distance;
      }
    });

    // Calculate percentages
    const percentages = {};
    for (let zone in counts) {
      percentages[zone] = totalDataPoints > 0 ? (counts[zone] / totalDataPoints * 100) : 0;
    }

    return {
      percentages,
      distances,
      totalDataPoints,
      runsAnalyzed: runs.length,
      runsWithDetailedHR: runs.filter(r => this.getHRDataType(r) === 'detailed').length
    };
  }

  /**
   * Generate HR graph SVG for a run
   */
  generateHRGraph(hrRecords, width = 400, height = 150) {
    const zones = this.dataProcessor.getZonesBPM();
    const hrMax = this.dataProcessor.hrMax;
    
    const padding = 30;
    const graphWidth = width - padding * 2;
    const graphHeight = height - padding * 2;
    
    // Sample data if too many points
    let sampledRecords = hrRecords;
    if (hrRecords.length > 200) {
      const step = Math.ceil(hrRecords.length / 200);
      sampledRecords = hrRecords.filter((_, i) => i % step === 0);
    }
    
    const minHR = Math.max(Math.min(...sampledRecords) - 10, 100);
    const maxHR = hrMax + 10;
    const hrRange = maxHR - minHR;
    
    // Create HR line path
    const pathData = sampledRecords.map((hr, i) => {
      const x = padding + (i / (sampledRecords.length - 1)) * graphWidth;
      const y = padding + graphHeight - ((hr - minHR) / hrRange) * graphHeight;
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');
    
    // Zone colors and rectangles
    const zoneConfig = [
      { upper: zones.z2Upper, color: 'rgba(52, 168, 83, 0.1)', label: 'Z2' },
      { upper: zones.z3Upper, color: 'rgba(251, 188, 4, 0.1)', label: 'Z3' },
      { upper: zones.z4Upper, color: 'rgba(255, 153, 0, 0.1)', label: 'Z4' },
      { upper: zones.z5Upper, color: 'rgba(234, 67, 53, 0.1)', label: 'Z5' }
    ];
    
    let zoneRects = '';
    let zoneLines = '';
    let prevY = padding + graphHeight;
    
    zoneConfig.forEach(zone => {
      if (zone.upper >= minHR && zone.upper <= maxHR) {
        const y = padding + graphHeight - ((zone.upper - minHR) / hrRange) * graphHeight;
        zoneRects += `<rect x="${padding}" y="${y}" width="${graphWidth}" height="${prevY - y}" fill="${zone.color}" />`;
        zoneLines += `<line x1="${padding}" y1="${y}" x2="${padding + graphWidth}" y2="${y}" stroke="#999" stroke-width="1" stroke-dasharray="3,3" opacity="0.5" />`;
        zoneLines += `<text x="${padding + graphWidth + 5}" y="${y + 4}" font-size="10" fill="#9aa0a6">${Math.round(zone.upper)}</text>`;
        prevY = y;
      }
    });
    
    return `
      <svg width="${width}" height="${height}" style="display: block; margin: 0 auto;">
        ${zoneRects}
        ${zoneLines}
        <path d="${pathData}" fill="none" stroke="#ea4335" stroke-width="2.5" />
        <line x1="${padding}" y1="${padding}" x2="${padding}" y2="${padding + graphHeight}" stroke="#2a2f3a" stroke-width="1.5" />
        <line x1="${padding}" y1="${padding + graphHeight}" x2="${padding + graphWidth}" y2="${padding + graphHeight}" stroke="#2a2f3a" stroke-width="1.5" />
        <text x="${padding - 5}" y="${padding - 5}" text-anchor="end" font-size="11" fill="#9aa0a6">${Math.round(maxHR)}</text>
        <text x="${padding - 5}" y="${padding + graphHeight + 5}" text-anchor="end" font-size="11" fill="#9aa0a6">${Math.round(minHR)}</text>
      </svg>
    `;
  }
}

// Export singleton
window.hrAnalyzer = new HRAnalyzer(window.dataProcessor);