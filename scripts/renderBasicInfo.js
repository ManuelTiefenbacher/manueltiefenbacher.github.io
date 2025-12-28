// Load HR_MAX from sessionStorage on page load (at the top of your script)
if (sessionStorage.getItem('customHRMax')) {
  HR_MAX = Number(sessionStorage.getItem('customHRMax'));
}

function renderBasicInfo(avgWeekly, recentRuns) { 
  const MS_PER_DAY = 86_400_000;
  const now = new Date();
  document.getElementById("avgWeekly").textContent = avgWeekly.toFixed(1)+" km";
  const last7 = recentRuns.filter(r => (now-r.date)/MS_PER_DAY<=7).reduce((a,b)=>a+b.distance,0);
  document.getElementById("distanceWeek").textContent = last7.toFixed(1)+" km";
  
  // If r.date is a Date or string, normalize to timestamp:
  const getTime = d =>
    d instanceof Date ? d.getTime()
    : typeof d === 'string' ? new Date(d).getTime()
    : d; // assume it's already a number
  
  const runsWeek = recentRuns
    .filter(r => {
      const t = getTime(r.date);
      if (!Number.isFinite(t)) return false;
      const daysAgo = (now - t) / MS_PER_DAY;
      return daysAgo >= 0 && daysAgo <= 7; // last 7 days
    })
    .length;
  document.getElementById("runsWeek").textContent = runsWeek;
  
  // Calculate days since last rest day
  const sortedRuns = [...recentRuns].sort((a,b) => b.date - a.date);
  let daysSinceRest = 0;
  
  // Check if there's a run today (within the last day)
  if (sortedRuns.length > 0) {
    const mostRecentRun = sortedRuns[0];
    const daysSinceLastRun = (now - mostRecentRun.date) / MS_PER_DAY;
    
    if (daysSinceLastRun <= 1) {
      // There was a run today, count consecutive runs
      for (let i = 0; i < sortedRuns.length - 1; i++) {
        const currentRun = sortedRuns[i];
        const nextRun = sortedRuns[i + 1];
        const daysBetween = Math.floor((currentRun.date - nextRun.date) / MS_PER_DAY);
        
        if (daysBetween > 1) {
          // Found a rest day (gap > 1 day between consecutive runs)
          daysSinceRest = i + 1;
          break;
        }
      }
      
      // If no rest day found in the data, count all runs
      if (daysSinceRest === 0) {
        daysSinceRest = sortedRuns.length;
      }
    }
    // else: daysSinceRest stays 0 (no run today)
  }
  
  document.getElementById("restDays").textContent = daysSinceRest;
  
// Calculate max HR from last 6 months
const maxHRValue = Math.max(...recentRuns.map(r => r.maxHR).filter(hr => hr > 0));
const saveBtn = document.getElementById('saveHrBtn');
const resetBtn = document.getElementById('resetHrBtn');
const maxHrInput = document.getElementById('maxHrInput');

// Use saved value if it exists, otherwise use calculated max
if (sessionStorage.getItem('customHRMax')) {
  HR_MAX = Number(sessionStorage.getItem('customHRMax'));
  if (maxHrInput) {
    maxHrInput.value = HR_MAX;
  }
} else {
  HR_MAX = maxHRValue;
  if (maxHrInput) {
    maxHrInput.value = maxHRValue;
  }
}

// Speichern-Button (explizit)
if (saveBtn) {
  saveBtn.addEventListener('click', () => {
    const newHRMax = Number(maxHrInput.value);
    if (newHRMax > 0) {
      HR_MAX = newHRMax;
      // Save to sessionStorage
      sessionStorage.setItem('customHRMax', HR_MAX);
      
      // Update the display
      document.getElementById("maxHR").textContent = HR_MAX + " bpm";
      
      // Re-run analyze with new HR_MAX
      if (typeof analyze === 'function' && window.allRuns) {
        analyze(window.allRuns, 'HR Max Updated');
      }
      
      showFeedback(`✅ Max HR updated to ${HR_MAX} bpm`, 'success');
    } else {
      showFeedback('❌ Please enter a valid HR value', 'error');
    }
  });
}

// Reset button to clear custom HR_MAX
if (resetBtn) {
  resetBtn.addEventListener('click', () => {
    sessionStorage.removeItem('customHRMax');
    HR_MAX = maxHRValue;
    if (maxHrInput) {
      maxHrInput.value = maxHRValue;
    }
    document.getElementById("maxHR").textContent = HR_MAX + " bpm";
    
    // Re-run analyze with reset HR_MAX
    if (typeof analyze === 'function' && window.allRuns) {
      analyze(window.allRuns, 'HR Max Reset');
    }
    
    showFeedback(`✅ Max HR reset to calculated value: ${HR_MAX} bpm`, 'success');
  });
}

// Scan Activities button
const scanBtn = document.getElementById('scanActivitiesBtn');
console.log('Scan button element:', scanBtn);

if (scanBtn) {
  console.log('Adding click listener to scan button');
  
  scanBtn.addEventListener('click', () => {
    console.log('Scan button clicked!');
    
    // Check for runs from either source
    const runs = window.allRuns || window.runs || [];
    console.log('Available runs:', runs);
    console.log('Runs length:', runs.length);
    
    if (!runs || runs.length === 0) {
      console.log('No activities found');
      showFeedback('❌ No activities loaded. Please upload a ZIP file or connect to Strava first.', 'error');
      return;
    }
    
    showFeedback('⏳ Scanning all activities for maximum HR...', 'info');
    
    let maxHRFromActivities = 0;
    let maxHRActivity = null;
    
    // Check both basic HR and detailed HR streams
    runs.forEach((run, index) => {
      console.log(`Checking run ${index}:`, {
        id: run.id,
        date: run.date,
        maxHR: run.maxHR,
        hasHrStream: !!run.hrStream
      });
      
      // Check basic max HR
      if (run.maxHR && run.maxHR > maxHRFromActivities) {
        maxHRFromActivities = run.maxHR;
        maxHRActivity = run;
        console.log(`New max from basic HR: ${maxHRFromActivities}`);
      }
      
      // Check detailed HR stream for potentially higher values
      if (run.hrStream && run.hrStream.heartrate && run.hrStream.heartrate.length > 0) {
        const streamMax = Math.max(...run.hrStream.heartrate);
        console.log(`Stream max for run ${index}: ${streamMax}`);
        if (streamMax > maxHRFromActivities) {
          maxHRFromActivities = streamMax;
          maxHRActivity = run;
          console.log(`New max from stream: ${maxHRFromActivities}`);
        }
      }
    });
    
    console.log('Final max HR:', maxHRFromActivities);
    console.log('Max HR activity:', maxHRActivity);
    
    if (maxHRFromActivities > 0) {
      HR_MAX = maxHRFromActivities;
      
      // Save to sessionStorage
      sessionStorage.setItem('customHRMax', HR_MAX);
      
      // Update input field
      if (maxHrInput) {
        maxHrInput.value = HR_MAX;
      }
      
      // Update display
      const maxHRElement = document.getElementById("maxHR");
      if (maxHRElement) {
        maxHRElement.textContent = HR_MAX + " bpm";
      }
      
      // Re-run analyze with the current runs
      if (typeof analyze === 'function') {
        analyze(runs, 'HR Max Scanned');
      }
      
      const activityDate = maxHRActivity.date.toLocaleDateString('en-GB');
      const activityDistance = maxHRActivity.distance.toFixed(1);
      showFeedback(
        `✅ Max HR found: ${HR_MAX} bpm (from ${activityDistance} km run on ${activityDate})`,
        'success'
      );
    } else {
      showFeedback('❌ No heart rate data found in activities', 'error');
    }
  });
} else {
  console.error('Scan button not found! Check if element with id="scanActivitiesBtn" exists');
}

if (maxHRValue > 0) {
  document.getElementById("maxHR").textContent = HR_MAX + " bpm";
}
}