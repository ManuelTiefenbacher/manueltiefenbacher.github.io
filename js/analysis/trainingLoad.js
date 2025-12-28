// js/analysis/trainingLoad.js
// Training load analysis and traffic light system

class TrainingLoadAnalyzer {
  constructor(dataProcessor, runClassifier) {
    this.dataProcessor = dataProcessor;
    this.runClassifier = runClassifier;
  }

  /**
   * Analyze training load and return all metrics
   */
  analyze(runs) {
    const last7 = this.dataProcessor.getRunsInRange(7);
    const last14 = this.dataProcessor.getRunsInRange(14);
    const last28 = this.dataProcessor.getRunsInRange(28);

    // Classify runs
    const classifications7 = this.runClassifier.classifyMultiple(last7);
    const classifications14 = this.runClassifier.classifyMultiple(last14);
    const classifications28 = this.runClassifier.classifyMultiple(last28);

    return {
      recovery: this.analyzeRecovery(classifications7, classifications14, last7),
      intensity: this.analyzeIntensityDistribution(classifications28, last28),
      volume: this.analyzeVolume(last7, last14, last28),
      longRuns: this.analyzeLongRuns(runs, last28),
      raceEfforts: this.analyzeRaceEfforts(classifications7, classifications14, classifications28)
    };
  }

  /**
   * Analyze recovery and rest days
   */
  analyzeRecovery(class7, class14, runs7) {
    const categories7 = class7.map(c => c.classification.category.split(' (')[0]);
    
    const highIntensity = categories7.filter(c => 
      c === 'Intensity Effort' || c === 'Race Effort'
    ).length;
    
    const z2 = categories7.filter(c => c === 'Z2').length;
    const total = categories7.length;
    
    const daysSinceLastRun = runs7.length > 0 
      ? window.helpers.daysAgo(runs7[0].date)
      : 7;

    let status = 'green';
    let message = '';

    if (total === 0) {
      status = 'yellow';
      message = `No runs recorded in the last 7 days. ${daysSinceLastRun} days of rest.`;
    } else if (highIntensity >= 4) {
      status = 'red';
      message = `${highIntensity} high-intensity sessions in 7 days with only ${z2} easy runs. High training stress detected.`;
    } else if (highIntensity === 3 && z2 < 2) {
      status = 'yellow';
      message = `${highIntensity} high-intensity sessions with limited easy running (${z2} Z2 runs). Recovery may be insufficient.`;
    } else if (total >= 6 && z2 < 3) {
      status = 'yellow';
      message = `${total} runs in 7 days but only ${z2} easy efforts. Volume is high with limited recovery runs.`;
    } else if (z2 >= total * 0.6) {
      status = 'green';
      message = `Good recovery balance: ${z2} easy runs out of ${total} total runs (${(z2/total*100).toFixed(0)}% easy).`;
    } else {
      status = 'green';
      message = `${total} runs in the last week with ${highIntensity} high-intensity sessions. Training load appears manageable.`;
    }

    const tooltip = `🟢 Green: ≥60% easy runs OR manageable load
🟡 Yellow: No runs, or 3+ high-intensity with <2 easy, or 6+ runs with <3 easy
🔴 Red: 4+ high-intensity sessions in 7 days with insufficient recovery`;

    return { status, message, metric: 'Recovery & Rest', tooltip };
  }

  /**
   * Analyze intensity distribution (80/20 principle)
   */
  analyzeIntensityDistribution(class28, runs28) {
    const categories = class28.map(c => c.classification.category.split(' (')[0]);
    
    const z2 = categories.filter(c => c === 'Z2').length;
    const intensity = categories.filter(c => c === 'Intensity Effort').length;
    const race = categories.filter(c => c === 'Race Effort').length;
    const total = categories.length;

    const z2Distance = class28
      .filter(c => c.classification.category.split(' (')[0] === 'Z2')
      .reduce((sum, c) => sum + c.run.distance, 0);
    
    const hardDistance = class28
      .filter(c => {
        const cat = c.classification.category.split(' (')[0];
        return cat === 'Intensity Effort' || cat === 'Race Effort';
      })
      .reduce((sum, c) => sum + c.run.distance, 0);
    
    const totalDistance = runs28.reduce((sum, r) => sum + r.distance, 0);

    let status = 'green';
    let message = '';

    const z2Pct = total > 0 ? (z2 / total * 100) : 0;
    const hardPct = total > 0 ? ((intensity + race) / total * 100) : 0;

    if (total === 0) {
      status = 'yellow';
      message = 'No runs in the last 28 days. Training consistency is very low.';
    } else if (z2Pct < 50 && hardPct > 40) {
      status = 'red';
      message = `Training is heavily skewed toward intensity: ${hardPct.toFixed(0)}% hard efforts vs ${z2Pct.toFixed(0)}% easy. Risk of overtraining and injury.`;
    } else if (z2Pct < 60 && hardPct > 30) {
      status = 'yellow';
      message = `Intensity distribution: ${z2Pct.toFixed(0)}% easy, ${hardPct.toFixed(0)}% hard. Below the recommended 80/20 principle.`;
    } else if (z2Pct >= 75) {
      status = 'green';
      message = `Excellent polarization: ${z2Pct.toFixed(0)}% easy runs (${z2Distance.toFixed(1)} km), ${hardPct.toFixed(0)}% hard efforts (${hardDistance.toFixed(1)} km). Training follows 80/20 principle.`;
    } else {
      status = 'green';
      message = `Balanced distribution over ${total} runs: ${z2} easy, ${intensity} intensity, ${race} race efforts. Total: ${totalDistance.toFixed(1)} km.`;
    }

    const tooltip = `🟢 Green: ≥60% easy runs following 80/20 principle
🟡 Yellow: <60% easy with >30% hard, or no runs in 28 days
🔴 Red: <50% easy with >40% hard efforts - overtraining risk`;

    return { status, message, metric: 'Intensity Distribution (28 days)', tooltip };
  }

  /**
   * Analyze volume progression
   */
  analyzeVolume(runs7, runs14, runs28) {
    const dist7 = runs7.reduce((sum, r) => sum + r.distance, 0);
    const dist14 = runs14.reduce((sum, r) => sum + r.distance, 0);
    const dist28 = runs28.reduce((sum, r) => sum + r.distance, 0);

    const avgWeek7 = dist7;
    const avgWeek14 = dist14 / 2;
    const avgWeek28 = dist28 / 4;

    let status = 'green';
    let message = '';

    const changeWeekly = avgWeek14 > 0 ? ((avgWeek7 - avgWeek14) / avgWeek14 * 100) : 0;

    if (dist7 === 0) {
      status = 'yellow';
      message = 'No running volume in the last 7 days.';
    } else if (changeWeekly > 30) {
      status = 'red';
      message = `Volume increased ${changeWeekly.toFixed(0)}% from previous week (${avgWeek7.toFixed(1)} km vs ${avgWeek14.toFixed(1)} km). Exceeds the 10% rule significantly.`;
    } else if (changeWeekly > 15) {
      status = 'yellow';
      message = `Volume increased ${changeWeekly.toFixed(0)}% this week (${avgWeek7.toFixed(1)} km vs ${avgWeek14.toFixed(1)} km avg). Moderate increase detected.`;
    } else if (changeWeekly < -40) {
      status = 'yellow';
      message = `Volume decreased ${Math.abs(changeWeekly).toFixed(0)}% (${avgWeek7.toFixed(1)} km this week vs ${avgWeek14.toFixed(1)} km average). Significant drop in training load.`;
    } else {
      status = 'green';
      message = `Consistent weekly volume: ${avgWeek7.toFixed(1)} km last 7 days, ${avgWeek28.toFixed(1)} km average per week over 28 days.`;
    }

    const tooltip = `🟢 Green: Volume change within ±15% (respects 10% rule)
🟡 Yellow: 15-30% increase or >40% decrease, or no volume
🔴 Red: >30% weekly increase - high injury risk`;

    return { status, message, metric: 'Volume Progression', tooltip };
  }

  /**
   * Analyze long run frequency
   */
  analyzeLongRuns(allRuns, runs28) {
    const summary = this.dataProcessor.getSummary();
    const avgWeekly = summary.last6Months.avgWeekly;
    
    const longRuns = runs28.filter(r => r.distance > (0.5 * avgWeekly));
    const now = new Date();
    const daysSinceLastLong = longRuns.length > 0 
      ? Math.min(...longRuns.map(r => window.helpers.daysAgo(r.date)))
      : 28;

    let status = 'green';
    let message = '';

    if (longRuns.length === 0) {
      status = 'yellow';
      message = `No long runs (>weekly average) in the last 28 days. Last long run was ${daysSinceLastLong}+ days ago.`;
    } else if (longRuns.length >= 4) {
      status = 'yellow';
      message = `${longRuns.length} long runs in 28 days. High frequency may impact recovery.`;
    } else if (daysSinceLastLong <= 10) {
      status = 'green';
      message = `${longRuns.length} long run(s) in last 28 days. Most recent: ${daysSinceLastLong} days ago. Consistent endurance training.`;
    } else {
      status = 'green';
      message = `${longRuns.length} long run(s) completed. Last long run: ${daysSinceLastLong} days ago.`;
    }

    const tooltip = `🟢 Green: 1-3 long runs in 28 days with recent activity
🟡 Yellow: No long runs in 28 days, or 4+ long runs (may impact recovery)

Long run = distance >50% of weekly average`;

    return { status, message, metric: 'Long Run Frequency', tooltip };
  }

  /**
   * Analyze race effort frequency
   */
  analyzeRaceEfforts(class7, class14, class28) {
    const getRaceCount = (classifications) => {
      return classifications.filter(c => 
        c.classification.category.split(' (')[0] === 'Race Effort'
      ).length;
    };

    const race7 = getRaceCount(class7);
    const race14 = getRaceCount(class14);
    const race28 = getRaceCount(class28);

    let status = 'green';
    let message = '';

    if (race7 >= 3) {
      status = 'red';
      message = `${race7} race-effort runs in 7 days. Very high anaerobic stress with elevated injury risk.`;
    } else if (race7 === 2 && class7.length <= 4) {
      status = 'yellow';
      message = `${race7} race efforts out of ${class7.length} runs this week. High proportion of maximal efforts.`;
    } else if (race14 >= 4) {
      status = 'yellow';
      message = `${race14} race efforts in the last 14 days. Consider spacing out maximal efforts.`;
    } else if (race28 === 0) {
      status = 'green';
      message = 'No race-effort runs in the last 28 days. Training focused on aerobic development.';
    } else if (race28 <= 3) {
      status = 'green';
      message = `${race28} race effort(s) in 28 days. Appropriate frequency for high-intensity work.`;
    } else {
      status = 'yellow';
      message = `${race28} race efforts in 28 days. High frequency of maximal efforts detected.`;
    }

    const tooltip = `🟢 Green: 0-3 race efforts in 28 days (appropriate spacing)
🟡 Yellow: 2 race efforts with few total runs, or 4+ in 14 days, or 4+ in 28 days
🔴 Red: 3+ race efforts in 7 days - very high anaerobic stress`;

    return { status, message, metric: 'Race Effort Frequency', tooltip };
  }
}

// Initialize and export singleton
window.trainingLoadAnalyzer = new TrainingLoadAnalyzer(
  window.dataProcessor, 
  window.runClassifier
);