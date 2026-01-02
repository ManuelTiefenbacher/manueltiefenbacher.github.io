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
            this.analyze();
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
            if (targetSport === "run") {
                this.analyzeRuns();
            } else if (targetSport === "ride") {
                this.analyzeRides();
            } else if (targetSport === "swim") {
                this.analyzeSwims();
            }

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
        window.runRenderer.renderTimeline(runs);
        window.runRenderer.renderTrainingLoadAnalysis(runs);
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
        window.rideRenderer.renderTimeline(rides);
        window.rideRenderer.renderTrainingLoadAnalysis(rides);
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
        window.swimRenderer.renderTimeline(swims);
        window.swimRenderer.renderTrainingLoadAnalysis(swims);
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
