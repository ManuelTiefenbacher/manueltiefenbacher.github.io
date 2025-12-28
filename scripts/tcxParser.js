// Parse TCX file for heart rate data with interpolation
function parseTcxFile(xmlText) {
  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, "text/xml");
    
    // Check for parse errors
    const parseError = xmlDoc.querySelector('parsererror');
    if (parseError) {
      console.error('XML parse error:', parseError.textContent);
      return null;
    }
    
    // Get all Trackpoint elements (they contain heart rate and time data)
    const trackpoints = xmlDoc.querySelectorAll('Trackpoint');
    const hrRecords = [];
    
    trackpoints.forEach((tp, index) => {
      const hrElement = tp.querySelector('HeartRateBpm Value');
      const timeElement = tp.querySelector('Time');
      
      if (hrElement && timeElement) {
        const hr = parseInt(hrElement.textContent);
        const time = new Date(timeElement.textContent);
        
        if (hr > 0 && hr < 250) {
          hrRecords.push({ 
            heart_rate: hr, 
            time: time,
            index: index 
          });
        } else if (timeElement) {
          // Record missing HR data point for interpolation
          hrRecords.push({ 
            heart_rate: null, 
            time: time,
            index: index 
          });
        }
      }
    });
    
    // Interpolate missing heart rate values
    if (hrRecords.length > 0) {
      interpolateHeartRate(hrRecords);
      
      // Filter out any remaining null values (at start/end)
      const validRecords = hrRecords.filter(r => r.heart_rate !== null);
      
      if (validRecords.length > 0) {
        return { records: validRecords };
      }
    }
    
    return null;
  } catch (e) {
    console.error('Error parsing TCX:', e);
    return null;
  }
}

// Interpolate missing heart rate values
function interpolateHeartRate(records) {
  for (let i = 0; i < records.length; i++) {
    if (records[i].heart_rate === null) {
      // Find previous valid value
      let prevIndex = i - 1;
      while (prevIndex >= 0 && records[prevIndex].heart_rate === null) {
        prevIndex--;
      }
      
      // Find next valid value
      let nextIndex = i + 1;
      while (nextIndex < records.length && records[nextIndex].heart_rate === null) {
        nextIndex++;
      }
      
      // Interpolate if we have both previous and next values
      if (prevIndex >= 0 && nextIndex < records.length) {
        const prevHR = records[prevIndex].heart_rate;
        const nextHR = records[nextIndex].heart_rate;
        const steps = nextIndex - prevIndex;
        const step = (nextIndex - prevIndex === 0) ? 0 : (i - prevIndex);
        
        records[i].heart_rate = Math.round(prevHR + (nextHR - prevHR) * (step / steps));
      }
      // If only previous value exists, use it
      else if (prevIndex >= 0) {
        records[i].heart_rate = records[prevIndex].heart_rate;
      }
      // If only next value exists, use it
      else if (nextIndex < records.length) {
        records[i].heart_rate = records[nextIndex].heart_rate;
      }
    }
  }
}