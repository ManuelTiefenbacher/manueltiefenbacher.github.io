// js/data-sources/tcxParser.js
// TCX file parsing with interpolation

class TCXParser {
  /**
   * Parse TCX XML text and extract HR data
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
      const time = [];
      let startTime = null;
      
      // Extract HR and time data
      for (let tp of trackpoints) {
        const timeEl = tp.getElementsByTagName('Time')[0];
        const hrEl = tp.getElementsByTagName('Value')[0];
        
        if (timeEl && hrEl) {
          const timestamp = new Date(timeEl.textContent);
          const hr = parseInt(hrEl.textContent);
          
          // Set start time from first trackpoint
          if (startTime === null) {
            startTime = timestamp;
          }
          
          // Calculate elapsed seconds from start
          const elapsedSeconds = Math.floor((timestamp - startTime) / 1000);
          
          // Validate HR value
          if (hr > 0 && hr < 250) {
            heartrate.push(hr);
            time.push(elapsedSeconds);
          } else {
            // Record missing data point for interpolation
            heartrate.push(null);
            time.push(elapsedSeconds);
          }
        }
      }
      
      // Interpolate missing values
      if (heartrate.length > 0) {
        this.interpolateHeartRate(heartrate);
        
        // Filter out any remaining null values
        const validIndices = heartrate
          .map((hr, i) => hr !== null ? i : -1)
          .filter(i => i !== -1);
        
        const validHeartrate = validIndices.map(i => heartrate[i]);
        const validTime = validIndices.map(i => time[i]);
        
        if (validHeartrate.length > 0) {
          return {
            hrStream: {
              heartrate: validHeartrate,
              time: validTime
            }
          };
        }
      }
      
      return null;
    } catch (e) {
      console.error('TCX parse error:', e);
      return null;
    }
  }

  /**
   * Interpolate missing heart rate values
   */
  interpolateHeartRate(hrArray) {
    for (let i = 0; i < hrArray.length; i++) {
      if (hrArray[i] === null) {
        // Find previous valid value
        let prevIndex = i - 1;
        while (prevIndex >= 0 && hrArray[prevIndex] === null) {
          prevIndex--;
        }
        
        // Find next valid value
        let nextIndex = i + 1;
        while (nextIndex < hrArray.length && hrArray[nextIndex] === null) {
          nextIndex++;
        }
        
        // Interpolate if we have both previous and next values
        if (prevIndex >= 0 && nextIndex < hrArray.length) {
          const prevHR = hrArray[prevIndex];
          const nextHR = hrArray[nextIndex];
          const steps = nextIndex - prevIndex;
          const step = i - prevIndex;
          
          hrArray[i] = Math.round(prevHR + (nextHR - prevHR) * (step / steps));
        }
        // If only previous value exists, use it
        else if (prevIndex >= 0) {
          hrArray[i] = hrArray[prevIndex];
        }
        // If only next value exists, use it
        else if (nextIndex < hrArray.length) {
          hrArray[i] = hrArray[nextIndex];
        }
      }
    }
  }
}

// Initialize and export singleton
window.tcxParser = new TCXParser();