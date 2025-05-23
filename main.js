// Select all tab and content elements
const tabElements = document.querySelectorAll('.tab');
const contentElements = document.querySelectorAll('.content');

// Add click event listeners to all tabs
tabElements.forEach(tab => {
  tab.addEventListener('click', () => {
    // Remove 'active' class from all tabs and contents
    tabElements.forEach(t => t.classList.remove('active'));
    contentElements.forEach(c => c.classList.remove('active'));

    // Activate the clicked tab and corresponding content
    tab.classList.add('active');
    document.getElementById(tab.dataset.tab).classList.add('active');
  });
});

// Generate an array of 7 random numbers between 0 and 19
const sampleData = () => Array.from({ length: 7 }, () => Math.floor(Math.random() * 20));

// Create a ranking section with a title and a table
const createRankingSection = (containerId, title, rankings) => {
  const container = document.getElementById(containerId);

  // Create and append title
  const h3 = document.createElement('h3');
  h3.textContent = title;
  container.appendChild(h3);

  // Create and style the table
  const table = document.createElement('table');
  table.classList.add('ranking-table');

  // Create the table header
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  const headers = ['Top 3', ...rankings.map(r => r.label.match(/Last .*/)?.[0] || '')];
  headers.forEach(text => {
    const th = document.createElement('th');
    th.textContent = text;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  // Create the table body with top 3 entries
  const tbody = document.createElement('tbody');
  for (let i = 0; i < 3; i++) {
    const row = document.createElement('tr');

    // Position number (1., 2., 3.)
    const positionCell = document.createElement('td');
    positionCell.textContent = `${i + 1}.`;
    row.appendChild(positionCell);

    // Add each ranking entry
    rankings.forEach(ranking => {
      const cell = document.createElement('td');
      const entry = ranking.entries[i] || '';
      cell.textContent = entry;
      row.appendChild(cell);
    });

    tbody.appendChild(row);
  }
  table.appendChild(tbody);

  // Append the table to the container
  container.appendChild(table);
};

const createActivityPerformanceChart = (containerId, activityData, activityLabel, colorSet) => {
  const container = document.getElementById(containerId);

  // Create a styled card for the chart
  const card = document.createElement('div');
  card.style.backgroundColor = '#222';
  card.style.margin = '20px 0';
  card.style.padding = '20px';
  card.style.borderRadius = '12px';
  card.style.boxShadow = '0 4px 12px rgba(0,0,0,0.5)';

  // Add a title above the chart
  const title = document.createElement('h3');
  title.innerText = activityLabel;
  title.style.color = 'white';
  title.style.textAlign = 'center';
  card.appendChild(title);

  // Create the canvas where the chart will be drawn
  const canvas = document.createElement('canvas');
  card.appendChild(canvas);
  container.appendChild(card);

  // Create a Chart.js line chart
  new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: {
      labels: activityData.time,
      datasets: [
        {
          label: 'Power (W)',
          data: activityData.power,
          borderColor: colorSet.power,
          backgroundColor: colorSet.power + '33',
          fill: true,
          tension: 0.3,
          pointRadius: 1,
          yAxisID: 'y1'
        },
        {
          label: 'Heart Rate (bpm)',
          data: activityData.heartRate,
          borderColor: colorSet.heartRate,
          backgroundColor: colorSet.heartRate + '33',
          borderWidth: 1,
          fill: false,
          tension: 0.3,
          pointRadius: 0.1,
          yAxisID: 'y2'
        },
        {
          label: 'Cadence (rpm)',
          data: activityData.cadence,
          borderColor: colorSet.cadence,
          backgroundColor: colorSet.cadence + '33',
          fill: false,
          tension: 0.3,
          yAxisID: 'y2',
          pointRadius: 0.5,
          borderWidth: 1,
          borderDash: [5, 5]
        },
      ]
    },
    options: {
      responsive: true,
      plugins: {
        title: { display: false },
        legend: { labels: { color: 'white' } }
      },
      scales: {
        x: {
          ticks: { color: 'white' },
          grid: { color: '#444' }
        },
        y1: {
          position: 'left',
          title: { display: true, text: 'Power (W)', color: colorSet.power },
          ticks: { color: colorSet.power },
          grid: { drawOnChartArea: false },
          min: 0,
          max: Math.ceil(Math.max(...activityData.power))
        },
        y2: {
          position: 'right',
          title: { display: true, text: 'Heart Rate (bpm)', color: colorSet.heartRate },
          ticks: { color: colorSet.heartRate },
          grid: { drawOnChartArea: false },
          min: 0,
          max: Math.ceil(Math.max(...activityData.heartRate))
        }
      }
    }
  });
};


const createActivityCadenceChart = (containerId, activityData, activityLabel, colorSet) => {
  const container = document.getElementById(containerId);

  // Create a styled card for the chart
  const card = document.createElement('div');
  card.style.backgroundColor = '#222';
  card.style.margin = '20px 0';
  card.style.padding = '20px';
  card.style.borderRadius = '12px';
  card.style.boxShadow = '0 4px 12px rgba(0,0,0,0.5)';

  // Add a title above the chart
  const title = document.createElement('h3');
  title.innerText = activityLabel;
  title.style.color = 'white';
  title.style.textAlign = 'center';
  card.appendChild(title);

  // Create the canvas where the chart will be drawn
  const canvas = document.createElement('canvas');
  card.appendChild(canvas);
  container.appendChild(card);
  
  // Convert an array of speeds from m/s to km/h
  let speedData = activityData.speed.map(speed => speed * 3.6);

  // Create a Chart.js line chart
  new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: {
      labels: activityData.time,
      datasets: [
        // Speed dataset
        {
          label: 'Speed (km/h)',
          data: speedData,
          borderColor: colorSet.speed,
          backgroundColor: colorSet.speed + '33',
          fill: false,
          tension: 0.3,
          yAxisID: 'y1',   // Speed -> y1
          pointRadius: 0.3,
          borderWidth: 1,
          borderDash: [5, 5]
        },
        // Altitude dataset
        {
          label: 'Altitude (m)',
          data: activityData.altitude,
          borderColor: colorSet.altitude,
          backgroundColor: colorSet.altitude + '33', // <-- corrected!
          fill: false,
          tension: 0.3,
          yAxisID: 'y2',   // Altitude -> y2
          pointRadius: 0.3,
          borderWidth: 1,
          borderDash: [5, 5]
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        title: { display: false },
        legend: { labels: { color: 'white' } }
      },
      scales: {
        x: {
          ticks: { color: 'white' },
          grid: { color: '#444' }
        },
        y1: {
          position: 'left',
          title: { display: true, text: 'Speed (km/h)', color: colorSet.speed },
          ticks: { color: colorSet.speed },
          grid: { color: '#444' },
          min: 0,
          max: Math.ceil(Math.max(...speedData) * 2) // <- careful: *2 might be too large
        },
        y2: {
          position: 'right',
          title: { display: true, text: 'Altitude (m)', color: colorSet.altitude },
          ticks: { color: colorSet.altitude },
          grid: { drawOnChartArea: false }, // usually no grid for right axis
          min: 0,
          max: Math.ceil(Math.max(...activityData.altitude))
        }
      }
    }
  });
};


// Create a Power Chart showing sorted power values
const createActivityPowerChart = (containerId, activityData, activityLabel, colorSet) => {
  // Sort the power values descending
  const sortedPower = [...activityData.power].sort((a, b) => b - a);
  const sortedIndex = sortedPower.map((_, index) => index + 1);

  console.log("Sorted Power Data (descending):", sortedPower);

  if (sortedPower.length === 0) {
    console.error("No valid power data available.");
    return;
  }

  const container = document.getElementById(containerId);
  const canvas = document.createElement('canvas');
  container.appendChild(canvas);

  // Create a Chart.js line chart for power data
  new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: {
      labels: sortedIndex,
      datasets: [{
        label: 'Power / Time',
        data: sortedPower,
        borderColor: colorSet.power,
        backgroundColor: colorSet.power + '33',
        fill: false,
        tension: 0.3,
        yAxisID: 'y1',
        pointRadius: 0.3,
        borderWidth: 1,
        borderDash: [5, 5]
      }]
    },
    options: {
      responsive: true,
      plugins: {
        title: { display: true, text: activityLabel, color: 'white', font: { size: 24 } },
        legend: { labels: { color: 'white' } }
      },
      scales: {
        x: {
          ticks: { color: 'white' },
          grid: { color: '#444' }
        },
        y: {
          type: 'linear',
          position: 'left',
          title: { display: true, text: 'Power (W)', color: colorSet.power },
          ticks: {
            color: colorSet.power,
            callback: value => value.toLocaleString()
          },
          grid: { color: '#444' },
          min: 0,
          max: Math.ceil(Math.max(...sortedPower) * 1.1)
        }
      }
    }
  });
};

// Fetch all activity files and create charts for each
async function loadAllActivities() {
  try {
    const listResponse = await fetch('https://strava.manueltiefenbacher998.workers.dev/');
    if (!listResponse.ok) throw new Error('Failed to fetch file list');

    const fileNames = await listResponse.json();
    console.log('Gefundene Dateien:', fileNames);

    for (const fileName of fileNames) {
      const activityData = await loadActivityData(fileName);
      if (activityData) {
        createActivityPerformanceChart('allChartContainer', activityData, fileName, colorSet);
      }
    }
  } catch (error) {
    console.error('Fehler beim Laden aller Aktivitäten:', error);
  }
}

// Load and parse a specific activity JSON file
async function loadActivityData(fileName) {
  try {
    if (!fileName) throw new Error('Ungültiger Dateiname');
    console.log('Lade Datei:', fileName);

    const response = await fetch(`https://strava.manueltiefenbacher998.workers.dev/?file=${fileName}`);
    if (!response.ok) throw new Error(`Fehler beim Laden der Datei: ${fileName}`);

    const jsonData = await response.json();

    const cadenceData = jsonData.cadence ? jsonData.cadence.data : [];
    const powerData = jsonData.watts ? jsonData.watts.data : [];
    const velocityData = jsonData.velocity_smooth ? jsonData.velocity_smooth.data : [];

    // Generate formatted time labels
    const time = Array.from({ length: jsonData.distance.data.length }, (_, i) => {
      const min = String(Math.floor(i / 60)).padStart(2, '0');
      const sec = String(i % 60).padStart(2, '0');
      return `${min}:${sec}`;
    });

    return {
      time: time,
      speed: velocityData,
      cadence: cadenceData,
      power: powerData,
      heartRate: jsonData.heartrate.data
    };
  } catch (error) {
    console.error('Fehler beim Laden der JSON-Daten:', error);
    return null;
  }
}

// Define colors for different data types
const colorSet = {
  speed: '#00bcd4',
  cadence: '#8bc34a',
  power: '#ff9800',
  heartRate: '#f44336'
};

// Load the latest activity and initialize the charts
async function initializeChart() {
  try {
    const listResponse = await fetch('https://strava.manueltiefenbacher998.workers.dev/');
    const fileNames = await listResponse.json();
    if (fileNames.length === 0) {
      console.error('Keine Dateien gefunden.');
      return;
    }

    const latestFile = fileNames[0]; // Take the latest file (can be changed to a sorted method)

    const activityData = await loadActivityData(latestFile);
	console.log(activityData);
    if (activityData) {
      createActivityPerformanceChart('performanceChartContainer', activityData, 'Performance Data', colorSet);
	  createActivityCadenceChart('cadenceChartContainer', activityData, 'Cadence Data', colorSet);
      createActivityPowerChart('powerChartContainer', activityData, 'Power Data', colorSet);
    }
  } catch (error) {
    console.error('Fehler beim Initialisieren:', error);
  }
}

// Start the process
initializeChart();
loadAllActivities();

// Create the three ranking sections for outdoor, indoor and running
createRankingSection('outdoorRanking', 'Outdoor Rankings', [
  { label: 'Top 3 Outdoor Rides - Last 4 Weeks', entries: ['Ride A - 67 km', 'Ride B - 59 km', 'Ride C - 55 km'] },
  { label: 'Top 3 Outdoor Rides - Last 3 Months', entries: ['Ride D - 102 km', 'Ride E - 98 km', 'Ride F - 91 km'] },
  { label: 'Top 3 Outdoor Rides - Last Year', entries: ['Ride G - 150 km', 'Ride H - 145 km', 'Ride I - 142 km'] },
]);

createRankingSection('indoorRanking', 'Indoor Rankings', [
  { label: 'Top 3 Indoor Rides - Last 4 Weeks', entries: ['Ride A - 43 km', 'Ride B - 39 km', 'Ride C - 36 km'] },
  { label: 'Top 3 Indoor Rides - Last 3 Months', entries: ['Ride D - 77 km', 'Ride E - 72 km', 'Ride F - 68 km'] },
  { label: 'Top 3 Indoor Rides - Last Year', entries: ['Ride G - 105 km', 'Ride H - 101 km', 'Ride I - 96 km'] },
]);

createRankingSection('runningRanking', 'Running Rankings', [
  { label: 'Top 3 Runs - Last 4 Weeks', entries: ['Run A - 18 km', 'Run B - 15 km', 'Run C - 14 km'] },
  { label: 'Top 3 Runs - Last 3 Months', entries: ['Run D - 25 km', 'Run E - 22 km', 'Run F - 21 km'] },
  { label: 'Top 3 Runs - Last Year', entries: ['Run G - 30 km', 'Run H - 29 km', 'Run I - 28 km'] },
]);
