function analyzeTrainingLoad(runs) {
  // Convert zones from percentages to BPM
  const zones = {
    z2Upper: Number(window.z2Upper) * HR_MAX,
    z3Upper: Number(window.z3Upper) * HR_MAX,
    z4Upper: Number(window.z4Upper) * HR_MAX,
    z5Upper: Number(window.z5Upper) * HR_MAX
  };

  const now = new Date();
  const last7Days = runs.filter(r => (now - r.date) / 86400000 <= 7);
  const last14Days = runs.filter(r => (now - r.date) / 86400000 <= 14);
  const last28Days = runs.filter(r => (now - r.date) / 86400000 <= 28);

  // Classify all recent runs
  const classifyRun = (r) => {
    const result = classify(r, 0, zones); // avgWeekly not needed for classification
    return result.category.split(' (')[0]; // Remove tendency indicators
  };

  const last7Classified = last7Days.map(classifyRun);
  const last14Classified = last14Days.map(classifyRun);
  const last28Classified = last28Days.map(classifyRun);

  // Count run types
  const count = (arr, type) => arr.filter(c => c === type).length;

  const analysis = {
    // Recovery analysis
    recovery: analyzeRecovery(last7Classified, last14Classified, last7Days),
    
    // Intensity distribution
    intensity: analyzeIntensityDistribution(last28Classified, last28Days),
    
    // Volume consistency
    volume: analyzeVolume(last7Days, last14Days, last28Days),
    
    // Long run frequency
    longRuns: analyzeLongRuns(runs, last28Days),
    
    // Race effort frequency
    raceEfforts: analyzeRaceEfforts(last7Classified, last14Classified, last28Classified)
  };

  return analysis;
}

function analyzeRecovery(last7, last14, last7Runs) {
  const highIntensityLast7 = last7.filter(c => c === 'Intensity Effort' || c === 'Race Effort').length;
  const z2Last7 = last7.filter(c => c === 'Z2').length;
  const totalLast7 = last7.length;
  
  // Calculate days since last run
  const daysSinceLastRun = last7Runs.length > 0 
    ? Math.floor((new Date() - last7Runs[0].date) / 86400000)
    : 7;

  let status = 'green';
  let message = '';

  if (totalLast7 === 0) {
    status = 'yellow';
    message = `No runs recorded in the last 7 days. ${daysSinceLastRun} days of rest.`;
  } else if (highIntensityLast7 >= 4) {
    status = 'red';
    message = `${highIntensityLast7} high-intensity sessions in 7 days with only ${z2Last7} easy runs. High training stress detected.`;
  } else if (highIntensityLast7 === 3 && z2Last7 < 2) {
    status = 'yellow';
    message = `${highIntensityLast7} high-intensity sessions with limited easy running (${z2Last7} Z2 runs). Recovery may be insufficient.`;
  } else if (totalLast7 >= 6 && z2Last7 < 3) {
    status = 'yellow';
    message = `${totalLast7} runs in 7 days but only ${z2Last7} easy efforts. Volume is high with limited recovery runs.`;
  } else if (z2Last7 >= totalLast7 * 0.6) {
    status = 'green';
    message = `Good recovery balance: ${z2Last7} easy runs out of ${totalLast7} total runs (${(z2Last7/totalLast7*100).toFixed(0)}% easy).`;
  } else {
    status = 'green';
    message = `${totalLast7} runs in the last week with ${highIntensityLast7} high-intensity sessions. Training load appears manageable.`;
  }

  const tooltip = `🟢 Green: ≥60% easy runs OR manageable load
🟡 Yellow: No runs, or 3+ high-intensity with <2 easy, or 6+ runs with <3 easy
🔴 Red: 4+ high-intensity sessions in 7 days with insufficient recovery`;

  return { status, message, metric: 'Recovery & Rest', tooltip };
}

function analyzeIntensityDistribution(last28, last28Runs) {
  const z2 = last28.filter(c => c === 'Z2').length;
  const intensity = last28.filter(c => c === 'Intensity Effort').length;
  const race = last28.filter(c => c === 'Race Effort').length;
  const mixed = last28.filter(c => c === 'Mixed Effort').length;
  const total = last28.length;

  const z2Distance = last28Runs.filter((r, i) => last28[i] === 'Z2')
    .reduce((sum, r) => sum + r.distance, 0);
  const hardDistance = last28Runs.filter((r, i) => 
    last28[i] === 'Intensity Effort' || last28[i] === 'Race Effort')
    .reduce((sum, r) => sum + r.distance, 0);
  const totalDistance = last28Runs.reduce((sum, r) => sum + r.distance, 0);

  let status = 'green';
  let message = '';

  const z2Percentage = total > 0 ? (z2 / total * 100) : 0;
  const hardPercentage = total > 0 ? ((intensity + race) / total * 100) : 0;

  if (total === 0) {
    status = 'yellow';
    message = 'No runs in the last 28 days. Training consistency is very low.';
  } else if (z2Percentage < 50 && hardPercentage > 40) {
    status = 'red';
    message = `Training is heavily skewed toward intensity: ${(hardPercentage).toFixed(0)}% hard efforts vs ${z2Percentage.toFixed(0)}% easy. Risk of overtraining and injury.`;
  } else if (z2Percentage < 60 && hardPercentage > 30) {
    status = 'yellow';
    message = `Intensity distribution: ${z2Percentage.toFixed(0)}% easy, ${hardPercentage.toFixed(0)}% hard. Below the recommended 80/20 principle.`;
  } else if (z2Percentage >= 75) {
    status = 'green';
    message = `Excellent polarization: ${z2Percentage.toFixed(0)}% easy runs (${z2Distance.toFixed(1)} km), ${hardPercentage.toFixed(0)}% hard efforts (${hardDistance.toFixed(1)} km). Training follows 80/20 principle.`;
  } else {
    status = 'green';
    message = `Balanced distribution over ${total} runs: ${z2} easy, ${intensity} intensity, ${race} race efforts. Total: ${totalDistance.toFixed(1)} km.`;
  }

  const tooltip = `🟢 Green: ≥60% easy runs following 80/20 principle
🟡 Yellow: <60% easy with >30% hard, or no runs in 28 days
🔴 Red: <50% easy with >40% hard efforts - overtraining risk`;

  return { status, message, metric: 'Intensity Distribution (28 days)', tooltip };
}

function analyzeVolume(last7, last14, last28) {
  const dist7 = last7.reduce((sum, r) => sum + r.distance, 0);
  const dist14 = last14.reduce((sum, r) => sum + r.distance, 0);
  const dist28 = last28.reduce((sum, r) => sum + r.distance, 0);

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

function analyzeLongRuns(allRuns, last28) {
  const now = new Date();
  const longRunsLast28 = last28.filter(r => {
    const avgWeekly = calculateAverageWeekly(allRuns, r.date);
    return r.distance > (0.5 * avgWeekly);
  });

  const longRunDates = longRunsLast28.map(r => Math.floor((now - r.date) / 86400000));
  const daysSinceLastLong = longRunDates.length > 0 ? Math.min(...longRunDates) : 28;

  let status = 'green';
  let message = '';

  if (longRunsLast28.length === 0) {
    status = 'yellow';
    message = `No long runs (>weekly average) in the last 28 days. Last long run was ${daysSinceLastLong}+ days ago.`;
  } else if (longRunsLast28.length >= 4) {
    status = 'yellow';
    message = `${longRunsLast28.length} long runs in 28 days. High frequency may impact recovery.`;
  } else if (daysSinceLastLong <= 10) {
    status = 'green';
    message = `${longRunsLast28.length} long run(s) in last 28 days. Most recent: ${daysSinceLastLong} days ago. Consistent endurance training.`;
  } else {
    status = 'green';
    message = `${longRunsLast28.length} long run(s) completed. Last long run: ${daysSinceLastLong} days ago.`;
  }

  const tooltip = `🟢 Green: 1-3 long runs in 28 days with recent activity
🟡 Yellow: No long runs in 28 days, or 4+ long runs (may impact recovery)

Long run = distance >50% of weekly average`;

  return { status, message, metric: 'Long Run Frequency', tooltip };
}

function analyzeRaceEfforts(last7, last14, last28) {
  const race7 = last7.filter(c => c === 'Race Effort').length;
  const race14 = last14.filter(c => c === 'Race Effort').length;
  const race28 = last28.filter(c => c === 'Race Effort').length;

  let status = 'green';
  let message = '';

  if (race7 >= 3) {
    status = 'red';
    message = `${race7} race-effort runs in 7 days. Very high anaerobic stress with elevated injury risk.`;
  } else if (race7 === 2 && last7.length <= 4) {
    status = 'yellow';
    message = `${race7} race efforts out of ${last7.length} runs this week. High proportion of maximal efforts.`;
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

function calculateAverageWeekly(runs, currentDate) {
  const sixMonthsAgo = new Date(currentDate);
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  
  const recentRuns = runs.filter(r => r.date >= sixMonthsAgo && r.date <= currentDate);
  const totalDistance = recentRuns.reduce((sum, r) => sum + r.distance, 0);
  const weeks = (currentDate - sixMonthsAgo) / (7 * 86400000);
  
  return weeks > 0 ? totalDistance / weeks : 0;
}

function renderTrainingLoadAnalysis(runs) {
  const analysis = analyzeTrainingLoad(runs);
  const container = document.getElementById('trainingLoadAnalysis');
  
  if (!container) {
    console.error('Training load analysis container not found');
    return;
  }

  const statusIcon = {
    'green': '🟢',
    'yellow': '🟡',
    'red': '🔴'
  };

  // Add CSS for tooltips if not already present
  if (!document.getElementById('tooltip-styles')) {
    const style = document.createElement('style');
    style.id = 'tooltip-styles';
    style.textContent = `
      .training-analysis .status-icon-wrapper {
        position: relative;
        display: inline-block;
        cursor: help;
      }
      
      .training-analysis .status-icon-wrapper .analysis-tooltip {
        visibility: hidden;
        opacity: 0;
        display: block;
        position: absolute;
        z-index: 99999;
        top: 100%;
        left: 0;
        margin-top: 8px;
        background-color: #1a1a1a;
        color: #fff;
        text-align: left;
        padding: 12px 16px;
        border-radius: 8px;
        font-size: 13px;
        line-height: 1.5;
        white-space: pre-line;
        width: 350px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        transition: opacity 0.2s, visibility 0.2s;
        pointer-events: none;
      }
      
      .training-analysis .status-icon-wrapper .analysis-tooltip::before {
        content: "";
        position: absolute;
        bottom: 100%;
        left: 15px;
        border-width: 6px;
        border-style: solid;
        border-color: transparent transparent #1a1a1a transparent;
      }
      
      .training-analysis .status-icon-wrapper:hover .analysis-tooltip {
        visibility: visible;
        opacity: 1;
      }
      
      .training-analysis .analysis-header {
        overflow: visible;
        position: relative;
      }
      
      .training-analysis .analysis-card {
        overflow: visible;
        position: relative;
      }
    `;
    document.head.appendChild(style);
  }

  let html = '<div class="training-analysis">';
  
  Object.values(analysis).forEach(item => {
    // Escape quotes in tooltip for HTML attribute
    const tooltipText = item.tooltip.replace(/"/g, '&quot;');
    
    html += `
      <div class="analysis-card ${item.status}">
        <div class="analysis-header" style="position: relative;">
          <span class="status-icon-wrapper" data-tooltip="${tooltipText}">
            <span class="status-icon">${statusIcon[item.status]}</span>
            <span class="analysis-tooltip">${item.tooltip}</span>
          </span>
          <h3>${item.metric}</h3>
        </div>
        <p class="analysis-message">${item.message}</p>
      </div>
    `;
  });
  
  html += '</div>';
  
  container.innerHTML = html;
  
  // Debug: Check if tooltips are in the DOM
  const tooltips = container.querySelectorAll('.tooltip');
  console.log('Tooltips found:', tooltips.length);
  tooltips.forEach((tip, i) => {
    console.log(`Tooltip ${i}:`, tip.textContent.substring(0, 50));
  });
}