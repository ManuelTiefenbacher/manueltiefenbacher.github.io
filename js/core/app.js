// js/core/app.js
// Main application initialization and coordination

class TriRunalyzer {
    constructor() {
        this.initialized = false;
        this.currentSport = "run"; // Default to running
    }

    /**
     * Initialize the application
     */
    async init() {
        if (this.initialized) return;

        console.log("🚀 Initializing Tri-Runalyzer...");

        // Initialize storage
        await window.storageManager.init();

        // Initialize feedback manager
        window.feedbackManager.init();

        // Load saved zones
        const savedZones = window.storageManager.loadZones();
        if (savedZones) {
            try {
                window.dataProcessor.setZones(savedZones);
                console.log("✓ Loaded saved zones");
            } catch (err) {
                console.warn("Saved zones invalid, using defaults");
            }
        }

        // Load saved HR Max
        const savedHRMax = window.storageManager.loadHRMax();
        if (savedHRMax) {
            window.dataProcessor.hrMax = savedHRMax;
            console.log("✓ Loaded saved HR Max:", savedHRMax);
        }

        // Load saved FTP
        const savedFTP = window.storageManager.loadFTP();
        if (savedFTP) {
            window.powerAnalyzer.setFTP(savedFTP);
            console.log("✓ Loaded saved FTP:", savedFTP);
        }

        // Try to load saved activity data
        const savedRuns = await window.storageManager.loadRuns();
        const savedRides = await window.storageManager.loadRides();
        const savedSwims = await window.storageManager.loadSwims();

        if (savedRuns && savedRuns.length > 0) {
            window.dataProcessor.addRuns(savedRuns, "Cached");
        }
        if (savedRides && savedRides.length > 0) {
            window.dataProcessor.addRides(savedRides, "Cached");
        }
        if (savedSwims && savedSwims.length > 0) {
            window.dataProcessor.addSwims(savedSwims, "Cached");
        }

        const totalActivities =
            (savedRuns?.length || 0) +
            (savedRides?.length || 0) +
            (savedSwims?.length || 0);

        if (totalActivities > 0) {
            window.feedbackManager.showSessionBanner(totalActivities, "zip");
            this.analyze("all");
        }

        // Setup navigation
        this.setupNavigation();

        // Setup clear buttons
        this.setupClearButtons();

        this.initialized = true;
        console.log("✅ Tri-Runalyzer initialized");
    }

    /**
     * Setup navigation
     */
    setupNavigation() {
        // Page navigation
        document.querySelectorAll(".nav-item[data-page]").forEach((btn) => {
            btn.addEventListener("click", (e) => {
                const page = btn.dataset.page;
                const sport = btn.dataset.sport;

                if (sport) {
                    this.currentSport = sport;
                    this.switchSport(sport);
                }

                this.navigateToPage(page);
            });
        });

        // Restore last active page
        const savedPage = localStorage.getItem("currentPage");
        if (savedPage) {
            this.navigateToPage(savedPage);
        }
    }

    /**
     * Navigate to a specific page
     */
    navigateToPage(pageId) {
        // Hide all pages
        document.querySelectorAll(".content-page").forEach((page) => {
            page.classList.remove("active");
        });

        // Show target page
        const targetPage = document.getElementById(pageId);
        if (targetPage) {
            targetPage.classList.add("active");
        }

        // Update nav item states
        document.querySelectorAll(".nav-item").forEach((item) => {
            item.classList.remove("active");
            if (item.dataset.page === pageId) {
                item.classList.add("active");
            }
        });

        // Save current page
        localStorage.setItem("currentPage", pageId);

        // Scroll to top
        window.scrollTo({ top: 0, behavior: "smooth" });
    }

    /**
     * Switch sport type in analysis view
     */
    switchSport(sport) {
        this.currentSport = sport;

        // Hide all sport analysis sections
        document
            .querySelectorAll(".sport-analysis-content")
            .forEach((section) => {
                section.style.display = "none";
            });

        // Show selected sport
        const targetSection = document.getElementById(`analysis-${sport}`);
        if (targetSection) {
            targetSection.style.display = "block";
        }

        // Re-run analysis for the selected sport
        this.analyze(sport);
    }

    /**
     * Setup clear data buttons
     */
    setupClearButtons() {
        // Clear ZIP data button (in banner)
        const clearZipBtn = document.querySelector("#sessionInfo button");
        if (clearZipBtn) {
            clearZipBtn.addEventListener("click", async () => {
                await window.storageManager.clearRuns();
                await window.storageManager.clearRides();
                await window.storageManager.clearSwims();
                window.dataProcessor.clear();
                window.feedbackManager.hideSessionBanner("zip");
                location.reload();
            });
        }

        // Clear Strava data button (in banner)
        const clearStravaBtn = document.querySelector(
            "#stravaSessionInfo button"
        );
        if (clearStravaBtn) {
            clearStravaBtn.addEventListener("click", async () => {
                await window.storageManager.clearRuns();
                await window.storageManager.clearRides();
                await window.storageManager.clearSwims();
                window.storageManager.clearStravaToken();
                window.dataProcessor.clear();
                window.feedbackManager.hideSessionBanner("strava");
                location.reload();
            });
        }
    }

    /**
     * Main analysis function - called after data is loaded
     */
    analyze(sport = null) {
        const targetSport = sport || this.currentSport;

        console.log(`📊 Analyzing ${targetSport} data...`);

        try {
            if (targetSport === "all") {
                this.analyzeRuns();
                this.analyzeRides();
                this.analyzeSwims();
            } else if (targetSport === "run") {
                this.analyzeRuns();
            } else if (targetSport === "ride") {
                this.analyzeRides();
            } else if (targetSport === "swim") {
                this.analyzeSwims();
            }
            window.DashboardRenderer.render();

            console.log(`✅ ${targetSport} analysis complete`);
        } catch (err) {
            console.error(`${targetSport} analysis error:`, err);
            window.feedbackManager.showError(
                `Error during ${targetSport} analysis`,
                err
            );
        }
    }

    /**
     * Analyze runs
     */
    analyzeRuns() {
        const runs = window.dataProcessor.runs;

        if (runs.length === 0) {
            console.warn("No runs to analyze");
            return;
        }

        // Calculate max HR if not set
        if (window.dataProcessor.hrMax === 190) {
            const { maxHR } = window.dataProcessor.calculateMaxHR();
            if (maxHR > 0) {
                window.storageManager.saveHRMax(maxHR);
            }
        }

        // Get summary and render
        const summaryRuns = window.dataProcessor.getSummaryRuns();
        window.runRenderer.renderBasicInfo(summaryRuns);
        window.runRenderer.renderCharts(runs);
        window.timelineChart.renderChart(runs, "run");
        window.trainingLoadAnalyzer.renderTrainingLoadAnalysis(runs, "run");
        initializeChartToggles("run");
    }

    /**
     * Analyze rides
     */
    analyzeRides() {
        const rides = window.dataProcessor.rides;

        if (rides.length === 0) {
            console.warn("No rides to analyze");
            return;
        }

        // Default value
        if (window.dataProcessor.FTP === 250) {
            const estimatedFTP = window.powerAnalyzer.estimateFTP();
            if (estimatedFTP) {
                window.storageManager.saveFTP(estimatedFTP);
            }
        }

        // Render ride-specific UI

        const summaryRides = window.dataProcessor.getSummaryRides();
        window.rideRenderer.renderBasicInfo(summaryRides);
        window.rideRenderer.renderCharts(rides);
        window.timelineChart.renderChart(rides, "ride");
        window.trainingLoadAnalyzer.renderTrainingLoadAnalysis(rides, "ride");
        initializeChartToggles("ride");
    }

    /**
     * Analyze swims
     */
    analyzeSwims() {
        const swims = window.dataProcessor.swims;

        if (swims.length === 0) {
            console.warn("No swims to analyze");
            return;
        }

        // Render swim-specific UI

        const summarySwims = window.dataProcessor.getSummarySwims();
        window.swimRenderer.renderBasicInfo(summarySwims);
        window.swimRenderer.renderCharts(swims);
        window.timelineChart.renderChart(swims, "swims");
        window.trainingLoadAnalyzer.renderTrainingLoadAnalysis(swims, "swims");
        initializeChartToggles("swim");
    }
}

// Global function wrappers for compatibility
window.navigateToPage = function (pageId) {
    window.app.navigateToPage(pageId);
};

window.analyze = function (sport = null) {
    window.app.analyze(sport);
};

window.clearAndReload = function () {
    Promise.all([
        window.storageManager.clearRuns(),
        window.storageManager.clearRides(),
        window.storageManager.clearSwims(),
    ]).then(() => location.reload());
};

window.clearStravaData = function () {
    window.storageManager.clearRuns();
    window.storageManager.clearRides();
    window.storageManager.clearSwims();
    window.storageManager.clearStravaToken();
    location.reload();
};

// Strava API global functions
window.initiateAuth = function () {
    window.stravaAPI.initiateAuth();
};

window.fetchStravaData = function () {
    window.stravaAPI.fetchActivities();
};

window.logout = function () {
    window.stravaAPI.logout();
};

window.clearZipFile = function () {
    window.zipHandler.clearZipFile();
};

// Initialize app on page load
window.app = new TriRunalyzer();

document.addEventListener("DOMContentLoaded", async () => {
    await window.app.init();
});

function initializeChartToggles(sportType) {
    const container = document.getElementById(`analysis-${sportType}`);
    if (!container) return;

    // Find the overview panel (first panel)
    const overviewPanel = container.querySelector(".panel");
    if (!overviewPanel) return;

    // Remove existing toggle container if present
    const existingToggle = overviewPanel.querySelector(
        ".chart-toggle-container"
    );
    if (existingToggle) {
        existingToggle.remove();
    }

    // Create toggle controls
    const toggleContainer = document.createElement("div");
    toggleContainer.className = "chart-toggle-container";
    toggleContainer.style.cssText =
        "margin-top: 1rem; padding-top: 1rem; border-top: 1px solid #e5e7eb;";

    const toggleTitle = document.createElement("div");
    toggleTitle.textContent = "Show Charts:";
    toggleTitle.style.cssText =
        "font-weight: 600; margin-bottom: 0.5rem; color: #374151;";

    const checkboxContainer = document.createElement("div");
    checkboxContainer.style.cssText =
        "display: flex; flex-wrap: wrap; gap: 0.5rem;";

    // Define charts to toggle
    const charts = [
        {
            id: "trainingLoad",
            label: "Training Load",
            panelSelector: (p) =>
                p
                    .querySelector("h2")
                    ?.textContent.includes("Training Load Analysis"),
        },
        {
            id: "avgDistance",
            label: "Average Weekly Distance",
            panelSelector: (p) =>
                p
                    .querySelector("h2")
                    ?.textContent.includes("Average Weekly Distance"),
        },
        {
            id: "intensity",
            label: "Intensity",
            panelSelector: (p) =>
                p.querySelector("h2")?.textContent.includes("Intensity"),
        },
        {
            id: "timeline",
            label: "Activity Timeline",
            panelSelector: (p) =>
                p
                    .querySelector("h2")
                    ?.textContent.includes("Previous Four Weeks"),
        },
    ];

    // Track active state for each chart
    const chartStates = {};

    charts.forEach((chart) => {
        chartStates[chart.id] = true; // All visible by default

        const button = document.createElement("button");
        button.textContent = chart.label;
        button.id = `toggle-${sportType}-${chart.id}`;

        const updateButtonStyle = (isActive) => {
            button.style.cssText = `padding: 8px 16px; border: 1px solid #5f6368; border-radius: 4px; background: ${isActive ? "#4285f4" : "transparent"}; color: ${isActive ? "#fff" : "#e8eaed"}; cursor: pointer; font-size: 13px; font-family: system-ui, -apple-system, sans-serif; transition: all 0.2s;`;
        };

        updateButtonStyle(true);

        // Handle toggle
        button.addEventListener("click", () => {
            chartStates[chart.id] = !chartStates[chart.id];
            updateButtonStyle(chartStates[chart.id]);

            let element;

            if (chart.panelSelector) {
                // Find panel by checking h2 content
                const panels = container.querySelectorAll(".panel");
                for (let panel of panels) {
                    if (chart.panelSelector(panel)) {
                        element = panel;
                        break;
                    }
                }
            }

            if (element) {
                element.style.display = chartStates[chart.id] ? "" : "none";
            }
        });

        button.addEventListener("mouseenter", () => {
            if (!chartStates[chart.id]) {
                button.style.background = "rgba(66, 133, 244, 0.1)";
            }
        });

        button.addEventListener("mouseleave", () => {
            if (!chartStates[chart.id]) {
                button.style.background = "transparent";
            }
        });

        checkboxContainer.appendChild(button);
    });

    toggleContainer.appendChild(toggleTitle);
    toggleContainer.appendChild(checkboxContainer);

    // Insert after the stats div
    const statsDiv = overviewPanel.querySelector(".stats");
    if (statsDiv) {
        statsDiv.after(toggleContainer);
    }
}
