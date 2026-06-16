// Extracted from index.html.
// Keep these helpers intentionally generic: they are reused by movement,
// ballistics, heading math, and schema cleanup.
      function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
      }

      function round(value, decimals = 2) {
        const factor = 10 ** decimals;
        return Math.round(value * factor) / factor;
      }

      function deepClone(value) {
        if (typeof structuredClone === "function") {
          return structuredClone(value);
        }
        return JSON.parse(JSON.stringify(value));
      }

      function angleDeg(from, to) {
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        let angle = Math.atan2(dy, dx) * (180 / Math.PI);
        if (angle < 0) {
          angle += 360;
        }
        return angle;
      }

      function smallestAngleDifference(a, b) {
        let diff = ((a - b + 540) % 360) - 180;
        if (diff < -180) {
          diff += 360;
        }
        return diff;
      }

      function normalizeHeadingDeg(heading) {
        const normalized = Number(heading || 0) % 360;
        return normalized < 0 ? normalized + 360 : normalized;
      }
