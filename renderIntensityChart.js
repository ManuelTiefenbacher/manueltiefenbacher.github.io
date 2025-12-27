function renderIntensityChart(runsParam) {
  // Always use current data source
  const runs = Array.isArray(runsParam) ? runsParam : window.runs;

  // Get zone boundaries from window and convert to numbers
  const z2 = Number(window.z2Upper);
  const z3 = Number(window.z3Upper);
  const z4 = Number(window.z4Upper);
  const z5 = Number(window.z5Upper);

  console.log('[render] using bounds:', { z2, z3, z4, z5 });

  // Validation
  if (![z2, z3, z4, z5].every(v => typeof v === 'number' && isFinite(v) && v > 0 && v < 1)) {
    console.error('[render] Invalid zone boundaries:', { z2, z3, z4, z5 });
    return;
  }
  if (!(z2 < z3 && z3 < z4 && z4 < z5)) {
    console.error('[render] Boundaries not strictly increasing:', { z2, z3, z4, z5 });
    return;
  }

  const bounds = [z2, z3, z4, z5];

  const now = new Date();
  const last28DaysRuns = runs
    .map(r => ({ ...r, date: r.date instanceof Date ? r.date : new Date(r.date) }))
    .filter(r => (now - r.date) / 86400000 <= 28);

  // Check HR_MAX
  if (typeof HR_MAX !== 'number' || !isFinite(HR_MAX) || HR_MAX <= 0) {
    console.error('[render] HR_MAX invalid:', HR_MAX);
    return;
  }

  // Generate dynamic labels with zone names
  const pct = x => Math.round(x * 100);
  const bpm = x => Math.round(x * HR_MAX);
  const labels = [
    `Z1: <${pct(bounds[0])}% (<${bpm(bounds[0])} bpm)`,
    `Z2: ${pct(bounds[0])}-${pct(bounds[1])}% (${bpm(bounds[0])}-${bpm(bounds[1])} bpm)`,
    `Z3: ${pct(bounds[1])}-${pct(bounds[2])}% (${bpm(bounds[1])}-${bpm(bounds[2])} bpm)`,
    `Z4: ${pct(bounds[2])}-${pct(bounds[3])}% (${bpm(bounds[2])}-${bpm(bounds[3])} bpm)`,
    `Z5: ${pct(bounds[3])}-95% (${bpm(bounds[3])}-${Math.round(HR_MAX * 0.95)} bpm)`,
    `Z6: >95% (>${Math.round(HR_MAX * 0.95)} bpm)`
  ];

  // Initialize counting buckets (now 6 zones)
  const bucketCounts = new Array(6).fill(0);
  const bucketDistances = new Array(6).fill(0); // Track distance per zone
  let totalDataPoints = 0;
  let runsWithDetailedData = 0;
  let totalDistance = 0;

  last28DaysRuns.forEach(r => {
    const tcxData = r.filename ? tcxDataCache[r.filename] : null;
    if (tcxData && Array.isArray(tcxData.records)) {
      runsWithDetailedData++;
      totalDistance += r.distance || 0;
      
      const runDataPoints = [];
      tcxData.records.forEach(record => {
        const hr = record?.heart_rate;
        if (hr && hr > 0) {
          totalDataPoints++;
          const p = hr / HR_MAX;
          
          // Determine zone (0-5 for Z1-Z6)
          let idx;
          if (p < bounds[0]) idx = 0; // Z1
          else if (p < bounds[1]) idx = 1; // Z2
          else if (p < bounds[2]) idx = 2; // Z3
          else if (p < bounds[3]) idx = 3; // Z4
          else if (p < 0.95) idx = 4; // Z5 (up to 95%)
          else idx = 5; // Z6 (above 95%)
          
          bucketCounts[idx]++;
          runDataPoints.push(idx);
        }
      });
      
      // Distribute run distance proportionally to zones
      if (runDataPoints.length > 0) {
        runDataPoints.forEach(idx => {
          bucketDistances[idx] += (r.distance || 0) / runDataPoints.length;
        });
      }
    }
  });

  // Calculate percentages
  const data = bucketCounts.map(c => totalDataPoints > 0 ? (c / totalDataPoints * 100) : 0);

  // Get canvas/context
  const canvas = document.getElementById('intensityChart');
  if (!canvas) { 
    console.error('[render] Canvas not found'); 
    return; 
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) { 
    console.error('[render] Context null (Panel hidden?)'); 
    return; 
  }

  // Safely destroy existing chart
  const existing = Chart.getChart(canvas);
  if (existing) existing.destroy();

  // If no data
  if (totalDataPoints === 0) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = '16px system-ui';
    ctx.fillStyle = '#9aa0a6';
    ctx.textAlign = 'center';
    ctx.fillText('No detailed HR data available for the last 28 days', canvas.width / 2, canvas.height / 2);
    return;
  }

  // Updated colors matching the zone scheme (6 zones now)
  const colors = [
    'rgba(189, 189, 189, 0.8)',   // Z1: Light gray
    'rgba(66, 133, 244, 0.8)',    // Z2: Blue
    'rgba(52, 168, 83, 0.8)',     // Z3: Green
    'rgba(255, 153, 0, 0.8)',     // Z4: Orange
    'rgba(234, 67, 53, 0.8)',     // Z5: Red
    'rgba(156, 39, 176, 0.8)'     // Z6: Purple
  ];
  const borderColors = [
    'rgba(189, 189, 189, 1)',
    'rgba(66, 133, 244, 1)',
    'rgba(52, 168, 83, 1)',
    'rgba(255, 153, 0, 1)',
    'rgba(234, 67, 53, 1)',
    'rgba(156, 39, 176, 1)'
  ];

  console.log('[render] labels:', labels);
  console.log('[render] data (%):', data);

  new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors,
        borderColor: borderColors,
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
            font: {
              size: 12,
              weight: '400',
              family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
            },
            usePointStyle: true,
            pointStyle: 'circle',
            generateLabels: function(chart) {
              const d = chart.data;
              if (d.labels.length && d.datasets.length) {
                return d.labels.map((label, i) => {
                  const value = d.datasets[0].data[i];
                  const distance = bucketDistances[i];
                  const zoneName = label.split(':')[0]; // Extract zone name (e.g., "Z2")
                  
                  // Only show if has data
                  if (value < 0.1) return null;
                  
                  return {
                    text: `${zoneName}: ${value.toFixed(1)}% | ${distance.toFixed(1)} km`,
                    fillStyle: d.datasets[0].backgroundColor[i],
                    strokeStyle: d.datasets[0].borderColor[i],
                    lineWidth: 2,
                    hidden: false,
                    index: i,
                    fontColor: '#e8eaed'
                  };
                }).filter(item => item !== null);
              }
              return [];
            }
          }
        },
        tooltip: {
          backgroundColor: 'rgba(19, 21, 28, 0.95)',
          titleColor: '#ffffff',
          bodyColor: '#ffffff',
          borderColor: '#383d4a',
          borderWidth: 1,
          padding: 12,
          titleFont: {
            size: 14,
            weight: 'bold'
          },
          bodyFont: {
            size: 13
          },
          callbacks: {
            title: function(context) {
              return labels[context[0].dataIndex].split(':')[0]; // Just show zone name
            },
            label: function(context) {
              const percentage = context.parsed.toFixed(1);
              const dp = bucketCounts[context.dataIndex];
              const minutes = Math.round(dp / 60);
              const hours = Math.floor(minutes / 60);
              const mins = minutes % 60;
              const timeStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
              return `Time: ${percentage}% (~${timeStr})`;
            },
            afterLabel: function(context) {
              const distance = bucketDistances[context.dataIndex];
              return `Distance: ${distance.toFixed(1)} km`;
            },
            footer: function() {
              // Calculate training stress score-like metric
              const polarizationIndex = (bucketDistances[1] + bucketDistances[0]) / (bucketDistances[3] + bucketDistances[4] + bucketDistances[5]);
              const highIntensity = bucketDistances[3] + bucketDistances[4] + bucketDistances[5];
              const lowIntensity = bucketDistances[0] + bucketDistances[1];
              
              return `
━━━━━━━━━━━━━━━━━━━━━━━━
${runsWithDetailedData} runs with TCX data
Total: ${totalDistance.toFixed(1)} km
Low intensity (Z1-Z2): ${lowIntensity.toFixed(1)} km
High intensity (Z4-Z6): ${highIntensity.toFixed(1)} km
Polarization ratio: ${polarizationIndex.toFixed(2)}`;
            }
          }
        },
        datalabels: {
          color: '#ffffff',
          font: { 
            weight: 'bold', 
            size: 16 
          },
          formatter: (value) => value < 2 ? '' : value.toFixed(1) + '%',
          textStrokeColor: '#1a1d24',
          textStrokeWidth: 3
        }
      }
    },
    plugins: [ChartDataLabels]
  });
}