// js/ui/renderer.js
// Main UI rendering coordinator

class UIRenderer {
  constructor() {
    this.chart = null;
  }

  /**
   * Render basic info stats
   */
  renderBasicInfo(summary) {
    // Average weekly distance
    const avgWeekly = summary.last6Months.avgWeekly;
    document.getElementById('avgWeekly').textContent = `${avgWeekly.toFixed(1)} km`;

    // Last 7 days distance
    const dist7 = summary.last7Days.distance;
    document.getElementById('distanceWeek').textContent = `${dist7.toFixed(1)} km`;

    // Runs last week
    const runsWeek = summary.last7Days.runs;
    document.getElementById('runsWeek').textContent = runsWeek;

    // Days since rest day
    const daysSinceRest = this.calculateDaysSinceRest();
    document.getElementById('restDays').textContent = daysSinceRest;

    // Update HR Max display
    const hrMax = window.dataProcessor.hrMax;
    const maxHRElement = document.getElementById('maxHR');
    if (maxHRElement && hrMax > 0) {
      maxHRElement.textContent = `${hrMax} bpm`;
    }
  }

  /**
   * Calculate days since last rest day
   */
  calculateDaysSinceRest() {
    const runs = window.dataProcessor.runs;
    if (runs.length === 0) return 0;

    const sortedRuns = [...runs].sort((a, b) => b.date - a.date);
    const mostRecent = sortedRuns[0];
    const daysSinceLastRun = window.helpers.daysAgo(mostRecent.date);

    if (daysSinceLastRun > 1) {
      return 0; // No run today
    }

    // Count consecutive running days
    let consecutiveDays = 0;
    for (let i = 0; i < sortedRuns.length - 1; i++) {
      const current = sortedRuns[i];
      const next = sortedRuns[i + 1];
      const daysBetween = window.helpers.daysBetween(next.date, current.date);

      if (daysBetween > 1) {
        consecutiveDays = i + 1;
        break;
      }
    }

    return consecutiveDays || sortedRuns.length;
  }

  /**
   * Render all charts
   */
  renderCharts(runs) {
    const summary = window.dataProcessor.getSummary();
    this.renderAverageDistanceChart(runs, summary.last6Months.avgWeekly);
    this.renderIntensityChart(runs);
  }

  /**
   * Render average distance chart with zone stacking
   */
  renderAverageDistanceChart(runs, avgWeekly) {
    // Get chart range settings
    const chartSettings = window.settingsManager.getChartRanges();
    const monthsToShow = chartSettings.distanceChartMonths;

    // Calculate date range based on settings
    const rangeStart = new Date();
    rangeStart.setMonth(rangeStart.getMonth() - monthsToShow);

    const recentRuns = runs.filter(r => r.date >= rangeStart);
    const weeklyData = this.calculateWeeklyZoneData(recentRuns);

    // Generate labels
    const labels = weeklyData.map(w => window.helpers.formatDate(w.weekStart));

    // Destroy existing chart
    if (this.chart) {
      this.chart.destroy();
    }

    const canvas = document.getElementById('chart');
    if (!canvas) return;

    // Update chart title
    const chartTitle = document.querySelector('#tab-analysis .panel h2');
    if (chartTitle && chartTitle.textContent.includes('Average Weekly Distance')) {
      chartTitle.textContent = `Average Weekly Distance (Last ${monthsToShow} Month${monthsToShow !== 1 ? 's' : ''})`;
    }

    // Prepare datasets
    const datasets = [
      {
        label: 'No HR Data',
        data: weeklyData.map(w => w.noHR),
        backgroundColor: 'rgba(154, 160, 166, 0.5)',
        stack: 'distance',
        yAxisID: 'y'
      },
      {
        label: 'Z1',
        data: weeklyData.map(w => w.z1),
        backgroundColor: 'rgba(189, 189, 189, 0.7)',
        stack: 'distance',
        yAxisID: 'y'
      },
      {
        label: 'Z2',
        data: weeklyData.map(w => w.z2),
        backgroundColor: 'rgba(66, 133, 244, 0.7)',
        stack: 'distance',
        yAxisID: 'y'
      },
      {
        label: 'Z3',
        data: weeklyData.map(w => w.z3),
        backgroundColor: 'rgba(52, 168, 83, 0.7)',
        stack: 'distance',
        yAxisID: 'y'
      },
      {
        label: 'Z4',
        data: weeklyData.map(w => w.z4),
        backgroundColor: 'rgba(255, 153, 0, 0.7)',
        stack: 'distance',
        yAxisID: 'y'
      },
      {
        label: 'Z5',
        data: weeklyData.map(w => w.z5),
        backgroundColor: 'rgba(234, 67, 53, 0.7)',
        stack: 'distance',
        yAxisID: 'y'
      },
      {
        label: 'Z6',
        data: weeklyData.map(w => w.z6),
        backgroundColor: 'rgba(156, 39, 176, 0.7)',
        stack: 'distance',
        yAxisID: 'y'
      },
      {
        type: 'line',
        label: `Ø ${monthsToShow} Month${monthsToShow !== 1 ? 's' : ''}`,
        data: Array(labels.length).fill(avgWeekly),
        borderColor: 'rgba(138, 180, 248, 1)',
        borderWidth: 2,
        borderDash: [5, 5],
        pointRadius: 0,
        fill: false,
        yAxisID: 'y'
      },
      // ADD PACE LINE
      {
        type: 'line',
        label: 'Avg Pace (min/km)',
        data: weeklyData.map(w => w.avgPace),
        borderColor: 'rgba(251, 188, 4, 1)',
        backgroundColor: 'rgba(251, 188, 4, 0.1)',
        borderWidth: 3,
        pointRadius: 4,
        pointBackgroundColor: 'rgba(251, 188, 4, 1)',
        fill: false,
        yAxisID: 'y2',
        tension: 0.3
      }
    ];

    this.chart = new Chart(canvas, {
      type: 'bar',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: {
            display: true,
            labels: {
              color: '#ffffff',
              usePointStyle: true,
              padding: 15
            }
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const label = context.dataset.label || '';
                const value = context.parsed.y;
            
                if (value === 0 || value === null) return null;
            
                // Format pace specially
                if (label === 'Avg Pace (min/km)') {
                  const minutes = Math.floor(value);
                  const seconds = Math.round((value - minutes) * 60);
                  return `${label}: ${minutes}:${seconds.toString().padStart(2, '0')}/km`;
                }
            
                return `${label}: ${value.toFixed(1)} km`;
              },
              footer: (tooltipItems) => {
                let total = 0;
                tooltipItems.forEach(item => {
                  if (item.dataset.stack === 'distance') {
                    total += item.parsed.y;
                  }
                });
                return total > 0 ? `Total: ${total.toFixed(1)} km` : '';
              }
            }
          }
        },
        scales: {
          y: {
            stacked: true,
            beginAtZero: true,
            position: 'left',
            ticks: {
              color: '#9aa0a6',
              callback: (value) => value + ' km'
            },
            grid: { color: '#2a2f3a' }
          },
          y2: {
            position: 'right',
            beginAtZero: false,
            ticks: {
              color: '#fbbc04',
              callback: (value) => {
                const minutes = Math.floor(value);
                const seconds = Math.round((value - minutes) * 60);
                return `${minutes}:${seconds.toString().padStart(2, '0')}`;
              }
            },
            grid: {
              display: false
            }
          },
          x: {
            stacked: true,
            ticks: { color: '#9aa0a6' },
            grid: { color: '#2a2f3a' }
          }
        }
      }
    });
  }

  /**
   * Calculate weekly zone distribution
   */
  calculateWeeklyZoneData(runs) {
    const weekMap = new Map();

    runs.forEach(run => {
      const weekStart = window.helpers.getWeekStart(run.date);
      const weekKey = weekStart.toISOString().split('T')[0];
  
      if (!weekMap.has(weekKey)) {
        weekMap.set(weekKey, {
          weekStart,
          total: 0,
          z1: 0, z2: 0, z3: 0, z4: 0, z5: 0, z6: 0,
          noHR: 0,
          paces: [], // Track all paces for averaging
          totalDuration: 0
        });
      }
  
      const weekData = weekMap.get(weekKey);
      weekData.total += run.distance;
      weekData.totalDuration += run.duration;
  
      // Track pace
      const avgPace = window.intervalDetector.calculateAveragePace(run);
      if (avgPace) {
        weekData.paces.push(avgPace);
      }
  
      const hrDataType = window.hrAnalyzer.getHRDataType(run);
  
      if (hrDataType === 'none') {
        weekData.noHR += run.distance;
      } else if (hrDataType === 'detailed') {
        const analysis = window.hrAnalyzer.analyzeHRStream(run.hrStream);
        if (analysis) {
          weekData.z1 += run.distance * (analysis.percentZ1 / 100);
          weekData.z2 += run.distance * (analysis.percentZ2 / 100);
          weekData.z3 += run.distance * (analysis.percentZ3 / 100);
          weekData.z4 += run.distance * (analysis.percentZ4 / 100);
          weekData.z5 += run.distance * (analysis.percentZ5 / 100);
          weekData.z6 += run.distance * (analysis.percentZ6 / 100);
        }
      } else { // basic HR
        const zone = window.hrAnalyzer.getZone(run.avgHR);
        const zoneKey = `z${zone}`;
        weekData[zoneKey] += run.distance;
      }
    });

    // Calculate average pace per week
    const result = Array.from(weekMap.values()).map(week => ({
      ...week,
      avgPace: week.paces.length > 0 
        ? week.paces.reduce((sum, p) => sum + p, 0) / week.paces.length 
        : null
    }));

    return result.sort((a, b) => a.weekStart - b.weekStart);
  }

  /**
   * Render intensity doughnut chart
   */
  renderIntensityChart(runs) {
    const canvas = document.getElementById('intensityChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const existing = Chart.getChart(canvas);
    if (existing) existing.destroy();

    // Get chart range settings
    const chartSettings = window.settingsManager.getChartRanges();
    const weeksToShow = chartSettings.intensityChartWeeks;
    const daysToShow = weeksToShow * 7;

    const runsInRange = window.dataProcessor.getRunsInRange(daysToShow);
    const distribution = window.hrAnalyzer.calculateZoneDistribution(runsInRange);

    // Update chart title
    const chartTitle = document.querySelector('#intensityChart').closest('.panel').querySelector('h2');
    if (chartTitle) {
      chartTitle.textContent = `Intensity (Last ${weeksToShow} Week${weeksToShow !== 1 ? 's' : ''})`;
    }

    if (distribution.totalDataPoints === 0) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.font = '16px system-ui';
      ctx.fillStyle = '#9aa0a6';
      ctx.textAlign = 'center';
      ctx.fillText(`No detailed HR data available for the last ${weeksToShow} week${weeksToShow !== 1 ? 's' : ''}`, canvas.width / 2, canvas.height / 2);
      return;
    }

    const zones = ['z1', 'z2', 'z3', 'z4', 'z5', 'z6'];
    const labels = zones.map((_, i) => window.hrAnalyzer.getZoneLabel(i + 1));
    const data = zones.map(z => distribution.percentages[z]);
    const distances = zones.map(z => distribution.distances[z]);

    const colors = [
      'rgba(189, 189, 189, 0.8)',
      'rgba(66, 133, 244, 0.8)',
      'rgba(52, 168, 83, 0.8)',
      'rgba(255, 153, 0, 0.8)',
      'rgba(234, 67, 53, 0.8)',
      'rgba(156, 39, 176, 0.8)'
    ];

    new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: colors,
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        cutout: '50%',
        plugins: {
          legend: {
            display: true,
            position: 'right',
            labels: {
              color: '#e8eaed',
              padding: 12,
              font: { size: 12 },
              generateLabels: (chart) => {
                return chart.data.labels.map((label, i) => {
                  const value = chart.data.datasets[0].data[i];
                  if (value < 0.1) return null;
                  const zoneName = label.split(':')[0];
                  return {
                    text: `${zoneName}: ${value.toFixed(1)}% | ${distances[i].toFixed(1)} km`,
                    fillStyle: colors[i],
                    hidden: false,
                    index: i
                  };
                }).filter(Boolean);
              }
            }
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const percent = context.parsed.toFixed(1);
                return `Time: ${percent}%`;
              },
              afterLabel: (context) => {
                const distance = distances[context.dataIndex];
                return `Distance: ${distance.toFixed(1)} km`;
              }
            }
          },
          datalabels: {
            color: '#ffffff',
            font: { weight: 'bold', size: 16 },
            formatter: (value) => value < 2 ? '' : value.toFixed(1) + '%'
          }
        }
      },
      plugins: [ChartDataLabels]
    });
  }

  /**
   * Render timeline
   */
  renderTimeline(runs) {
    const div = document.getElementById('timeline');
    if (!div) return;

    div.innerHTML = '';

    const recentRuns = runs.filter(r => window.helpers.daysAgo(r.date) <= 28);
    const sortedRuns = [...recentRuns].sort((a, b) => b.date - a.date);

    sortedRuns.forEach(run => {
      const classification = window.runClassifier.classify(run);
      const el = this.createRunElement(run, classification);
      div.appendChild(el);
    });
  }

  /**
   * Create run element for timeline
   */
  createRunElement(run, classification) {
    const { category, isLong, hrDataType, detailedHR } = classification;
    const cssClass = window.runClassifier.getCategoryClass(category);

    const el = document.createElement('div');
    el.className = `run ${cssClass}`;

    // Detect intervals
    const intervalInfo = window.intervalDetector.detectInterval(run);

    // Create tooltip
    const tooltip = this.createRunTooltip(run, classification, intervalInfo);

    // Create badges
    let badges = '';

    // Interval badge (PRIORITY - show first if detected)
    if (intervalInfo.isInterval) {
      badges += '<span class="badge interval-badge">⚡ Interval</span>';
    }

    if (hrDataType === 'none') {
      badges += '<span class="badge no-hr">No HR</span>';
    } else if (hrDataType === 'basic') {
      badges += '<span class="badge basic-hr">Basic HR</span>';
    }
    if (isLong) {
      badges += '<span class="badge long-run">Long Run</span>';
    }

    el.innerHTML = `
      <span>${window.helpers.formatDateFull(run.date)} — ${category}${isLong ? ' (Long)' : ''}</span>
      <span>${badges}<span class="badge">${run.distance.toFixed(1)} km</span></span>
      ${tooltip}
    `;

    return el;
  }

  /**
   * Create tooltip for run
   */
  createRunTooltip(run, classification, intervalInfo) {
    const { category, hrDataType, detailedHR } = classification;
    const zones = window.dataProcessor.getZonesBPM();

    let html = '<div class="tooltip">';

    // Basic info
    html += `
      <div class="tooltip-row">
        <span class="tooltip-label">Type:</span>
        <span class="tooltip-value">${category}</span>
      </div>
      <div class="tooltip-row">
        <span class="tooltip-label">Distance:</span>
        <span class="tooltip-value">${run.distance.toFixed(2)} km</span>
      </div>
    `;

    // Interval information
    if (intervalInfo && intervalInfo.isInterval) {
      html += `
        <div class="tooltip-row" style="background: rgba(251, 188, 4, 0.1); padding: 4px; border-radius: 4px; margin: 8px 0;">
          <span class="tooltip-label">⚡ Intervals:</span>
          <span class="tooltip-value">${intervalInfo.details}</span>
        </div>
      `;
    }

    // Average pace
    const avgPace = window.intervalDetector.calculateAveragePace(run);
    if (avgPace) {
      html += `
        <div class="tooltip-row">
          <span class="tooltip-label">Avg Pace:</span>
          <span class="tooltip-value">${window.intervalDetector.formatPace(avgPace)}</span>
        </div>
      `;
    }

    // HR data info
    if (hrDataType === 'none') {
      html += `
        <div class="tooltip-row">
          <span class="tooltip-label">HR Data:</span>
          <span class="tooltip-value" style="color:#ea4335">Not available</span>
        </div>
      `;
    } else if (hrDataType === 'basic') {
      const zone = window.hrAnalyzer.getZone(run.avgHR);
      html += `
        <div class="tooltip-row">
          <span class="tooltip-label">Avg HR:</span>
          <span class="tooltip-value">${run.avgHR} bpm (Zone ${zone})</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-label">Max HR:</span>
          <span class="tooltip-value">${run.maxHR} bpm</span>
        </div>
      `;
    } else if (hrDataType === 'detailed' && detailedHR) {
      // Add HR graph
      html += '<hr style="border:none;border-top:1px solid var(--border);margin:8px 0">';
      html += window.hrAnalyzer.generateHRGraph(detailedHR.hrRecords);
  
      // Zone distribution
      html += `
        <div class="tooltip-row">
          <span class="tooltip-label">Time in Z1:</span>
          <span class="tooltip-value">${detailedHR.percentZ1.toFixed(1)}%</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-label">Time in Z2:</span>
          <span class="tooltip-value">${detailedHR.percentZ2.toFixed(1)}%</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-label">Time in Z3:</span>
          <span class="tooltip-value">${detailedHR.percentZ3.toFixed(1)}%</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-label">Time in Z4:</span>
          <span class="tooltip-value">${detailedHR.percentZ4.toFixed(1)}%</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-label">Time in Z5:</span>
          <span class="tooltip-value">${detailedHR.percentZ5.toFixed(1)}%</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-label">Time in Z6:</span>
          <span class="tooltip-value">${detailedHR.percentZ6.toFixed(1)}%</span>
        </div>
      `;
    }

    html += '</div>';
    return html;
  }

  /**
   * Render training load analysis
   */
  renderTrainingLoadAnalysis(runs) {
    const container = document.getElementById('trainingLoadAnalysis');
    if (!container) return;

    const analysis = window.trainingLoadAnalyzer.analyze(runs);
    
    const statusIcon = {
      'green': '🟢',
      'yellow': '🟡',
      'red': '🔴'
    };

    let html = '<div class="training-analysis">';
    
    Object.values(analysis).forEach(item => {
      // Escape HTML for tooltip and convert newlines to <br>
      const tooltipHTML = item.tooltip
        .replace(/\n/g, '<br>')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/&lt;strong&gt;/g, '<strong>')
        .replace(/&lt;\/strong&gt;/g, '</strong>')
        .replace(/&lt;br&gt;/g, '<br>');
      
      html += `
        <div class="analysis-card ${item.status}">
          <div class="analysis-header">
            <span class="status-icon-wrapper" title="Click for details">
              <span class="status-icon">${statusIcon[item.status]}</span>
              <div class="analysis-tooltip">${tooltipHTML}</div>
            </span>
            <h3>${item.metric}</h3>
          </div>
          <p class="analysis-message">${item.message}</p>
        </div>
      `;
    });
    
    html += '</div>';
    container.innerHTML = html;
  }
}

// Initialize and export singleton
window.uiRenderer = new UIRenderer();