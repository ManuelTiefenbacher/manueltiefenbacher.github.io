tri-runalyzer/
├── index.html                      ✅ NEW - Refactored with correct script order
├── styles.css                      ✓ Keep as-is
│
├── js/
│   ├── core/
│   │   ├── app.js                  ✅ NEW - Main application coordinator
│   │   ├── dataProcessor.js        ✅ NEW - Unified data management
│   │   └── storage.js              ✅ NEW - IndexedDB & sessionStorage
│   │
│   ├── utils/
│   │   └── helpers.js              ✅ NEW - Date, validation, formatting utilities
│   │
│   ├── ui/
│   │   ├── feedback.js             ✅ NEW - User feedback & progress
│   │   ├── renderer.js             ✅ NEW - All UI rendering (charts, timeline, stats)
│   │   └── settings.js             ✅ NEW - Settings management (zones, HR Max)
│   │
│   ├── data-sources/
│   │   ├── tcxParser.js            ✅ NEW - Refactored TCX parser
│   │   ├── zipHandler.js           ✅ NEW - Refactored ZIP processing
│   │   └── stravaApi.js            ✅ NEW - Refactored Strava integration
│   │
│   └── analysis/
│       ├── hrAnalysis.js           ✅ NEW - Unified HR analysis
│       ├── runClassification.js    ✅ NEW - Run type classification
│       └── trainingLoad.js         ✅ NEW - Training load analysis


Data Flow

Data Sources (ZIP/Strava)
    ↓
DataProcessor (normalize & deduplicate)
    ↓
Analysis Modules (HR Analysis, Classification, Training Load)
    ↓
UI Renderer (Charts, Timeline, Stats)


Module Dependencies

helpers.js (no dependencies)
    ↓
storage.js (uses helpers)
    ↓
dataProcessor.js (uses storage)
    ↓
hrAnalysis.js (uses dataProcessor)
    ↓
runClassification.js (uses dataProcessor + hrAnalysis)
    ↓
trainingLoad.js (uses all analysis modules)
    ↓
renderer.js (uses all modules)
    ↓
app.js (coordinates everything)


Global Singletons
Each module exports a singleton to window:

window.helpers              // Utility functions
window.storageManager       // Storage operations
window.dataProcessor        // Data management
window.hrAnalyzer          // HR analysis
window.runClassifier       // Run classification
window.trainingLoadAnalyzer // Training load
window.feedbackManager     // User feedback
window.uiRenderer          // UI rendering
window.settingsManager     // Settings UI
window.stravaAPI           // Strava API
window.zipHandler          // ZIP processing
window.tcxParser           // TCX parsing
window.app                 // Main app