
// zones-settings.js
(function () {
  // ==== Konfiguration ====
  const STORAGE_KEY = 'hr_zone_bounds_v1'; // LocalStorage-Key
  const DEFAULTS = { z2Upper: 0.75, z3Upper: 0.85, z4Upper: 0.90, z5Upper: 0.95 };

function onZonesChange(z) {

  if (typeof window.__zonesOnChange === 'function') {
    window.__zonesOnChange(z);
  }
}

  // ==== Utilities ====
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

  function validateBounds(z) {
    const arr = [z.z2Upper, z.z3Upper, z.z4Upper, z.z5Upper];
    const inRange = arr.every(x => typeof x === 'number' && isFinite(x) && x > 0 && x < 1);
    const ascending = (arr[0] < arr[1]) && (arr[1] < arr[2]) && (arr[2] < arr[3]);
    return inRange && ascending;
  }

  function loadFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (validateBounds(parsed)) return parsed;
    } catch {}
    return null;
  }

  function saveToStorage(z) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(z));
    } catch (e) {
      console.warn('Konnte Zonen nicht speichern:', e);
    }
  }

  function getCurrentZones() {
    // Quelle: LocalStorage > bereits globale Vars > Defaults
    const fromStorage = loadFromStorage();
    if (fromStorage) return fromStorage;

    const fromGlobals = {
      z2Upper: Number(window.z2Upper),
      z3Upper: Number(window.z3Upper),
      z4Upper: Number(window.z4Upper),
      z5Upper: Number(window.z5Upper),
    };
    if (validateBounds(fromGlobals)) return fromGlobals;

    return { ...DEFAULTS };
  }

  function setGlobals(z) {
    window.z2Upper = z.z2Upper;
    window.z3Upper = z.z3Upper;
    window.z4Upper = z.z4Upper;
    window.z5Upper = z.z5Upper;
  }

  function showStatus(msg, ok = true) {
    const el = document.getElementById('zonesStatus');
    if (!el) return;
    el.textContent = msg;
    el.style.color = ok ? '#7dd56f' : '#ff6b6b';
    // Auto-clear nach 3s
    clearTimeout(showStatus._t);
    showStatus._t = setTimeout(() => (el.textContent = ''), 3000);
  }

  // Debounce für teures Re-Rendering
  function debounce(fn, wait = 400) {
    let t;
    return function (...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), wait);
    };
  }

  // ==== Initialisierung nach DOM ====
  document.addEventListener('DOMContentLoaded', () => {
    // Inputs suchen (Prozent-Variante)
    const z2Pct = document.getElementById('z2UpperInputPct');
    const z3Pct = document.getElementById('z3UpperInputPct');
    const z4Pct = document.getElementById('z4UpperInputPct');
    const z5Pct = document.getElementById('z5UpperInputPct');

    // Inputs (Anteil-Variante)
    const z2Inp = document.getElementById('z2UpperInput');
    const z3Inp = document.getElementById('z3UpperInput');
    const z4Inp = document.getElementById('z4UpperInput');
    const z5Inp = document.getElementById('z5UpperInput');

    const saveBtn = document.getElementById('saveZonesBtn');
    const resetBtn = document.getElementById('resetZonesBtn');

    // Aktuelle Werte bestimmen
    const zones = getCurrentZones();
    setGlobals(zones); // globale Variablen überschreiben

    // UI initial befüllen
    if (z2Pct && z3Pct && z4Pct && z5Pct) {
      z2Pct.value = Math.round(zones.z2Upper * 100 * 100) / 100; // 2 Nachkommastellen
      z3Pct.value = Math.round(zones.z3Upper * 100 * 100) / 100;
      z4Pct.value = Math.round(zones.z4Upper * 100 * 100) / 100;
      z5Pct.value = Math.round(zones.z5Upper * 100 * 100) / 100;
    }
    if (z2Inp && z3Inp && z4Inp && z5Inp) {
      z2Inp.value = zones.z2Upper;
      z3Inp.value = zones.z3Upper;
      z4Inp.value = zones.z4Upper;
      z5Inp.value = zones.z5Upper;
    }

    const triggerRerender = debounce(() => onZonesChange(getCurrentZones()), 300);

    function readFromUI() {
      // Bevorzugt: Prozent-Inputs, ansonsten Anteil-Inputs
      if (z2Pct && z3Pct && z4Pct && z5Pct) {
        const z = {
          z2Upper: clamp(Number(z2Pct.value) / 100, 0.0001, 0.9999),
          z3Upper: clamp(Number(z3Pct.value) / 100, 0.0002, 0.9999),
          z4Upper: clamp(Number(z4Pct.value) / 100, 0.0003, 0.9999),
          z5Upper: clamp(Number(z5Pct.value) / 100, 0.0004, 0.9999),
        };
        return z;
      }
      if (z2Inp && z3Inp && z4Inp && z5Inp) {
        const z = {
          z2Upper: clamp(Number(z2Inp.value), 0.0001, 0.9999),
          z3Upper: clamp(Number(z3Inp.value), 0.0002, 0.9999),
          z4Upper: clamp(Number(z4Inp.value), 0.0003, 0.9999),
          z5Upper: clamp(Number(z5Inp.value), 0.0004, 0.9999),
        };
        return z;
      }
      return null;
    }

    function applyAndPersist(fromUI) {
      if (!fromUI) {
        showStatus('Keine Eingabefelder gefunden.', false);
        return;
      }
      if (!validateBounds(fromUI)) {
        showStatus('Ungültige Grenzen: Werte müssen zwischen 0 und 1 liegen und strikt ansteigend sein.', false);
        return;
      }
      setGlobals(fromUI);     // globale Variablen überschreiben
      saveToStorage(fromUI);  // persistieren
      showStatus('Zones updated.');
      //triggerRerender();      // Charts neu rendern (debounced)
	  analyze();
    }

    // Speichern-Button (explizit)
    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        const z = readFromUI();
        applyAndPersist(z);
      });
    }

    // Reset-Button auf Defaults
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        setGlobals(DEFAULTS);
        saveToStorage(DEFAULTS);
        if (z2Pct && z3Pct && z4Pct && z5Pct) {
          z2Pct.value = 75; z3Pct.value = 85; z4Pct.value = 90; z5Pct.value = 95;
        }
        if (z2Inp && z3Inp && z4Inp && z5Inp) {
          z2Inp.value = DEFAULTS.z2Upper;
          z3Inp.value = DEFAULTS.z3Upper;
          z4Inp.value = DEFAULTS.z4Upper;
          z5Inp.value = DEFAULTS.z5Upper;
        }
        showStatus('Standards wiederhergestellt.');
        triggerRerender();
      });
    }

    [z2Pct, z3Pct, z4Pct, z5Pct, z2Inp, z3Inp, z4Inp, z5Inp]
      .filter(Boolean)
      .forEach(el => {
        el.addEventListener('input', () => {
          const z = readFromUI();
          if (z && validateBounds(z)) {
            // Nicht sofort speichern, aber UI-gültige Werte schon global setzen
            setGlobals(z);
            showStatus('Änderung vorgemerkt…', true);
            triggerRerender();
          }
        });
      });
  });
})();
