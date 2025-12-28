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
    const code = urlParams.get('code');
    const error = urlParams.get('error');
    
    if (window.opener && (code || error)) {
      window.opener.postMessage({
        type: 'strava-auth',
        code: code,
        error: error
      }, window.location.origin);
      window.close();
      return;
    }
    
    // Restore saved token
    this.accessToken = window.storageManager.loadStravaToken();
    if (this.accessToken) {
      this.showRequestButton();
    }
    
    // Listen for OAuth callback
    window.addEventListener('message', this.handleAuthMessage.bind(this));
  }

  /**
   * Start OAuth flow
   */
  initiateAuth() {
    this.clientId = document.getElementById('clientId').value.trim();
    this.clientSecret = document.getElementById('clientSecret').value.trim();
    
    if (!this.clientId || !this.clientSecret) {
      window.feedbackManager.showError('Please enter both Client ID and Client Secret');
      return;
    }
    
    // Store credentials temporarily
    sessionStorage.setItem('stravaClientId', this.clientId);
    sessionStorage.setItem('stravaClientSecret', this.clientSecret);
    
    const redirectUri = window.location.origin + window.location.pathname;
    const scope = 'read,activity:read_all,profile:read_all';
    const authUrl = `https://www.strava.com/oauth/authorize?client_id=${this.clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&approval_prompt=force&scope=${scope}`;
    
    // Open popup
    const width = 600;
    const height = 700;
    const left = (screen.width / 2) - (width / 2);
    const top = (screen.height / 2) - (height / 2);
    
    const popup = window.open(
      authUrl,
      'Strava Authorization',
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
    );
    
    if (!popup || popup.closed || typeof popup.closed === 'undefined') {
      window.feedbackManager.showError('Popup was blocked! Please allow popups for this site.');
    }
  }

  /**
   * Handle OAuth callback message
   */
  handleAuthMessage(event) {
    if (event.data && event.data.type === 'strava-auth') {
      if (event.data.code) {
        this.exchangeToken(event.data.code);
      } else if (event.data.error) {
        window.feedbackManager.showError('Authorization denied or failed');
      }
    }
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeToken(code) {
    this.clientId = sessionStorage.getItem('stravaClientId');
    this.clientSecret = sessionStorage.getItem('stravaClientSecret');
    
    if (!this.clientId || !this.clientSecret) {
      window.feedbackManager.showError('Missing credentials. Please try again.');
      return;
    }
    
    try {
      const response = await fetch('https://www.strava.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          code: code,
          grant_type: 'authorization_code'
        })
      });
      
      const data = await response.json();
      
      if (data.access_token) {
        this.accessToken = data.access_token;
        window.storageManager.saveStravaToken(this.accessToken);
        
        // Clean URL
        window.history.replaceState({}, document.title, window.location.pathname);
        
        this.showRequestButton();
      } else {
        window.feedbackManager.showError('Failed to obtain access token');
      }
    } catch (err) {
      window.feedbackManager.showError('Error connecting to Strava', err);
    }
  }

  /**
   * Show request data button
   */
  showRequestButton() {
    const connectBtn = document.getElementById('connectBtn');
    const clientId = document.getElementById('clientId');
    const clientSecret = document.getElementById('clientSecret');
    const requestSection = document.getElementById('requestSection');
    
    if (connectBtn) connectBtn.style.display = 'none';
    if (clientId) clientId.disabled = true;
    if (clientSecret) clientSecret.disabled = true;
    if (requestSection) requestSection.style.display = 'block';
  }

  /**
   * Fetch activities from Strava
   */
  async fetchActivities() {
    if (!this.accessToken) {
      window.feedbackManager.showError('Not authenticated. Please connect to Strava first.');
      return;
    }

    window.feedbackManager.showFeedback('⏳ Fetching data from Strava...', 'info');
    
    try {
      // Fetch all activities with pagination
      const allActivities = [];
      const perPage = 200;
      const maxPages = 2;
      
      for (let page = 1; page <= maxPages; page++) {
        window.feedbackManager.showFeedback(
          `⏳ Fetching activities (page ${page}/${maxPages})...`, 
          'info'
        );
        
        const response = await fetch(
          `https://www.strava.com/api/v3/athlete/activities?per_page=${perPage}&page=${page}`,
          { headers: { 'Authorization': `Bearer ${this.accessToken}` } }
        );
        
        if (!response.ok) {
          throw new Error(`Failed to fetch activities: ${response.status}`);
        }
        
        const pageActivities = await response.json();
        if (pageActivities.length === 0) break;
        
        allActivities.push(...pageActivities);
        if (pageActivities.length < perPage) break;
      }
      
      // Filter for runs only
      const runs = allActivities.filter(a => a.type === 'Run');
      
      window.feedbackManager.showFeedback(
        `⏳ Fetching detailed data for ${runs.length} runs...`, 
        'info'
      );
      
      // Fetch detailed data + HR streams
      const detailedRuns = await this.fetchDetailedData(runs);
      
      // Normalize to our format
      const normalizedRuns = detailedRuns.map(r => ({
        id: r.id,
        date: new Date(r.start_date),
        distance: r.distance / 1000, // meters to km
        duration: r.moving_time / 60, // seconds to minutes
        avgHR: r.average_heartrate || null,
        maxHR: r.max_heartrate || null,
        hrStream: r.hrStream || null,
        paceStream: r.paceStream || null,
        source: 'Strava API'
      }));

      // Add to data processor
      window.dataProcessor.addRuns(normalizedRuns, 'Strava');
      
      // Save to storage
      await window.storageManager.saveRuns(window.dataProcessor.runs);
      
      // Show session banner
      window.feedbackManager.showSessionBanner(normalizedRuns.length, 'strava');
      
      // Trigger analysis
      if (typeof window.analyze === 'function') {
        window.analyze();
      }
      
      const hrCount = normalizedRuns.filter(r => r.hrStream).length;
      const paceCount = normalizedRuns.filter(r => r.paceStream).length;
      window.feedbackManager.showFeedback(
        `✅ Successfully fetched ${normalizedRuns.length} runs from Strava! (${hrCount} with HR data, ${paceCount} with pace data)`,
        'success'
      );
      
    } catch (err) {
      console.error('Strava fetch error:', err);
      window.feedbackManager.showError(`Error fetching Strava data: ${err.message}`);
    }
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
        
        try {
          // Fetch detailed activity
          const detailResponse = await fetch(
            `https://www.strava.com/api/v3/activities/${activity.id}`,
            { headers: { 'Authorization': `Bearer ${this.accessToken}` } }
          );
          
          if (!detailResponse.ok) {
            console.warn(`Failed to fetch details for activity ${activity.id}`);
            return { ...activity, hrStream: null, paceStream: null };
          }
          
          const detailData = await detailResponse.json();
          
          // Fetch HR and PACE streams
          try {
            const streamResponse = await fetch(
              `https://www.strava.com/api/v3/activities/${activity.id}/streams?keys=heartrate,time,velocity&key_by_type=true`,
              { headers: { 'Authorization': `Bearer ${this.accessToken}` } }
            );
            
            if (streamResponse.ok) {
              const streamData = await streamResponse.json();
              
              // HR Stream
              if (streamData.heartrate && streamData.time) {
                hrStream = {
                  heartrate: streamData.heartrate.data,
                  time: streamData.time.data
                };
              }
              
              // Pace Stream (convert velocity m/s to min/km)
              if (streamData.velocity && streamData.time) {
                paceStream = {
                  pace: streamData.velocity.data.map(v => {
                    // Convert m/s to min/km
                    // v = m/s, pace = min/km = 1000/(v*60) = 16.667/v
                    return v > 0 ? 16.667 / v : 0;
                  }),
                  time: streamData.time.data
                };
              }
            }
          } catch (err) {
            console.warn(`Failed to fetch streams for activity ${activity.id}:`, err);
          }
          
          return { ...detailData, hrStream, paceStream };
        } catch (err) {
          console.error(`Error fetching activity ${activity.id}:`, err);
          return { ...activity, hrStream: null, paceStream: null };
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
    window.feedbackManager.hideSessionBanner('strava');
    location.reload();
  }
}

// Initialize and export singleton
window.stravaAPI = new StravaAPI();

// Auto-initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  window.stravaAPI.init();
});