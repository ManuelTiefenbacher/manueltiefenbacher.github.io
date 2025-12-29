// js/ui/visualizationPresets.js
// Data visualization presets for different training focuses

class VisualizationPresets {
  constructor() {
    this.currentPreset = 'overview';
    this.presets = {
      overview: {
        name: 'Overview',
        icon: '📊',
        sections: ['stats', 'trainingLoad', 'weeklyChart', 'timeline', 'intensityChart']
      },
      training: {
        name: 'Training',
        icon: '🏃',
        sections: ['stats', 'trainingLoad', 'intensityChart', 'timeline']
      },
      progress: {
        name: 'Progress',
        icon: '📈',
        sections: ['stats', 'weeklyChart', 'timeline']
      },
      recovery: {
        name: 'Recovery',
        icon: '💤',
        sections: ['stats', 'trainingLoad']
      },
      zones: {
        name: 'Zones',
        icon: '❤️',
        sections: ['intensityChart', 'weeklyChart', 'timeline']
      },
      quick: {
        name: 'Quick',
        icon: '⚡',
        sections: ['stats', 'trainingLoad']
      }
    };
  }

  /**
   * Initialize preset selector
   */
  init() {
    this.createPresetSelector();
    this.loadSavedPreset();
    this.applyPreset(this.currentPreset);
  }

  /**
   * Create preset selector UI (tab style)
   */
  createPresetSelector() {
    const analysisTab = document.getElementById('tab-analysis');
    if (!analysisTab) return;

    const container = document.createElement('div');
    container.className = 'preset-selector-container';
    container.innerHTML = `
      <div class="preset-tabs" id="presetTabs"></div>
    `;

    // Insert before first panel
    const firstPanel = analysisTab.querySelector('.panel');
    if (firstPanel) {
      firstPanel.parentNode.insertBefore(container, firstPanel);
    }

    this.renderPresetTabs();
  }

  /**
   * Render preset tabs
   */
  renderPresetTabs() {
    const container = document.getElementById('presetTabs');
    if (!container) return;

    container.innerHTML = '';

    const label = document.createElement('preset-tab-name');
    label.className = 'preset-tab';
    label.innerHTML = `Select Preset: `;
    label.style.margin = '0px 20px';
    container.appendChild(label);

    Object.entries(this.presets).forEach(([key, preset]) => {
      const tab = document.createElement('preset-button');
      tab.className = `preset-tab ${key === this.currentPreset ? 'active' : ''}`;
      tab.innerHTML = `
        <span class="preset-tab-icon">${preset.icon}</span>
        <span class="preset-tab-name">${preset.name}</span>
      `;
      tab.addEventListener('click', () => this.selectPreset(key));
      container.appendChild(tab);
      
      const hr = document.createElement('hr');
      hr.style.margin = '20px 0px';
      hr.style.width = '20px';
      hr.style.transform = 'rotate(90deg)';
      container.appendChild(hr);

    });
    
if (container.lastChild) {
  container.removeChild(container.lastChild);
}

  }

  /**
   * Select and apply a preset
   */
  selectPreset(presetKey) {
    if (!this.presets[presetKey]) return;

    this.currentPreset = presetKey;
    this.savePreset(presetKey);
    this.applyPreset(presetKey);
    this.renderPresetTabs();
  }

  /**
   * Apply a preset by showing/hiding sections
   */
  applyPreset(presetKey) {
    const preset = this.presets[presetKey];
    if (!preset) return;

    const sectionMap = {
      'stats': this.getStatsPanel(),
      'trainingLoad': this.getTrainingLoadPanel(),
      'weeklyChart': this.getWeeklyChartPanel(),
      'timeline': this.getTimelinePanel(),
      'intensityChart': this.getIntensityPanel()
    };

    // Hide all sections first
    Object.values(sectionMap).forEach(panel => {
      if (panel) {
        panel.style.display = 'none';
        panel.style.animation = 'none';
      }
    });

    // Show only sections in the preset with animation
    preset.sections.forEach((section, index) => {
      const panel = sectionMap[section];
      if (panel) {
        // Use setTimeout to stagger the animations
        setTimeout(() => {
          panel.style.display = 'block';
          panel.style.animation = 'fadeIn 0.4s ease-out';
        }, index * 100);
      }
    });

    console.log(`📊 Applied preset: ${preset.name}`);
  }

  /**
   * Get panel elements
   */
  getStatsPanel() {
    // Find the panel containing the overview stats
    const panels = document.querySelectorAll('#tab-analysis .panel');
    for (let panel of panels) {
      const h2 = panel.querySelector('h2');
      if (h2 && h2.textContent.includes('Overview')) {
        return panel;
      }
    }
    return null;
  }

  getTrainingLoadPanel() {
    // Find panel that contains trainingLoadAnalysis
    const loadDiv = document.getElementById('trainingLoadAnalysis');
    return loadDiv ? loadDiv.closest('.panel') : null;
  }

  getWeeklyChartPanel() {
    const canvas = document.getElementById('chart');
    return canvas ? canvas.closest('.panel') : null;
  }

  getTimelinePanel() {
    const timeline = document.getElementById('timeline');
    return timeline ? timeline.closest('.panel') : null;
  }

  getIntensityPanel() {
    const canvas = document.getElementById('intensityChart');
    return canvas ? canvas.closest('.panel') : null;
  }

  /**
   * Save preset to localStorage
   */
  savePreset(presetKey) {
    try {
      localStorage.setItem('visualizationPreset', presetKey);
    } catch (err) {
      console.warn('Failed to save preset:', err);
    }
  }

  /**
   * Load saved preset from localStorage
   */
  loadSavedPreset() {
    try {
      const saved = localStorage.getItem('visualizationPreset');
      if (saved && this.presets[saved]) {
        this.currentPreset = saved;
      }
    } catch (err) {
      console.warn('Failed to load preset:', err);
    }
  }
}

// Initialize and export singleton
window.visualizationPresets = new VisualizationPresets();

// Auto-initialize when switching to analysis tab
document.addEventListener('DOMContentLoaded', () => {
  // Wait for the app to be initialized
  setTimeout(() => {
    const analysisTab = document.getElementById('tab-analysis');
    if (analysisTab) {
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.target.classList.contains('active')) {
            if (!document.getElementById('presetTabs')) {
              window.visualizationPresets.init();
            }
          }
        });
      });

      observer.observe(analysisTab, {
        attributes: true,
        attributeFilter: ['class']
      });

      // Also init if analysis tab is already active
      if (analysisTab.classList.contains('active')) {
        window.visualizationPresets.init();
      }
    }
  }, 500);
});