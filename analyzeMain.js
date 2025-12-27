let oldRuns = [];
let allRuns = [];

function analyze(newRuns, source = 'unknown') {

	console.log(`Analyzing ${newRuns.length} runs from ${source}`);
	const now = new Date();
	const sixMonthsAgo = new Date();
	sixMonthsAgo.setMonth(now.getMonth() - 6);
  
	// Combine and remove duplicates based on ID
	const combinedRuns = [...oldRuns, ...newRuns];
	
	// Remove duplicates - keep the first occurrence (CSV has priority)
	const uniqueRuns = combinedRuns.filter((run, index, self) => 
	  index === self.findIndex(r => r.id === run.id)
	);
	
	allRuns = uniqueRuns;
	oldRuns = uniqueRuns; // Store for next call
	
	console.log(`Total runs: ${combinedRuns.length}, Unique runs: ${uniqueRuns.length}`);
	
	// Check if tcxDataCache is available
	console.log('TCX data available:', Object.keys(window.tcxDataCache || {}).length, 'files');
	
	// Filter runs from last 6 months
	const recentRuns = allRuns.filter(r => r.date >= sixMonthsAgo);
  
	// Calculate weekly distances
	const weekly = {};
	recentRuns.forEach(r => {
		const w = isoWeek(r.date);
		weekly[w] = (weekly[w] || 0) + r.distance;
	});
	const weeks = Object.keys(weekly).sort();
	const values = weeks.map(w => weekly[w]);
	const avgWeekly = values.reduce((a,b)=>a+b,0)/values.length;
	
	console.log('Analyzing', allRuns.length, 'runs');
	
	renderBasicInfo(avgWeekly, allRuns);
	renderAverageDistanceChartWithZones(allRuns, avgWeekly);
	renderIntensityChart(allRuns);
	renderTimeline(allRuns, avgWeekly);
	renderTrainingLoadAnalysis(allRuns);
}

function isoWeek(d){
  d=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));
  d.setUTCDate(d.getUTCDate()+4-(d.getUTCDay()||7));
  const y=new Date(Date.UTC(d.getUTCFullYear(),0,1));
  return d.getUTCFullYear()+"-W"+Math.ceil((((d-y)/86400000)+1)/7);
}