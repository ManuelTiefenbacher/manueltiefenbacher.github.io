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
    if (!powerStream || !powerStream.watts || powerStream.watts.length < 30) {
      return null;
    }

    const watts = powerStream.watts.filter(w => w >= 0);
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
    const fourthPower = rollingAvg.map(w => Math.pow(w, 4));

    // Average and take 4th root
    const avgFourthPower = fourthPower.reduce((sum, w) => sum + w, 0) / fourthPower.length;
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
    if (!normalizedPower || !duration || !ftpValue || ftpValue === 0) return null;

    const intensityFactor = this.calculateIntensityFactor(normalizedPower, ftpValue);
    if (!intensityFactor) return null;

    const durationSeconds = duration * 60; // convert minutes to seconds
    const tss = (durationSeconds * normalizedPower * intensityFactor) / (ftpValue * 3600) * 100;
    
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
        const avg = windowWatts.reduce((sum, w) => sum + w, 0) / windowWatts.length;
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
        const avg = windowWatts.reduce((sum, w) => sum + w, 0) / windowWatts.length;
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
    const rides = this.dataProcessor.rides.filter(r => 
      r.powerStream && r.powerStream.watts && r.powerStream.watts.length > 300
    );

    if (rides.length === 0) {
      console.log('No rides with power data found');
      return null;
    }

    let best20Min = 0;
    let best5Min = 0;

    rides.forEach(ride => {
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
        maxPower: ride.maxPower || null
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
      ftp: this.ftp
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
      1: 'Z1: Active Recovery (<55% FTP)',
      2: 'Z2: Endurance (55-75% FTP)',
      3: 'Z3: Tempo (75-90% FTP)',
      4: 'Z4: Threshold (90-105% FTP)',
      5: 'Z5: VO2 Max (105-120% FTP)',
      6: 'Z6: Anaerobic (>120% FTP)'
    };
    return labels[zone] || 'Unknown';
  }

  /**
   * Calculate power zone distribution for a ride
   */
  analyzePowerZoneDistribution(powerStream) {
    if (!powerStream || !powerStream.watts) {
      return null;
    }

    const watts = powerStream.watts.filter(w => w >= 0);
    if (watts.length === 0) return null;

    const counts = { z1: 0, z2: 0, z3: 0, z4: 0, z5: 0, z6: 0 };

    watts.forEach(w => {
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
      totalDataPoints: total
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
}

// Initialize and export singleton
window.powerAnalyzer = new PowerAnalyzer(window.dataProcessor);