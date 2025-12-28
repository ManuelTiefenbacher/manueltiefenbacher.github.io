// js/data-sources/tcxParser.js
// TCX file parsing with interpolation and pace extraction

class TCXParser {
  /**
   * Parse TCX XML text and extract HR and pace data
   */
  parse(tcxText) {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(tcxText, 'text/xml');
      
      // Check for parse errors
      const parseError = doc.querySelector('parsererror');
      if (parseError) {
        console.error('XML parse error:', parseError.textContent);
        return null;
      }
      
      const trackpoints = doc.getElementsByTagName('Trackpoint');
      const heartrate = [];
      const pace = [];
      const time = [];
      let startTime = null;
      let lastPosition = null;
      let lastTime = null;
      
      // Extract HR, pace and time data
      for (let tp of trackpoints) {
        const timeEl = tp.getElementsByTagName('Time')[0];
        const hrEl = tp.getElementsByTagName('Value')[0];
        const positionEl = tp.getElementsByTagName('Position')[0];
        
        if (timeEl) {
          const timestamp = new Date(timeEl.textContent);
          
          // Set start time from first trackpoint
          if (startTime === null) {
            startTime = timestamp;
          }
          
          // Calculate elapsed seconds from start
          const elapsedSeconds = Math.floor((timestamp - startTime) / 1000);
          
          // HR value
          let hr = null;
          if (hrEl) {
            hr = parseInt(hrEl.textContent);
            if (hr > 0 && hr < 250) {
              heartrate.push(hr);
            } else {
              heartrate.push(null);
            }
          } else {
            heartrate.push(null);
          }
          
          // Calculate pace from position changes
          let currentPace = null;
          if (positionEl && lastPosition && lastTime) {
            const latEl = positionEl.getElementsByTagName('LatitudeDegrees')[0];
            const lonEl = positionEl.getElementsByTagName('LongitudeDegrees')[0];
            
            if (latEl && lonEl) {
              const lat = parseFloat(latEl.textContent);
              const lon = parseFloat(lonEl.textContent);
              
              // Calculate distance using Haversine formula
              const distance = this.calculateDistance(
                lastPosition.lat, lastPosition.lon,
                lat, lon
              );
              
              const timeDiff = (timestamp - lastTime) / 1000; // seconds
              
              if (distance > 0 && timeDiff > 0) {
                // Speed in m/s
                const speed = distance / timeDiff;
                // Pace in min/km = 1000 / (speed * 60)
                currentPace = speed > 0 ? 16.667 / speed : null;
              }
              
              lastPosition = { lat, lon };
              lastTime = timestamp;
            }
          } else if (positionEl) {
            // Initialize position
            const latEl = positionEl.getElementsByTagName('LatitudeDegrees')[0];
            const lonEl = positionEl.getElementsByTagName('LongitudeDegrees')[0];
            
            if (latEl && lonEl) {
              lastPosition = {
                lat: parseFloat(latEl.textContent),
                lon: parseFloat(lonEl.textContent)
              };
              lastTime = timestamp;
            }
          }
          
          pace.push(currentPace);
          time.push(elapsedSeconds);
        }
      }
      
      // Interpolate missing values
      if (heartrate.length > 0) {
        this.interpolateValues(heartrate);
      }
      
      if (pace.length > 0) {
        this.interpolateValues(pace);
      }
      
      // Filter out any remaining null values
      const validIndices = [];
      for (let i = 0; i < heartrate.length; i++) {
        if ((heartrate[i] !== null || pace[i] !== null)) {
          validIndices.push(i);
        }
      }
      
      const result = {};
      
      // HR Stream
      const validHeartrate = validIndices.map(i => heartrate[i]).filter(hr => hr !== null);
      const validHRTime = validIndices.map(i => time[i]);
      
      if (validHeartrate.length > 0) {
        result.hrStream = {
          heartrate: validHeartrate,
          time: validHRTime
        };
      }
      
      // Pace Stream
      const validPace = validIndices.map(i => pace[i]).filter(p => p !== null && p > 0 && p < 20);
      const validPaceTime = validIndices.map(i => time[i]);
      
      if (validPace.length > 0) {
        result.paceStream = {
          pace: validPace,
          time: validPaceTime
        };
      }
      
      return Object.keys(result).length > 0 ? result : null;
    } catch (e) {
      console.error('TCX parse error:', e);
      return null;
    }
  }

  /**
   * Calculate distance between two GPS coordinates using Haversine formula
   * Returns distance in meters
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Earth's radius in meters
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Convert degrees to radians
   */
  toRadians(degrees) {
    return degrees * Math.PI / 180;
  }

  /**
   * Interpolate missing values in an array
   */
  interpolateValues(array) {
    for (let i = 0; i < array.length; i++) {
      if (array[i] === null) {
        // Find previous valid value
        let prevIndex = i - 1;
        while (prevIndex >= 0 && array[prevIndex] === null) {
          prevIndex--;
        }
        
        // Find next valid value
        let nextIndex = i + 1;
        while (nextIndex < array.length && array[nextIndex] === null) {
          nextIndex++;
        }
        
        // Interpolate if we have both previous and next values
        if (prevIndex >= 0 && nextIndex < array.length) {
          const prevVal = array[prevIndex];
          const nextVal = array[nextIndex];
          const steps = nextIndex - prevIndex;
          const step = i - prevIndex;
          
          array[i] = prevVal + (nextVal - prevVal) * (step / steps);
        }
        // If only previous value exists, use it
        else if (prevIndex >= 0) {
          array[i] = array[prevIndex];
        }
        // If only next value exists, use it
        else if (nextIndex < array.length) {
          array[i] = array[nextIndex];
        }
      }
    }
  }
}

// Initialize and export singleton
window.tcxParser = new TCXParser();