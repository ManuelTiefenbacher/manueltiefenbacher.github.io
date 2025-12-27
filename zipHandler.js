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
        complete: result => {
          console.log("CSV geparst:", result.data.length, "Zeilen");
          parseCSV(result.data);
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
          const matchingRuns = allRuns.filter(r => {
            if (!r.filename) return false;
            return r.filename.includes(activityId);
          });
          
          if (matchingRuns.length > 0) {
            matchedCount++;
            tcxDataCache[matchingRuns[0].filename] = parsedTcx;
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
    
    // Re-analyze with TCX data
    if (allRuns.length > 0 && matchedCount > 0) {
      analyze(allRuns);
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

function parseCSV(data) {
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
    
    document.dispatchEvent(new CustomEvent('runs-ready', { detail: { runs } }));

    analyze(runs);
  } catch(e) {
    console.error("Parse error:", e);
    alert("Fehler beim Laden: " + e.message);
  }
}

// ===== Event Handlers =====
// Handle ZIP file upload
document.getElementById("zipFile").addEventListener("change", async e => {
  const file = e.target.files[0];
  if (!file) return;
  
  await processZipFile(file);
});