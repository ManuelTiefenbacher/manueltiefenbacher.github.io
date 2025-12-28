// js/ui/settings.js
// Settings management (HR Max and Zone configuration)

class SettingsManager {
  constructor() {
    this.DEFAULTS = {
      z2Upper: 0.75,
      z3Upper: 0.85,
      z4Upper: 0.90,
      z5Upper: 0.95
    };
  }

  /**
   * Initialize settings UI
   */
  init() {
    this.setupHRMaxControls();
    this.setupZoneControls();
    this.setupScanButton();
    this.loadSavedSettings();
  }

  /**
   * Load saved settings into UI
   */
  loadSavedSettings() {
    const zones = window.dataProcessor.zones;
    const hrMax = window.dataProcessor.hrMax;

    // Load zone percentages
    const z2Input = document.getElementById('z2UpperInputPct');
    const z3Input = document.getElementById('z3UpperInputPct');
    const z4Input = document.getElementById('z4UpperInputPct');
    const z5Input = document.getElementById('z5UpperInputPct');

    if (z2Input) z2Input.value = Math.round(zones.z2Upper * 100 * 100) / 100;
    if (z3Input) z3Input.value = Math.round(zones.z3Upper * 100 * 100) / 100;
    if (z4Input) z4Input.value = Math.round(zones.z4Upper * 100 * 100) / 100;
    if (z5Input) z5Input.value = Math.round(zones.z5Upper * 100 * 100) / 100;

    // Load HR Max
    const maxHrInput = document.getElementById('maxHrInput');
    if (maxHrInput && hrMax) {
      maxHrInput.value = hrMax;
    }
  }

  /**
   * Setup HR Max controls
   */
  setupHRMaxControls() {
    const saveBtn = document.getElementById('saveHrBtn');
    const resetBtn = document.getElementById('resetHrBtn');
    const maxHrInput = document.getElementById('maxHrInput');

    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        const newHRMax = Number(maxHrInput.value);
        
        if (!newHRMax || newHRMax <= 0 || newHRMax > 250) {
          window.feedbackManager.showError('Please enter a valid HR value (1-250)');
          return;
        }

        window.dataProcessor.hrMax = newHRMax;
        window.storageManager.saveHRMax(newHRMax);
        
        // Update display
        const maxHRElement = document.getElementById('maxHR');
        if (maxHRElement) {
          maxHRElement.textContent = `${newHRMax} bpm`;
        }

        // Re-analyze
        if (typeof window.analyze === 'function') {
          window.analyze();
        }

        window.feedbackManager.showFeedback(`✅ Max HR updated to ${newHRMax} bpm`, 'success');
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        window.storageManager.clearHRMax();
        
        const { maxHR } = window.dataProcessor.calculateMaxHR();
        
        if (maxHrInput) {
          maxHrInput.value = maxHR;
        }

        const maxHRElement = document.getElementById('maxHR');
        if (maxHRElement) {
          maxHRElement.textContent = `${maxHR} bpm`;
        }

        if (typeof window.analyze === 'function') {
          window.analyze();
        }

        window.feedbackManager.showFeedback(`✅ Max HR reset to calculated value: ${maxHR} bpm`, 'success');
      });
    }
  }

  /**
   * Setup zone controls
   */
  setupZoneControls() {
    const saveBtn = document.getElementById('saveZonesBtn');
    const resetBtn = document.getElementById('resetZonesBtn');

    const inputs = {
      z2: document.getElementById('z2UpperInputPct'),
      z3: document.getElementById('z3UpperInputPct'),
      z4: document.getElementById('z4UpperInputPct'),
      z5: document.getElementById('z5UpperInputPct')
    };

    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        const zones = this.readZonesFromUI(inputs);
        
        if (!zones) {
          window.feedbackManager.showError('Invalid zone values');
          return;
        }

        try {
          window.dataProcessor.setZones(zones);
          window.storageManager.saveZones(zones);
          
          // Re-analyze
          if (typeof window.analyze === 'function') {
            window.analyze();
          }

          window.feedbackManager.showFeedback('✅ Zones updated successfully', 'success');
        } catch (err) {
          window.feedbackManager.showError('Invalid zone boundaries: ' + err.message);
        }
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        window.dataProcessor.setZones(this.DEFAULTS);
        window.storageManager.saveZones(this.DEFAULTS);

        // Update UI
        if (inputs.z2) inputs.z2.value = 75;
        if (inputs.z3) inputs.z3.value = 85;
        if (inputs.z4) inputs.z4.value = 90;
        if (inputs.z5) inputs.z5.value = 95;

        // Re-analyze
        if (typeof window.analyze === 'function') {
          window.analyze();
        }

        window.feedbackManager.showFeedback('✅ Zones reset to defaults', 'success');
      });
    }

    // Live validation on input
    Object.values(inputs).forEach(input => {
      if (input) {
        input.addEventListener('input', window.helpers.debounce(() => {
          const zones = this.readZonesFromUI(inputs);
          if (zones) {
            try {
              window.dataProcessor.setZones(zones);
              // Don't save yet, just validate
            } catch (err) {
              // Invalid zones
            }
          }
        }, 500));
      }
    });
  }

  /**
   * Read zones from UI inputs
   */
  readZonesFromUI(inputs) {
    if (!inputs.z2 || !inputs.z3 || !inputs.z4 || !inputs.z5) {
      return null;
    }

    const zones = {
      z2Upper: window.helpers.clamp(Number(inputs.z2.value) / 100, 0.0001, 0.9999),
      z3Upper: window.helpers.clamp(Number(inputs.z3.value) / 100, 0.0002, 0.9999),
      z4Upper: window.helpers.clamp(Number(inputs.z4.value) / 100, 0.0003, 0.9999),
      z5Upper: window.helpers.clamp(Number(inputs.z5.value) / 100, 0.0004, 0.9999)
    };

    return zones;
  }

  /**
   * Setup scan activities button
   */
  setupScanButton() {
    const scanBtn = document.getElementById('scanActivitiesBtn');
    
    if (scanBtn) {
      scanBtn.addEventListener('click', () => {
        const runs = window.dataProcessor.runs;
        
        if (runs.length === 0) {
          window.feedbackManager.showError('No activities loaded. Please upload a ZIP file or connect to Strava first.');
          return;
        }

        window.feedbackManager.showFeedback('⏳ Scanning all activities for maximum HR...', 'info');

        const { maxHR, activity } = window.dataProcessor.calculateMaxHR();

        if (maxHR > 0) {
          window.storageManager.saveHRMax(maxHR);

          // Update input
          const maxHrInput = document.getElementById('maxHrInput');
          if (maxHrInput) {
            maxHrInput.value = maxHR;
          }

          // Update display
          const maxHRElement = document.getElementById('maxHR');
          if (maxHRElement) {
            maxHRElement.textContent = `${maxHR} bpm`;
          }

          // Re-analyze
          if (typeof window.analyze === 'function') {
            window.analyze();
          }

          const activityDate = window.helpers.formatDateFull(activity.date);
          const activityDistance = activity.distance.toFixed(1);
          
          window.feedbackManager.showFeedback(
            `✅ Max HR found: ${maxHR} bpm (from ${activityDistance} km run on ${activityDate})`,
            'success'
          );
        } else {
          window.feedbackManager.showError('No heart rate data found in activities');
        }
      });
    }
  }
}

// Initialize and export singleton
window.settingsManager = new SettingsManager();

// Auto-initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  window.settingsManager.init();
});