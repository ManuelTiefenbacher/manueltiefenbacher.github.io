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
  HR_MAX = maxHRValue;
  
  // Speichern-Button (explizit)
  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      HR_MAX = maxHrInput;
    });
  }
  
  if (maxHRValue > 0) {
    document.getElementById("maxHR").textContent = maxHRValue + " bpm";
  }
}