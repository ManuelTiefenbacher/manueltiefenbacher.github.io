// js/analysis/intervalDetection.js
// General interval training detector (v2.6 - WITH HYSTERESIS)
// Detects any iterative fast/slow pattern

class IntervalDetector {
    constructor() {
        this.MIN_INTERVAL_COUNT = 4;
        this.MIN_SEGMENT_POINTS = 100; // Increased to avoid micro-segments
        this.MIN_SEGMENT_DURATION = 30; // Increased from 20s
        this.SMOOTHING_WINDOW = 9; // Increased smoothing
        this.MIN_SPEED_SEPARATION = 0.2; // Increased to 20% minimum

        // Hysteresis: need bigger change to switch state
        this.HYSTERESIS_PERCENT = 0.3; // 30% buffer zone around threshold

        // For detecting actual intervals vs steady pace variation
        this.MIN_PACE_RANGE_PERCENT = 0.25; // Need 25% pace variation for intervals

        this.debugMode = false;
    }

    log(...args) {
        if (this.debugMode) {
            console.log("[IntervalDetector]", ...args);
        }
    }

    detectInterval(run) {
        this.log("=== Starting Interval Detection ===");

        if (!run || !run.paceStream || !Array.isArray(run.paceStream.pace)) {
            this.log("ERROR: No pace data provided");
            return this._noIntervalResult("No pace data");
        }

        this.log("Raw pace data points:", run.paceStream.pace.length);

        // Filter valid paces
        const rawPaces = run.paceStream.pace.filter(
            (p) => Number.isFinite(p) && p > 0 && p < 20
        );

        this.log("Valid pace points:", rawPaces.length);

        if (rawPaces.length < 100) {
            this.log("ERROR: Insufficient data points:", rawPaces.length);
            return this._noIntervalResult(
                `Only ${rawPaces.length} valid pace points (need at least 100)`
            );
        }

        // Build time array
        const times = this._ensureTimesArray(run, rawPaces.length);
        const totalDuration = times[times.length - 1] - times[0];
        this.log("Total duration:", this._formatDuration(totalDuration));

        // Smooth the data heavily to avoid noise
        const smoothedPaces = this._smooth(rawPaces, this.SMOOTHING_WINDOW);

        // Remove warmup and cooldown to get core section
        const coreIndices = this._getCoreIndices(smoothedPaces);
        const corePaces = smoothedPaces.slice(
            coreIndices.start,
            coreIndices.end
        );
        const coreTimes = times.slice(coreIndices.start, coreIndices.end);

        this.log(
            "Core section:",
            coreIndices.start,
            "-",
            coreIndices.end,
            `(${this._formatDuration(coreTimes[coreTimes.length - 1] - coreTimes[0])})`
        );

        if (corePaces.length < 50) {
            this.log("ERROR: Core section too short");
            return this._noIntervalResult(
                "Core section too short after removing warmup/cooldown"
            );
        }

        // Check if there's enough pace variation for intervals
        const paceStats = this._analyzePaceVariation(corePaces);
        this.log("Pace variation in core:");
        this.log(
            "  Min:",
            paceStats.min.toFixed(2),
            "max:",
            paceStats.max.toFixed(2)
        );
        this.log("  Range:", paceStats.range.toFixed(2), "min/km");
        this.log(
            "  Mean:",
            paceStats.mean.toFixed(2),
            "CV:",
            paceStats.cv.toFixed(3)
        );
        this.log(
            "  Range/Mean ratio:",
            ((paceStats.range / paceStats.mean) * 100).toFixed(1) + "%"
        );

        if (paceStats.range / paceStats.mean < this.MIN_PACE_RANGE_PERCENT) {
            this.log("ERROR: Pace too steady for intervals");
            return this._noIntervalResult(
                `Pace too steady: ${((paceStats.range / paceStats.mean) * 100).toFixed(1)}% variation ` +
                    `(need at least ${this.MIN_PACE_RANGE_PERCENT * 100}%)`
            );
        }

        // Calculate threshold with percentiles (30th and 70th for better separation)
        const sorted = [...corePaces].sort((a, b) => a - b);
        const fastThreshold = sorted[Math.floor(sorted.length * 0.3)];
        const slowThreshold = sorted[Math.floor(sorted.length * 0.7)];
        const midThreshold = (fastThreshold + slowThreshold) / 2;

        this.log("Thresholds:");
        this.log(
            "  Fast (30th percentile):",
            fastThreshold.toFixed(2),
            "min/km"
        );
        this.log(
            "  Slow (70th percentile):",
            slowThreshold.toFixed(2),
            "min/km"
        );
        this.log("  Mid:", midThreshold.toFixed(2), "min/km");

        // Segment with hysteresis
        const segments = this._hysteresisSegmentation(
            corePaces,
            coreTimes,
            midThreshold,
            coreIndices.start
        );

        this.log("--- Segmentation Results ---");
        this.log("Fast segments found:", segments.fastSegments.length);
        this.log("Slow segments found:", segments.slowSegments.length);

        if (segments.fastSegments.length > 0) {
            this.log("Fast segments:");
            segments.fastSegments.forEach((seg, i) => {
                this.log(
                    `  #${i + 1}: ${this._formatDuration(seg.duration)} at ${this._formatPace(seg.avgPace)}`
                );
            });
        }

        if (segments.slowSegments.length > 0) {
            this.log("Slow segments:");
            segments.slowSegments.forEach((seg, i) => {
                this.log(
                    `  #${i + 1}: ${this._formatDuration(seg.duration)} at ${this._formatPace(seg.avgPace)}`
                );
            });
        }

        if (
            segments.fastSegments.length < this.MIN_INTERVAL_COUNT ||
            segments.slowSegments.length < this.MIN_INTERVAL_COUNT
        ) {
            this.log("ERROR: Insufficient segments");
            return this._noIntervalResult(
                `Insufficient segments: ${segments.fastSegments.length} fast, ${segments.slowSegments.length} slow`
            );
        }

        // Build pairs
        const pairs = this._buildPairs(segments);
        this.log("Alternating pairs found:", pairs.length);

        if (pairs.length < this.MIN_INTERVAL_COUNT) {
            this.log("ERROR: Not enough alternating pairs");
            return this._noIntervalResult(
                `Only ${pairs.length} alternating pairs`
            );
        }

        // Check speed separation
        const avgFastSpeed = this._mean(
            segments.fastSegments.map((s) => s.avgSpeed)
        );
        const avgSlowSpeed = this._mean(
            segments.slowSegments.map((s) => s.avgSpeed)
        );
        const speedDiff = (avgFastSpeed - avgSlowSpeed) / avgSlowSpeed;
        const speedDiffPercent = (speedDiff * 100).toFixed(1);

        this.log("--- Speed Separation ---");
        this.log(
            "Fast speed:",
            avgFastSpeed.toFixed(3),
            "km/min (",
            this._formatPace(segments.avgFastPace),
            ")"
        );
        this.log(
            "Slow speed:",
            avgSlowSpeed.toFixed(3),
            "km/min (",
            this._formatPace(segments.avgSlowPace),
            ")"
        );
        this.log("Difference:", speedDiffPercent + "%");

        if (speedDiff < this.MIN_SPEED_SEPARATION) {
            this.log("ERROR: Speed separation insufficient");
            return this._noIntervalResult(
                `Speed separation too low: ${speedDiffPercent}% (need ${this.MIN_SPEED_SEPARATION * 100}%)`
            );
        }

        // Additional check: segments should alternate reasonably
        const alternationScore = this._checkAlternationPattern(segments);
        this.log(
            "Alternation score:",
            alternationScore.toFixed(2),
            "(1.0 = perfect alternation)"
        );

        if (alternationScore < 0.6) {
            this.log("ERROR: Poor alternation pattern");
            return this._noIntervalResult(
                `Poor alternation pattern: ${alternationScore.toFixed(2)} (need at least 0.6)`
            );
        }

        const classification = this._classifyPattern(segments, pairs);
        const details = this._buildDetailsString(
            pairs.length,
            segments,
            classification
        );

        this.log("=== INTERVAL DETECTED ===");
        this.log(details);

        return {
            isInterval: true,
            intervals: pairs.length,
            details,
            workoutType: classification.workoutType,
            patternSubtype: classification.patternSubtype,
            coefficientOfVariation: paceStats.cv,
            debug: {
                pairCount: pairs.length,
                speedDiffPercent: parseFloat(speedDiffPercent),
                alternationScore,
                avgFastPace: segments.avgFastPace,
                avgSlowPace: segments.avgSlowPace,
                fastSegments: segments.fastSegments.length,
                slowSegments: segments.slowSegments.length,
                coreSection: coreIndices,
            },
        };
    }

    _hysteresisSegmentation(paces, times, threshold, globalStartIdx = 0) {
        const fastSegments = [];
        const slowSegments = [];

        const upperThreshold = threshold * (1 - this.HYSTERESIS_PERCENT);
        const lowerThreshold = threshold * (1 + this.HYSTERESIS_PERCENT);

        this.log(
            "Hysteresis thresholds: fast <",
            upperThreshold.toFixed(2),
            ", slow >",
            lowerThreshold.toFixed(2)
        );

        let currentState = null; // 'fast', 'slow', or null
        let segmentStart = 0;
        let segmentPaces = [];
        let stateChangesPending = 0;

        for (let i = 0; i < paces.length; i++) {
            const pace = paces[i];

            // Determine if we should be fast or slow based on current state
            let shouldBeFast;
            if (currentState === null) {
                // Initial state determination
                shouldBeFast = pace < threshold;
            } else if (currentState === "fast") {
                // Stay fast unless pace goes above lower threshold
                shouldBeFast = pace < lowerThreshold;
            } else {
                // currentState === 'slow'
                // Stay slow unless pace goes below upper threshold
                shouldBeFast = pace < upperThreshold;
            }

            const newState = shouldBeFast ? "fast" : "slow";

            if (currentState === null) {
                currentState = newState;
                segmentStart = i;
                segmentPaces = [pace];
                stateChangesPending = 0;
            } else if (newState === currentState) {
                segmentPaces.push(pace);
                stateChangesPending = 0;
            } else {
                // Potential state change - require confirmation
                stateChangesPending++;

                if (stateChangesPending >= 3) {
                    // Require 3 consecutive points to confirm
                    // Save previous segment if valid
                    if (segmentPaces.length >= this.MIN_SEGMENT_POINTS) {
                        const duration =
                            times[i - stateChangesPending] -
                            times[segmentStart];

                        if (duration >= this.MIN_SEGMENT_DURATION) {
                            const segment = {
                                start: globalStartIdx + segmentStart,
                                end: globalStartIdx + i - stateChangesPending,
                                duration,
                                avgPace: this._mean(segmentPaces),
                                avgSpeed: 1 / this._mean(segmentPaces),
                            };

                            if (currentState === "fast") {
                                fastSegments.push(segment);
                            } else {
                                slowSegments.push(segment);
                            }
                        }
                    }

                    // Start new segment
                    currentState = newState;
                    segmentStart = i - stateChangesPending + 1;
                    segmentPaces = paces.slice(segmentStart, i + 1);
                    stateChangesPending = 0;
                } else {
                    segmentPaces.push(pace);
                }
            }
        }

        // Handle last segment
        if (segmentPaces.length >= this.MIN_SEGMENT_POINTS) {
            const duration = times[times.length - 1] - times[segmentStart];

            if (duration >= this.MIN_SEGMENT_DURATION) {
                const segment = {
                    start: globalStartIdx + segmentStart,
                    end: globalStartIdx + paces.length - 1,
                    duration,
                    avgPace: this._mean(segmentPaces),
                    avgSpeed: 1 / this._mean(segmentPaces),
                };

                if (currentState === "fast") {
                    fastSegments.push(segment);
                } else {
                    slowSegments.push(segment);
                }
            }
        }

        return {
            fastSegments,
            slowSegments,
            avgFastPace: this._mean(fastSegments.map((s) => s.avgPace)),
            avgSlowPace: this._mean(slowSegments.map((s) => s.avgPace)),
        };
    }

    _getCoreIndices(paces) {
        // Remove first and last 10% OR detect actual warmup/cooldown
        const defaultSkip = Math.floor(paces.length * 0.1);

        // Simple approach: skip 10% from each end
        return {
            start: defaultSkip,
            end: paces.length - defaultSkip,
        };
    }

    _analyzePaceVariation(paces) {
        const min = Math.min(...paces);
        const max = Math.max(...paces);
        const mean = this._mean(paces);
        const range = max - min;
        const cv = this._cv(paces);

        return { min, max, mean, range, cv };
    }

    _checkAlternationPattern(segments) {
        // Create sequence of all segments sorted by start time
        const seq = [
            ...segments.fastSegments.map((s) => ({ ...s, type: "fast" })),
            ...segments.slowSegments.map((s) => ({ ...s, type: "slow" })),
        ].sort((a, b) => a.start - b.start);

        if (seq.length < 2) return 0;

        let alternations = 0;
        let consecutiveSame = 0;

        for (let i = 1; i < seq.length; i++) {
            if (seq[i].type !== seq[i - 1].type) {
                alternations++;
            } else {
                consecutiveSame++;
            }
        }

        // Perfect alternation = 1.0, no alternation = 0
        return alternations / (seq.length - 1);
    }

    _buildPairs(segments) {
        const seq = [
            ...segments.fastSegments.map((s) => ({ ...s, type: "fast" })),
            ...segments.slowSegments.map((s) => ({ ...s, type: "slow" })),
        ].sort((a, b) => a.start - b.start);

        const pairs = [];
        for (let i = 0; i + 1 < seq.length; i++) {
            const a = seq[i];
            const b = seq[i + 1];
            if (a.type !== b.type) {
                if (a.type === "fast") {
                    pairs.push([a, b]);
                } else {
                    pairs.push([b, a]);
                }
            }
        }
        return pairs;
    }

    _classifyPattern(segments, pairs) {
        const fastDur = segments.fastSegments.map((s) => s.duration);
        const slowDur = segments.slowSegments.map((s) => s.duration);
        const fastCV = this._cv(fastDur);
        const slowCV = this._cv(slowDur);

        const structured = fastCV <= 0.35 && slowCV <= 0.35;

        return {
            workoutType: structured
                ? "structured-intervals"
                : "fartlek-intervals",
            patternSubtype: this._detectSubtype(segments.fastSegments),
            fastDurations: fastDur,
            slowDurations: slowDur,
            fastCV,
            slowCV,
        };
    }

    _detectSubtype(fastSegments) {
        if (!fastSegments || fastSegments.length < 2) return "mixed";
        const d = fastSegments.map((s) => s.duration);
        const median = this._median(d);

        const equalish = d.every((x) => Math.abs(x - median) <= median * 0.2);
        if (equalish) return "equal";

        return "mixed";
    }

    _buildDetailsString(pairCount, segments, classification) {
        const avgFast = this._formatPace(segments.avgFastPace);
        const avgSlow = this._formatPace(segments.avgSlowPace);
        const fastMedian = this._formatDuration(
            this._median(classification.fastDurations)
        );
        const slowMedian = this._formatDuration(
            this._median(classification.slowDurations)
        );

        return (
            `${pairCount} intervals detected (${classification.workoutType}, ${classification.patternSubtype}). ` +
            `Fast: ${avgFast} for ~${fastMedian}, Slow: ${avgSlow} for ~${slowMedian}`
        );
    }

    _formatPace(pace) {
        const min = Math.floor(pace);
        const sec = Math.round((pace - min) * 60);
        return `${min}:${sec.toString().padStart(2, "0")}/km`;
    }

    _formatDuration(seconds) {
        if (!Number.isFinite(seconds)) return "—";
        const m = Math.floor(seconds / 60);
        const s = Math.round(seconds % 60);
        return `${m}:${s.toString().padStart(2, "0")}`;
    }

    _noIntervalResult(reason) {
        this.log("=== NO INTERVAL DETECTED ===");
        this.log("Reason:", reason);
        return {
            isInterval: false,
            intervals: 0,
            details: null,
            workoutType: "none",
            patternSubtype: null,
            reason,
        };
    }

    _mean(arr) {
        return arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;
    }

    _median(arr) {
        if (!arr || !arr.length) return 0;
        const sorted = [...arr].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 === 0
            ? (sorted[mid - 1] + sorted[mid]) / 2
            : sorted[mid];
    }

    _cv(arr) {
        if (!arr || arr.length === 0) return Infinity;
        const m = this._mean(arr);
        if (m === 0) return Infinity;
        const variance = this._mean(arr.map((x) => (x - m) ** 2));
        return Math.sqrt(variance) / m;
    }

    _smooth(values, window) {
        const out = [];
        const half = Math.floor(window / 2);
        for (let i = 0; i < values.length; i++) {
            const start = Math.max(0, i - half);
            const end = Math.min(values.length, i + half + 1);
            out.push(this._mean(values.slice(start, end)));
        }
        return out;
    }

    _ensureTimesArray(run, length) {
        if (run.paceStream?.time?.length === length) {
            this.log("Using provided time array");
            return run.paceStream.time;
        }
        if (run.duration && length > 1) {
            const apparentSamplingRate = run.duration / (length - 1);

            if (apparentSamplingRate < 0.1) {
                this.log("WARNING: Duration in minutes, converting to seconds");
                const durationInSeconds = run.duration * 60;
                const dt = durationInSeconds / (length - 1);
                this.log(
                    "Corrected duration:",
                    this._formatDuration(durationInSeconds)
                );
                return Array.from({ length }, (_, i) => i * dt);
            }

            const dt = run.duration / (length - 1);
            this.log("Sampling rate:", dt.toFixed(2), "s/point");
            return Array.from({ length }, (_, i) => i * dt);
        }
        this.log("No duration provided, assuming 1Hz sampling");
        return Array.from({ length }, (_, i) => i);
    }
}

// Export singleton
window.intervalDetector = new IntervalDetector();
