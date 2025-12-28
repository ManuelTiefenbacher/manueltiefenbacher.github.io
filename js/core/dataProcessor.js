// js/core/dataProcessor.js
// Unified data processing for all sources (Strava API, ZIP, etc.)

class DataProcessor {
  constructor() {
    this.runs = [];
    this.hrMax = 190;
    this.zones = {
      z2Upper: 0.75,
      z3Upper: 0.85,
      z4Upper: 0.90,
      z5Upper: 0.95
    };
  }

  /**
   * Normalize run data to unified format
   * Handles data from Strava API, CSV, and TCX files
   */
  normalizeRun(run) {
    return {
      id: run.id,
      date: run.date instanceof Date ? run.date : new Date(run.date),
      distance: Number(run.distance) || 0,
      duration: Number(run.duration) || 0,
      avgHR: Number(run.avgHR) || null,
      maxHR: Number(run.maxHR) || null,
      
      // Unified HR stream format: { heartrate: [...], time: [...] }
      hrStream: this.normalizeHRStream(run.hrStream),
      
      // Unified pace stream format: { pace: [...], time: [...] }
      paceStream: this.normalizePaceStream(run.paceStream),
      
      // Metadata
      source: run.source || 'unknown',
      filename: run.filename || null
    };
  }

  /**
   * Normalize HR stream to consistent format
   */
  normalizeHRStream(hrStream) {
    if (!hrStream) return null;
    
    // Already in correct format
    if (hrStream.heartrate && hrStream.time) {
      return {
        heartrate: hrStream.heartrate.filter(hr => hr > 0 && hr < 250),
        time: hrStream.time
      };
    }
    
    // Legacy format from TCX parser
    if (hrStream.records) {
      return {
        heartrate: hrStream.records.map(r => r.heart_rate),
        time: hrStream.records.map((r, i) => i) // Use index if no time
      };
    }
    
    return null;
  }

  /**
   * Normalize pace stream to consistent format
   */
  normalizePaceStream(paceStream) {
    if (!paceStream) return null;
    
    // Already in correct format
    if (paceStream.pace && paceStream.time) {
      return {
        pace: paceStream.pace.filter(p => p > 0 && p < 20), // min/km, filter unrealistic values
        time: paceStream.time
      };
    }
    
    return null;
  }

  /**
   * Add runs from any source with automatic deduplication
   */
  addRuns(newRuns, source = 'unknown') {
    const normalized = newRuns.map(run => ({
      ...this.normalizeRun(run),
      source
    }));

    // Combine and deduplicate (keep latest occurrence)
    const combined = [...this.runs, ...normalized];
    const uniqueMap = new Map();
    
    combined.forEach(run => {
      const existing = uniqueMap.get(run.id);
      // Keep the one with more data (prefer detailed HR over basic)
      if (!existing || this.hasMoreData(run, existing)) {
        uniqueMap.set(run.id, run);
      }
    });

    this.runs = Array.from(uniqueMap.values())
      .sort((a, b) => b.date - a.date);

    console.log(`📊 Total unique runs: ${this.runs.length} (added ${normalized.length} from ${source})`);
    return this.runs;
  }

  /**
   * Check if run A has more complete data than run B
   */
  hasMoreData(runA, runB) {
    // Prefer runs with detailed HR stream
    const aHasStream = runA.hrStream?.heartrate?.length > 0;
    const bHasStream = runB.hrStream?.heartrate?.length > 0;
    
    if (aHasStream && !bHasStream) return true;
    if (!aHasStream && bHasStream) return false;
    
    // If both have streams, prefer the longer one
    if (aHasStream && bHasStream) {
      return runA.hrStream.heartrate.length > runB.hrStream.heartrate.length;
    }
    
    // Prefer runs with pace data
    const aHasPace = runA.paceStream?.pace?.length > 0;
    const bHasPace = runB.paceStream?.pace?.length > 0;
    
    if (aHasPace && !bHasPace) return true;
    if (!aHasPace && bHasPace) return false;
    
    // Prefer runs with basic HR data
    const aHasBasicHR = runA.avgHR > 0 && runA.maxHR > 0;
    const bHasBasicHR = runB.avgHR > 0 && runB.maxHR > 0;
    
    return aHasBasicHR && !bHasBasicHR;
  }

  /**
   * Get runs filtered by date range
   */
  getRunsInRange(days = null, startDate = null, endDate = null) {
    if (days !== null) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      return this.runs.filter(r => r.date >= cutoff);
    }
    
    if (startDate && endDate) {
      return this.runs.filter(r => r.date >= startDate && r.date <= endDate);
    }
    
    return this.runs;
  }

  /**
   * Calculate maximum HR from all runs
   */
  calculateMaxHR() {
    let maxHR = 0;
    let maxActivity = null;

    this.runs.forEach(run => {
      // Check basic max HR
      if (run.maxHR && run.maxHR > maxHR) {
        maxHR = run.maxHR;
        maxActivity = run;
      }

      // Check detailed HR stream
      if (run.hrStream?.heartrate?.length > 0) {
        const streamMax = Math.max(...run.hrStream.heartrate);
        if (streamMax > maxHR) {
          maxHR = streamMax;
          maxActivity = run;
        }
      }
    });

    if (maxHR > 0) {
      this.hrMax = maxHR;
      console.log(`❤️ Max HR: ${maxHR} bpm from ${maxActivity.date.toLocaleDateString()}`);
    }

    return { maxHR, activity: maxActivity };
  }

  /**
   * Update zone boundaries
   */
  setZones(zones) {
    // Validate zones
    const values = [zones.z2Upper, zones.z3Upper, zones.z4Upper, zones.z5Upper];
    const valid = values.every(v => typeof v === 'number' && v > 0 && v < 1) &&
                  values[0] < values[1] && values[1] < values[2] && values[2] < values[3];
    
    if (!valid) {
      throw new Error('Invalid zone boundaries');
    }

    this.zones = { ...zones };
    console.log('🎯 Zones updated:', this.zones);
  }

  /**
   * Get zone boundaries in BPM
   */
  getZonesBPM() {
    return {
      z2Upper: this.zones.z2Upper * this.hrMax,
      z3Upper: this.zones.z3Upper * this.hrMax,
      z4Upper: this.zones.z4Upper * this.hrMax,
      z5Upper: this.zones.z5Upper * this.hrMax
    };
  }

  /**
   * Clear all data
   */
  clear() {
    this.runs = [];
    console.log('🗑️ All data cleared');
  }

  /**
   * Get summary statistics
   */
  getSummary() {
    const last7 = this.getRunsInRange(7);
    const last28 = this.getRunsInRange(28);
    const last180 = this.getRunsInRange(180);

    return {
      totalRuns: this.runs.length,
      last7Days: {
        runs: last7.length,
        distance: last7.reduce((sum, r) => sum + r.distance, 0)
      },
      last28Days: {
        runs: last28.length,
        distance: last28.reduce((sum, r) => sum + r.distance, 0)
      },
      last6Months: {
        runs: last180.length,
        distance: last180.reduce((sum, r) => sum + r.distance, 0),
        avgWeekly: last180.reduce((sum, r) => sum + r.distance, 0) / (180 / 7)
      },
      hrData: {
        maxHR: this.hrMax,
        runsWithBasicHR: this.runs.filter(r => r.avgHR > 0).length,
        runsWithStreamHR: this.runs.filter(r => r.hrStream?.heartrate?.length > 0).length
      },
      paceData: {
        runsWithPace: this.runs.filter(r => r.paceStream?.pace?.length > 0).length
      }
    };
  }
}

// Export singleton instance
window.dataProcessor = new DataProcessor();