function renderTimeline(runs, avgWeekly) {
  const div = document.getElementById("timeline");
  div.innerHTML = "";

  // Get zones from global config and convert percentages to BPM
  const zones = {
    z2Upper: Number(window.z2Upper) * HR_MAX,
    z3Upper: Number(window.z3Upper) * HR_MAX,
    z4Upper: Number(window.z4Upper) * HR_MAX,
    z5Upper: Number(window.z5Upper) * HR_MAX
  };
  
  // Debug: log zones to console
  console.log('HR Zones (BPM):', zones);
  console.log('HR_MAX:', HR_MAX);

  runs
    .filter(r => (new Date()-r.date)/86400000<=700)
    .sort((a,b)=>b.date-a.date)
    .forEach(r => {
      const classificationResult = classify(r, avgWeekly, zones);
      const { category, isLong, hrDataType, detailedHR } = classificationResult;
      
      const el = document.createElement("div");
      el.className = `run ${category.replace(/\s+/g, '-').toLowerCase()}`;
      
      // Create tooltip with detailed info
      let tooltipHTML = `
        <div class="tooltip">
          <div class="tooltip-row">
            <span class="tooltip-label">Type:</span>
            <span class="tooltip-value">${category}${isLong ? ' (Long Run)' : ''}</span>
          </div>
          <div class="tooltip-row">
            <span class="tooltip-label">Distance:</span>
            <span class="tooltip-value">${r.distance.toFixed(2)} km</span>
          </div>
          <div class="tooltip-row">
            <span class="tooltip-label">Avg Weekly km:</span>
            <span class="tooltip-value">${avgWeekly.toFixed(1)} km</span>
          </div>`;
      
      if (hrDataType === 'none') {
        tooltipHTML += `
          <div class="tooltip-row">
            <span class="tooltip-label">HR Data:</span>
            <span class="tooltip-value" style="color:#ea4335">Not available</span>
          </div>`;
      } else if (hrDataType === 'basic') {
        const zone = getZone(r.avgHR, zones);
        tooltipHTML += `
          <div class="tooltip-row">
            <span class="tooltip-label">HR Data:</span>
            <span class="tooltip-value" style="color:#fbbc04">Only Max & Avg HR available</span>
          </div>
          <div class="tooltip-row">
            <span class="tooltip-label">Avg HR:</span>
            <span class="tooltip-value">${r.avgHR} bpm (Zone ${zone})</span>
          </div>
          <div class="tooltip-row">
            <span class="tooltip-label">Max HR:</span>
            <span class="tooltip-value">${r.maxHR} bpm (${(r.maxHR/HR_MAX*100).toFixed(0)}%)</span>
          </div>`;
      } else if (hrDataType === 'detailed') {
        const zone = getZone(r.avgHR, zones);
        tooltipHTML += `
          <div class="tooltip-row">
            <span class="tooltip-label">HR Data:</span>
            <span class="tooltip-value" style="color:#34a853">Detailed HR available</span>
          </div>
          <div class="tooltip-row">
            <span class="tooltip-label">Avg HR:</span>
            <span class="tooltip-value">${r.avgHR} bpm (Zone ${zone})</span>
          </div>
          <div class="tooltip-row">
            <span class="tooltip-label">Max HR:</span>
            <span class="tooltip-value">${r.maxHR} bpm (${(r.maxHR/HR_MAX*100).toFixed(0)}%)</span>
          </div>`;
      }
      
      if (detailedHR) {
        tooltipHTML += `
          <hr style="border:none;border-top:1px solid var(--border);margin:8px 0">`;
        
        // Add HR graph if we have detailed data
        if (detailedHR.hrRecords && detailedHR.hrRecords.length > 0) {
          const graphSVG = generateHRGraph(detailedHR.hrRecords, zones);
          tooltipHTML += graphSVG;
        }
        
        tooltipHTML += `
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
          </div>`;
      }
      
      tooltipHTML += `
          <hr style="border:none;border-top:1px solid var(--border);margin:8px 0">
          <div style="font-size:0.8rem;color:var(--muted);margin-top:4px">
            <strong>Z2:</strong> 75% in Z2 & ≤5% above Z4<br>
            <strong>Intensity:</strong> 80% in Z3-Z5<br>
            <strong>Race:</strong> 80% in Z5-Z6<br>
            <strong>Long:</strong> Distance > Avg Weekly km<br>
            <strong>Zones (BPM):</strong> Z2: ≤${Math.round(zones.z2Upper)}, Z3: ≤${Math.round(zones.z3Upper)}, Z4: ≤${Math.round(zones.z4Upper)}, Z5: ≤${Math.round(zones.z5Upper)}
          </div>
        </div>`;
      
      // Create HR data type badge
      let hrBadge = '';
      if (hrDataType === 'none') {
        hrBadge = '<span class="badge no-hr" style="background:#ea4335;color:white">No HR</span>';
      } else if (hrDataType === 'basic') {
        hrBadge = '<span class="badge basic-hr" style="background:#fbbc04;color:black">Basic HR</span>';
      }
      
      el.innerHTML = `
        <span>${r.date.toLocaleDateString('en-GB')} – ${category}${isLong ? ' (Long)' : ''}</span>
        <span>${hrBadge}${isLong ? '<span class="badge long-run" style="background:#34a853;color:white">Long Run</span>' : ''}<span class="badge">${r.distance.toFixed(1)} km</span></span>
        ${tooltipHTML}
      `;
      div.appendChild(el);
    });
}

function getZone(hr, zones) {
  // Zone thresholds should be in ascending order
  // Z1: < 60% of max (very light, recovery)
  // Z2: 60-75% (aerobic base)
  // Z3: 75-85% (tempo)
  // Z4: 85-90% (threshold)
  // Z5: 90-95% (VO2 max)
  // Z6: >95% (anaerobic/sprint)
  
  if (hr <= zones.z2Upper) return 2;
  if (hr <= zones.z3Upper) return 3;
  if (hr <= zones.z4Upper) return 4;
  if (hr <= zones.z5Upper) return 5;
  return 6;
}

function generateHRGraph(hrRecords, zones) {
  const width = 400;
  const height = 150;
  const padding = 30;
  const graphWidth = width - padding * 2;
  const graphHeight = height - padding * 2;
  
  console.log('Generating graph with width:', width, 'height:', height);
  
  // Sample data if too many points (max 200 points for performance)
  let sampledRecords = hrRecords;
  if (hrRecords.length > 200) {
    const step = Math.ceil(hrRecords.length / 200);
    sampledRecords = hrRecords.filter((_, i) => i % step === 0);
  }
  
  // Use global HR_MAX for y-axis range
  const minHR = Math.max(Math.min(...sampledRecords) - 10, 100); // Some padding below min
  const maxHR = HR_MAX + 10; // Use global max + padding
  const hrRange = maxHR - minHR;
  
  console.log('HR Range:', minHR, 'to', maxHR, 'HR_MAX:', HR_MAX);
  
  // Create path for HR line
  let pathData = sampledRecords.map((hr, i) => {
    const x = padding + (i / (sampledRecords.length - 1)) * graphWidth;
    const y = padding + graphHeight - ((hr - minHR) / hrRange) * graphHeight;
    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');
  
  // Create zone background rectangles
  const zoneColors = {
    2: 'rgba(52, 168, 83, 0.1)',  // Green for Z2
    3: 'rgba(251, 188, 4, 0.1)',   // Yellow for Z3
    4: 'rgba(255, 153, 0, 0.1)',   // Orange for Z4
    5: 'rgba(234, 67, 53, 0.1)'    // Red for Z5
  };
  
  let zoneRects = '';
  let zoneLines = '';
  const zoneThresholds = [
    { upper: zones.z2Upper, color: zoneColors[2], label: 'Z2' },
    { upper: zones.z3Upper, color: zoneColors[3], label: 'Z3' },
    { upper: zones.z4Upper, color: zoneColors[4], label: 'Z4' },
    { upper: zones.z5Upper, color: zoneColors[5], label: 'Z5' }
  ];
  
  let prevY = padding + graphHeight;
  zoneThresholds.forEach((zone) => {
    if (zone.upper >= minHR && zone.upper <= maxHR) {
      const y = padding + graphHeight - ((zone.upper - minHR) / hrRange) * graphHeight;
      zoneRects += `<rect x="${padding}" y="${y}" width="${graphWidth}" height="${prevY - y}" fill="${zone.color}" />`;
      
      // Add horizontal line for zone threshold
      zoneLines += `<line x1="${padding}" y1="${y}" x2="${padding + graphWidth}" y2="${y}" stroke="#999" stroke-width="1" stroke-dasharray="3,3" opacity="0.5" />`;
      zoneLines += `<text x="${padding + graphWidth + 5}" y="${y + 4}" font-size="10" fill="var(--muted)">${zone.upper}</text>`;
      
      prevY = y;
    }
  });
  
  // Add horizontal grid lines every 10 bpm
  let gridLines = '';
  for (let hr = Math.ceil(minHR / 10) * 10; hr <= maxHR; hr += 10) {
    const y = padding + graphHeight - ((hr - minHR) / hrRange) * graphHeight;
    gridLines += `<line x1="${padding}" y1="${y}" x2="${padding + graphWidth}" y2="${y}" stroke="var(--border)" stroke-width="1" opacity="0.3" />`;
  }
  
  return `
    <div style="margin: 12px 0;">
      <svg width="${width}" height="${height}" style="display: block; margin: 0 auto;">
        ${gridLines}
        ${zoneRects}
        ${zoneLines}
        <path d="${pathData}" fill="none" stroke="#ea4335" stroke-width="2.5" />
        <line x1="${padding}" y1="${padding}" x2="${padding}" y2="${padding + graphHeight}" stroke="var(--border)" stroke-width="1.5" />
        <line x1="${padding}" y1="${padding + graphHeight}" x2="${padding + graphWidth}" y2="${padding + graphHeight}" stroke="var(--border)" stroke-width="1.5" />
        <text x="${padding - 5}" y="${padding - 5}" text-anchor="end" font-size="11" fill="var(--muted)" font-weight="500">${Math.round(maxHR)}</text>
        <text x="${padding - 5}" y="${padding + graphHeight + 5}" text-anchor="end" font-size="11" fill="var(--muted)" font-weight="500">${Math.round(minHR)}</text>
      </svg>
    </div>
  `;
}

function classify(r, avgWeekly, zones) {
  const isLong = r.distance > (0.5 * avgWeekly);

  // Determine HR data type using new format
  const hasBasicHR = r.avgHR > 0 && r.maxHR > 0;
  let detailedHR = null;
  let hrDataType = 'none';

  // Check for hrStream (new unified format for both Strava and ZIP)
  if (r.hrStream && r.hrStream.heartrate && r.hrStream.heartrate.length > 0) {
    detailedHR = analyzeDetailedHR(r.hrStream, zones);
    if (detailedHR) {
      hrDataType = 'detailed';
      console.log(`Run ${r.id} has detailed HR data (${r.hrStream.heartrate.length} points)`);
    }
  }
  
  if (hrDataType === 'none' && hasBasicHR) {
    hrDataType = 'basic';
  }

  // If no HR data at all, return Mixed
  if (hrDataType === 'none') {
    return {
      category: "Mixed Effort",
      isLong: isLong,
      hrDataType: 'none',
      detailedHR: null
    };
  }

  let category = "Mixed Effort";
  let tendency = ""; // For mixed efforts, indicate tendency

  // Use detailed HR data if available, otherwise fall back to basic HR
  if (detailedHR) {
    const timeAboveZ4 = detailedHR.percentZ5 + detailedHR.percentZ6;
    const timeZ3toZ5 = detailedHR.percentZ3 + detailedHR.percentZ4 + detailedHR.percentZ5;
    const timeZ5Z6 = detailedHR.percentZ5 + detailedHR.percentZ6;
    
    // Z2: 75% in Z2 & ≤5% above Z4
    if (detailedHR.percentZ2 >= 75 && timeAboveZ4 <= 5) {
      category = "Z2";
    }
    // Race: 80% in Z5-Z6
    else if (timeZ5Z6 >= 80) {
      category = "Race Effort";
    }
    // Intensity: 80% in Z3-Z5
    else if (timeZ3toZ5 >= 80) {
      category = "Intensity Effort";
    }
    // Mixed - determine tendency
    else {
      category = "Mixed Effort";
      // Determine tendency based on highest percentage zone
      const zonePercentages = [
        { zone: 'Z2', percent: detailedHR.percentZ2 },
        { zone: 'Intensity', percent: timeZ3toZ5 },
        { zone: 'Race', percent: timeZ5Z6 }
      ];
      const dominant = zonePercentages.reduce((max, curr) => 
        curr.percent > max.percent ? curr : max
      );
      tendency = ` (→ ${dominant.zone})`;
    }
  } else {
    // Basic HR fallback classification
    const avgZone = getZone(r.avgHR, zones);
    const maxZone = getZone(r.maxHR, zones);
    
    // Z2: average HR in Z2
    if (avgZone === 2 && maxZone <= 4) {
      category = "Z2";
    }
    // Race: average HR in Z5 or Z6
    else if (avgZone >= 5) {
      category = "Race Effort";
    }
    // Intensity: average HR in Z3 or Z4
    else if (avgZone === 3 || avgZone === 4) {
      category = "Intensity Effort";
    }
    else {
      category = "Mixed Effort";
      if (avgZone === 2) tendency = " (→ Z2)";
      else if (avgZone >= 3 && avgZone <= 4) tendency = " (→ Intensity)";
      else if (avgZone >= 5) tendency = " (→ Race)";
    }
  }

  return {
    category: category + tendency,
    isLong: isLong,
    hrDataType: hrDataType,
    detailedHR: detailedHR
  };
}

function analyzeDetailedHR(hrStream, zones) {
  // New unified format: hrStream = { heartrate: [...], time: [...] }
  if (!hrStream || !hrStream.heartrate || hrStream.heartrate.length === 0) {
    console.warn('No HR stream data available');
    return null;
  }
  
  const hrRecords = hrStream.heartrate.filter(hr => hr && hr > 0);
  
  if (hrRecords.length === 0) {
    console.warn('No valid HR records after filtering');
    return null;
  }
  
  console.log(`Analyzing ${hrRecords.length} HR records`);
  
  // Calculate time in each zone
  let timeZ1 = 0; // Below Z2 lower (we don't have Z1 upper, so assume < 60% of Z2Upper)
  let timeZ2 = 0;
  let timeZ3 = 0;
  let timeZ4 = 0;
  let timeZ5 = 0;
  let timeZ6 = 0; // Above Z5 upper
  let totalTime = hrRecords.length;
  
  // Estimate Z1 upper as anything below Z2 (could be refined)
  const z1Upper = zones.z2Upper * 0.8; // Rough estimate: Z1 is recovery zone
  
  hrRecords.forEach(hr => {
    if (hr <= z1Upper) {
      timeZ1++;
    } else if (hr <= zones.z2Upper) {
      timeZ2++;
    } else if (hr <= zones.z3Upper) {
      timeZ3++;
    } else if (hr <= zones.z4Upper) {
      timeZ4++;
    } else if (hr <= zones.z5Upper) {
      timeZ5++;
    } else {
      timeZ6++;
    }
  });
  
  const result = {
    percentZ1: (timeZ1 / totalTime) * 100,
    percentZ2: (timeZ2 / totalTime) * 100,
    percentZ3: (timeZ3 / totalTime) * 100,
    percentZ4: (timeZ4 / totalTime) * 100,
    percentZ5: (timeZ5 / totalTime) * 100,
    percentZ6: (timeZ6 / totalTime) * 100,
    avgHR: hrRecords.reduce((a,b) => a+b, 0) / hrRecords.length,
    maxHR: Math.max(...hrRecords),
    totalRecords: totalTime,
    hrRecords: hrRecords // Include raw HR data for graphing
  };
  
  console.log('HR analysis result:', {
    avgHR: result.avgHR.toFixed(1),
    maxHR: result.maxHR,
    z2Percent: result.percentZ2.toFixed(1)
  });
  
  return result;
}