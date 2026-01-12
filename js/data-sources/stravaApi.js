// js/data-sources/stravaApi.js
// Strava OAuth and API integration

class StravaAPI {
    constructor() {
        this.accessToken = null;
        this.clientId = null;
        this.clientSecret = null;
    }

    /**
     * Initialize Strava authentication
     */
    init() {
        // Check if we're returning from OAuth (in popup)
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get("code");
        const error = urlParams.get("error");

        if (window.opener && (code || error)) {
            window.opener.postMessage(
                {
                    type: "strava-auth",
                    code: code,
                    error: error,
                },
                window.location.origin
            );
            window.close();
            return;
        }

        // Restore saved token
        this.accessToken = window.storageManager.loadStravaToken();
        if (this.accessToken) {
            this.showRequestButton();
        }

        // Listen for OAuth callback
        window.addEventListener("message", this.handleAuthMessage.bind(this));
    }

    /**
     * Start OAuth flow
     */
    initiateAuth() {
        this.clientId = document.getElementById("clientId").value.trim();
        this.clientSecret = document
            .getElementById("clientSecret")
            .value.trim();

        if (!this.clientId || !this.clientSecret) {
            window.feedbackManager.showError(
                "Please enter both Client ID and Client Secret"
            );
            return;
        }

        // Store credentials temporarily
        sessionStorage.setItem("stravaClientId", this.clientId);
        sessionStorage.setItem("stravaClientSecret", this.clientSecret);

        const redirectUri = window.location.origin + window.location.pathname;
        const scope = "read,activity:read_all,profile:read_all";
        const authUrl = `https://www.strava.com/oauth/authorize?client_id=${this.clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&approval_prompt=force&scope=${scope}`;

        // Open popup
        const width = 600;
        const height = 700;
        const left = screen.width / 2 - width / 2;
        const top = screen.height / 2 - height / 2;

        const popup = window.open(
            authUrl,
            "Strava Authorization",
            `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
        );

        if (!popup || popup.closed || typeof popup.closed === "undefined") {
            window.feedbackManager.showError(
                "Popup was blocked! Please allow popups for this site."
            );
        }
    }

    /**
     * Handle OAuth callback message
     */
    handleAuthMessage(event) {
        if (event.data && event.data.type === "strava-auth") {
            if (event.data.code) {
                this.exchangeToken(event.data.code);
            } else if (event.data.error) {
                window.feedbackManager.showError(
                    "Authorization denied or failed"
                );
            }
        }
    }

    /**
     * Exchange authorization code for access token
     */
    async exchangeToken(code) {
        this.clientId = sessionStorage.getItem("stravaClientId");
        this.clientSecret = sessionStorage.getItem("stravaClientSecret");

        if (!this.clientId || !this.clientSecret) {
            window.feedbackManager.showError(
                "Missing credentials. Please try again."
            );
            return;
        }

        try {
            const response = await fetch("https://www.strava.com/oauth/token", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    client_id: this.clientId,
                    client_secret: this.clientSecret,
                    code: code,
                    grant_type: "authorization_code",
                }),
            });

            const data = await response.json();

            if (data.access_token) {
                this.accessToken = data.access_token;
                window.storageManager.saveStravaToken(this.accessToken);

                // Clean URL
                window.history.replaceState(
                    {},
                    document.title,
                    window.location.pathname
                );

                this.showRequestButton();
            } else {
                window.feedbackManager.showError(
                    "Failed to obtain access token"
                );
            }
        } catch (err) {
            window.feedbackManager.showError("Error connecting to Strava", err);
        }
    }

    /**
     * Show request data button
     */
    showRequestButton() {
        const connectBtn = document.getElementById("connectBtn");
        const clientId = document.getElementById("clientId");
        const clientSecret = document.getElementById("clientSecret");
        const requestSection = document.getElementById("requestSection");

        if (connectBtn) connectBtn.style.display = "none";
        if (clientId) clientId.disabled = true;
        if (clientSecret) clientSecret.disabled = true;
        if (requestSection) requestSection.style.display = "block";
    }

    /**
     * Fetch activities from Strava
     */
    async fetchActivities() {
        if (!this.accessToken) {
            window.feedbackManager.showError(
                "Not authenticated. Please connect to Strava first."
            );
            return;
        }

        window.feedbackManager.showFeedback(
            "⏳ Fetching data from Strava...",
            "info"
        );

        try {
            // Fetch all activities with pagination
            const allActivities = [];
            const perPage = 150;
            const maxPages = 1;

            for (let page = 1; page <= maxPages; page++) {
                window.feedbackManager.showFeedback(
                    `⏳ Fetching activities (page ${page}/${maxPages})...`,
                    "info"
                );

                const response = await fetch(
                    `https://www.strava.com/api/v3/athlete/activities?per_page=${perPage}&page=${page}`,
                    { headers: { Authorization: `Bearer ${this.accessToken}` } }
                );

                if (!response.ok) {
                    throw new Error(
                        `Failed to fetch activities: ${response.status}`
                    );
                }

                const pageActivities = await response.json();
                if (pageActivities.length === 0) break;

                allActivities.push(...pageActivities);
                if (pageActivities.length < perPage) break;
            }

            // Separate by sport type
            const runs = allActivities.filter((a) => a.type === "Run");
            const rides = allActivities.filter(
                (a) => a.type === "Ride" || a.type === "VirtualRide"
            );
            const swims = allActivities.filter((a) => a.type === "Swim");

            window.feedbackManager.showFeedback(
                `⏳ Fetching detailed data for ${runs.length} runs, ${rides.length} rides, ${swims.length} swims...`,
                "info"
            );

            // Fetch detailed data + HR streams for each sport
            const detailedRuns = await this.fetchDetailedData(runs);
            const detailedRides = await this.fetchDetailedData(rides);
            const detailedSwims = await this.fetchDetailedData(swims);

            // Normalize to our format
            const normalizedRuns = detailedRuns.map((r) =>
                this.normalizeActivity(r)
            );
            const normalizedRides = detailedRides.map((r) =>
                this.normalizeActivity(r)
            );
            const normalizedSwims = detailedSwims.map((r) =>
                this.normalizeActivity(r)
            );

            // Add to data processor
            window.dataProcessor.addRuns(normalizedRuns, "Strava");
            window.dataProcessor.addRides(normalizedRides, "Strava");
            window.dataProcessor.addSwims(normalizedSwims, "Strava");

            // Save to storage
            await window.storageManager.saveRuns(window.dataProcessor.runs);
            await window.storageManager.saveRides(window.dataProcessor.rides);
            await window.storageManager.saveSwims(window.dataProcessor.swims);

            // Show session banner
            const totalActivities =
                normalizedRuns.length +
                normalizedRides.length +
                normalizedSwims.length;
            window.feedbackManager.showSessionBanner(totalActivities, "strava");

            // Trigger analysis
            if (typeof window.analyze === "function") {
                window.analyze();
            }

            const hrCount = normalizedRuns.filter((r) => r.hrStream).length;
            const paceCount = normalizedRuns.filter((r) => r.paceStream).length;
            const powerCount = normalizedRides.filter(
                (r) => r.powerStream
            ).length;

            window.feedbackManager.showFeedback(
                `✅ Successfully fetched ${normalizedRuns.length} runs (${hrCount} with HR, ${paceCount} with pace), ${normalizedRides.length} rides (${powerCount} with power), ${normalizedSwims.length} swims from Strava!`,
                "success"
            );
        } catch (err) {
            console.error("Strava fetch error:", err);
            window.feedbackManager.showError(
                `Error fetching Strava data: ${err.message}`
            );
        }
    }

    /**
     * Normalize activity to our format
     */
    normalizeActivity(activity) {
        return {
            id: activity.id,
            date: new Date(activity.start_date),
            distance: activity.distance / 1000, // meters to km
            duration: activity.moving_time / 60, // seconds to minutes
            movingTime: activity.moving_time, // Keep in seconds for TSS calculations
            avgHR: activity.average_heartrate || null,
            maxHR: activity.max_heartrate || null,
            hrStream: activity.hrStream || null,
            paceStream: activity.paceStream || null,
            powerStream: activity.powerStream || null,
            avgPower: activity.average_watts || null,
            maxPower: activity.max_watts || null,
            avgPace: activity.avgPace || null, // seconds per km
            cadenceStream: activity.cadenceStream || null,
            altitudeStream: activity.altitudeStream || null,
            distanceStream: activity.distanceStream || null,
            distanceMeters:
                activity.distanceMeters ||
                (activity.distance ? activity.distance : null), // meters
            totalSteps: activity.totalSteps || null,
            source: "Strava API",
        };
    }

    /**
     * Fetch detailed data for each activity including HR and pace streams
     */
    async fetchDetailedData(activities) {
        return await Promise.all(
            activities.map(async (activity) => {
                // Initialize streams as null
                let hrStream = null;
                let paceStream = null;
                let powerStream = null;
                let cadenceStream = null;
                let altitudeStream = null;
                let distanceStream = null;

                try {
                    // Fetch detailed activity
                    const detailResponse = await fetch(
                        `https://www.strava.com/api/v3/activities/${activity.id}`,
                        {
                            headers: {
                                Authorization: `Bearer ${this.accessToken}`,
                            },
                        }
                    );

                    if (!detailResponse.ok) {
                        console.warn(
                            `Failed to fetch details for activity ${activity.id}`
                        );
                        return {
                            ...activity,
                            hrStream: null,
                            paceStream: null,
                            powerStream: null,
                            cadenceStream: null,
                        };
                    }

                    const detailData = await detailResponse.json();

                    // Fetch all available streams
                    // Keys: heartrate, time, velocity_smooth, watts, cadence, altitude, distance
                    try {
                        const streamResponse = await fetch(
                            `https://www.strava.com/api/v3/activities/${activity.id}/streams?keys=heartrate,time,velocity_smooth,watts,cadence,altitude,distance`,
                            {
                                headers: {
                                    Authorization: `Bearer ${this.accessToken}`,
                                },
                            }
                        );

                        if (streamResponse.ok) {
                            const streamData = await streamResponse.json();

                            console.log(
                                `Activity ${activity.id} streams:`,
                                streamData
                            );

                            // Extract individual streams
                            const hrData = streamData.find(
                                (s) => s.type === "heartrate"
                            );
                            const timeData = streamData.find(
                                (s) => s.type === "time"
                            );
                            const velocityData = streamData.find(
                                (s) => s.type === "velocity_smooth"
                            );
                            const powerData = streamData.find(
                                (s) => s.type === "watts"
                            );
                            const cadenceData = streamData.find(
                                (s) => s.type === "cadence"
                            );
                            const altitudeData = streamData.find(
                                (s) => s.type === "altitude"
                            );
                            const distanceData = streamData.find(
                                (s) => s.type === "distance"
                            );

                            // HR Stream
                            if (
                                hrData &&
                                hrData.data &&
                                timeData &&
                                timeData.data
                            ) {
                                hrStream = {
                                    heartrate: hrData.data,
                                    time: timeData.data,
                                };
                                console.log(
                                    `✓ HR stream found for activity ${activity.id}: ${hrData.data.length} points`
                                );
                            }

                            // Pace Stream (convert velocity m/s to seconds/km)
                            if (
                                velocityData &&
                                velocityData.data &&
                                timeData &&
                                timeData.data
                            ) {
                                paceStream = {
                                    pace: velocityData.data.map((v) => {
                                        // Convert m/s to seconds/km
                                        // pace (sec/km) = 1000 / v
                                        if (
                                            v === 0 ||
                                            v === null ||
                                            v === undefined
                                        )
                                            return 0;
                                        return 1000 / v;
                                    }),
                                    time: timeData.data,
                                };

                                // Add elevation and distance to paceStream for NGP calculation
                                if (altitudeData && altitudeData.data) {
                                    paceStream.elevation = altitudeData.data;
                                }
                                if (distanceData && distanceData.data) {
                                    paceStream.distance = distanceData.data;
                                }

                                console.log(
                                    `✓ Pace stream found for activity ${activity.id}: ${velocityData.data.length} points`
                                );
                                console.log(
                                    `  Sample velocities: ${velocityData.data.slice(0, 5).join(", ")} m/s`
                                );
                                console.log(
                                    `  Sample paces: ${paceStream.pace
                                        .slice(0, 5)
                                        .map((p) => p.toFixed(2))
                                        .join(", ")} sec/km`
                                );
                            } else {
                                console.log(
                                    `✗ No velocity stream for activity ${activity.id}`
                                );
                            }

                            // Power Stream (watts)
                            if (
                                powerData &&
                                powerData.data &&
                                timeData &&
                                timeData.data
                            ) {
                                powerStream = {
                                    watts: powerData.data,
                                    time: timeData.data,
                                };
                                console.log(
                                    `✓ Power stream found for activity ${activity.id}: ${powerData.data.length} points`
                                );
                                console.log(
                                    `  Sample power: ${powerData.data.slice(0, 5).join(", ")} watts`
                                );

                                // Calculate average and max power from stream
                                const validWatts = powerData.data.filter(
                                    (w) => w > 0
                                );
                                if (validWatts.length > 0) {
                                    detailData.average_watts =
                                        validWatts.reduce((a, b) => a + b, 0) /
                                        validWatts.length;
                                    detailData.max_watts = Math.max(
                                        ...validWatts
                                    );
                                }
                            } else {
                                console.log(
                                    `✗ No power stream for activity ${activity.id}`
                                );
                            }

                            // Cadence Stream
                            if (
                                cadenceData &&
                                cadenceData.data &&
                                timeData &&
                                timeData.data
                            ) {
                                // For running: cadence is in steps per minute (SPM)
                                // For cycling: cadence is in revolutions per minute (RPM)
                                cadenceStream = cadenceData.data;

                                console.log(
                                    `✓ Cadence stream found for activity ${activity.id}: ${cadenceData.data.length} points`
                                );
                                console.log(
                                    `  Sample cadence: ${cadenceData.data.slice(0, 5).join(", ")} ${activity.type === "Run" ? "spm" : "rpm"}`
                                );
                            } else {
                                console.log(
                                    `✗ No cadence stream for activity ${activity.id}`
                                );
                            }

                            // Altitude Stream (for elevation profile)
                            if (altitudeData && altitudeData.data) {
                                altitudeStream = altitudeData.data;
                                console.log(
                                    `✓ Altitude stream found for activity ${activity.id}: ${altitudeData.data.length} points`
                                );
                            }

                            // Distance Stream (for precise calculations)
                            if (distanceData && distanceData.data) {
                                distanceStream = distanceData.data;
                                console.log(
                                    `✓ Distance stream found for activity ${activity.id}: ${distanceData.data.length} points`
                                );
                            }

                            // Calculate average pace from stream if available
                            if (paceStream && paceStream.pace.length > 0) {
                                const validPaces = paceStream.pace.filter(
                                    (p) => p > 0 && p < 1000
                                );
                                if (validPaces.length > 0) {
                                    detailData.avgPace =
                                        validPaces.reduce((a, b) => a + b, 0) /
                                        validPaces.length;
                                    console.log(
                                        `  Calculated avgPace: ${detailData.avgPace.toFixed(2)} sec/km`
                                    );
                                }
                            }

                            // Calculate total steps for stride length calculation
                            if (cadenceStream && activity.type === "Run") {
                                // Total steps = sum of (cadence * time_interval / 60)
                                // Approximate: cadence is already in steps per minute
                                // For simplicity: sum all cadence values and divide by data points per minute
                                const timeIntervals = [];
                                for (let i = 1; i < timeData.data.length; i++) {
                                    timeIntervals.push(
                                        timeData.data[i] - timeData.data[i - 1]
                                    );
                                }
                                const avgInterval =
                                    timeIntervals.reduce((a, b) => a + b, 0) /
                                    timeIntervals.length;
                                const stepsPerSecond = cadenceStream.map(
                                    (c) => c / 60
                                );
                                detailData.totalSteps = Math.round(
                                    stepsPerSecond.reduce((sum, sps, i) => {
                                        const interval =
                                            i < timeIntervals.length
                                                ? timeIntervals[i]
                                                : avgInterval;
                                        return sum + sps * interval;
                                    }, 0)
                                );
                                console.log(
                                    `  Calculated totalSteps: ${detailData.totalSteps}`
                                );
                            }

                            // Store distance in meters for stride length calculation
                            if (detailData.distance) {
                                detailData.distanceMeters =
                                    detailData.distance * 1000;
                            }
                        } else {
                            console.warn(
                                `Stream request failed for activity ${activity.id}: ${streamResponse.status}`
                            );
                        }
                    } catch (err) {
                        console.warn(
                            `Failed to fetch streams for activity ${activity.id}:`,
                            err
                        );
                    }

                    return {
                        ...detailData,
                        hrStream,
                        paceStream,
                        powerStream,
                        cadenceStream,
                        altitudeStream,
                        distanceStream,
                    };
                } catch (err) {
                    console.error(
                        `Error fetching activity ${activity.id}:`,
                        err
                    );
                    return {
                        ...activity,
                        hrStream: null,
                        paceStream: null,
                        powerStream: null,
                        cadenceStream: null,
                        altitudeStream: null,
                        distanceStream: null,
                    };
                }
            })
        );
    }

    /**
     * Logout and clear data
     */
    logout() {
        this.accessToken = null;
        window.storageManager.clearStravaToken();
        window.feedbackManager.hideSessionBanner("strava");
        location.reload();
    }
}

// Initialize and export singleton
window.stravaAPI = new StravaAPI();

// Auto-initialize on page load
document.addEventListener("DOMContentLoaded", () => {
    window.stravaAPI.init();
});
