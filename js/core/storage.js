
// js/core/storage.js
// Unified storage management for IndexedDB, localStorage, and sessionStorage
// Schema:
//   DB: TriRunalyzerDB (v3)
//   Stores:
//     - runs  (keyPath: 'id')
//     - rides (keyPath: 'id')
//     - swims (keyPath: 'id')
//     - meta  (key-value; e.g., last_updated)

/* ---------- Small internal helpers ---------- */

function idbAvailable() {
  try { return !!window.indexedDB; } catch { return false; }
}

function reqToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error);
    tx.onerror = () => reject(tx.error);
  });
}

function generateId() {
  try {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return window.crypto.randomUUID();
    }
  } catch {}
  return `id_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function toISO(value) {
  if (!value) return value;
  if (value instanceof Date) return value.toISOString();
  return value;
}

function reviveDate(value) {
  return value ? new Date(value) : null;
}

/* ---------- Storage Manager ---------- */

class StorageManager {
  constructor() {
    this.DB_NAME = 'TriRunalyzerDB';
    this.DB_VERSION = 3; // bump when schema changes
    this.STORES = {
      RUNS: 'runs',
      RIDES: 'rides',
      SWIMS: 'swims',
      META: 'meta',
    };

    this.db = null;
    this._ready = null; // promise to avoid opening race conditions
  }

  /**
   * Initialize (or re-open) the IndexedDB database with required stores.
   * Safe to call multiple times: returns the same in-flight promise if opening.
   */
  async init() {
    if (!idbAvailable()) {
      console.warn('IndexedDB is not available in this environment.');
      return;
    }
    if (this.db) return;
    if (this._ready) return this._ready;

    this._ready = new Promise((resolve, reject) => {
      const req = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      req.onupgradeneeded = (e) => {
        const db = req.result;

        // Create object stores if missing (idempotent)
        if (!db.objectStoreNames.contains(this.STORES.RUNS)) {
          db.createObjectStore(this.STORES.RUNS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(this.STORES.RIDES)) {
          db.createObjectStore(this.STORES.RIDES, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(this.STORES.SWIMS)) {
          db.createObjectStore(this.STORES.SWIMS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(this.STORES.META)) {
          db.createObjectStore(this.STORES.META); // key-value store
        }

        console.log('✓ IndexedDB object stores created/updated');
      };

      req.onsuccess = () => {
        this.db = req.result;

        // Handle versionchange from other tabs gracefully
        this.db.onversionchange = () => {
          console.warn('IndexedDB version change detected. Closing DB.');
          try { this.db.close(); } catch {}
          this.db = null;
        };

        console.log('✓ IndexedDB initialized');
        resolve();
      };

      req.onerror = () => {
        console.error('IndexedDB open error:', req.error);
        reject(req.error);
      };
    });

    return this._ready.finally(() => { this._ready = null; });
  }

  /* ---------------- Runs ---------------- */

  /**
   * Save runs array into 'runs' store and update 'meta.last_updated'
   * Each run must have an 'id'; if missing, one will be generated.
   * Dates are serialized to ISO-8601 strings.
   */
  async saveRuns(runs) {
    try {
      await this.init();
      if (!this.db) throw new Error('IndexedDB not available');

      const tx = this.db.transaction([this.STORES.RUNS, this.STORES.META], 'readwrite');
      const runsStore = tx.objectStore(this.STORES.RUNS);
      const metaStore = tx.objectStore(this.STORES.META);

      runsStore.clear();

      for (const run of runs) {
        const record = {
          ...run,
          id: run.id ?? generateId(),
          date: toISO(run.date),
        };
        runsStore.put(record);
      }

      metaStore.put(new Date().toISOString(), 'last_updated');

      await txDone(tx);
      console.log(`✓ Saved ${runs.length} runs to IndexedDB`);
      return true;
    } catch (err) {
      console.error('Failed to save runs:', err);
      return false;
    }
  }

  /**
   * Load runs from 'runs' store; returns []
   */
  async loadRuns() {
    try {
      await this.init();
      if (!this.db) return [];

      const tx = this.db.transaction([this.STORES.RUNS, this.STORES.META], 'readonly');
      const runsStore = tx.objectStore(this.STORES.RUNS);
      const metaStore = tx.objectStore(this.STORES.META);

      const runsReq = runsStore.getAll();
      const timeReq = metaStore.get('last_updated');

      const [savedRuns, lastUpdated] = await Promise.all([
        reqToPromise(runsReq),
        reqToPromise(timeReq),
      ]);

      await txDone(tx);

      const runs = (savedRuns || []).map(run => ({
        ...run,
        date: reviveDate(run.date),
      }));

      console.log(`✓ Loaded ${runs.length} runs from IndexedDB (updated: ${lastUpdated || 'n/a'})`);
      return runs;
    } catch (err) {
      console.error('Failed to load runs:', err);
      return [];
    }
  }

  /**
   * Clear runs and its metadata
   */
  async clearRuns() {
    try {
      await this.init();
      if (!this.db) return false;

      const tx = this.db.transaction([this.STORES.RUNS, this.STORES.META], 'readwrite');
      tx.objectStore(this.STORES.RUNS).clear();
      tx.objectStore(this.STORES.META).delete('last_updated');
      await txDone(tx);

      console.log('✓ Runs cleared from IndexedDB');
      return true;
    } catch (err) {
      console.error('Failed to clear runs:', err);
      return false;
    }
  }

  /* ---------------- Rides ---------------- */

  async saveRides(rides) {
    try {
      await this.init();
      if (!this.db) throw new Error('IndexedDB not available');

      const tx = this.db.transaction([this.STORES.RIDES], 'readwrite');
      const store = tx.objectStore(this.STORES.RIDES);

      store.clear();
      for (const ride of rides) {
        store.put({
          ...ride,
          id: ride.id ?? generateId(),
          date: toISO(ride.date),
        });
      }

      await txDone(tx);
      console.log(`✓ ${rides.length} rides saved to IndexedDB`);
      return true;
    } catch (err) {
      console.error('Error saving rides:', err);
      return false;
    }
  }

  async loadRides() {
    try {
      await this.init();
      if (!this.db) return [];

      const tx = this.db.transaction([this.STORES.RIDES], 'readonly');
      const store = tx.objectStore(this.STORES.RIDES);

      const rides = await reqToPromise(store.getAll());
      await txDone(tx);

      (rides || []).forEach(ride => {
        if (ride && ride.date) ride.date = reviveDate(ride.date);
      });

      console.log(`✓ ${(rides || []).length} rides loaded from IndexedDB`);
      return rides || [];
    } catch (err) {
      console.error('Error loading rides:', err);
      return [];
    }
  }

  async clearRides() {
    try {
      await this.init();
      if (!this.db) return false;

      const tx = this.db.transaction([this.STORES.RIDES], 'readwrite');
      tx.objectStore(this.STORES.RIDES).clear();
      await txDone(tx);

      console.log('✓ Rides cleared from IndexedDB');
      return true;
    } catch (err) {
      console.error('Error clearing rides:', err);
      return false;
    }
  }

  /* ---------------- Swims ---------------- */

  async saveSwims(swims) {
    try {
      await this.init();
      if (!this.db) throw new Error('IndexedDB not available');

      const tx = this.db.transaction([this.STORES.SWIMS], 'readwrite');
      const store = tx.objectStore(this.STORES.SWIMS);

      store.clear();
      for (const swim of swims) {
        store.put({
          ...swim,
          id: swim.id ?? generateId(),
          date: toISO(swim.date),
        });
      }

      await txDone(tx);
      console.log(`✓ ${swims.length} swims saved to IndexedDB`);
      return true;
    } catch (err) {
      console.error('Error saving swims:', err);
      return false;
    }
  }

  async loadSwims() {
    try {
      await this.init();
      if (!this.db) return [];

      const tx = this.db.transaction([this.STORES.SWIMS], 'readonly');
      const store = tx.objectStore(this.STORES.SWIMS);

      const swims = await reqToPromise(store.getAll());
      await txDone(tx);

      (swims || []).forEach(swim => {
        if (swim && swim.date) swim.date = reviveDate(swim.date);
      });

      console.log(`✓ ${(swims || []).length} swims loaded from IndexedDB`);
      return swims || [];
    } catch (err) {
      console.error('Error loading swims:', err);
      return [];
    }
  }

  async clearSwims() {
    try {
      await this.init();
      if (!this.db) return false;

      const tx = this.db.transaction([this.STORES.SWIMS], 'readwrite');
      tx.objectStore(this.STORES.SWIMS).clear();
      await txDone(tx);

      console.log('✓ Swims cleared from IndexedDB');
      return true;
    } catch (err) {
      console.error('Error clearing swims:', err);
      return false;
    }
  }

  /* ---------------- Strava token (sessionStorage) ---------------- */

  saveStravaToken(token) {
    try {
      sessionStorage.setItem('stravaToken', token);
      return true;
    } catch (err) {
      console.error('Failed to save Strava token:', err);
      return false;
    }
  }

  loadStravaToken() {
    try {
      return sessionStorage.getItem('stravaToken');
    } catch (err) {
      console.error('Failed to load Strava token:', err);
      return null;
    }
  }

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

  /* ---------------- FTP (localStorage) ---------------- */

  saveFTP(ftp) {
    try {
      localStorage.setItem('userFTP', String(ftp));
      console.log(`✓ FTP saved: ${ftp}W`);
      return true;
    } catch (err) {
      console.error('Error saving FTP:', err);
      return false;
    }
  }

  loadFTP() {
    try {
      const ftp = localStorage.getItem('userFTP');
      return ftp ? parseInt(ftp, 10) : null;
    } catch (err) {
      console.error('Error loading FTP:', err);
      return null;
    }
  }

  clearFTP() {
    try {
      localStorage.removeItem('userFTP');
      console.log('✓ FTP cleared');
      return true;
    } catch (err) {
      console.error('Error clearing FTP:', err);
      return false;
    }
  }

  /* ---------------- HR Max (sessionStorage) ---------------- */

  saveHRMax(hrMax) {
    try {
      sessionStorage.setItem('customHRMax', String(hrMax));
      return true;
    } catch (err) {
      console.error('Failed to save HR Max:', err);
      return false;
    }
  }

  loadHRMax() {
    try {
      const saved = sessionStorage.getItem('customHRMax');
      return saved ? Number(saved) : null;
    } catch (err) {
      console.error('Failed to load HR Max:', err);
      return null;
    }
  }

  clearHRMax() {
    try {
      sessionStorage.removeItem('customHRMax');
      return true;
    } catch (err) {
      console.error('Failed to clear HR Max:', err);
      return false;
    }
  }

  /* ---------------- Zones (localStorage) ---------------- */

  saveZones(zones) {
    try {
      localStorage.setItem('hr_zone_bounds_v1', JSON.stringify(zones));
      return true;
    } catch (err) {
      console.error('Failed to save zones:', err);
      return false;
    }
  }

  loadZones() {
    try {
      const saved = localStorage.getItem('hr_zone_bounds_v1');
      return saved ? JSON.parse(saved) : null;
    } catch (err) {
      console.error('Failed to load zones:', err);
      return null;
    }
  }

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

/* ---------- Initialize and export singleton ---------- */
window.storageManager = new StorageManager();
``
