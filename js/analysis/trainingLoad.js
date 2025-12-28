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

    const tooltip = `<strong>Recovery & Rest Analysis</strong>

This metric evaluates whether you're getting adequate recovery between hard efforts. Recovery runs (Z2) are crucial for adaptation and injury prevention.

<strong>What's measured:</strong>
• Number of easy runs (Z2) vs hard efforts in the last 7 days
• Balance between training stress and recovery
• Consecutive days of running without rest

<strong>Healthy training:</strong>
• At least 60% of runs should be easy (Z2)
• No more than 3 high-intensity sessions per week
• Sufficient easy runs between hard efforts
• Regular rest days or very easy recovery runs

<strong>Status indicators:</strong>
🟢 Good balance of easy and hard runs
🟡 Recovery may be insufficient for training load
🔴 High risk of overtraining or injury`;

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

    const tooltip = `<strong>Intensity Distribution (80/20 Principle)</strong>

This metric evaluates whether your training follows the proven 80/20 principle: 80% of training at low intensity, 20% at high intensity. This approach maximizes aerobic development while minimizing injury risk.

<strong>What's measured:</strong>
• Percentage of easy (Z2) runs over the last 28 days
• Percentage of hard efforts (Intensity + Race) over the last 28 days
• Total distance distribution across intensities

<strong>Run classifications:</strong>
• <strong>Z2 (Easy):</strong> ≥75% of time in Zone 2, ≤5% above Zone 4
• <strong>Intensity:</strong> ≥80% of time in Zones 3-5
• <strong>Race:</strong> ≥80% of time in Zones 5-6
• <strong>Mixed:</strong> Everything else

<strong>Optimal distribution:</strong>
• 75-80% easy runs for aerobic base building
• 20-25% hard efforts for speed and lactate threshold
• This ratio maximizes fitness gains while minimizing injury risk

<strong>Status indicators:</strong>
🟢 Following 80/20 principle (≥60% easy)
🟡 Below recommended ratio (<60% easy)
🔴 Dangerous imbalance (too much intensity)`;

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

    const tooltip = `<strong>Volume Progression (10% Rule)</strong>

This metric monitors how quickly you're increasing your weekly running volume. The "10% rule" suggests limiting weekly mileage increases to reduce injury risk.

<strong>What's measured:</strong>
• Total distance in the last 7 days
• Comparison to average of previous 2 weeks
• Rate of change (% increase or decrease)
• 4-week trend for context

<strong>The 10% rule:</strong>
Research shows that increasing weekly mileage by more than 10% significantly raises injury risk. Gradual progression allows your body to adapt to increased training stress.

<strong>Safe progression:</strong>
• Increase weekly volume by no more than 10-15%
• Every 3-4 weeks, include a recovery week with 20-30% reduced volume
• After injury or break, rebuild gradually (even slower than 10%)

<strong>Status indicators:</strong>
🟢 Volume change within safe limits (±15%)
🟡 Moderate increase (15-30%) or sharp decrease
🔴 Excessive increase (>30%) - high injury risk`;

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

    const tooltip = `<strong>Long Run Frequency</strong>

Long runs are the cornerstone of endurance training, building aerobic capacity and mental toughness. However, they also create significant fatigue and require adequate recovery.

<strong>What's measured:</strong>
• Number of long runs in the last 28 days
• Days since your last long run
• Long run definition: distance > 50% of your weekly average

<strong>Long run definition:</strong>
A "long run" is defined as any run exceeding 50% of your average weekly mileage. For example:
• If you average 40 km/week, long runs are >20 km
• If you average 60 km/week, long runs are >30 km

<strong>Optimal frequency:</strong>
• <strong>1-2 per month:</strong> Maintains endurance base
• <strong>3 per month:</strong> Actively building endurance
• <strong>4+ per month:</strong> May compromise recovery

<strong>Recovery needs:</strong>
Long runs require 1-2 days of easy running or rest for proper recovery. Too many long runs can lead to chronic fatigue and overtraining.

<strong>Status indicators:</strong>
🟢 1-3 long runs per month with recent activity
🟡 No recent long runs or excessive frequency`;

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

    const tooltip = `<strong>Race Effort Frequency</strong>

Race-effort runs (≥80% time in Zones 5-6) create the highest training stress and require the longest recovery. These are your hardest workouts: intervals at VO2max, races, or all-out time trials.

<strong>What's measured:</strong>
• Number of race-effort runs in the last 7, 14, and 28 days
• Proportion of race efforts relative to total training
• Recovery time between maximal efforts

<strong>Race effort definition:</strong>
A run is classified as "Race Effort" when you spend ≥80% of the time in heart rate Zones 5-6 (>90% of max HR). This includes:
• VO2max intervals
• 5K-10K races
• All-out time trials
• Hard track workouts

<strong>Physiological stress:</strong>
Race efforts deplete muscle glycogen, create significant muscle damage, and tax the central nervous system. They require 48-72 hours for full recovery.

<strong>Optimal frequency:</strong>
• <strong>0-1 per week:</strong> Safe for most runners
• <strong>2 per week:</strong> Only for experienced runners in peak training
• <strong>3+ per week:</strong> Unsustainable; high injury/burnout risk

<strong>Recovery requirements:</strong>
After a race effort, plan at least 2 easy days before the next hard workout.

<strong>Status indicators:</strong>
🟢 0-3 race efforts per month, well-spaced
🟡 High frequency or poor spacing between efforts
🔴 Excessive frequency (3+ per week) - injury risk`;

    return { status, message, metric: 'Race Effort Frequency', tooltip };
  }
}

// Initialize and export singleton
window.trainingLoadAnalyzer = new TrainingLoadAnalyzer(
  window.dataProcessor, 
  window.runClassifier
);