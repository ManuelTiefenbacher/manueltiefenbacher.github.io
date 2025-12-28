// js/data-sources/zipHandler.js
// ZIP file processing for Strava exports

class ZipHandler {
  constructor() {
    this.csvRuns = [];
  }

  /**
   * Initialize file input listener
   */
  init() {
    const zipInput = document.getElementById('zipFile');
    if (zipInput) {
      zipInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        // Clear old session data
        await window.storageManager.clearRuns();
        window.feedbackManager.hideSessionBanner('zip');
        
        await this.processZipFile(file);
      });
    }
  }

  /**
   * Process ZIP file
   */
  async processZipFile(file) {
    window.feedbackManager.showProgress('Unpacking ZIP file...', 10);
    
    try {
      const zip = await JSZip.loadAsync(file);
      console.log(`ZIP loaded, ${Object.keys(zip.files).length} files`);
      
      // Find activities.csv
      window.feedbackManager.updateProgress('Searching for activities.csv...', 20);
      
      let csvFile = null;
      for (const filename in zip.files) {
        if (filename.endsWith('activities.csv')) {
          csvFile = zip.files[filename];
          console.log('CSV found:', filename);
          break;
        }
      }
      
      if (!csvFile) {
        window.feedbackManager.showError('No activities.csv found in ZIP archive!');
        window.feedbackManager.hideProgress();
        return;
      }
      
      // Parse CSV
      window.feedbackManager.updateProgress('Loading activities.csv...', 30);
      const csvText = await csvFile.async('text');
      await this.parseCSV(csvText);
      
      // Process TCX files
      window.feedbackManager.updateProgress('Searching for TCX files...', 40);
      
      const tcxFiles = [];
      for (const filename in zip.files) {
        if (filename.includes('activities/') && filename.endsWith('.tcx.gz')) {
          tcxFiles.push({ filename, file: zip.files[filename] });
        }
      }
      
      console.log(`${tcxFiles.length} TCX.GZ files found`);
      
      if (tcxFiles.length === 0) {
        window.feedbackManager.updateProgress('No TCX files found - using CSV data only', 100);
        await this.finalize();
        return;
      }
      
      // Process TCX files
      await this.processTCXFiles(tcxFiles);
      await this.finalize();
      
    } catch (err) {
      console.error('ZIP processing error:', err);
      window.feedbackManager.showError(`Error processing ZIP archive: ${err.message}`);
      window.feedbackManager.hideProgress();
    }
  }

  /**
   * Parse CSV data
   */
  async parseCSV(csvText) {
    return new Promise((resolve) => {
      Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        complete: (result) => {
          console.log('CSV parsed:', result.data.length, 'rows');
          
          const runs = result.data
            .filter(r => r['Activity Type'] === 'Run')
            .map(r => ({
              id: +r['Activity ID'],
              date: new Date(r['Activity Date']),
              distance: +r['Distance'] / 1000, // meters to km
              duration: +r['Moving Time'],
              avgHR: +r['Average Heart Rate'],
              maxHR: +r['Max Heart Rate'],
              filename: r['Filename'],
              hrStream: null,
              source: 'ZIP'
            }))
            .filter(r => r.distance && r.duration && !isNaN(r.date.getTime()));

          console.log('Parsed runs:', runs.length);
          
          if (runs.length === 0) {
            window.feedbackManager.showError('No runs found in CSV. Please check the CSV format.');
            resolve();
            return;
          }

          this.csvRuns = runs;
          
          // Add to data processor
          window.dataProcessor.addRuns(runs, 'ZIP');
          
          resolve();
        },
        error: (err) => {
          console.error('CSV parse error:', err);
          window.feedbackManager.showError(`Error parsing CSV: ${err.message}`);
          resolve();
        }
      });
    });
  }

  /**
   * Process TCX files and match with runs
   */
  async processTCXFiles(tcxFiles) {
    let processedCount = 0;
    let matchedCount = 0;
    
    for (const { filename, file } of tcxFiles) {
      try {
        window.feedbackManager.updateProgress(
          `Processing TCX files... (${processedCount + 1}/${tcxFiles.length})`,
          40 + (processedCount / tcxFiles.length) * 50
        );
        
        // Decompress .gz file
        const gzData = await file.async('uint8array');
        const tcxData = pako.ungzip(gzData, { to: 'string' });
        
        // Parse TCX
        const parsedTcx = window.tcxParser.parse(tcxData);
        
        if (parsedTcx && parsedTcx.hrStream && parsedTcx.hrStream.heartrate.length > 0) {
          // Extract activity ID from filename
          const activityId = filename.split('/').pop().replace('.tcx.gz', '');
          
          // Find matching run in data processor
          const matchingRun = window.dataProcessor.runs.find(r => 
            r.filename && r.filename.includes(activityId)
          );
          
          if (matchingRun) {
            matchedCount++;
            matchingRun.hrStream = parsedTcx.hrStream;
            console.log(`✓ Matched ${activityId} (${parsedTcx.hrStream.heartrate.length} HR records)`);
          }
        }
        
        processedCount++;
      } catch (err) {
        console.error(`Error processing ${filename}:`, err);
      }
    }
    
    window.feedbackManager.updateProgress(
      `Finished! ${matchedCount} of ${tcxFiles.length} TCX files matched`,
      100
    );
    
    console.log(`TCX processing complete: ${processedCount} processed, ${matchedCount} matched`);
  }

  /**
   * Finalize processing
   */
  async finalize() {
    // Save to IndexedDB
    await window.storageManager.saveRuns(window.dataProcessor.runs);
    
    // Show session banner
    window.feedbackManager.showSessionBanner(window.dataProcessor.runs.length, 'zip');
    
    // Trigger analysis
    if (typeof window.analyze === 'function') {
      window.analyze();
    }
    
    window.feedbackManager.hideProgress();
  }

  /**
   * Clear ZIP data
   */
  async clearZipFile() {
    const zipInput = document.getElementById('zipFile');
    if (zipInput) {
      zipInput.value = '';
    }
    
    await window.storageManager.clearRuns();
    window.dataProcessor.clear();
    window.feedbackManager.hideSessionBanner('zip');
    
    console.log('✓ ZIP data cleared');
    alert('ZIP data cleared successfully!');
  }
}

// Initialize and export singleton
window.zipHandler = new ZipHandler();

// Auto-initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  window.zipHandler.init();
});