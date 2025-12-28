// js/core/app.js
// Main application initialization and coordination

class TriRunalyzer {
  constructor() {
    this.initialized = false;
  }

  /**
   * Initialize the application
   */
  async init() {
    if (this.initialized) return;

    console.log('🚀 Initializing Tri-Runalyzer...');

    // Initialize storage
    await window.storageManager.init();

    // Initialize feedback manager
    window.feedbackManager.init();

    // Load saved zones
    const savedZones = window.storageManager.loadZones();
    if (savedZones) {
      try {
        window.dataProcessor.setZones(savedZones);
        console.log('✓ Loaded saved zones');
      } catch (err) {
        console.warn('Saved zones invalid, using defaults');
      }
    }

    // Load saved HR Max
    const savedHRMax = window.storageManager.loadHRMax();
    if (savedHRMax) {
      window.dataProcessor.hrMax = savedHRMax;
      console.log('✓ Loaded saved HR Max:', savedHRMax);
    }

    // Try to load saved run data
    const savedRuns = await window.storageManager.loadRuns();
    if (savedRuns && savedRuns.length > 0) {
      window.dataProcessor.addRuns(savedRuns, 'Cached');
      window.feedbackManager.showSessionBanner(savedRuns.length, 'zip');
      
      // Trigger analysis with cached data
      this.analyze();
    }

    // Setup tab navigation
    this.setupTabs();

    // Setup clear buttons
    this.setupClearButtons();

    this.initialized = true;
    console.log('✅ Tri-Runalyzer initialized');
  }

  /**
   * Setup tab navigation
   */
  setupTabs() {
    // Restore last active tab
    const savedTab = localStorage.getItem('currentTab');
    if (savedTab && ['upload', 'settings', 'analysis'].includes(savedTab)) {
      this.switchTab(savedTab);
    }
  }

  /**
   * Switch between tabs
   */
  switchTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
      tab.classList.remove('active');
    });
    
    // Remove active class from all buttons
    document.querySelectorAll('.tab-button').forEach(btn => {
      btn.classList.remove('active');
    });
    
    // Show selected tab
    const tabContent = document.getElementById('tab-' + tabName);
    if (tabContent) {
      tabContent.classList.add('active');
    }
    
    // Activate corresponding button
    const buttons = document.querySelectorAll('.tab-button');
    buttons.forEach(btn => {
      if (btn.textContent.toLowerCase().includes(tabName)) {
        btn.classList.add('active');
      }
    });
    
    // Save current tab
    localStorage.setItem('currentTab', tabName);
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /**
   * Setup clear data buttons
   */
  setupClearButtons() {
    // Clear ZIP data button (in banner)
    const clearZipBtn = document.querySelector('#sessionInfo button');
    if (clearZipBtn) {
      clearZipBtn.addEventListener('click', async () => {
        await window.storageManager.clearRuns();
        window.dataProcessor.clear();
        window.feedbackManager.hideSessionBanner('zip');
        location.reload();
      });
    }

    // Clear Strava data button (in banner)
    const clearStravaBtn = document.querySelector('#stravaSessionInfo button');
    if (clearStravaBtn) {
      clearStravaBtn.addEventListener('click', async () => {
        await window.storageManager.clearRuns();
        window.storageManager.clearStravaToken();
        window.dataProcessor.clear();
        window.feedbackManager.hideSessionBanner('strava');
        location.reload();
      });
    }
  }

  /**
   * Main analysis function - called after data is loaded
   */
  analyze() {
    const runs = window.dataProcessor.runs;
    
    if (runs.length === 0) {
      console.warn('No runs to analyze');
      return;
    }

    console.log(`📊 Analyzing ${runs.length} runs...`);

    try {
      // Get summary stats
      const summary = window.dataProcessor.getSummary();
      console.log('Summary:', summary);

      // Calculate max HR if not set
      if (window.dataProcessor.hrMax === 190) { // Default value
        const { maxHR } = window.dataProcessor.calculateMaxHR();
        if (maxHR > 0) {
          window.storageManager.saveHRMax(maxHR);
        }
      }

      // Render all UI components
      window.uiRenderer.renderBasicInfo(summary);
      window.uiRenderer.renderCharts(runs);
      window.uiRenderer.renderTimeline(runs);
      window.uiRenderer.renderTrainingLoadAnalysis(runs);

      console.log('✅ Analysis complete');
    } catch (err) {
      console.error('Analysis error:', err);
      window.feedbackManager.showError('Error during analysis', err);
    }
  }
}

// Global function wrappers for compatibility
window.switchTab = function(tabName) {
  window.app.switchTab(tabName);
};

window.analyze = function() {
  window.app.analyze();
};

window.clearAndReload = function() {
  window.storageManager.clearRuns().then(() => location.reload());
};

window.clearStravaData = function() {
  window.storageManager.clearRuns();
  window.storageManager.clearStravaToken();
  location.reload();
};

// Strava API global functions (for HTML onclick handlers)
window.initiateAuth = function() {
  window.stravaAPI.initiateAuth();
};

window.fetchStravaData = function() {
  window.stravaAPI.fetchActivities();
};

window.logout = function() {
  window.stravaAPI.logout();
};

window.clearZipFile = function() {
  window.zipHandler.clearZipFile();
};

// Initialize app on page load
window.app = new TriRunalyzer();

document.addEventListener('DOMContentLoaded', async () => {
  await window.app.init();
});