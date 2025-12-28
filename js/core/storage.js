// js/core/storage.js
// Unified storage management for IndexedDB and sessionStorage

class StorageManager {
  constructor() {
    this.DB_NAME = 'StravaAnalyzerDB';
    this.DB_VERSION = 1;
    this.STORE_NAME = 'stravaData';
    this.db = null;
  }

  /**
   * Initialize IndexedDB
   */
  async init() {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          db.createObjectStore(this.STORE_NAME);
        }
      };
    });
  }

  /**
   * Save runs to IndexedDB
   */
  async saveRuns(runs) {
    try {
      if (!this.db) await this.init();
      
      // Convert runs to serializable format
      const runsToSave = runs.map(run => ({
        ...run,
        date: run.date.toISOString()
      }));
      
      const transaction = this.db.transaction([this.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);
      
      await store.put(runsToSave, 'runs');
      await store.put(new Date().toISOString(), 'last_updated');
      
      await new Promise((resolve, reject) => {
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error);
      });
      
      console.log(`✓ Saved ${runsToSave.length} runs to IndexedDB`);
      return true;
    } catch (err) {
      console.error('Failed to save to IndexedDB:', err);
      return false;
    }
  }

  /**
   * Load runs from IndexedDB
   */
  async loadRuns() {
    try {
      if (!this.db) await this.init();
      
      const transaction = this.db.transaction([this.STORE_NAME], 'readonly');
      const store = transaction.objectStore(this.STORE_NAME);
      
      const runsRequest = store.get('runs');
      const timeRequest = store.get('last_updated');
      
      const [savedRuns, lastUpdated] = await Promise.all([
        new Promise((resolve) => { 
          runsRequest.onsuccess = () => resolve(runsRequest.result); 
        }),
        new Promise((resolve) => { 
          timeRequest.onsuccess = () => resolve(timeRequest.result); 
        })
      ]);
      
      if (savedRuns && savedRuns.length > 0) {
        // Restore dates as Date objects
        const runs = savedRuns.map(run => ({
          ...run,
          date: new Date(run.date)
        }));
        
        console.log(`✓ Loaded ${runs.length} runs from IndexedDB (updated: ${lastUpdated})`);
        return runs;
      }
      
      return null;
    } catch (err) {
      console.error('Failed to load from IndexedDB:', err);
      return null;
    }
  }

  /**
   * Clear all data from IndexedDB
   */
  async clearRuns() {
    try {
      if (!this.db) await this.init();
      
      const transaction = this.db.transaction([this.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);
      
      store.delete('runs');
      store.delete('last_updated');
      
      await new Promise((resolve, reject) => {
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error);
      });
      
      console.log('✓ IndexedDB data cleared');
      return true;
    } catch (err) {
      console.error('Failed to clear IndexedDB:', err);
      return false;
    }
  }

  /**
   * Save Strava token to sessionStorage
   */
  saveStravaToken(token) {
    try {
      sessionStorage.setItem('stravaToken', token);
      return true;
    } catch (err) {
      console.error('Failed to save Strava token:', err);
      return false;
    }
  }

  /**
   * Load Strava token from sessionStorage
   */
  loadStravaToken() {
    try {
      return sessionStorage.getItem('stravaToken');
    } catch (err) {
      console.error('Failed to load Strava token:', err);
      return null;
    }
  }

  /**
   * Clear Strava token from sessionStorage
   */
  clearStravaToken() {
    try {
      sessionStorage.removeItem('stravaToken');
      sessionStorage.removeItem('stravaClientId');
      sessionStorage.removeItem('stravaClientSecret');
      return true;
    } catch (err) {
      console.error('Failed to clear Strava token:', err);
      return false;
    }
  }

  /**
   * Save HR Max to sessionStorage
   */
  saveHRMax(hrMax) {
    try {
      sessionStorage.setItem('customHRMax', hrMax.toString());
      return true;
    } catch (err) {
      console.error('Failed to save HR Max:', err);
      return false;
    }
  }

  /**
   * Load HR Max from sessionStorage
   */
  loadHRMax() {
    try {
      const saved = sessionStorage.getItem('customHRMax');
      return saved ? Number(saved) : null;
    } catch (err) {
      console.error('Failed to load HR Max:', err);
      return null;
    }
  }

  /**
   * Clear HR Max from sessionStorage
   */
  clearHRMax() {
    try {
      sessionStorage.removeItem('customHRMax');
      return true;
    } catch (err) {
      console.error('Failed to clear HR Max:', err);
      return false;
    }
  }

  /**
   * Save zones to localStorage
   */
  saveZones(zones) {
    try {
      localStorage.setItem('hr_zone_bounds_v1', JSON.stringify(zones));
      return true;
    } catch (err) {
      console.error('Failed to save zones:', err);
      return false;
    }
  }

  /**
   * Load zones from localStorage
   */
  loadZones() {
    try {
      const saved = localStorage.getItem('hr_zone_bounds_v1');
      return saved ? JSON.parse(saved) : null;
    } catch (err) {
      console.error('Failed to load zones:', err);
      return null;
    }
  }

  /**
   * Clear zones from localStorage
   */
  clearZones() {
    try {
      localStorage.removeItem('hr_zone_bounds_v1');
      return true;
    } catch (err) {
      console.error('Failed to clear zones:', err);
      return false;
    }
  }
}

// Initialize and export singleton
window.storageManager = new StorageManager();