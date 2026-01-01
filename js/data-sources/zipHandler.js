// js/data-sources/zipHandler.js
// ZIP file processing for Strava exports with power data (TCX + FIT)

class ZipHandler {
    constructor() {
        this.csvRuns = [];
        this.csvRides = [];
        this.csvSwims = [];
    }

    /**
     * Initialize file input listener
     */
    init() {
        const zipInput = document.getElementById("zipFile");
        if (zipInput) {
            zipInput.addEventListener("change", async (e) => {
                const file = e.target.files[0];
                if (!file) return;

                // Clear old session data
                await window.storageManager.clearRuns();
                await window.storageManager.clearRides();
                await window.storageManager.clearSwims();
                window.feedbackManager.hideSessionBanner("zip");

                await this.processZipFile(file);
            });
        }
    }

    /**
     * Process ZIP file
     */
    async processZipFile(file) {
        window.feedbackManager.showProgress("Unpacking ZIP file...", 10);

        try {
            const zip = await JSZip.loadAsync(file);
            console.log(`ZIP loaded, ${Object.keys(zip.files).length} files`);

            // Find activities.csv
            window.feedbackManager.updateProgress(
                "Searching for activities.csv...",
                20
            );

            let csvFile = null;
            for (const filename in zip.files) {
                if (filename.endsWith("activities.csv")) {
                    csvFile = zip.files[filename];
                    console.log("CSV found:", filename);
                    break;
                }
            }

            if (!csvFile) {
                window.feedbackManager.showError(
                    "No activities.csv found in ZIP archive!"
                );
                window.feedbackManager.hideProgress();
                return;
            }

            // Parse CSV
            window.feedbackManager.updateProgress(
                "Loading activities.csv...",
                30
            );
            const csvText = await csvFile.async("text");
            await this.parseCSV(csvText);

            // Process FIT files first (for rides with power data)
            window.feedbackManager.updateProgress(
                "Searching for FIT files...",
                40
            );

            const fitFiles = [];
            for (const filename in zip.files) {
                if (
                    filename.includes("activities/") &&
                    filename.endsWith(".fit.gz")
                ) {
                    fitFiles.push({ filename, file: zip.files[filename] });
                }
            }

            console.log(`${fitFiles.length} FIT.GZ files found`);

            if (fitFiles.length > 0) {
                await this.processFITFiles(fitFiles);
            }

            // Process TCX files (for activities without FIT files)
            window.feedbackManager.updateProgress(
                "Searching for TCX files...",
                60
            );

            const tcxFiles = [];
            for (const filename in zip.files) {
                if (
                    filename.includes("activities/") &&
                    filename.endsWith(".tcx.gz")
                ) {
                    tcxFiles.push({ filename, file: zip.files[filename] });
                }
            }

            console.log(`${tcxFiles.length} TCX.GZ files found`);

            if (tcxFiles.length > 0) {
                await this.processTCXFiles(tcxFiles);
            }

            await this.finalize();
        } catch (err) {
            console.error("ZIP processing error:", err);
            window.feedbackManager.showError(
                `Error processing ZIP archive: ${err.message}`
            );
            window.feedbackManager.hideProgress();
        }
    }

    /**
     * Parse CSV data
     */
    async parseCSV(csvText) {
        return new Promise((resolve) => {
            Papa.parse(csvText, {
                header: true,
                skipEmptyLines: true,
                complete: (result) => {
                    console.log("CSV parsed:", result.data.length, "rows");

                    // Parse runs
                    const runs = result.data
                        .filter((r) => r["Activity Type"] === "Run")
                        .map((r) => ({
                            id: +r["Activity ID"],
                            date: new Date(r["Activity Date"]),
                            distance: +r["Distance"] / 1000, // meters to km
                            duration: +r["Moving Time"],
                            avgHR: +r["Average Heart Rate"],
                            maxHR: +r["Max Heart Rate"],
                            filename: r["Filename"],
                            hrStream: null,
                            paceStream: null,
                            source: "ZIP",
                        }))
                        .filter(
                            (r) =>
                                r.distance &&
                                r.duration &&
                                !isNaN(r.date.getTime())
                        );

                    console.log("Parsed runs:", runs.length);
                    this.csvRuns = runs;
                    window.dataProcessor.addRuns(runs, "ZIP");

                    // Parse rides
                    const rides = result.data
                        .filter(
                            (r) =>
                                r["Activity Type"] === "Ride" ||
                                r["Activity Type"] === "Virtual Ride"
                        )
                        .map((r) => ({
                            id: +r["Activity ID"],
                            date: new Date(r["Activity Date"]),
                            distance: +r["Distance"] / 1000, // meters to km
                            duration: +r["Moving Time"],
                            avgHR: +r["Average Heart Rate"],
                            maxHR: +r["Max Heart Rate"],
                            avgPower: +r["Average Watts"] || null,
                            maxPower: +r["Max Watts"] || null,
                            filename: r["Filename"],
                            hrStream: null,
                            powerStream: null,
                            cadenceStream: null,
                            speedStream: null,
                            source: "ZIP",
                        }))
                        .filter(
                            (r) =>
                                r.distance &&
                                r.duration &&
                                !isNaN(r.date.getTime())
                        );

                    console.log("Parsed rides:", rides.length);
                    this.csvRides = rides;
                    window.dataProcessor.addRides(rides, "ZIP");

                    // Parse swims
                    const swims = result.data
                        .filter((r) => r["Activity Type"] === "Swim")
                        .map((r) => ({
                            id: +r["Activity ID"],
                            date: new Date(r["Activity Date"]),
                            distance: +r["Distance"] / 1000, // meters to km
                            duration: +r["Moving Time"],
                            avgHR: +r["Average Heart Rate"],
                            maxHR: +r["Max Heart Rate"],
                            filename: r["Filename"],
                            hrStream: null,
                            source: "ZIP",
                        }))
                        .filter(
                            (r) =>
                                r.distance &&
                                r.duration &&
                                !isNaN(r.date.getTime())
                        );

                    console.log("Parsed swims:", swims.length);
                    this.csvSwims = swims;
                    window.dataProcessor.addSwims(swims, "ZIP");

                    resolve();
                },
                error: (err) => {
                    console.error("CSV parse error:", err);
                    window.feedbackManager.showError(
                        `Error parsing CSV: ${err.message}`
                    );
                    resolve();
                },
            });
        });
    }

    /**
     * Process FIT files and match with activities
     */
    async processFITFiles(fitFiles) {
        let processedCount = 0;
        let matchedCount = 0;

        for (const { filename, file } of fitFiles) {
            try {
                window.feedbackManager.updateProgress(
                    `Processing FIT files... (${processedCount + 1}/${fitFiles.length})`,
                    40 + (processedCount / fitFiles.length) * 20
                );

                // Decompress .gz file
                const gzData = await file.async("uint8array");
                const fitData = pako.ungzip(gzData);

                // Parse FIT
                const parsedFit = window.fitParser.parse(fitData.buffer);

                if (parsedFit) {
                    // Extract activity ID from filename
                    const activityId = filename
                        .split("/")
                        .pop()
                        .replace(".fit.gz", "");

                    // Try to match with ride
                    const matchingRide = window.dataProcessor.rides.find(
                        (r) => r.filename && r.filename.includes(activityId)
                    );

                    if (matchingRide) {
                        matchedCount++;

                        // Add HR stream
                        if (parsedFit.hrStream) {
                            matchingRide.hrStream = parsedFit.hrStream;
                        }

                        // Add power stream and metrics
                        if (parsedFit.powerStream) {
                            matchingRide.powerStream = parsedFit.powerStream;
                            if (parsedFit.avgPower) {
                                matchingRide.avgPower = parsedFit.avgPower;
                            }
                            if (parsedFit.maxPower) {
                                matchingRide.maxPower = parsedFit.maxPower;
                            }
                        }

                        // Add cadence stream
                        if (parsedFit.cadenceStream) {
                            matchingRide.cadenceStream =
                                parsedFit.cadenceStream;
                            if (parsedFit.avgCadence) {
                                matchingRide.avgCadence = parsedFit.avgCadence;
                            }
                        }

                        // Add speed stream
                        if (parsedFit.speedStream) {
                            matchingRide.speedStream = parsedFit.speedStream;
                        }

                        console.log(
                            `✓ Matched ride ${activityId} with FIT data`
                        );
                    }

                    // Try to match with run (some runs might have FIT files)
                    const matchingRun = window.dataProcessor.runs.find(
                        (r) => r.filename && r.filename.includes(activityId)
                    );

                    if (matchingRun) {
                        matchedCount++;
                        if (parsedFit.hrStream) {
                            matchingRun.hrStream = parsedFit.hrStream;
                        }
                        console.log(
                            `✓ Matched run ${activityId} with FIT data`
                        );
                    }
                }

                processedCount++;
            } catch (err) {
                console.error(`Error processing ${filename}:`, err);
            }
        }

        console.log(
            `FIT processing complete: ${processedCount} processed, ${matchedCount} matched`
        );
    }

    /**
     * Process TCX files and match with activities
     */
    async processTCXFiles(tcxFiles) {
        let processedCount = 0;
        let matchedCount = 0;

        for (const { filename, file } of tcxFiles) {
            try {
                window.feedbackManager.updateProgress(
                    `Processing TCX files... (${processedCount + 1}/${tcxFiles.length})`,
                    60 + (processedCount / tcxFiles.length) * 30
                );

                // Decompress .gz file
                const gzData = await file.async("uint8array");
                const tcxData = pako.ungzip(gzData, { to: "string" });

                // Parse TCX
                const parsedTcx = window.tcxParser.parse(tcxData);

                if (parsedTcx) {
                    // Extract activity ID from filename
                    const activityId = filename
                        .split("/")
                        .pop()
                        .replace(".tcx.gz", "");

                    // Try to match with run
                    const matchingRun = window.dataProcessor.runs.find(
                        (r) => r.filename && r.filename.includes(activityId)
                    );

                    if (matchingRun && !matchingRun.hrStream) {
                        matchedCount++;
                        if (parsedTcx.hrStream)
                            matchingRun.hrStream = parsedTcx.hrStream;
                        if (parsedTcx.paceStream)
                            matchingRun.paceStream = parsedTcx.paceStream;
                        console.log(`✓ Matched run ${activityId}`);
                    }

                    // Try to match with ride (only if no FIT data was found)
                    const matchingRide = window.dataProcessor.rides.find(
                        (r) => r.filename && r.filename.includes(activityId)
                    );

                    if (matchingRide && !matchingRide.powerStream) {
                        matchedCount++;
                        if (parsedTcx.hrStream)
                            matchingRide.hrStream = parsedTcx.hrStream;
                        if (parsedTcx.powerStream) {
                            matchingRide.powerStream = parsedTcx.powerStream;
                            // Calculate avg/max power from stream if not already set
                            if (!matchingRide.avgPower) {
                                const validWatts =
                                    parsedTcx.powerStream.watts.filter(
                                        (w) => w > 0
                                    );
                                if (validWatts.length > 0) {
                                    matchingRide.avgPower =
                                        validWatts.reduce((a, b) => a + b, 0) /
                                        validWatts.length;
                                    matchingRide.maxPower = Math.max(
                                        ...validWatts
                                    );
                                }
                            }
                        }
                        console.log(`✓ Matched ride ${activityId}`);
                    }

                    // Try to match with swim
                    const matchingSwim = window.dataProcessor.swims.find(
                        (r) => r.filename && r.filename.includes(activityId)
                    );

                    if (matchingSwim && !matchingSwim.hrStream) {
                        matchedCount++;
                        if (parsedTcx.hrStream)
                            matchingSwim.hrStream = parsedTcx.hrStream;
                        console.log(`✓ Matched swim ${activityId}`);
                    }
                }

                processedCount++;
            } catch (err) {
                console.error(`Error processing ${filename}:`, err);
            }
        }

        console.log(
            `TCX processing complete: ${processedCount} processed, ${matchedCount} matched`
        );
    }

    /**
     * Finalize processing
     */
    async finalize() {
        // Save to IndexedDB
        await window.storageManager.saveRuns(window.dataProcessor.runs);
        await window.storageManager.saveRides(window.dataProcessor.rides);
        await window.storageManager.saveSwims(window.dataProcessor.swims);

        // Show session banner
        const totalActivities =
            window.dataProcessor.runs.length +
            window.dataProcessor.rides.length +
            window.dataProcessor.swims.length;
        window.feedbackManager.showSessionBanner(totalActivities, "zip");

        // Trigger analysis
        if (typeof window.analyze === "function") {
            window.analyze();
        }

        window.feedbackManager.hideProgress();
    }

    /**
     * Clear ZIP data
     */
    async clearZipFile() {
        const zipInput = document.getElementById("zipFile");
        if (zipInput) {
            zipInput.value = "";
        }

        await window.storageManager.clearRuns();
        await window.storageManager.clearRides();
        await window.storageManager.clearSwims();
        window.dataProcessor.clear();
        window.feedbackManager.hideSessionBanner("zip");

        console.log("✓ ZIP data cleared");
        alert("ZIP data cleared successfully!");
    }
}

// Initialize and export singleton
window.zipHandler = new ZipHandler();

// Auto-initialize on page load
document.addEventListener("DOMContentLoaded", () => {
    window.zipHandler.init();
});
