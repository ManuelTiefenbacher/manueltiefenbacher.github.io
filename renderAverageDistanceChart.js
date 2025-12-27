function renderAverageDistanceChart(labels, weeklyData, avgWeekly) {
  if(chart) chart.destroy();
  
  // weeklyData should be an array of objects with structure:
  // { total: distance, z1: distance, z2: distance, z3: distance, z4: distance, z5: distance, z6: distance, noHR: distance }
  
  // Extract data for each zone
  const z1Data = weeklyData.map(w => w.z1 || 0);
  const z2Data = weeklyData.map(w => w.z2 || 0);
  const z3Data = weeklyData.map(w => w.z3 || 0);
  const z4Data = weeklyData.map(w => w.z4 || 0);
  const z5Data = weeklyData.map(w => w.z5 || 0);
  const z6Data = weeklyData.map(w => w.z6 || 0);
  const noHRData = weeklyData.map(w => w.noHR || 0);
  
  chart = new Chart(document.getElementById("chart"), {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: 'No HR Data',
          data: noHRData,
          backgroundColor: 'rgba(154, 160, 166, 0.5)',
          borderColor: 'rgba(154, 160, 166, 0.8)',
          borderWidth: 1,
          stack: 'distance'
        },
        {
          label: 'Z1',
          data: z1Data,
          backgroundColor: 'rgba(189, 189, 189, 0.7)',
          borderColor: 'rgba(189, 189, 189, 1)',
          borderWidth: 1,
          stack: 'distance'
        },
        {
          label: 'Z2',
          data: z2Data,
          backgroundColor: 'rgba(66, 133, 244, 0.7)',
          borderColor: 'rgba(66, 133, 244, 1)',
          borderWidth: 1,
          stack: 'distance'
        },
        {
          label: 'Z3',
          data: z3Data,
          backgroundColor: 'rgba(52, 168, 83, 0.7)',
          borderColor: 'rgba(52, 168, 83, 1)',
          borderWidth: 1,
          stack: 'distance'
        },
        {
          label: 'Z4',
          data: z4Data,
          backgroundColor: 'rgba(255, 153, 0, 0.7)',
          borderColor: 'rgba(255, 153, 0, 1)',
          borderWidth: 1,
          stack: 'distance'
        },
        {
          label: 'Z5',
          data: z5Data,
          backgroundColor: 'rgba(234, 67, 53, 0.7)',
          borderColor: 'rgba(234, 67, 53, 1)',
          borderWidth: 1,
          stack: 'distance'
        },
        {
          label: 'Z6',
          data: z6Data,
          backgroundColor: 'rgba(156, 39, 176, 0.7)',
          borderColor: 'rgba(156, 39, 176, 1)',
          borderWidth: 1,
          stack: 'distance'
        },
        {
          type: 'line',
          label: 'Ø 6 Months',
          data: Array(labels.length).fill(avgWeekly),
          borderColor: 'rgba(138, 180, 248, 1)',
          backgroundColor: 'rgba(138, 180, 248, 0.1)',
          borderWidth: 2,
          borderDash: [5, 5],
          pointRadius: 0,
          fill: false,
          stack: 'average'
        }
      ]
    },
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
            label: function(context) {
              const label = context.dataset.label || '';
              const value = context.parsed.y;
              if (value === 0) return null;
              return `${label}: ${value.toFixed(1)} km`;
            },
            footer: function(tooltipItems) {
              let total = 0;
              tooltipItems.forEach(item => {
                if (item.dataset.stack === 'distance') {
                  total += item.parsed.y;
                }
              });
              return `Total: ${total.toFixed(1)} km`;
            }
          }
        }
      },
      scales: {
        y: {
          stacked: true,
          beginAtZero: true,
          ticks: { 
            color: '#9aa0a6',
            callback: function(value) {
              return value + ' km';
            }
          },
          grid: { color: '#2a2f3a' }
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

// Helper function to calculate weekly zone data from runs
function calculateWeeklyZoneData(runs, zones) {
  // Group runs by week
  const weekMap = new Map();
  
  runs.forEach(run => {
    const weekStart = getWeekStart(run.date);
    const weekKey = weekStart.toISOString().split('T')[0];
    
    if (!weekMap.has(weekKey)) {
      weekMap.set(weekKey, {
        weekStart: weekStart,
        total: 0,
        z1: 0,
        z2: 0,
        z3: 0,
        z4: 0,
        z5: 0,
        z6: 0,
        noHR: 0
      });
    }
    
    const weekData = weekMap.get(weekKey);
    weekData.total += run.distance;
    
    // Check if run has HR data
    const hasBasicHR = run.avgHR > 0 && run.maxHR > 0;
    let detailedHR = null;
    
    if (run.filename && tcxDataCache[run.filename]) {
      detailedHR = analyzeDetailedHR(tcxDataCache[run.filename], zones);
    }
    
    if (!hasBasicHR && !detailedHR) {
      // No HR data
      weekData.noHR += run.distance;
    } else if (detailedHR) {
      // Use detailed HR distribution
      weekData.z1 += run.distance * (detailedHR.percentZ1 / 100);
      weekData.z2 += run.distance * (detailedHR.percentZ2 / 100);
      weekData.z3 += run.distance * (detailedHR.percentZ3 / 100);
      weekData.z4 += run.distance * (detailedHR.percentZ4 / 100);
      weekData.z5 += run.distance * (detailedHR.percentZ5 / 100);
      weekData.z6 += run.distance * (detailedHR.percentZ6 / 100);
    } else {
      // Use basic HR - assign entire distance to the average zone
      const avgZone = getZone(run.avgHR, zones);
      const zoneKey = `z${avgZone}`;
      weekData[zoneKey] += run.distance;
    }
  });
  
  // Convert map to sorted array
  return Array.from(weekMap.values()).sort((a, b) => a.weekStart - b.weekStart);
}

// Helper function to get the start of the week (Monday)
function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
  return new Date(d.setDate(diff));
}

// Updated function signature to work with the existing codebase
function renderAverageDistanceChartWithZones(runs, avgWeekly) {
  // Convert zones from percentages to BPM
  const zones = {
    z2Upper: Number(window.z2Upper) * HR_MAX,
    z3Upper: Number(window.z3Upper) * HR_MAX,
    z4Upper: Number(window.z4Upper) * HR_MAX,
    z5Upper: Number(window.z5Upper) * HR_MAX
  };
  
  // Calculate weekly zone data for past 6 months
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  
  const recentRuns = runs.filter(r => r.date >= sixMonthsAgo);
  const weeklyZoneData = calculateWeeklyZoneData(recentRuns, zones);
  
  // Generate labels (week starting dates)
  const labels = weeklyZoneData.map(w => {
    const d = w.weekStart;
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
  });
  
  // Render the chart
  renderAverageDistanceChart(labels, weeklyZoneData, avgWeekly);
}