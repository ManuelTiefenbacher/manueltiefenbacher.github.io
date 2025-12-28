// js/analysis/intervalDetection.js
// Detect interval training patterns from pace data

class IntervalDetector {
  constructor() {
    this.MIN_INTERVAL_COUNT = 2; // Minimum 2 complete intervals
    this.PACE_VARIATION_THRESHOLD = 0.10; // 10% variation - more sensitive for time-based intervals
    this.MIN_INTERVAL_DURATION = 30; // Minimum 30 seconds per segment
  }

  /**
   * Detect if a run is an interval workout based on pace patterns
   * @param {Object} run - Run object with pace stream data
   * @returns {Object} - { isInterval: boolean, intervals: number, details: string }
   */
  detectInterval(run) {
    // Check if we have pace stream data
    if (!run.paceStream || !run.paceStream.pace || run.paceStream.pace.length < 10) {
      return { isInterval: false, intervals: 0, details: null };
    }

    const paces = run.paceStream.pace.filter(p => p > 0 && p < 20); // Filter valid paces (min/km)
    
    if (paces.length < 10) {
      return { isInterval: false, intervals: 0, details: null };
    }

    // Dynamically detect and remove warmup/cooldown
    const coreSection = this.extractCoreSection(paces, run.paceStream.time);
    
    if (coreSection.corePaces.length < 10) {
      return { isInterval: false, intervals: 0, details: null };
    }

    // Calculate average pace and standard deviation for CORE section only
    const avgPace = coreSection.corePaces.reduce((sum, p) => sum + p, 0) / coreSection.corePaces.length;
    const variance = coreSection.corePaces.reduce((sum, p) => sum + Math.pow(p - avgPace, 2), 0) / coreSection.corePaces.length;
    const stdDev = Math.sqrt(variance);
    
    // High coefficient of variation suggests interval training
    const coefficientOfVariation = stdDev / avgPace;
    
    // Detect pace segments (fast and slow) in CORE section
    const segments = this.detectPaceSegments(coreSection.corePaces, avgPace, coreSection.coreTimes);
    
    // Count transitions between fast and slow paces
    const intervalCount = Math.floor(segments.fastSegments.length);
    
    // More lenient detection: lower threshold and fewer required intervals
    const isInterval = (coefficientOfVariation > 0.12 && intervalCount >= 2) || // Lower CV threshold
                       (intervalCount >= 3 && segments.fastSegments.length >= 3); // Or clear pattern
    
    let details = null;
    if (isInterval) {
      const fastPace = this.formatPace(segments.avgFastPace);
      const slowPace = this.formatPace(segments.avgSlowPace);
      details = `~${intervalCount}x intervals (Fast: ${fastPace}, Recovery: ${slowPace})`;
    }

    return {
      isInterval,
      intervals: intervalCount,
      details,
      coefficientOfVariation
    };
  }

  /**
   * Dynamically extract core workout section by detecting warmup and cooldown
   * Uses pace progression analysis to find where the main workout starts and ends
   */
  extractCoreSection(paces, times) {
    if (paces.length < 30) {
      // Too short for warmup/cooldown detection
      return { corePaces: paces, coreTimes: times, warmupEnd: 0, cooldownStart: paces.length };
    }

    // Calculate moving average with window size
    const windowSize = Math.max(5, Math.floor(paces.length / 20));
    const movingAvg = this.calculateMovingAverage(paces, windowSize);
    
    // Find warmup end: look for where pace stabilizes after initial slowing
    const warmupEnd = this.findWarmupEnd(paces, movingAvg);
    
    // Find cooldown start: look for where pace starts consistently slowing at the end
    const cooldownStart = this.findCooldownStart(paces, movingAvg);
    
    // Extract core section
    const corePaces = paces.slice(warmupEnd, cooldownStart);
    const coreTimes = times ? times.slice(warmupEnd, cooldownStart) : null;
    
    return { corePaces, coreTimes, warmupEnd, cooldownStart };
  }

  /**
   * Calculate moving average for pace smoothing
   */
  calculateMovingAverage(paces, windowSize) {
    const result = [];
    for (let i = 0; i < paces.length; i++) {
      const start = Math.max(0, i - Math.floor(windowSize / 2));
      const end = Math.min(paces.length, i + Math.floor(windowSize / 2) + 1);
      const window = paces.slice(start, end);
      const avg = window.reduce((sum, p) => sum + p, 0) / window.length;
      result.push(avg);
    }
    return result;
  }

  /**
   * Find where warmup ends by detecting pace stabilization
   */
  findWarmupEnd(paces, movingAvg) {
    // Look at first 40% of run for warmup
    const searchEnd = Math.min(Math.floor(paces.length * 0.4), paces.length - 10);
    
    // Calculate overall average pace for comparison
    const overallAvg = paces.reduce((sum, p) => sum + p, 0) / paces.length;
    
    // Find where moving average stabilizes (stops getting consistently faster)
    let warmupEnd = 0;
    let consecutiveStable = 0;
    const requiredStable = 5;
    
    for (let i = 5; i < searchEnd; i++) {
      const paceChange = movingAvg[i] - movingAvg[i - 1];
      const relativePace = movingAvg[i] / overallAvg;
      
      // Pace is stabilizing if:
      // 1. Not getting much faster (paceChange > -0.05)
      // 2. Within reasonable range of overall average (0.85 to 1.15)
      if (paceChange > -0.05 && relativePace > 0.85 && relativePace < 1.15) {
        consecutiveStable++;
        if (consecutiveStable >= requiredStable) {
          warmupEnd = i - requiredStable;
          break;
        }
      } else {
        consecutiveStable = 0;
      }
    }
    
    return warmupEnd;
  }

  /**
   * Find where cooldown starts by detecting sustained pace slowing
   */
  findCooldownStart(paces, movingAvg) {
    // Look at last 40% of run for cooldown
    const searchStart = Math.max(Math.floor(paces.length * 0.6), 10);
    
    // Calculate average pace of middle section
    const middleStart = Math.floor(paces.length * 0.3);
    const middleEnd = Math.floor(paces.length * 0.7);
    const middleAvg = paces.slice(middleStart, middleEnd).reduce((sum, p) => sum + p, 0) / (middleEnd - middleStart);
    
    // Find where pace starts consistently slowing (cooling down)
    let cooldownStart = paces.length;
    let consecutiveSlow = 0;
    const requiredSlow = 5;
    
    for (let i = searchStart; i < paces.length - 5; i++) {
      const paceChange = movingAvg[i + 1] - movingAvg[i];
      const relativePace = movingAvg[i] / middleAvg;
      
      // Cooldown detected if:
      // 1. Pace is slowing (paceChange > 0.03)
      // 2. Significantly slower than middle section (> 1.08)
      if (paceChange > 0.03 || relativePace > 1.08) {
        consecutiveSlow++;
        if (consecutiveSlow >= requiredSlow) {
          cooldownStart = i - requiredSlow;
          break;
        }
      } else {
        consecutiveSlow = 0;
      }
    }
    
    return cooldownStart;
  }

  /**
   * Detect fast and slow effort segments based on relative speed changes
   * This detects time-based intervals (3min fast, 3min slow) regardless of absolute pace
   */
  detectPaceSegments(paces, avgPace, times) {
    // Convert pace (min/km) to speed (km/min) for more intuitive comparison
    const speeds = paces.map(p => 1 / p);
    const avgSpeed = 1 / avgPace;
    
    // Calculate dynamic threshold based on pace variability
    const speedStdDev = this.calculateStdDev(speeds);
    const threshold = avgSpeed + (speedStdDev * 0.4); // Fast = 0.4 std dev above average speed
    
    let fastSegments = [];
    let slowSegments = [];
    let currentSegment = null;
    let segmentStart = 0;
    let segmentStartTime = 0;
    let segmentPaces = [];
    let segmentSpeeds = [];
    
    speeds.forEach((speed, i) => {
      const isFast = speed > threshold;
      
      if (currentSegment === null) {
        currentSegment = isFast ? 'fast' : 'slow';
        segmentStart = i;
        segmentStartTime = times ? times[i] : i;
        segmentPaces = [paces[i]];
        segmentSpeeds = [speed];
      } else if ((isFast && currentSegment === 'slow') || (!isFast && currentSegment === 'fast')) {
        // Segment changed - save previous segment if long enough
        const duration = times && times[i] 
          ? times[i] - segmentStartTime
          : (i - segmentStart);
        
        // More lenient: accept segments 30+ seconds with at least 3 data points
        if (duration >= 30 && segmentPaces.length >= 3) {
          const avgSegmentPace = segmentPaces.reduce((sum, p) => sum + p, 0) / segmentPaces.length;
          const avgSegmentSpeed = segmentSpeeds.reduce((sum, s) => sum + s, 0) / segmentSpeeds.length;
          
          if (currentSegment === 'fast') {
            fastSegments.push({ 
              start: segmentStart, 
              end: i, 
              avgPace: avgSegmentPace, 
              avgSpeed: avgSegmentSpeed,
              duration 
            });
          } else {
            slowSegments.push({ 
              start: segmentStart, 
              end: i, 
              avgPace: avgSegmentPace,
              avgSpeed: avgSegmentSpeed, 
              duration 
            });
          }
        }
        
        currentSegment = isFast ? 'fast' : 'slow';
        segmentStart = i;
        segmentStartTime = times ? times[i] : i;
        segmentPaces = [paces[i]];
        segmentSpeeds = [speed];
      } else {
        // Continue current segment
        segmentPaces.push(paces[i]);
        segmentSpeeds.push(speed);
      }
    });
    
    // Handle last segment
    if (segmentPaces.length >= 3) {
      const duration = times && times[times.length - 1]
        ? times[times.length - 1] - segmentStartTime
        : (paces.length - segmentStart);
      
      if (duration >= 30) {
        const avgSegmentPace = segmentPaces.reduce((sum, p) => sum + p, 0) / segmentPaces.length;
        const avgSegmentSpeed = segmentSpeeds.reduce((sum, s) => sum + s, 0) / segmentSpeeds.length;
        
        if (currentSegment === 'fast') {
          fastSegments.push({ 
            start: segmentStart, 
            end: paces.length, 
            avgPace: avgSegmentPace,
            avgSpeed: avgSegmentSpeed, 
            duration 
          });
        } else {
          slowSegments.push({ 
            start: segmentStart, 
            end: paces.length, 
            avgPace: avgSegmentPace,
            avgSpeed: avgSegmentSpeed, 
            duration 
          });
        }
      }
    }
    
    // Filter out segments that are too similar (no real speed difference)
    // Only keep segments where fast segments are meaningfully faster
    if (fastSegments.length > 0 && slowSegments.length > 0) {
      const avgFastSpeed = fastSegments.reduce((sum, s) => sum + s.avgSpeed, 0) / fastSegments.length;
      const avgSlowSpeed = slowSegments.reduce((sum, s) => sum + s.avgSpeed, 0) / slowSegments.length;
      
      // Require at least 6% speed difference between fast and slow
      const speedDifference = (avgFastSpeed - avgSlowSpeed) / avgSlowSpeed;
      
      if (speedDifference < 0.06) {
        // Not enough difference - likely steady pace run
        return { fastSegments: [], slowSegments: [], avgFastPace: avgPace, avgSlowPace: avgPace };
      }
    }
    
    // Calculate average fast and slow paces
    const avgFastPace = fastSegments.length > 0
      ? fastSegments.reduce((sum, s) => sum + s.avgPace, 0) / fastSegments.length
      : avgPace;
    
    const avgSlowPace = slowSegments.length > 0
      ? slowSegments.reduce((sum, s) => sum + s.avgPace, 0) / slowSegments.length
      : avgPace;
    
    return { fastSegments, slowSegments, avgFastPace, avgSlowPace };
  }

  /**
   * Calculate standard deviation
   */
  calculateStdDev(values) {
    const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  /**
   * Format pace as min:sec per km
   */
  formatPace(pace) {
    const minutes = Math.floor(pace);
    const seconds = Math.round((pace - minutes) * 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}/km`;
  }

  /**
   * Calculate average pace for a run
   */
  calculateAveragePace(run) {
    if (run.paceStream && run.paceStream.pace) {
      const validPaces = run.paceStream.pace.filter(p => p > 0 && p < 20);
      if (validPaces.length > 0) {
        return validPaces.reduce((sum, p) => sum + p, 0) / validPaces.length;
      }
    }
    
    // Fallback: calculate from distance and duration
    if (run.distance > 0 && run.duration > 0) {
      return run.duration / run.distance; // min/km
    }
    
    return null;
  }
}

// Export singleton
window.intervalDetector = new IntervalDetector();