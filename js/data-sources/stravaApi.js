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
            // 1) Pull new activities (summary) with paging & optional 'after'
            const perPage = 200;
            const after = window.storageManager.loadStravaAfterEpoch?.() || 0; // your persisted watermark
            let page = 1;
            const allActivities = [];

            for (;;) {
                const url = new URL(
                    "https://www.strava.com/api/v3/athlete/activities"
                );
                url.searchParams.set("per_page", perPage);
                url.searchParams.set("page", page);
                if (after) url.searchParams.set("after", after);

                const resp = await fetch(url.toString(), {
                    headers: { Authorization: `Bearer ${this.accessToken}` },
                });
                if (!resp.ok)
                    throw new Error(
                        `Failed to fetch activities (page ${page}): ${resp.status}`
                    );
                const batch = await resp.json();
                if (!batch.length) break;

                allActivities.push(...batch);
                if (batch.length < perPage) break;
                page++;
            }

            if (!allActivities.length) {
                window.feedbackManager.showFeedback(
                    "No new Strava activities found.",
                    "info"
                );
                return;
            }

            // 2) Split by type (optional) or just process all with one pass
            const runs = allActivities.filter((a) => a.type === "Run");
            const rides = allActivities.filter(
                (a) => a.type === "Ride" || a.type === "VirtualRide"
            );
            const swims = allActivities.filter((a) => a.type === "Swim");

            window.feedbackManager.showFeedback(
                `⏳ Fetching streams for ${runs.length} runs, ${rides.length} rides, ${swims.length} swims...`,
                "info"
            );

            // 3) Fetch streams with limited concurrency (avoid rate limits)
            const limiter = createLimiter(5); // tune 4–6 depending on your traffic
            const fetchStreamsForActivities = (activities) =>
                Promise.all(
                    activities.map((a) =>
                        limiter(() => this.fetchStreamsForOneActivity(a))
                    )
                );

            const [detailedRuns, detailedRides, detailedSwims] =
                await Promise.all([
                    fetchStreamsForActivities(runs),
                    fetchStreamsForActivities(rides),
                    fetchStreamsForActivities(swims),
                ]);

            // 4) Normalize & store
            const normalizedRuns = detailedRuns.map((r) =>
                this.normalizeActivity(r)
            );
            const normalizedRides = detailedRides.map((r) =>
                this.normalizeActivity(r)
            );
            const normalizedSwims = detailedSwims.map((r) =>
                this.normalizeActivity(r)
            );

            window.dataProcessor.addRuns(normalizedRuns, "Strava");
            window.dataProcessor.addRides(normalizedRides, "Strava");
            window.dataProcessor.addSwims(normalizedSwims, "Strava");

            await window.storageManager.saveRuns(window.dataProcessor.runs);
            await window.storageManager.saveRides(window.dataProcessor.rides);
            await window.storageManager.saveSwims(window.dataProcessor.swims);

            // 5) Persist new watermark (use newest start_date from this batch)
            const newest = Math.max(
                ...allActivities.map((a) => Date.parse(a.start_date) / 1000)
            );
            if (Number.isFinite(newest)) {
                window.storageManager.saveStravaAfterEpoch?.(newest);
            }

            // 6) UX feedback
            const totalActivities =
                normalizedRuns.length +
                normalizedRides.length +
                normalizedSwims.length;
            window.feedbackManager.showSessionBanner(totalActivities, "strava");

            if (typeof window.analyze === "function") window.analyze();

            const hrCount = normalizedRuns.filter((r) => r.hrStream).length;
            const paceCount = normalizedRuns.filter((r) => r.paceStream).length;
            const powerCount = normalizedRides.filter(
                (r) => r.powerStream
            ).length;

            window.feedbackManager.showFeedback(
                `✅ Synced ${normalizedRuns.length} runs (${hrCount} HR, ${paceCount} pace), ` +
                    `${normalizedRides.length} rides (${powerCount} power), ${normalizedSwims.length} swims.`,
                "success"
            );
        } catch (err) {
            console.error("Strava fetch error:", err);
            window.feedbackManager.showError(
                `Error fetching Strava data: ${err.message}`
            );
        }
    }

    // --- new: per-activity streams fetch (no detail call) ---
    async fetchStreamsForOneActivity(activity) {
        const base = {
            ...activity, // summary fields from /athlete/activities
            hrStream: null,
            paceStream: null,
            powerStream: null,
            cadenceStream: null,
            altitudeStream: null,
            distanceStream: null,
            avgPace: null,
            average_watts: activity.average_watts ?? null,
            max_watts: activity.max_watts ?? null,
        };

        const url =
            `https://www.strava.com/api/v3/activities/${activity.id}/streams` +
            `?keys=heartrate,time,velocity_smooth,watts,cadence,altitude,distance` +
            `&key_by_type=true`;

        try {
            const resp = await fetch(url, {
                headers: { Authorization: `Bearer ${this.accessToken}` },
            });
            if (!resp.ok) return base; // quietly skip if streams unavailable

            const streams = await resp.json(); // keyed by type when key_by_type=true
            const time = streams.time?.data;

            // HR
            if (streams.heartrate?.data && time) {
                base.hrStream = { heartrate: streams.heartrate.data, time };
            }

            // Pace from velocity_smooth (m/s -> s/km)
            if (streams.velocity_smooth?.data && time) {
                const pace = streams.velocity_smooth.data.map((v) =>
                    v ? 1000 / v : 0
                );
                base.paceStream = { pace, time };
                if (streams.altitude?.data)
                    base.paceStream.elevation = streams.altitude.data;
                if (streams.distance?.data)
                    base.paceStream.distance = streams.distance.data;

                const validPaces = pace.filter((p) => p > 0 && p < 1000);
                if (validPaces.length)
                    base.avgPace =
                        validPaces.reduce((a, b) => a + b, 0) /
                        validPaces.length;
            }

            // Power
            if (streams.watts?.data && time) {
                base.powerStream = { watts: streams.watts.data, time };
                const valid = streams.watts.data.filter((w) => w > 0);
                if (valid.length) {
                    base.average_watts =
                        valid.reduce((a, b) => a + b, 0) / valid.length;
                    base.max_watts = Math.max(...valid);
                }
            }

            // Cadence / Altitude / Distance (raw arrays)
            if (streams.cadence?.data)
                base.cadenceStream = streams.cadence.data;
            if (streams.altitude?.data)
                base.altitudeStream = streams.altitude.data;
            if (streams.distance?.data)
                base.distanceStream = streams.distance.data;

            // Optional: steps for runs (approx)
            if (base.cadenceStream && activity.type === "Run" && time?.length) {
                const intervals = [];
                for (let i = 1; i < time.length; i++)
                    intervals.push(time[i] - time[i - 1]);
                const avgInt = intervals.length
                    ? intervals.reduce((a, b) => a + b, 0) / intervals.length
                    : 1;
                const sps = base.cadenceStream.map((c) => c / 60);
                base.totalSteps = Math.round(
                    sps.reduce(
                        (sum, v, i) => sum + v * (intervals[i] ?? avgInt),
                        0
                    )
                );
            }

            // Preserve meters for stride computations
            if (base.distance) base.distanceMeters = base.distance; // activities list already returns meters

            return base;
        } catch (e) {
            console.warn(`Streams failed for activity ${activity.id}:`, e);
            return base;
        }
    }

    /**
     * Normalize activity to our format
     */

    normalizeActivity(activity) {
        return {
            id: activity.id,
            date: new Date(activity.start_date),
            distance: (activity.distance ?? 0) / 1000, // meters -> km
            duration: (activity.moving_time ?? 0) / 60, // sec -> min
            movingTime: activity.moving_time ?? 0,
            avgHR: activity.average_heartrate ?? null,
            maxHR: activity.max_heartrate ?? null,

            hrStream: activity.hrStream ?? null,
            paceStream: activity.paceStream ?? null,
            powerStream: activity.powerStream ?? null,
            avgPower: activity.average_watts ?? null,
            maxPower: activity.max_watts ?? null,
            avgPace: activity.avgPace ?? null,
            cadenceStream: activity.cadenceStream ?? null,
            altitudeStream: activity.altitudeStream ?? null,
            distanceStream: activity.distanceStream ?? null,

            distanceMeters:
                activity.distanceMeters ?? activity.distance ?? null,
            totalSteps: activity.totalSteps ?? null,
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

/* --- helper: simple concurrency limiter (no external deps) --- */
function createLimiter(max) {
    let active = 0;
    const queue = [];
    const runNext = () => {
        if (active >= max || queue.length === 0) return;
        active++;
        const { fn, resolve, reject } = queue.shift();
        fn().then(
            (res) => {
                active--;
                resolve(res);
                runNext();
            },
            (err) => {
                active--;
                reject(err);
                runNext();
            }
        );
    };
    return (fn) =>
        new Promise((resolve, reject) => {
            queue.push({ fn, resolve, reject });
            runNext();
        });
}

// Auto-initialize on page load
document.addEventListener("DOMContentLoaded", () => {
    window.stravaAPI.init();
});
