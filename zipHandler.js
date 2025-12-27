// ===== Initialize Global Variables if not already declared =====
if (typeof window.allRuns === 'undefined') {
  window.allRuns = [];
}
if (typeof window.csvRuns === 'undefined') {
  window.csvRuns = [];
}
if (typeof window.tcxDataCache === 'undefined') {
  window.tcxDataCache = {};
}

// ===== ZIP Processing Function =====
async function processZipFile(file) {
  const progressContainer = document.getElementById("progressContainer");
  const progressText = document.getElementById("progressText");
  const progressFill = document.getElementById("progressFill");
  
  progressContainer.style.display = "block";
  progressText.textContent = "Entpacke ZIP-Datei...";
  progressFill.style.width = "10%";
  
  try {
    const zip = await JSZip.loadAsync(file);
    console.log("ZIP geladen, Dateien:", Object.keys(zip.files).length);
    
    // Find activities.csv
    progressText.textContent = "Suche activities.csv...";
    progressFill.style.width = "20%";
    
    let csvFile = null;
    for (const filename in zip.files) {
      if (filename.endsWith('activities.csv')) {
        csvFile = zip.files[filename];
        console.log("CSV gefunden:", filename);
        break;
      }
    }
    
    if (!csvFile) {
      alert("Keine activities.csv gefunden im ZIP-Archiv!");
      progressContainer.style.display = "none";
      return;
    }
    
    // Parse CSV
    progressText.textContent = "Lade activities.csv...";
    progressFill.style.width = "30%";
    
    const csvText = await csvFile.async("text");
    await new Promise((resolve) => {
      Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        complete: async result => {
          console.log("CSV geparst:", result.data.length, "Zeilen");
          await parseCSV(result.data);
          resolve();
        },
        error: err => {
          console.error("CSV Parse-Fehler:", err);
          alert("Fehler beim Parsen der CSV: " + err.message);
          progressContainer.style.display = "none";
        }
      });
    });
    
    // Find and process TCX files in activities folder
    progressText.textContent = "Suche TCX-Dateien...";
    progressFill.style.width = "40%";
    
    const tcxFiles = [];
    for (const filename in zip.files) {
      if (filename.includes('activities/') && filename.endsWith('.tcx.gz')) {
        tcxFiles.push({ filename, file: zip.files[filename] });
      }
    }
    
    console.log(`${tcxFiles.length} TCX.GZ-Dateien gefunden`);
    
    if (tcxFiles.length === 0) {
      progressText.textContent = "Keine TCX-Dateien gefunden - Analyse nur mit CSV-Daten";
      progressFill.style.width = "100%";
      
      // Save to IndexedDB even without TCX data
      if (typeof saveToSession === 'function') {
        await saveToSession();
      }
      
      // Call analyze even without TCX data
      if (window.allRuns.length > 0 && typeof analyze === 'function') {
        console.log('Calling analyze() with', window.allRuns.length, 'runs (no TCX data)');
        analyze(window.allRuns);
      }
      
      setTimeout(() => {
        progressContainer.style.display = "none";
      }, 2000);
      return;
    }
    
    // Process TCX files
    let processedCount = 0;
    let matchedCount = 0;
    
    for (const { filename, file } of tcxFiles) {
      try {
        progressText.textContent = `Verarbeite TCX-Dateien... (${processedCount + 1}/${tcxFiles.length})`;
        const baseProgress = 40;
        const progressRange = 50;
        progressFill.style.width = (baseProgress + (processedCount / tcxFiles.length) * progressRange) + "%";
        
        // Extract .gz file
        const gzData = await file.async("uint8array");
        
        // Decompress using pako
        const tcxData = pako.ungzip(gzData, { to: 'string' });
        
        // Parse TCX
        const parsedTcx = parseTcxFile(tcxData);
        
        if (parsedTcx && parsedTcx.records && parsedTcx.records.length > 0) {
          // Extract activity ID from filename
          const activityId = filename.split('/').pop().replace('.tcx.gz', '');
          
          // Find matching run
          const matchingRuns = window.allRuns.filter(r => {
            if (!r.filename) return false;
            return r.filename.includes(activityId);
          });
          
          if (matchingRuns.length > 0) {
            matchedCount++;
            window.tcxDataCache[matchingRuns[0].filename] = parsedTcx;
            console.log(`✓ Matched ${activityId} (${parsedTcx.records.length} HR records)`);
          }
        }
        
        processedCount++;
      } catch (err) {
        console.error(`Fehler bei ${filename}:`, err);
      }
    }
    
    progressText.textContent = `Fertig! ${matchedCount} von ${tcxFiles.length} TCX-Dateien zugeordnet`;
    progressFill.style.width = "100%";
    
    console.log(`TCX-Verarbeitung abgeschlossen: ${processedCount} verarbeitet, ${matchedCount} zugeordnet`);
    
    // Save to IndexedDB after TCX processing
    if (typeof saveToSession === 'function') {
      await saveToSession();
    }
    
    // Re-analyze with TCX data AFTER saving
    if (window.allRuns.length > 0) {
      if (typeof analyze === 'function') {
        console.log('Calling analyze() with', window.allRuns.length, 'runs and', Object.keys(window.tcxDataCache).length, 'TCX files');
        analyze(window.allRuns);
      }
    }
    
    setTimeout(() => {
      progressContainer.style.display = "none";
    }, 3000);
    
  } catch (err) {
    console.error("ZIP-Fehler:", err);
    alert("Fehler beim Verarbeiten des ZIP-Archivs: " + err.message);
    progressContainer.style.display = "none";
  }
}

// ===== CSV Parsing Function =====
async function parseCSV(data) {
  try {
    console.log("Parsed rows:", data.length);
    console.log("First row:", data[0]);
    
    const runs = data
      .filter(r => r["Activity Type"] === "Run")
      .map(r => ({
        id: +r["Activity ID"],
        date: new Date(r["Activity Date"]),
        distance: +r["Distance"] / 1000,
        duration: +r["Moving Time"],
        avgHR: +r["Average Heart Rate"],
        maxHR: +r["Max Heart Rate"],
        filename: r["Filename"]
      }))
      .filter(r => r.distance && r.duration && !isNaN(r.date.getTime()));

    console.log("Parsed runs:", runs.length);
    if (runs.length === 0) {
      alert("Keine Läufe gefunden. Bitte überprüfe das CSV-Format.\n\nÖffne die Browser-Konsole (F12) für Details.");
      return;
    }

    csvRuns = runs;
    allRuns = runs;
    window.runs = runs;
    
    // Expose to window for other scripts
    window.allRuns = runs;
    window.csvRuns = runs;
    
    // Save to IndexedDB after CSV parsing
    if (typeof saveToSession === 'function') {
      await saveToSession();
    }
    
    // Dispatch custom event for other scripts
    document.dispatchEvent(new CustomEvent('runs-ready', { detail: { runs } }));

    // Trigger analysis if function exists
    if (typeof analyze === 'function') {
      console.log('Calling analyze() after CSV parse with', runs.length, 'runs');
      analyze(runs);
    }
  } catch(e) {
    console.error("Parse error:", e);
    alert("Fehler beim Laden: " + e.message);
  }
}

// ===== TCX Parsing Function =====
function parseTcxFile(tcxText) {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(tcxText, "text/xml");
    
    const trackpoints = doc.getElementsByTagName("Trackpoint");
    const records = [];
    
    for (let tp of trackpoints) {
      const timeEl = tp.getElementsByTagName("Time")[0];
      const hrEl = tp.getElementsByTagName("Value")[0];
      
      if (timeEl && hrEl) {
        records.push({
          time: new Date(timeEl.textContent),
          heart_rate: parseInt(hrEl.textContent)  // ← Changed from 'hr' to 'heart_rate'
        });
      }
    }
    
    return { records };
  } catch (err) {
    console.error("TCX parse error:", err);
    return null;
  }
}

// ===== Clear ZIP Function =====
function clearZipFile() {
  // Clear file input
  const zipInput = document.getElementById('zipFile');
  if (zipInput) {
    zipInput.value = '';
  }
  
  // Clear data
  allRuns = [];
  csvRuns = [];
  tcxDataCache = {};
  window.allRuns = [];
  window.csvRuns = [];
  window.tcxDataCache = {};
  
  // Clear session storage
  if (typeof clearSession === 'function') {
    clearSession();
  }
  
  // Hide session info banner
  const sessionInfo = document.getElementById('sessionInfo');
  if (sessionInfo) {
    sessionInfo.style.display = 'none';
  }
  
  console.log("✓ ZIP data cleared");
  alert("ZIP data cleared successfully!");
}

// ===== Event Handlers =====
// Handle ZIP file upload
document.addEventListener('DOMContentLoaded', () => {
  const zipInput = document.getElementById("zipFile");
  if (zipInput) {
    zipInput.addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      // Clear old session data before processing new ZIP
      if (typeof clearSession === 'function') {
        clearSession();
      }
      
      // Hide session info banner
      const sessionInfo = document.getElementById('sessionInfo');
      if (sessionInfo) {
        sessionInfo.style.display = 'none';
      }
      
      await processZipFile(file);
    });
  }
});