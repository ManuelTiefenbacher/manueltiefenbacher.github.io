// js/data-sources/fitParser.js
// FIT file parsing - self-contained, no external dependencies
// Based on FIT SDK specifications

class FITParser {
    constructor() {
        console.log('FIT Parser initialized (self-contained)');
        
        // FIT message types we care about
        this.MESSAGE_TYPES = {
            FILE_ID: 0,
            SESSION: 18,
            LAP: 19,
            RECORD: 20,
            EVENT: 21,
            DEVICE_INFO: 23
        };
        
        // Field definitions for RECORD messages (the data we want)
        this.RECORD_FIELDS = {
            253: 'timestamp',
            0: 'position_lat',
            1: 'position_long',
            2: 'altitude',
            3: 'heart_rate',
            4: 'cadence',
            5: 'distance',
            6: 'speed',
            7: 'power',
            13: 'temperature',
            29: 'accumulated_power',
            73: 'enhanced_speed',
            78: 'enhanced_altitude'
        };
        
        console.log('FIT field definitions loaded:', Object.keys(this.RECORD_FIELDS).length, 'fields');
    }

    /**
     * Parse FIT file binary data
     */
    parse(arrayBuffer) {
        try {
            if (!arrayBuffer || arrayBuffer.byteLength === 0) {
                console.error('Empty FIT file');
                return null;
            }

            console.log(`Parsing FIT file (${arrayBuffer.byteLength} bytes)`);
            
            const view = new DataView(arrayBuffer);
            
            // Parse FIT header
            const header = this.parseHeader(view);
            if (!header) {
                return null;
            }

            console.log(`FIT header: protocol ${header.protocolVersion}, profile ${header.profileVersion}`);

            // Parse records
            const records = this.parseRecords(view, header);
            
            if (!records || records.length === 0) {
                console.warn('No records found in FIT file');
                return null;
            }

            console.log(`Extracted ${records.length} records`);
            
            return this.extractStreams(records);

        } catch (e) {
            console.error('FIT parsing failed:', e);
            return null;
        }
    }

    /**
     * Parse FIT file header
     */
    parseHeader(view) {
        try {
            const headerSize = view.getUint8(0);
            if (headerSize !== 14 && headerSize !== 12) {
                console.error('Invalid FIT header size:', headerSize);
                return null;
            }

            const protocolVersion = view.getUint8(1);
            const profileVersion = view.getUint16(2, true);
            const dataSize = view.getUint32(4, true);
            
            const signature = String.fromCharCode(
                view.getUint8(8),
                view.getUint8(9),
                view.getUint8(10),
                view.getUint8(11)
            );
            
            if (signature !== '.FIT') {
                console.error('Invalid FIT signature:', signature);
                return null;
            }

            return {
                headerSize,
                protocolVersion,
                profileVersion,
                dataSize,
                dataOffset: headerSize
            };

        } catch (e) {
            console.error('Header parsing failed:', e);
            return null;
        }
    }

    /**
     * Parse FIT records (simplified - extracts basic data)
     */
    parseRecords(view, header) {
        const records = [];
        let offset = header.dataOffset;
        const endOffset = header.dataOffset + header.dataSize;
        
        const localMessageTypes = new Map();
        
        try {
            while (offset < endOffset - 2) {
                // Bounds check
                if (offset >= view.byteLength) {
                    break;
                }
                
                const recordHeader = view.getUint8(offset);
                offset++;

                // Check if it's a definition or data message
                const isDefinition = (recordHeader & 0x40) !== 0;
                const localMessageType = recordHeader & 0x0F;

                if (isDefinition) {
                    // Bounds check for definition header
                    if (offset + 5 > view.byteLength) {
                        break;
                    }
                    
                    // Definition message - store the field definitions
                    const reserved = view.getUint8(offset);
                    const architecture = view.getUint8(offset + 1);
                    const globalMessageNumber = view.getUint16(offset + 2, architecture === 0);
                    const numFields = view.getUint8(offset + 4);
                    
                    offset += 5;
                    
                    const fields = [];
                    for (let i = 0; i < numFields; i++) {
                        // Bounds check for field definition
                        if (offset + 3 > view.byteLength) {
                            break;
                        }
                        
                        const fieldDef = view.getUint8(offset);
                        const size = view.getUint8(offset + 1);
                        const baseType = view.getUint8(offset + 2);
                        offset += 3;
                        
                        fields.push({ fieldDef, size, baseType });
                    }
                    
                    // Debug: log field IDs for RECORD messages
                    if (globalMessageNumber === 20 && localMessageTypes.size === 0) {
                        console.log(`RECORD message definition found with ${fields.length} fields:`);
                        console.log('Field IDs:', fields.map(f => `${f.fieldDef} (${this.RECORD_FIELDS[f.fieldDef] || 'unknown'})`).join(', '));
                    }
                    
                    localMessageTypes.set(localMessageType, {
                        globalMessageNumber,
                        architecture,
                        fields
                    });
                    
                } else {
                    // Data message
                    const messageType = localMessageTypes.get(localMessageType);
                    
                    if (!messageType) {
                        // Unknown message type, skip
                        continue;
                    }
                    
                    // Debug: log message types we're seeing
                    if (records.length === 0) {
                        console.log(`First data message: type ${messageType.globalMessageNumber}, ${messageType.fields.length} fields`);
                    }
                    
                    // Only parse RECORD messages (type 20)
                    if (messageType.globalMessageNumber === 20) {
                        const record = {};
                        let isFirstRecord = records.length === 0;
                        
                        for (const field of messageType.fields) {
                            // Bounds check before reading field
                            if (offset + field.size > view.byteLength) {
                                console.warn(`Skipping field at offset ${offset}, would exceed bounds`);
                                break;
                            }
                            
                            const fieldId = field.fieldDef;
                            const fieldName = this.RECORD_FIELDS[fieldId];
                            
                            let value = null;
                            
                            // Parse based on base type
                            const baseType = field.baseType & 0x1F;
                            
                            try {
                                if (baseType === 0x00) { // enum
                                    value = view.getUint8(offset);
                                } else if (baseType === 0x01) { // sint8
                                    value = view.getInt8(offset);
                                } else if (baseType === 0x02) { // uint8
                                    value = view.getUint8(offset);
                                } else if (baseType === 0x83) { // sint16
                                    value = view.getInt16(offset, messageType.architecture === 0);
                                } else if (baseType === 0x84) { // uint16
                                    value = view.getUint16(offset, messageType.architecture === 0);
                                } else if (baseType === 0x85) { // sint32
                                    value = view.getInt32(offset, messageType.architecture === 0);
                                } else if (baseType === 0x86) { // uint32
                                    value = view.getUint32(offset, messageType.architecture === 0);
                                } else if (baseType === 0x88) { // float32
                                    value = view.getFloat32(offset, messageType.architecture === 0);
                                } else {
                                    // Unknown type, read as bytes
                                    value = null;
                                }
                                
                                // Debug: log ALL fields with values in first record
                                if (isFirstRecord && value !== null && value !== 0xFF && value !== 0xFFFF && value !== 0xFFFFFFFF && value !== 0) {
                                    console.log(`Field ID ${fieldId} (${fieldName || 'unknown'}): ${value}, baseType: 0x${baseType.toString(16)}, size: ${field.size}`);
                                }
                                
                                // Store field if we know what it is
                                if (fieldName && value !== null && value !== 0xFF && value !== 0xFFFF && value !== 0xFFFFFFFF) {
                                    // Convert timestamp
                                    if (fieldName === 'timestamp') {
                                        // FIT timestamp is seconds since UTC 00:00 Dec 31 1989
                                        const fitEpoch = new Date('1989-12-31T00:00:00Z').getTime();
                                        record[fieldName] = new Date(fitEpoch + value * 1000);
                                    } else if (fieldName === 'speed' || fieldName === 'enhanced_speed') {
                                        record.speed = value / 1000 * 3.6; // m/s to km/h
                                    } else {
                                        record[fieldName] = value;
                                    }
                                }
                            } catch (e) {
                                // Skip invalid field
                            }
                            
                            offset += field.size;
                        }
                        
                        if (Object.keys(record).length > 0) {
                            records.push(record);
                        }
                    } else {
                        // Skip other message types
                        for (const field of messageType.fields) {
                            // Bounds check
                            if (offset + field.size > view.byteLength) {
                                break;
                            }
                            offset += field.size;
                        }
                    }
                }
            }
        } catch (e) {
            console.warn('Stopped parsing at offset', offset, '- extracted', records.length, 'records');
        }
        
        return records;
    }

    /**
     * Extract power, HR, and other streams from records
     */
    extractStreams(records) {
        const heartrate = [];
        const power = [];
        const cadence = [];
        const speed = [];
        const time = [];
        
        let startTime = null;

        records.forEach((record) => {
            if (!record.timestamp) {
                return;
            }

            if (!startTime) {
                startTime = record.timestamp;
            }

            const elapsedSeconds = Math.floor((record.timestamp - startTime) / 1000);
            time.push(elapsedSeconds);

            // Heart Rate
            heartrate.push(
                record.heart_rate !== undefined && record.heart_rate > 0 && record.heart_rate < 250
                    ? record.heart_rate
                    : null
            );

            // Power
            power.push(
                record.power !== undefined && record.power >= 0 && record.power < 2000
                    ? record.power
                    : null
            );

            // Cadence
            cadence.push(
                record.cadence !== undefined && record.cadence >= 0 && record.cadence < 255
                    ? record.cadence
                    : null
            );

            // Speed
            speed.push(
                record.speed !== undefined && record.speed >= 0
                    ? record.speed
                    : null
            );
        });

        if (time.length === 0) {
            return null;
        }

        // Interpolate missing values
        this.interpolateValues(heartrate);
        this.interpolateValues(power);
        this.interpolateValues(cadence);
        this.interpolateValues(speed);

        const result = {};

        // HR Stream
        const validHR = this.filterValidData(heartrate, time, (hr) => hr !== null && hr > 0);
        if (validHR.data.length > 0) {
            result.hrStream = {
                heartrate: validHR.data,
                time: validHR.time,
            };
            console.log(`✓ Extracted ${validHR.data.length} HR data points`);
        }

        // Power Stream
        const validPower = this.filterValidData(power, time, (w) => w !== null && w >= 0);
        if (validPower.data.length > 0) {
            result.powerStream = {
                watts: validPower.data,
                time: validPower.time,
            };
            
            const powerValues = validPower.data.filter(w => w > 0);
            if (powerValues.length > 0) {
                result.avgPower = Math.round(powerValues.reduce((sum, w) => sum + w, 0) / powerValues.length);
                result.maxPower = Math.round(Math.max(...powerValues));
                console.log(`✓ Extracted ${validPower.data.length} power data points (avg: ${result.avgPower}W, max: ${result.maxPower}W)`);
            }
        }

        // Cadence Stream
        const validCadence = this.filterValidData(cadence, time, (c) => c !== null && c > 0);
        if (validCadence.data.length > 0) {
            result.cadenceStream = {
                cadence: validCadence.data,
                time: validCadence.time,
            };
            
            const cadenceValues = validCadence.data.filter(c => c > 0);
            if (cadenceValues.length > 0) {
                result.avgCadence = Math.round(cadenceValues.reduce((sum, c) => sum + c, 0) / cadenceValues.length);
                console.log(`✓ Extracted ${validCadence.data.length} cadence data points (avg: ${result.avgCadence} rpm)`);
            }
        }

        // Speed Stream
        const validSpeed = this.filterValidData(speed, time, (s) => s !== null && s >= 0);
        if (validSpeed.data.length > 0) {
            result.speedStream = {
                speed: validSpeed.data,
                time: validSpeed.time,
            };
            console.log(`✓ Extracted ${validSpeed.data.length} speed data points`);
        }

        return Object.keys(result).length > 0 ? result : null;
    }

    filterValidData(dataArray, timeArray, validationFn) {
        const filtered = dataArray
            .map((value, i) => ({ value, time: timeArray[i] }))
            .filter(item => validationFn(item.value));

        return {
            data: filtered.map(item => item.value),
            time: filtered.map(item => item.time),
        };
    }

    interpolateValues(array) {
        for (let i = 0; i < array.length; i++) {
            if (array[i] === null) {
                let prevIndex = i - 1;
                while (prevIndex >= 0 && array[prevIndex] === null) {
                    prevIndex--;
                }

                let nextIndex = i + 1;
                while (nextIndex < array.length && array[nextIndex] === null) {
                    nextIndex++;
                }

                if (prevIndex >= 0 && nextIndex < array.length) {
                    const prevVal = array[prevIndex];
                    const nextVal = array[nextIndex];
                    const steps = nextIndex - prevIndex;
                    const step = i - prevIndex;
                    array[i] = prevVal + (nextVal - prevVal) * (step / steps);
                } else if (prevIndex >= 0) {
                    array[i] = array[prevIndex];
                } else if (nextIndex < array.length) {
                    array[i] = array[nextIndex];
                }
            }
        }
    }
}

// Initialize and export singleton
window.fitParser = new FITParser();