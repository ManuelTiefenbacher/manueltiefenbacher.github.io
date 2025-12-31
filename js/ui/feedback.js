// js/ui/feedback.js
// User feedback and progress management

class FeedbackManager {
    constructor() {
        this.progressContainer = null;
        this.progressText = null;
        this.progressFill = null;
        this.feedbackDiv = null;
        this.statusDiv = null;
    }

    /**
     * Initialize DOM references
     */
    init() {
        this.progressContainer = document.getElementById("progressContainer");
        this.progressText = document.getElementById("progressText");
        this.progressFill = document.getElementById("progressFill");
        this.feedbackDiv = document.getElementById("feedbackMessage");
        this.statusDiv = document.getElementById("hrStatus");
    }

    /**
     * Show progress bar
     */
    showProgress(message = "Processing...", percent = 0) {
        if (!this.progressContainer) this.init();

        if (this.progressContainer) {
            this.progressContainer.style.display = "block";
        }
        if (this.progressText) {
            this.progressText.textContent = message;
        }
        if (this.progressFill) {
            this.progressFill.style.width = `${percent}%`;
        }
    }

    /**
     * Update progress
     */
    updateProgress(message, percent) {
        if (this.progressText) {
            this.progressText.textContent = message;
        }
        if (this.progressFill) {
            this.progressFill.style.width = `${percent}%`;
        }
    }

    /**
     * Hide progress bar
     */
    hideProgress() {
        if (this.progressContainer) {
            setTimeout(() => {
                this.progressContainer.style.display = "none";
            }, 1000);
        }
    }

    /**
     * Show feedback message
     */
    showFeedback(message, type = "info", duration = 5000) {
        if (!this.feedbackDiv) this.init();

        if (!this.feedbackDiv) {
            console.warn("Feedback element not found");
            return;
        }

        // Set class based on type
        const classes = {
            success: "info-box success",
            error: "info-box error",
            warning: "info-box warning",
            info: "info-box",
        };

        this.feedbackDiv.className = classes[type] || classes["info"];
        this.feedbackDiv.innerHTML = `<p>${message}</p>`;

        // Auto-hide for success messages
        if (type === "success" && duration > 0) {
            setTimeout(() => {
                this.feedbackDiv.textContent = "";
                this.feedbackDiv.className = "";
            }, duration);
        }
    }

    /**
     * Clear feedback message
     */
    clearFeedback() {
        if (this.feedbackDiv) {
            this.feedbackDiv.textContent = "";
            this.feedbackDiv.className = "";
        }
    }

    /**
     * Show status message (for settings)
     */
    showStatus(message, isSuccess = true) {
        if (!this.statusDiv) this.init();

        if (this.statusDiv) {
            this.statusDiv.textContent = message;
            this.statusDiv.style.color = isSuccess ? "#34a853" : "#ea4335";

            // Auto-clear after 3s
            setTimeout(() => {
                this.statusDiv.textContent = "";
            }, 3000);
        }
    }

    /**
     * Show error in console and UI
     */
    showError(message, error = null) {
        console.error(message, error);
        this.showFeedback(`❌ ${message}`, "error", 0);
    }

    /**
     * Show session info banner
     */
    showSessionBanner(count, type = "zip") {
        const bannerId =
            type === "strava" ? "stravaSessionInfo" : "sessionInfo";
        const banner = document.getElementById(bannerId);

        if (banner) {
            banner.style.display = "flex";

            if (type === "strava") {
                const countSpan = banner.querySelector("#stravaActivityCount");
                if (countSpan) {
                    countSpan.textContent = count;
                }
            }
        }
    }

    /**
     * Hide session info banner
     */
    hideSessionBanner(type = "zip") {
        const bannerId =
            type === "strava" ? "stravaSessionInfo" : "sessionInfo";
        const banner = document.getElementById(bannerId);

        if (banner) {
            banner.style.display = "none";
        }
    }
}

// Initialize and export singleton
window.feedbackManager = new FeedbackManager();
