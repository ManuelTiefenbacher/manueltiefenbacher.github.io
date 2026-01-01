/* eslint-disable no-console */

/**
 * FITParser (browser-friendly, self-contained)
 * - Decodes FIT header, definitions, and data messages
 * - Supports FIT v2.0 Developer Data Fields (field_description #206, developer_data_id #207)
 * - Handles compressed timestamp record headers
 * - Converts semicircles -> degrees, speed -> km/h, altitude scaling/offset
 *
 * References:
 *  - FIT Protocol (file structure, headers, base types): https://developer.garmin.com/fit/protocol/
 *  - Developer Data Fields (v2.0, field_description/developer_data_id): https://developer.garmin.com/fit/cookbook/developer-data/
 *  - Common scales/units (lat/lon, speed mm/s, altitude 0.2 m & offset): https://logiqx.github.io/gps-wizard/formats/fit.html
 */

class FITParser {
    constructor() {
        console.log("FIT Parser initialized (self-contained)");

        // Global Message Numbers (GMN) used here (subset of the FIT Profile)
        this.MESSAGE_TYPES = {
            FILE_ID: 0,
            SESSION: 18,
            LAP: 19,
            RECORD: 20,
            EVENT: 21,
            DEVICE_INFO: 23,
            FIELD_DESCRIPTION: 206, // FIT v2.0 (developer data)
            DEVELOPER_DATA_ID: 207, // FIT v2.0 (developer data)
        };

        // Common record field IDs (subset) — numbers per FIT profile
        this.RECORD_FIELDS = {
            253: "timestamp",
            0: "position_lat",
            1: "position_long",
            2: "altitude", // 0.2 m steps, offset -500 m
            3: "heart_rate", // bpm
            4: "cadence", // rpm
            5: "distance", // meters * 1e-3 (often cumulative)
            6: "speed", // mm/s -> m/s -> km/h
            7: "power", // watts
            13: "temperature", // °C
            29: "accumulated_power", // watts-seconds
            73: "enhanced_speed", // like speed but 32-bit
            78: "enhanced_altitude", // like altitude but 32-bit (no -500 offset)
        };

        // Developer Field description mapping storage:
        // key = `${developer_data_index}:${field_definition_number}` => { name, units, baseType }
        this.devFieldMeta = new Map();

        // Developer ID metadata (optional, not required for decoding values)
        // key = devIdx -> { developerId, applicationId, manufacturer, applicationVersion }
        this.devIndexMeta = new Map();

        this.FIT_EPOCH_MS = Date.parse("1989-12-31T00:00:00Z");
    }

    /**
     * Public: Parse a FIT ArrayBuffer and return either:
     *  - { records, streams, meta } on success
     *  - null on failure
     */
    parse(arrayBuffer) {
        try {
            if (!arrayBuffer || arrayBuffer.byteLength === 0) {
                console.error("Empty FIT file");
                return null;
            }

            const view = new DataView(arrayBuffer);
            const header = this.parseHeader(view);
            if (!header) return null;

            const { records, meta } = this.parseRecords(view, header);
            if (!records || records.length === 0) {
                console.warn("No RECORD messages found");
                return null;
            }

            const streams = this.extractStreams(records);
            return { records, streams, meta };
        } catch (e) {
            console.error("FIT parsing failed:", e);
            return null;
        }
    }

    /**
     * FIT file header (12 or 14 bytes; bytes 8..11 must be ".FIT")
     * https://developer.garmin.com/fit/protocol/
     */
    parseHeader(view) {
        try {
            const headerSize = view.getUint8(0);
            if (headerSize !== 14 && headerSize !== 12) {
                console.error("Invalid FIT header size:", headerSize);
                return null;
            }

            const protocolVersion = view.getUint8(1);
            const profileVersion = view.getUint16(2, true);
            const dataSize = view.getUint32(4, true);

            // signature ".FIT" at bytes 8..11
            const signature = String.fromCharCode(
                view.getUint8(8),
                view.getUint8(9),
                view.getUint8(10),
                view.getUint8(11)
            );
            if (signature !== ".FIT") {
                console.error("Invalid FIT signature:", signature);
                return null;
            }

            // Optional: read header CRC if headerSize == 14 (not strictly needed to decode)
            // const headerCRC = (headerSize === 14) ? view.getUint16(12, true) : null;

            return {
                headerSize,
                protocolVersion,
                profileVersion,
                dataSize,
                dataOffset: headerSize,
                // headerCRC,
            };
        } catch (e) {
            console.error("Header parsing failed:", e);
            return null;
        }
    }

    /**
     * Parse records: definitions + data messages
     * Includes:
     *  - Normal vs. compressed timestamp headers
     *  - Developer data extension (definition flag + devFields)
     *  - Field Description (#206) and Developer Data ID (#207)
     */
    parseRecords(view, header) {
        const records = [];
        const meta = { file_id: null, sessions: 0, laps: 0 };

        let offset = header.dataOffset;
        const endOffset = header.dataOffset + header.dataSize;

        // Local message definitions: localId (0..15) => { globalMessageNumber, architecture, fields[], devFields[] }
        const localMessageTypes = new Map();

        // Timestamp accumulator for compressed timestamp headers
        let currentTimestamp = null;

        // Helper: read bounded UTF-8 string of given size (stop at first 0x00)
        const readString = (off, size) => {
            const bytes = new Uint8Array(view.buffer, off, size);
            const zero = bytes.indexOf(0);
            const slice = zero >= 0 ? bytes.slice(0, zero) : bytes;
            return new TextDecoder("utf-8").decode(slice);
        };

        // Helper: read a base-type value at offset
        const readValue = (off, normalizedBaseType, littleEndian) => {
            switch (normalizedBaseType) {
                case 0x00:
                    return view.getUint8(off); // enum (uint8)
                case 0x01:
                    return view.getInt8(off); // sint8
                case 0x02:
                    return view.getUint8(off); // uint8
                case 0x03:
                    return view.getInt16(off, littleEndian); // sint16
                case 0x04:
                    return view.getUint16(off, littleEndian); // uint16
                case 0x05:
                    return view.getInt32(off, littleEndian); // sint32
                case 0x06:
                    return view.getUint32(off, littleEndian); // uint32
                case 0x07:
                    /* string handled separately */ return null;
                case 0x08:
                    return view.getFloat32(off, littleEndian); // float32
                case 0x09:
                    return view.getFloat64(off, littleEndian); // float64
                case 0x0a:
                    return view.getUint8(off); // uint8z
                case 0x0b:
                    return view.getUint16(off, littleEndian); // uint16z
                case 0x0c:
                    return view.getUint32(off, littleEndian); // uint32z
                case 0x0d:
                    return view.getUint8(off); // byte
                case 0x0e:
                    try {
                        return view.getBigInt64(off, littleEndian);
                    } catch {
                        return null;
                    } // sint64
                case 0x0f:
                    try {
                        return view.getBigUint64(off, littleEndian);
                    } catch {
                        return null;
                    } // uint64/uint64z
                default:
                    return null;
            }
        };

        // Conversions
        const toDateFromFitSeconds = (sec) =>
            new Date(this.FIT_EPOCH_MS + Number(sec) * 1000);
        const semicirclesToDegrees = (s) => (Number(s) * 180) / 2147483648; // 2**31
        const toSpeedKmH = (raw) => Number(raw) * 1e-3 * 3.6; // mm/s -> m/s -> km/h
        const toAltitudeMeters = (raw, enhanced = false) => {
            const meters = Number(raw) / 5; // 0.2 m steps
            return enhanced ? meters : meters - 500;
        };

        while (offset < endOffset - 2) {
            // leave last 2 bytes for CRC
            if (offset >= view.byteLength) break;

            const recordHeader = view.getUint8(offset++);

            const isDefinition = (recordHeader & 0x40) !== 0;
            const isCompressed = (recordHeader & 0x80) !== 0;

            // --- Compressed timestamp header (bit 7 set)
            if (isCompressed) {
                // Bits 5-6: two-bit local message number, bits 0-4: 5-bit time offset (seconds)
                const localMessageType = (recordHeader >> 5) & 0x03;
                const timeOffset = recordHeader & 0x1f;

                const messageType = localMessageTypes.get(localMessageType);
                if (!messageType) {
                    // No definition available yet — cannot parse; skip
                    continue;
                }

                // Advance timestamp by offset (requires a prior explicit timestamp)
                if (currentTimestamp) {
                    currentTimestamp = new Date(
                        currentTimestamp.getTime() + timeOffset * 1000
                    );
                }

                // Parse data for this definition (same as the non-compressed data branch below)
                offset = this._parseDataMessage({
                    view,
                    offset,
                    messageType,
                    records,
                    currentTimestamp,
                    helpers: {
                        readValue,
                        readString,
                        toDateFromFitSeconds,
                        semicirclesToDegrees,
                        toSpeedKmH,
                        toAltitudeMeters,
                    },
                    RECORD_FIELDS: this.RECORD_FIELDS,
                });
                continue;
            }

            // --- Definition message
            if (isDefinition) {
                // Byte layout:
                // reserved (1), architecture (1), globalMessageNumber (2, endian per architecture),
                // numFields (1), then numFields * 3 bytes (fieldDef, size, baseType)
                if (offset + 5 > view.byteLength) break;

                const reserved = view.getUint8(offset);
                const architecture = view.getUint8(offset + 1); // 0 = little, 1 = big
                const littleEndian = architecture === 0;
                const globalMessageNumber = view.getUint16(
                    offset + 2,
                    littleEndian
                );
                const numFields = view.getUint8(offset + 4);
                offset += 5;

                const fields = [];
                for (let i = 0; i < numFields; i++) {
                    if (offset + 3 > view.byteLength) break;
                    const fieldDef = view.getUint8(offset);
                    const size = view.getUint8(offset + 1);
                    const baseType = view.getUint8(offset + 2); // unmasked (bit7 marks endian-capable types)
                    offset += 3;
                    fields.push({ fieldDef, size, baseType });
                }

                // FIT v2.0 developer data extension:
                // If header bit 0x20 set, next byte is num_dev_fields, followed by triples (id, size, devIdx)
                let devFields = [];
                if ((recordHeader & 0x20) !== 0) {
                    if (offset >= view.byteLength) break;
                    const numDevFields = view.getUint8(offset++);
                    devFields = [];
                    for (let i = 0; i < numDevFields; i++) {
                        if (offset + 3 > view.byteLength) break;
                        const devId = view.getUint8(offset + 0);
                        const devSize = view.getUint8(offset + 1);
                        const devIdx = view.getUint8(offset + 2);
                        offset += 3;
                        devFields.push({ devId, devSize, devIdx });
                    }
                }

                const localMessageType = recordHeader & 0x0f;
                localMessageTypes.set(localMessageType, {
                    globalMessageNumber,
                    architecture,
                    fields,
                    devFields,
                });

                // Track simple meta counts (optional)
                if (globalMessageNumber === this.MESSAGE_TYPES.FILE_ID)
                    meta.file_id = true;
                if (globalMessageNumber === this.MESSAGE_TYPES.SESSION)
                    meta.sessions += 1;
                if (globalMessageNumber === this.MESSAGE_TYPES.LAP)
                    meta.laps += 1;

                continue;
            }

            // --- Data message
            const localMessageType = recordHeader & 0x0f;
            const messageType = localMessageTypes.get(localMessageType);
            if (!messageType) {
                // Unknown local ID — skip
                continue;
            }

            // Special handling for field_description (#206) and developer_data_id (#207)
            if (
                messageType.globalMessageNumber ===
                this.MESSAGE_TYPES.FIELD_DESCRIPTION
            ) {
                // Typical fields (by ID): developer_data_index, field_definition_number, fit_base_type_id,
                // field_name (string), units (string). See FIT SDK / FitDataProtocol docs.
                const desc = {
                    devIdx: undefined,
                    fieldDefNum: undefined,
                    fitBaseType: undefined,
                    fieldName: "",
                    units: "",
                };

                for (const field of messageType.fields) {
                    if (offset + field.size > view.byteLength) break;

                    const baseTypeRaw = field.baseType;
                    const normalized = baseTypeRaw & 0x1f;
                    const littleEndian = messageType.architecture === 0;

                    let value;
                    if (normalized === 0x07) {
                        value = readString(offset, field.size);
                    } else {
                        value = readValue(offset, normalized, littleEndian);
                    }

                    // Known field IDs (commonly used in profile implementations)
                    switch (field.fieldDef) {
                        case 0:
                            desc.devIdx = value;
                            break; // developer_data_index
                        case 1:
                            desc.fieldDefNum = value;
                            break; // field_definition_number
                        case 2:
                            desc.fitBaseType = value;
                            break; // fit_base_type_id
                        case 3:
                            desc.fieldName = String(value || "");
                            break; // field_name
                        case 8:
                            desc.units = String(value || "");
                            break; // units
                        default:
                            /* ignore other sub-fields */ break;
                    }

                    offset += field.size;
                }

                if (desc.devIdx != null && desc.fieldDefNum != null) {
                    this.devFieldMeta.set(
                        `${desc.devIdx}:${desc.fieldDefNum}`,
                        {
                            name: desc.fieldName || `dev_${desc.fieldDefNum}`,
                            units: desc.units || "",
                            baseType: desc.fitBaseType,
                        }
                    );
                }
                continue;
            }

            if (
                messageType.globalMessageNumber ===
                this.MESSAGE_TYPES.DEVELOPER_DATA_ID
            ) {
                const info = {
                    devIdx: undefined,
                    developerId: null,
                    applicationId: null,
                    manufacturer: null,
                    applicationVersion: null,
                };

                for (const field of messageType.fields) {
                    if (offset + field.size > view.byteLength) break;

                    const baseTypeRaw = field.baseType;
                    const normalized = baseTypeRaw & 0x1f;
                    const littleEndian = messageType.architecture === 0;

                    let value;
                    if (normalized === 0x07) {
                        value = readString(offset, field.size);
                    } else {
                        value = readValue(offset, normalized, littleEndian);
                    }

                    // Common IDs seen in libraries:
                    // 0 developer_id (bytes), 1 application_id (bytes), 2 manufacturer, 3 data_index, 4 application_version
                    switch (field.fieldDef) {
                        case 0:
                            info.developerId = value;
                            break;
                        case 1:
                            info.applicationId = value;
                            break;
                        case 2:
                            info.manufacturer = value;
                            break;
                        case 3:
                            info.devIdx = value;
                            break; // developer_data_index
                        case 4:
                            info.applicationVersion = value;
                            break;
                        default:
                            break;
                    }

                    offset += field.size;
                }

                if (info.devIdx != null)
                    this.devIndexMeta.set(info.devIdx, info);
                continue;
            }

            // Regular data messages (record/session/lap/etc.)
            offset = this._parseDataMessage({
                view,
                offset,
                messageType,
                records,
                currentTimestamp,
                helpers: {
                    readValue,
                    readString,
                    toDateFromFitSeconds,
                    semicirclesToDegrees,
                    toSpeedKmH,
                    toAltitudeMeters,
                },
                RECORD_FIELDS: this.RECORD_FIELDS,
            });

            // Keep last explicit timestamp for compressed headers
            const last = records.length ? records[records.length - 1] : null;
            if (last?.timestamp) currentTimestamp = last.timestamp;
        }

        // Optional CRC validation (FIT CRC is 2 bytes at end of file)
        // const fileCRC = view.getUint16(endOffset, true);
        // const computedCRC = this._computeFitCRC(view, header.dataOffset, header.dataSize);
        // if (computedCRC !== fileCRC) console.warn('CRC mismatch:', { computedCRC, fileCRC });

        return { records, meta };
    }

    /**
     * Internal: parse one data message at current offset; returns new offset.
     * Applies unit conversions & developer field values for RECORD messages.
     */
    _parseDataMessage({
        view,
        offset,
        messageType,
        records,
        currentTimestamp,
        helpers,
        RECORD_FIELDS,
    }) {
        const {
            readValue,
            readString,
            toDateFromFitSeconds,
            semicirclesToDegrees,
            toSpeedKmH,
            toAltitudeMeters,
        } = helpers;
        const littleEndian = messageType.architecture === 0;

        if (messageType.globalMessageNumber === 20 /* RECORD */) {
            const record = {};

            for (const field of messageType.fields) {
                if (offset + field.size > view.byteLength) break;

                const baseTypeRaw = field.baseType;
                const normalized = baseTypeRaw & 0x1f;

                let value;
                if (normalized === 0x07) {
                    value = readString(offset, field.size);
                } else {
                    value = readValue(offset, normalized, littleEndian);
                }

                const fieldId = field.fieldDef;
                const fieldName = RECORD_FIELDS[fieldId];

                // Filter obvious invalids (FIT invalid placeholders)
                const invalids = [0xff, 0xffff, 0xffffffff];
                const isValid =
                    value != null && !invalids.includes(Number(value));

                if (fieldName && isValid) {
                    if (fieldName === "timestamp") {
                        const dt = toDateFromFitSeconds(value);
                        record.timestamp = dt;
                    } else if (fieldName === "position_lat") {
                        record.lat = semicirclesToDegrees(value);
                    } else if (fieldName === "position_long") {
                        record.lon = semicirclesToDegrees(value);
                    } else if (fieldName === "enhanced_speed") {
                        record.speed = toSpeedKmH(value);
                    } else if (fieldName === "speed") {
                        // Keep as fallback if enhanced_speed absent
                        record.speed ??= toSpeedKmH(value);
                    } else if (fieldName === "enhanced_altitude") {
                        record.altitude = toAltitudeMeters(value, true);
                    } else if (fieldName === "altitude") {
                        record.altitude ??= toAltitudeMeters(value, false);
                    } else {
                        record[fieldName] =
                            typeof value === "bigint" ? Number(value) : value;
                    }
                }

                offset += field.size;
            }

            // Developer fields (if present in the definition)
            if (messageType.devFields && messageType.devFields.length) {
                for (const dev of messageType.devFields) {
                    if (offset + dev.devSize > view.byteLength) break;

                    let value;
                    // Read as integer or string; there’s no explicit base type in dev definition,
                    // but most are small integers or strings. We’ll treat length > 4 as string.
                    if (dev.devSize === 1) value = view.getUint8(offset);
                    else if (dev.devSize === 2)
                        value = view.getUint16(offset, littleEndian);
                    else if (dev.devSize === 4)
                        value = view.getUint32(offset, littleEndian);
                    else value = readString(offset, dev.devSize);

                    offset += dev.devSize;

                    const meta = this.devFieldMeta.get(
                        `${dev.devIdx}:${dev.devId}`
                    );
                    const key = meta?.name || `dev_${dev.devIdx}_${dev.devId}`;
                    record[key] = value;
                }
            }

            // If record has no explicit timestamp, use compressed-header timestamp (if we have it)
            if (!record.timestamp && currentTimestamp) {
                record.timestamp = currentTimestamp;
            }

            if (Object.keys(record).length) records.push(record);
            return offset;
        }

        // Non-record messages: fast-forward over bytes (or decode if you need more)
        for (const field of messageType.fields) {
            if (offset + field.size > view.byteLength) break;
            offset += field.size;
        }
        // Note: Developer fields may also attach to other messages (session/lap).
        if (messageType.devFields && messageType.devFields.length) {
            for (const dev of messageType.devFields) {
                if (offset + dev.devSize > view.byteLength) break;
                offset += dev.devSize;
            }
        }
        return offset;
    }

    /**
     * Extract streams (HR, power, cadence, speed) with timestamps.
     * Performs simple interpolation to fill short gaps.
     */
    extractStreams(records) {
        const heartrate = [];
        const power = [];
        const cadence = [];
        const speed = [];
        const timeSec = [];

        let t0 = null;

        for (const r of records) {
            if (!r.timestamp) continue;
            if (!t0) t0 = r.timestamp;
            const dt = Math.floor((r.timestamp - t0) / 1000);
            timeSec.push(dt);

            heartrate.push(
                r.heart_rate != null && r.heart_rate > 0 && r.heart_rate < 250
                    ? r.heart_rate
                    : null
            );
            power.push(
                r.power != null && r.power >= 0 && r.power < 2000
                    ? r.power
                    : null
            );
            cadence.push(
                r.cadence != null && r.cadence >= 0 && r.cadence < 255
                    ? r.cadence
                    : null
            );
            speed.push(r.speed != null && r.speed >= 0 ? r.speed : null);
        }

        if (timeSec.length === 0) return null;

        // Interpolate short gaps (linear)
        const interp = (arr) => {
            for (let i = 0; i < arr.length; i++) {
                if (arr[i] === null) {
                    let p = i - 1;
                    while (p >= 0 && arr[p] === null) p--;
                    let n = i + 1;
                    while (n < arr.length && arr[n] === null) n++;
                    if (p >= 0 && n < arr.length) {
                        const step = (arr[n] - arr[p]) / (n - p);
                        arr[i] = arr[p] + step * (i - p);
                    } else if (p >= 0) {
                        arr[i] = arr[p];
                    } else if (n < arr.length) {
                        arr[i] = arr[n];
                    }
                }
            }
        };
        interp(heartrate);
        interp(power);
        interp(cadence);
        interp(speed);

        const filterValid = (data, time, fn) => {
            const out = [];
            const tt = [];
            data.forEach((v, i) => {
                if (fn(v)) {
                    out.push(v);
                    tt.push(time[i]);
                }
            });
            return { data: out, time: tt };
        };

        const result = {};

        const hr = filterValid(heartrate, timeSec, (v) => v != null && v > 0);
        if (hr.data.length) {
            result.hrStream = { heartrate: hr.data, time: hr.time };
            const hrVals = hr.data.filter((x) => x > 0);
            if (hrVals.length) {
                result.avgHR = Math.round(
                    hrVals.reduce((s, x) => s + x, 0) / hrVals.length
                );
                result.maxHR = Math.round(Math.max(...hrVals));
            }
        }

        const pw = filterValid(power, timeSec, (v) => v != null && v >= 0);
        if (pw.data.length) {
            result.powerStream = { watts: pw.data, time: pw.time };
            const pv = pw.data.filter((x) => x > 0);
            if (pv.length) {
                result.avgPower = Math.round(
                    pv.reduce((s, x) => s + x, 0) / pv.length
                );
                result.maxPower = Math.round(Math.max(...pv));
            }
        }

        const cd = filterValid(cadence, timeSec, (v) => v != null && v > 0);
        if (cd.data.length) {
            result.cadenceStream = { cadence: cd.data, time: cd.time };
            const cv = cd.data.filter((x) => x > 0);
            if (cv.length)
                result.avgCadence = Math.round(
                    cv.reduce((s, x) => s + x, 0) / cv.length
                );
        }

        const sp = filterValid(speed, timeSec, (v) => v != null && v >= 0);
        if (sp.data.length) {
            result.speedStream = { speed: sp.data, time: sp.time }; // km/h
        }

        return Object.keys(result).length ? result : null;
    }

    /**
     * (Optional) FIT CRC16 calculation — if you want integrity checks.
     * FIT uses a table-based CRC; you can implement it here if needed.
     * For brevity, this is left as a stub.
     */
    _computeFitCRC(_view, _start, _length) {
        // Implement Garmin FIT CRC if you need strict validation.
        // See SDK Decode.checkIntegrity() for behavior. [2](https://libraries.io/pypi/garmin-fit-sdk)
        return null;
    }
}

// Expose as a singleton for quick testing (like your original)
window.fitParser = new FITParser();

/**
 * Example usage in the browser:
 *
 * <input type="file" id="fitFile" accept=".fit" />
 * <pre id="out"></pre>
 *
 * const input = document.getElementById('fitFile');
 * const out   = document.getElementById('out');
 * input.addEventListener('change', async () => {
 *   const file = input.files?.[0];
 *   if (!file) return;
 *   const buf = await file.arrayBuffer();
 *   const result = window.fitParser.parse(buf);
 *   out.textContent = JSON.stringify(result?.streams ?? result, null, 2);
 * });
 */
