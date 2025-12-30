
// js/core/dataProcessor.js
// Unified data processing for all sources (Strava API, ZIP, etc.)

class DataProcessor {
  constructor() {
    this.runs = [];
    this.rides = [];
    this.swims = [];
    this.hrMax = 190;
    this.zones = {
      z2Upper: 0.75,
      z3Upper: 0.85,
      z4Upper: 0.90,
      z5Upper: 0.95
    };
  }

  /**
   * Normalize run-like activity to unified format
   * Handles data from Strava API, CSV, and TCX files
   * NOTE: Used for runs, rides, and swims to keep a common shape.
   */
  normalizeRun(run) {
    return {
      id: run.id,
      date: run.date instanceof Date ? run.date : new Date(run.date),
      distance: Number(run.distance) || 0,   // kilometers or meters based on your upstream parser
      duration: Number(run.duration) || 0,   // seconds
      avgHR: Number(run.avgHR) || null,
      maxHR: Number(run.maxHR) || null,

      // Unified HR stream format: { heartrate: [...], time: [...] }
      hrStream: this.normalizeHRStream(run.hrStream),

      // Unified pace stream format: { pace: [...], time: [...] }
      // For rides/swims, you may feed speed/cadence/etc. through paceStream
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
   * pace in min/km (filter unrealistic values)
   */
  normalizePaceStream(paceStream) {
    if (!paceStream) return null;

    // Already in correct format
    if (paceStream.pace && paceStream.time) {
      return {
        pace: paceStream.pace.filter(p => p > 0 && p < 20), // min/km
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
   * Add rides from any source with automatic deduplication
   */
  addRides(newRides, source = 'unknown') {
    const normalized = newRides.map(ride => ({
      ...this.normalizeRun(ride),
      source
    }));

    const combined = [...this.rides, ...normalized];
    const uniqueMap = new Map();

    combined.forEach(ride => {
      const existing = uniqueMap.get(ride.id);
      if (!existing || this.hasMoreData(ride, existing)) {
        uniqueMap.set(ride.id, ride);
      }
    });

    this.rides = Array.from(uniqueMap.values())
      .sort((a, b) => b.date - a.date);

    console.log(`📊 Total unique rides: ${this.rides.length} (added ${normalized.length} from ${source})`);
    return this.rides;
  }

  /**
   * Add swims from any source with automatic deduplication
   */
  addSwims(newSwims, source = 'unknown') {
    const normalized = newSwims.map(swim => ({
      ...this.normalizeRun(swim),
      source
    }));

    const combined = [...this.swims, ...normalized];
    const uniqueMap = new Map();

    combined.forEach(swim => {
      const existing = uniqueMap.get(swim.id);
      if (!existing || this.hasMoreData(swim, existing)) {
        uniqueMap.set(swim.id, swim);
      }
    });

    this.swims = Array.from(uniqueMap.values())
      .sort((a, b) => b.date - a.date);

    console.log(`📊 Total unique swims: ${this.swims.length} (added ${normalized.length} from ${source})`);
    return this.swims;
  }

  /**
   * Check if activity A has more complete data than activity B
   */
  hasMoreData(runA, runB) {
    // Prefer activities with detailed HR stream
    const aHasStream = runA.hrStream?.heartrate?.length > 0;
    const bHasStream = runB.hrStream?.heartrate?.length > 0;

    if (aHasStream && !bHasStream) return true;
    if (!aHasStream && bHasStream) return false;

    // If both have streams, prefer the longer one
    if (aHasStream && bHasStream) {
      return runA.hrStream.heartrate.length > runB.hrStream.heartrate.length;
    }

    // Prefer activities with pace data
    const aHasPace = runA.paceStream?.pace?.length > 0;
    const bHasPace = runB.paceStream?.pace?.length > 0;

    if (aHasPace && !bHasPace) return true;
    if (!aHasPace && bHasPace) return false;

    // Prefer activities with basic HR data
    const aHasBasicHR = runA.avgHR > 0 && runA.maxHR > 0;
    const bHasBasicHR = runB.avgHR > 0 && runB.maxHR > 0;

    return aHasBasicHR && !bHasBasicHR;
  }

  /* ---------------- Range filters ---------------- */

  /**
   * Get runs filtered by date range
   */
  getRunsInRange(days = null, startDate = null, endDate = null) {
    return this._getInRange(this.runs, days, startDate, endDate);
  }

  /**
   * Get rides filtered by date range
   */
  getRidesInRange(days = null, startDate = null, endDate = null) {
    return this._getInRange(this.rides, days, startDate, endDate);
  }

  /**
   * Get swims filtered by date range
   */
  getSwimsInRange(days = null, startDate = null, endDate = null) {
    return this._getInRange(this.swims, days, startDate, endDate);
  }

  /**
   * Generic range filter
   */
  _getInRange(list, days = null, startDate = null, endDate = null) {
    if (days !== null) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      return list.filter(a => a.date >= cutoff);
    }

    if (startDate && endDate) {
      return list.filter(a => a.date >= startDate && a.date <= endDate);
    }

    return list;
  }

  /* ---------------- Metrics ---------------- */

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
    this.rides = [];
    this.swims = [];
    console.log('🗑️ All data cleared');
  }

  /* ---------------- Summaries ---------------- */

  /**
   * Helper: compute summary for a list with range selectors
   */
  _computeSummary(list, getInRangeFn) {
    const last7   = getInRangeFn.call(this, 7);
    const last28  = getInRangeFn.call(this, 28);
    const last180 = getInRangeFn.call(this, 180);

    const distance7   = last7.reduce((sum, a) => sum + (a.distance || 0), 0);
    const distance28  = last28.reduce((sum, a) => sum + (a.distance || 0), 0);
    const distance180 = last180.reduce((sum, a) => sum + (a.distance || 0), 0);

    return {
      total: list.length,
      last7Days: {
        count: last7.length,
        distance: distance7
      },
      last28Days: {
        count: last28.length,
        distance: distance28
      },
      last6Months: {
        count: last180.length,
        distance: distance180,
        avgWeekly: distance180 / (180 / 7)
      },
      hrData: {
        withBasicHR: list.filter(a => (a.avgHR || 0) > 0).length,
        withStreamHR: list.filter(a => a.hrStream?.heartrate?.length > 0).length
      },
      paceData: {
        withPace: list.filter(a => a.paceStream?.pace?.length > 0).length
      }
    };
  }

  /**
   * Get summary statistics for RUNS
   * (keeps the same structure as your original getSummary, but scoped to runs)
   */
  getSummaryRuns() {
    const summary = this._computeSummary(this.runs, this.getRunsInRange);
    // Preserve keys expected by original code
    return {
      totalRuns: summary.total,
      last7Days: { runs: summary.last7Days.count, distance: summary.last7Days.distance },
      last28Days: { runs: summary.last28Days.count, distance: summary.last28Days.distance },
      last6Months: { runs: summary.last6Months.count, distance: summary.last6Months.distance, avgWeekly: summary.last6Months.avgWeekly },
      hrData: { maxHR: this.hrMax, runsWithBasicHR: summary.hrData.withBasicHR, runsWithStreamHR: summary.hrData.withStreamHR },
      paceData: { runsWithPace: summary.paceData.withPace }
    };
  }

  /**
   * Get summary statistics for RIDES
   */
  getSummaryRides() {
    const summary = this._computeSummary(this.rides, this.getRidesInRange);
    return {
      totalRides: summary.total,
      last7Days: { rides: summary.last7Days.count, distance: summary.last7Days.distance },
      last28Days: { rides: summary.last28Days.count, distance: summary.last28Days.distance },
      last6Months: { rides: summary.last6Months.count, distance: summary.last6Months.distance, avgWeekly: summary.last6Months.avgWeekly },
      hrData: { ridesWithBasicHR: summary.hrData.withBasicHR, ridesWithStreamHR: summary.hrData.withStreamHR },
      paceData: { ridesWithPace: summary.paceData.withPace }
    };
  }

  /**
   * Get summary statistics for SWIMS
   */
  getSummarySwims() {
    const summary = this._computeSummary(this.swims, this.getSwimsInRange);
    return {
      totalSwims: summary.total,
      last7Days: { swims: summary.last7Days.count, distance: summary.last7Days.distance },
      last28Days: { swims: summary.last28Days.count, distance: summary.last28Days.distance },
      last6Months: { swims: summary.last6Months.count, distance: summary.last6Months.distance, avgWeekly: summary.last6Months.avgWeekly },
      hrData: { swimsWithBasicHR: summary.hrData.withBasicHR, swimsWithStreamHR: summary.hrData.withStreamHR },
      paceData: { swimsWithPace: summary.paceData.withPace }
    };
  }

  /**
   * Backwards compatibility:
   * Keep the original name `getSummary()` for runs to avoid breaking callers.
   */
  getSummary() {
    return this.getSummaryRuns();
  }

  /**
   * Optional: Combined summary across runs, rides, and swims
   */
  getSummaryAll() {
    const runs    = this.getSummaryRuns();
    const rides   = this.getSummaryRides();
    const swims   = this.getSummarySwims();

    const totalActivities =
      (runs?.totalRuns || 0) +
      (rides?.totalRides || 0) +
      (swims?.totalSwims || 0);

    const aggDistance7  = (runs.last7Days.distance || 0) + (rides.last7Days.distance || 0) + (swims.last7Days.distance || 0);
    const aggDistance28 = (runs.last28Days.distance || 0) + (rides.last28Days.distance || 0) + (swims.last28Days.distance || 0);
    const aggDistance180= (runs.last6Months.distance || 0) + (rides.last6Months.distance || 0) + (swims.last6Months.distance || 0);

    return {
      totals: {
        activities: totalActivities,
        runs: runs.totalRuns,
        rides: rides.totalRides,
        swims: swims.totalSwims
      },
      last7Days: {
        distance: aggDistance7,
        runs: runs.last7Days.runs,
        rides: rides.last7Days.rides,
        swims: swims.last7Days.swims
      },
      last28Days: {
        distance: aggDistance28,
        runs: runs.last28Days.runs,
        rides: rides.last28Days.rides,
        swims: swims.last28Days.swims
      },
      last6Months: {
        distance: aggDistance180,
        avgWeekly: (runs.last6Months.avgWeekly || 0) + (rides.last6Months.avgWeekly || 0) + (swims.last6Months.avgWeekly || 0),
        runs: runs.last6Months.runs,
        rides: rides.last6Months.rides,
        swims: swims.last6Months.swims
      }
    };
  }
}

// Export singleton instance
window.dataProcessor = new DataProcessor();
