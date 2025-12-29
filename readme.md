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

CSS Structure Guide
1. variables.css - CSS Variables & Theme

- Color scheme (backgrounds, text, borders)
- Primary colors
- Training zone colors
- Shadow definitions
- Load this first - all other files depend on these variables

2. base.css - Base Styles & Reset

- CSS reset (* selector)
- Body styles
- Basic element styling (hr, canvas)
- Load this second - establishes foundation

3. layout.css - Header, Tabs, Panels

- Header styling
- Tab navigation system
- Tab content animations
- Panel components
- Basic structural elements

4. forms.css - Form Elements & Inputs

- Input fields (text, password, file, select)
- Input groups
- Zone fields
- Form styling and states

5. buttons.css - Button Styles

- Primary buttons
- Secondary buttons
- Action buttons
- Navigation buttons
- Preset buttons and tabs

6. components.css - Info Boxes, Stats, Progress

- Info boxes and notifications
- Instructions containers
- Progress bars
- Stats grids
- Reusable UI components

7. runs.css - Timeline, Runs, Badges, Tooltips

- Timeline display
- Run items and classifications
- Badge styles
- Tooltip system
- Run-specific styling

8. training.css - Training Analysis & Activities

- Training load analysis cards
- Activity lists
- Athlete info displays
- Activity details
- Training-specific components

9. modals.css - Modal & Comparison Views

- Modal system
- Comparison selectors
- Comparison statistics grid
- Modal animations

10. responsive.css - Tablet Responsive (≤968px)

- Tablet adjustments
- Medium screen optimizations
- Desktop-to-tablet transitions

11. mobile.css - Mobile-Only Styles (≤480px)

- Touch-friendly interfaces
- Mobile-optimized layouts
- Single-column grids
- Larger tap targets (44px minimum)
- Mobile-specific UX improvements