// js/analysis/intervalDetection.js
// General interval training detector (v2.3)
// Detects any iterative fast/slow pattern (e.g., 30/30, 1'/1', 3'/3', fartlek, ladder, pyramid)
//
// Public API:
//   window.intervalDetector.detectInterval(run)
//     -> {
//          isInterval: boolean,
//          intervals: number,            // number of FAST+SLOW pairs
//          details: string|null,         // human-readable summary
//          workoutType: 'structured-intervals' | 'fartlek-intervals' | 'none',
//          patternSubtype: 'equal' | 'ladder' | 'pyramid' | 'mixed' | null,
//          coefficientOfVariation?: number,
//          debug?: { ... }
//        }
//
// Expected input:
//   run = {
//     paceStream: { pace: number[], time?: number[] }, // pace in min/km; time in seconds (monotonic)
//     distance?: number (km),
//     duration?: number (seconds)
//   }

class IntervalDetector {
    constructor() {
        // ---- Tunable parameters ----

        // Pair counting (FAST+SLOW)
        this.MIN_INTERVAL_COUNT = 2; // require at least 2 complete pairs

        // Segment requirements (support short and long intervals)
        this.MIN_INTERVAL_DURATION = 40; // min seconds per segment (fast OR slow); 25 allows 30/30
        this.MIN_SEGMENT_POINTS = 5; // minimum data points in a segment

        // Debounce: avoid rapid flips around thresholds
        this.MIN_DWELL_TIME = 25; // seconds to confirm a state change (short to support short intervals)

        // Smoothing (moving average window for pace stream)
        this.SMOOTHING_WINDOW = 7; // samples; adjust for your sampling rate if needed

        // Variability & separation
        this.CV_THRESHOLD = 0.16; // coefficient of variation threshold over core section
        this.MIN_SPEED_SEPARATION = 0.4; // min average speed gap between fast & slow (10%)

        // Hysteresis (percent above avg speed)
        this.FAST_ON_PCT = 0.1; // +10% to enter fast
        this.FAST_OFF_PCT = 0.05; // +5% to remain fast (prevents chatter)

        // Warmup/Cooldown detection (conservative)
        this.WARMUP_STABLE_POINTS = 12;
        this.WARMUP_RELATIVE_BAND = [0.9, 1.1]; // vs overall avg
        this.COOLDOWN_SLOW_POINTS = 12;
        this.COOLDOWN_RELATIVE_MIN = 1.1; // 10% slower than middle
        this.COOLDOWN_MIN_SLOPE = 0.03; // min pace increase per step (slowing)

        // Core length requirement
        this.MIN_CORE_DURATION_SEC = 8 * 60; // require >= 8 min to confidently assess intervals

        // Pattern classification thresholds
        this.REGULARITY_CV_MAX = 0.35; // CV cutoff for "structured" durations
        this.DURATION_RATIO_TOL = 0.6; // fast vs slow duration similarity per pair (min ratio)
        this.LADDER_TOL = 0.2; // 20% monotonic tolerance for ladder detection
    }

    /**
     * Detect whether a run is an interval workout (any alternating fast/slow pattern).
     * @param {Object} run
     * @returns {{
     *  isInterval: boolean,
     *  intervals: number,
     *  details: string|null,
     *  workoutType: 'structured-intervals' | 'fartlek-intervals' | 'none',
     *  patternSubtype: 'equal' | 'ladder' | 'pyramid' | 'mixed' | null,
     *  coefficientOfVariation?: number,
     *  debug?: any
     * }}
     */
    detectInterval(run) {
        if (!run || !run.paceStream || !Array.isArray(run.paceStream.pace)) {
            return {
                isInterval: false,
                intervals: 0,
                details: null,
                workoutType: "none",
                patternSubtype: null,
            };
        }

        const rawPaces = run.paceStream.pace.filter(
            (p) => Number.isFinite(p) && p > 0 && p < 20
        );
        if (rawPaces.length < 30) {
            return {
                isInterval: false,
                intervals: 0,
                details: null,
                workoutType: "none",
                patternSubtype: null,
            };
        }

        // Build/validate time array
        const times = this._ensureTimesArray(run, rawPaces.length);
        if (!times || times.length !== rawPaces.length) {
            return {
                isInterval: false,
                intervals: 0,
                details: null,
                workoutType: "none",
                patternSubtype: null,
            };
        }

        // Extract core (trim warmup/cooldown conservatively)
        const core = this.extractCoreSection(rawPaces, times);
        if (core.corePaces.length < 30) {
            return {
                isInterval: false,
                intervals: 0,
                details: null,
                workoutType: "none",
                patternSubtype: null,
            };
        }
        const coreDuration =
            core.coreTimes[core.coreTimes.length - 1] - core.coreTimes[0];
        if (
            !Number.isFinite(coreDuration) ||
            coreDuration < this.MIN_CORE_DURATION_SEC
        ) {
            return {
                isInterval: false,
                intervals: 0,
                details: null,
                workoutType: "none",
                patternSubtype: null,
            };
        }

        // Stats
        const avgPace = this._mean(core.corePaces);
        const stdDev = this.calculateStdDev(core.corePaces);
        const coefficientOfVariation = stdDev / avgPace;

        // Segment detection (smoothing + hysteresis + dwell)
        const segments = this.detectPaceSegments(
            core.corePaces,
            avgPace,
            core.coreTimes
        );

        // Build alternating pairs (FAST + SLOW)
        const pairs = this._buildPairs(segments);
        const pairCount = pairs.length;

        // Separation check (fast vs slow speed gap)
        const separationOk = this._hasMeaningfulSeparation(segments);

        // Classification: structured vs fartlek; subtype (equal/ladder/pyramid/mixed)
        const classification = this._classifyPattern(segments, pairs);

        // Final decision
        const isInterval =
            separationOk &&
            (pairCount >= this.MIN_INTERVAL_COUNT + 1 || // 3+ pairs => strong signal
                (pairCount >= this.MIN_INTERVAL_COUNT &&
                    coefficientOfVariation >= this.CV_THRESHOLD));

        const workoutType = isInterval ? classification.workoutType : "none";
        const patternSubtype = isInterval
            ? classification.patternSubtype
            : null;

        let details = null;
        if (isInterval) {
            const fastPaceStr = this.formatPace(segments.avgFastPace);
            const slowPaceStr = this.formatPace(segments.avgSlowPace);
            const fastMedDur = this._formatDuration(
                classification.fastMedianDur
            );
            const slowMedDur = this._formatDuration(
                classification.slowMedianDur
            );

            details =
                `${pairCount}x ${patternSubtype || "intervals"} ` +
                `(Fast ~${fastMedDur} @ ${fastPaceStr}, ` +
                `Recovery ~${slowMedDur} @ ${slowPaceStr})`;
        }

        return {
            isInterval,
            intervals: isInterval ? pairCount : 0,
            details,
            workoutType,
            patternSubtype,
            coefficientOfVariation,
            debug: {
                coreDuration,
                pairCount,
                separationOk,
                avgFastPace: segments.avgFastPace,
                avgSlowPace: segments.avgSlowPace,
                fastDurations: classification.fastDurations,
                slowDurations: classification.slowDurations,
                fastCV: classification.fastCV,
                slowCV: classification.slowCV,
            },
        };
    }

    // ---------------- Core extraction (warmup/cooldown) ----------------

    extractCoreSection(paces, times) {
        if (paces.length !== times.length) {
            return {
                corePaces: paces,
                coreTimes: times,
                warmupEnd: 0,
                cooldownStart: paces.length,
            };
        }

        if (paces.length < 60) {
            return {
                corePaces: paces,
                coreTimes: times,
                warmupEnd: 0,
                cooldownStart: paces.length,
            };
        }

        const windowSize = Math.max(5, Math.floor(paces.length / 30));
        const movingAvg = this.calculateMovingAverage(paces, windowSize);

        const warmupEnd = this.findWarmupEnd(paces, movingAvg);
        const cooldownStart = this.findCooldownStart(paces, movingAvg);

        const start = Math.max(0, Math.min(warmupEnd, paces.length - 1));
        const end = Math.max(start + 1, Math.min(cooldownStart, paces.length));

        const corePaces = paces.slice(start, end);
        const coreTimes = times.slice(start, end);

        return { corePaces, coreTimes, warmupEnd: start, cooldownStart: end };
    }

    calculateMovingAverage(values, windowSize) {
        const res = [];
        for (let i = 0; i < values.length; i++) {
            const a = Math.max(0, i - Math.floor(windowSize / 2));
            const b = Math.min(
                values.length,
                i + Math.floor(windowSize / 2) + 1
            );
            const avg = this._mean(values.slice(a, b));
            res.push(avg);
        }
        return res;
    }

    findWarmupEnd(paces, movingAvg) {
        const n = paces.length;
        const searchEnd = Math.min(
            Math.floor(n * 0.4),
            n - this.WARMUP_STABLE_POINTS - 1
        );
        if (searchEnd <= 10) return 0;

        const overallAvg = this._mean(paces);
        const [low, high] = this.WARMUP_RELATIVE_BAND;
        const required = this.WARMUP_STABLE_POINTS;

        let consecutive = 0;
        for (let i = 2; i < searchEnd; i++) {
            const paceChange = movingAvg[i] - movingAvg[i - 1]; // + means slowing
            const relative = movingAvg[i] / overallAvg;
            const stabilizing = Math.abs(paceChange) < 0.02; // nearly flat
            const inBand = relative > low && relative < high;

            if (stabilizing && inBand) {
                consecutive++;
                if (consecutive >= required) {
                    return Math.max(0, i - required);
                }
            } else {
                consecutive = 0;
            }
        }
        return 0;
    }

    findCooldownStart(paces, movingAvg) {
        const n = paces.length;
        const searchStart = Math.max(
            Math.floor(n * 0.6),
            this.COOLDOWN_SLOW_POINTS + 1
        );

        const midStart = Math.floor(n * 0.3);
        const midEnd = Math.floor(n * 0.7);
        const middleAvg = this._mean(paces.slice(midStart, midEnd));

        let consecutive = 0;
        for (let i = searchStart; i < n - 2; i++) {
            const paceChange = movingAvg[i + 1] - movingAvg[i]; // + means slowing
            const relative = movingAvg[i] / middleAvg;

            // BOTH sustained slowing AND notably slower than middle
            if (
                paceChange > this.COOLDOWN_MIN_SLOPE &&
                relative > this.COOLDOWN_RELATIVE_MIN
            ) {
                consecutive++;
                if (consecutive >= this.COOLDOWN_SLOW_POINTS) {
                    return Math.max(searchStart, i - this.COOLDOWN_SLOW_POINTS);
                }
            } else {
                consecutive = 0;
            }
        }
        return n;
    }

    // ---------------- Segment detection ----------------

    detectPaceSegments(paces, avgPace, times) {
        const MIN_DUR = this.MIN_INTERVAL_DURATION;
        const MIN_POINTS = this.MIN_SEGMENT_POINTS;

        // Smooth pace before classifying (reduces noise flips)
        const smoothed = this._smooth(paces, this.SMOOTHING_WINDOW);

        const speeds = smoothed.map((p) => 1 / p);
        const avgSpeed = 1 / avgPace;
        const speedStdDev = this.calculateStdDev(speeds);

        // Hysteresis thresholds: stronger of percentage vs std-dev
        const fastOn = Math.max(
            avgSpeed * (1 + this.FAST_ON_PCT),
            avgSpeed + 0.8 * speedStdDev
        );
        const fastOff = Math.max(
            avgSpeed * (1 + this.FAST_OFF_PCT),
            avgSpeed + 0.5 * speedStdDev
        );

        let state = null; // 'fast' | 'slow'
        let segStartIdx = 0;
        let segStartTime = times[0];
        let dwellAnchorTime = times[0];

        let segPaces = [];
        let segSpeeds = [];

        const fastSegments = [];
        const slowSegments = [];

        const commit = (segState, endIdx, endTime, sp, ss) => {
            const duration = endTime - segStartTime;
            if (
                Number.isFinite(duration) &&
                duration >= MIN_DUR &&
                sp.length >= MIN_POINTS
            ) {
                const avgP = this._mean(sp);
                const avgS = this._mean(ss);
                const obj = {
                    start: segStartIdx,
                    end: endIdx,
                    avgPace: avgP,
                    avgSpeed: avgS,
                    duration,
                };
                (segState === "fast" ? fastSegments : slowSegments).push(obj);
            }
        };

        for (let i = 0; i < speeds.length; i++) {
            const t = times[i];
            const spd = speeds[i];

            const isFastCandidate =
                state === "fast" ? spd > fastOff : spd > fastOn;

            if (state === null) {
                state = isFastCandidate ? "fast" : "slow";
                segStartIdx = i;
                segStartTime = t;
                dwellAnchorTime = t;
                segPaces = [paces[i]];
                segSpeeds = [spd];
                continue;
            }

            const desired = isFastCandidate ? "fast" : "slow";
            if (desired !== state) {
                // Debounce: require sustained desire for MIN_DWELL_TIME
                if (t - dwellAnchorTime >= this.MIN_DWELL_TIME) {
                    // close previous
                    commit(state, i, t, segPaces, segSpeeds);
                    // start new
                    state = desired;
                    segStartIdx = i;
                    segStartTime = t;
                    segPaces = [paces[i]];
                    segSpeeds = [spd];
                    dwellAnchorTime = t;
                }
            } else {
                // staying in same state: refresh dwell anchor and accumulate
                dwellAnchorTime = t;
                segPaces.push(paces[i]);
                segSpeeds.push(spd);
            }
        }

        // Close tail segment
        if (segPaces.length >= MIN_POINTS) {
            const lastTime = times[times.length - 1];
            commit(state, speeds.length, lastTime, segPaces, segSpeeds);
        }

        // Aggregate pace summaries
        let avgFastPace = avgPace;
        let avgSlowPace = avgPace;

        if (fastSegments.length && slowSegments.length) {
            avgFastPace = this._mean(fastSegments.map((s) => s.avgPace));
            avgSlowPace = this._mean(slowSegments.map((s) => s.avgPace));
        }

        return { fastSegments, slowSegments, avgFastPace, avgSlowPace };
    }

    // ---------------- Decision helpers ----------------

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
                // duration similarity per pair (tolerant for varied intervals)
                const ratio =
                    Math.min(a.duration, b.duration) /
                    Math.max(a.duration, b.duration);
                if (ratio >= this.DURATION_RATIO_TOL) {
                    // save as [fast, slow]
                    if (a.type === "fast") pairs.push([a, b]);
                    else pairs.push([b, a]);
                } else {
                    // even if durations differ, still count as a pair (fartlek); comment out to be stricter
                    if (a.type === "fast") pairs.push([a, b]);
                    else pairs.push([b, a]);
                }
            }
        }
        return pairs;
    }

    _hasMeaningfulSeparation(segments) {
        if (!segments.fastSegments.length || !segments.slowSegments.length)
            return false;
        const avgFast = this._mean(
            segments.fastSegments.map((s) => s.avgSpeed)
        );
        const avgSlow = this._mean(
            segments.slowSegments.map((s) => s.avgSpeed)
        );
        const diff = (avgFast - avgSlow) / avgSlow;
        return diff >= this.MIN_SPEED_SEPARATION;
    }

    _classifyPattern(segments, pairs) {
        const fastDur = segments.fastSegments.map((s) => s.duration);
        const slowDur = segments.slowSegments.map((s) => s.duration);

        const fastCV = this._cv(fastDur);
        const slowCV = this._cv(slowDur);

        const fastMedian = this._median(fastDur);
        const slowMedian = this._median(slowDur);

        // Ladder/pyramid detection (based on FAST durations sequence)
        const subtype = this._detectSubtype(segments.fastSegments);

        // Structured vs fartlek:
        // - Structured: durations relatively consistent (CV <= REGULARITY_CV_MAX)
        // - Fartlek: durations vary widely (CV > REGULARITY_CV_MAX), still alternates
        const structured =
            Number.isFinite(fastCV) &&
            Number.isFinite(slowCV) &&
            fastCV <= this.REGULARITY_CV_MAX &&
            slowCV <= this.REGULARITY_CV_MAX;

        let workoutType = "fartlek-intervals";
        if (structured) workoutType = "structured-intervals";

        // Map subtype: equal if subtype 'equal', else ladder/pyramid/mixed
        let patternSubtype = subtype;

        return {
            workoutType,
            patternSubtype,
            fastDurations: fastDur,
            slowDurations: slowDur,
            fastCV,
            slowCV,
            fastMedianDur: fastMedian,
            slowMedianDur: slowMedian,
        };
    }

    _detectSubtype(fastSegments) {
        if (!fastSegments || fastSegments.length < 2) return "mixed";
        const d = fastSegments.map((s) => s.duration);

        const median = this._median(d);
        const max = Math.max(...d);
        const min = Math.min(...d);

        // Equal: durations all within ±20% of median
        const equalish = d.every(
            (x) => Math.abs(x - median) <= median * this.LADDER_TOL
        );
        if (equalish) return "equal";

        // Ladder/pyramid: check monotonic increase/decrease with one peak
        const peakIdx = d.indexOf(max);
        const increasingBeforePeak = this._isMonotonic(
            d.slice(0, peakIdx),
            +1,
            this.LADDER_TOL
        );
        const decreasingAfterPeak = this._isMonotonic(
            d.slice(peakIdx + 1),
            -1,
            this.LADDER_TOL
        );

        if (
            increasingBeforePeak &&
            decreasingAfterPeak &&
            peakIdx > 0 &&
            peakIdx < d.length - 1
        ) {
            return "pyramid";
        }
        if (increasingBeforePeak && peakIdx === d.length - 1) {
            return "ladder";
        }
        if (decreasingAfterPeak && peakIdx === 0) {
            return "ladder";
        }
        return "mixed";
    }

    _isMonotonic(arr, direction, tol) {
        if (arr.length < 2) return false;
        // direction: +1 for increasing, -1 for decreasing
        for (let i = 1; i < arr.length; i++) {
            const prev = arr[i - 1],
                cur = arr[i];
            const ok =
                direction > 0
                    ? cur >= prev * (1 - tol)
                    : cur <= prev * (1 + tol);
            if (!ok) return false;
        }
        return true;
    }

    // ---------------- Utilities ----------------

    calculateStdDev(values) {
        if (!values || values.length === 0) return 0;
        const m = this._mean(values);
        const v = this._mean(values.map((x) => (x - m) ** 2));
        return Math.sqrt(v);
    }

    formatPace(pace) {
        const minutes = Math.floor(pace);
        const seconds = Math.round((pace - minutes) * 60);
        return `${minutes}:${seconds.toString().padStart(2, "0")}/km`;
    }

    calculateAveragePace(run) {
        if (run.paceStream && run.paceStream.pace) {
            const valid = run.paceStream.pace.filter((p) => p > 0 && p < 20);
            if (valid.length) return this._mean(valid);
        }
        if (run.distance > 0 && run.duration > 0) {
            return run.duration / 60 / run.distance; // min/km
        }
        return null;
    }

    calculateAverageSpeed(activity) {
        if (!activity.distance || !activity.duration) return null;
        const distanceKm = activity.distance;
        const durationHours = activity.duration / 3600;
        if (durationHours === 0) return null;
        return distanceKm / durationHours;
    }

    calculateAverageSwimPace(activity) {
        if (!activity.distance || !activity.duration) return null;
        const distanceMeters = activity.distance * 1000;
        const durationMinutes = activity.duration / 60;
        if (distanceMeters === 0) return null;
        return (durationMinutes / distanceMeters) * 100; // min/100m
    }

    formatSwimPace(pace) {
        if (!pace && pace !== 0) return "—";
        const minutes = Math.floor(pace);
        const seconds = Math.round((pace - minutes) * 60);
        return `${minutes}:${seconds.toString().padStart(2, "0")}/100m`;
    }

    _mean(arr) {
        if (!arr || !arr.length) return 0;
        return arr.reduce((s, v) => s + v, 0) / arr.length;
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
        const sd = this.calculateStdDev(arr);
        return sd / m;
    }

    _smooth(values, window = 5) {
        const out = [];
        for (let i = 0; i < values.length; i++) {
            const a = Math.max(0, i - Math.floor(window / 2));
            const b = Math.min(values.length, i + Math.floor(window / 2) + 1);
            out.push(this._mean(values.slice(a, b)));
        }
        return out;
    }

    _formatDuration(seconds) {
        if (!Number.isFinite(seconds)) return "—";
        const m = Math.floor(seconds / 60);
        const s = Math.round(seconds % 60);
        return `${m}:${s.toString().padStart(2, "0")}`;
    }

    _ensureTimesArray(run, length) {
        // If provided, validate
        if (
            run.paceStream.time &&
            Array.isArray(run.paceStream.time) &&
            run.paceStream.time.length === length
        ) {
            return run.paceStream.time.slice();
        }

        // Otherwise, infer from total duration if available
        if (Number.isFinite(run.duration) && run.duration > 0 && length > 1) {
            const dt = run.duration / (length - 1);
            const times = new Array(length);
            for (let i = 0; i < length; i++) times[i] = i * dt;
            return times;
        }

        // Fallback: assume 1 Hz sampling
        const times = new Array(length);
        for (let i = 0; i < length; i++) times[i] = i;
        return times;
    }
}

// Export singleton for browser
window.intervalDetector = new IntervalDetector();
