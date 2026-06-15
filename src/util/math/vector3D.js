// Extracted from index.html
      function distance3D(a, b) {
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dz = (b.z || 0) - (a.z || 0);
        return Math.sqrt((dx * dx) + (dy * dy) + (dz * dz));
      }

      function distance2D(a, b) {
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        return Math.sqrt((dx * dx) + (dy * dy));
      }

      function subtractVectors(a, b) {
        return {
          x: (a.x || 0) - (b.x || 0),
          y: (a.y || 0) - (b.y || 0),
          z: (a.z || 0) - (b.z || 0)
        };
      }

      function addVectors(a, b) {
        return {
          x: (a.x || 0) + (b.x || 0),
          y: (a.y || 0) + (b.y || 0),
          z: (a.z || 0) + (b.z || 0)
        };
      }

      function scaleVector(vector, scalar) {
        return {
          x: (vector.x || 0) * scalar,
          y: (vector.y || 0) * scalar,
          z: (vector.z || 0) * scalar
        };
      }

      function dotProduct(a, b) {
        return ((a.x || 0) * (b.x || 0)) + ((a.y || 0) * (b.y || 0)) + ((a.z || 0) * (b.z || 0));
      }

      function magnitude3D(vector) {
        return Math.sqrt(dotProduct(vector, vector));
      }

      function magnitude2D(vector) {
        return Math.sqrt(((vector.x || 0) * (vector.x || 0)) + ((vector.y || 0) * (vector.y || 0)));
      }

      function normalizeVector(vector) {
        const magnitude = magnitude3D(vector);
        if (magnitude <= 1e-6) {
          return null;
        }
        return scaleVector(vector, 1 / magnitude);
      }

      function normalizeVector2D(vector) {
        const magnitude = magnitude2D(vector);
        if (magnitude <= 1e-6) {
          return null;
        }
        return {
          x: (vector.x || 0) / magnitude,
          y: (vector.y || 0) / magnitude,
          z: 0
        };
      }

      function dotProduct2D(a, b) {
        return ((a.x || 0) * (b.x || 0)) + ((a.y || 0) * (b.y || 0));
      }
