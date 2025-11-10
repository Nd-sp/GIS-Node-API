/**
 * Coordinate Validation Utility
 *
 * Validates GPS coordinates for India region
 * Prevents invalid coordinates from being imported
 */

/**
 * India's geographical boundaries (with buffer for islands)
 * Including Andaman & Nicobar Islands and Lakshadweep
 */
const INDIA_BOUNDS = {
  // Mainland + Islands
  latitude: {
    min: 6.5,    // Southernmost point (Indira Point, Andaman & Nicobar)
    max: 35.5    // Northernmost point (Siachen Glacier area)
  },
  longitude: {
    min: 68.0,   // Westernmost point (Gujarat border)
    max: 97.5    // Easternmost point (Arunachal Pradesh)
  }
};

/**
 * Strict mainland India boundaries (excludes islands)
 */
const INDIA_MAINLAND_BOUNDS = {
  latitude: {
    min: 8.0,    // Southern tip of mainland
    max: 35.5    // Northern border
  },
  longitude: {
    min: 68.0,   // Western border
    max: 97.5    // Eastern border
  }
};

/**
 * State-wise boundary data for better validation
 * Format: { name, latMin, latMax, lngMin, lngMax }
 */
const STATE_BOUNDARIES = [
  // North India
  { name: "Jammu and Kashmir", latMin: 32.3, latMax: 37.1, lngMin: 73.3, lngMax: 80.3 },
  { name: "Himachal Pradesh", latMin: 30.4, latMax: 33.3, lngMin: 75.6, lngMax: 79.0 },
  { name: "Punjab", latMin: 29.5, latMax: 32.6, lngMin: 73.9, lngMax: 76.9 },
  { name: "Uttarakhand", latMin: 28.7, latMax: 31.5, lngMin: 77.6, lngMax: 81.0 },
  { name: "Haryana", latMin: 27.7, latMax: 30.9, lngMin: 74.5, lngMax: 77.6 },
  { name: "Delhi", latMin: 28.4, latMax: 28.9, lngMin: 76.8, lngMax: 77.3 },
  { name: "Rajasthan", latMin: 23.0, latMax: 30.2, lngMin: 69.5, lngMax: 78.3 },
  { name: "Uttar Pradesh", latMin: 23.9, latMax: 30.4, lngMin: 77.1, lngMax: 84.6 },

  // Central India
  { name: "Madhya Pradesh", latMin: 21.1, latMax: 26.9, lngMin: 74.0, lngMax: 82.8 },
  { name: "Chhattisgarh", latMin: 17.8, latMax: 24.1, lngMin: 80.3, lngMax: 84.4 },

  // West India
  { name: "Gujarat", latMin: 20.1, latMax: 24.7, lngMin: 68.2, lngMax: 74.5 },
  { name: "Daman and Diu", latMin: 20.3, latMax: 20.5, lngMin: 72.8, lngMax: 73.0 },
  { name: "Dadra and Nagar Haveli", latMin: 20.0, latMax: 20.3, lngMin: 72.9, lngMax: 73.2 },
  { name: "Maharashtra", latMin: 15.6, latMax: 22.0, lngMin: 72.6, lngMax: 80.9 },
  { name: "Goa", latMin: 14.9, latMax: 15.8, lngMin: 73.7, lngMax: 74.4 },

  // South India
  { name: "Karnataka", latMin: 11.5, latMax: 18.5, lngMin: 74.0, lngMax: 78.6 },
  { name: "Telangana", latMin: 15.8, latMax: 19.9, lngMin: 77.2, lngMax: 81.3 },
  { name: "Andhra Pradesh", latMin: 12.6, latMax: 19.9, lngMin: 76.8, lngMax: 84.8 },
  { name: "Tamil Nadu", latMin: 8.0, latMax: 13.6, lngMin: 76.2, lngMax: 80.3 },
  { name: "Kerala", latMin: 8.2, latMax: 12.8, lngMin: 74.8, lngMax: 77.4 },
  { name: "Puducherry", latMin: 11.7, latMax: 12.0, lngMin: 79.6, lngMax: 79.9 },

  // East India
  { name: "Bihar", latMin: 24.3, latMax: 27.5, lngMin: 83.3, lngMax: 88.3 },
  { name: "Jharkhand", latMin: 21.9, latMax: 25.3, lngMin: 83.3, lngMax: 87.9 },
  { name: "Odisha", latMin: 17.8, latMax: 22.6, lngMin: 81.3, lngMax: 87.5 },
  { name: "West Bengal", latMin: 21.5, latMax: 27.2, lngMin: 85.8, lngMax: 89.9 },

  // Northeast India
  { name: "Sikkim", latMin: 27.1, latMax: 28.1, lngMin: 88.0, lngMax: 88.9 },
  { name: "Assam", latMin: 24.1, latMax: 28.2, lngMin: 89.7, lngMax: 96.0 },
  { name: "Arunachal Pradesh", latMin: 26.6, latMax: 29.5, lngMin: 91.6, lngMax: 97.4 },
  { name: "Nagaland", latMin: 25.2, latMax: 27.0, lngMin: 93.3, lngMax: 95.2 },
  { name: "Manipur", latMin: 23.8, latMax: 25.7, lngMin: 93.0, lngMax: 94.8 },
  { name: "Mizoram", latMin: 21.9, latMax: 24.5, lngMin: 92.2, lngMax: 93.5 },
  { name: "Tripura", latMin: 22.9, latMax: 24.5, lngMin: 91.0, lngMax: 92.5 },
  { name: "Meghalaya", latMin: 25.0, latMax: 26.1, lngMin: 89.8, lngMax: 92.8 },

  // Islands
  { name: "Andaman and Nicobar Islands", latMin: 6.7, latMax: 13.7, lngMin: 92.2, lngMax: 94.0 },
  { name: "Lakshadweep", latMin: 8.0, latMax: 12.4, lngMin: 71.6, lngMax: 74.0 }
];

/**
 * Validates if coordinates are within India's boundaries
 * @param {number} latitude - Latitude coordinate
 * @param {number} longitude - Longitude coordinate
 * @param {boolean} strictMainland - If true, excludes islands (default: false)
 * @returns {Object} { valid: boolean, error?: string }
 */
function isValidIndiaCoordinate(latitude, longitude, strictMainland = false) {
  // Type validation
  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    return {
      valid: false,
      error: 'Coordinates must be numbers'
    };
  }

  // Check for NaN
  if (isNaN(latitude) || isNaN(longitude)) {
    return {
      valid: false,
      error: 'Invalid coordinate values (NaN)'
    };
  }

  // General coordinate range check
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return {
      valid: false,
      error: 'Coordinates out of valid range (lat: -90 to 90, lng: -180 to 180)'
    };
  }

  const bounds = strictMainland ? INDIA_MAINLAND_BOUNDS : INDIA_BOUNDS;

  // India boundary check
  if (latitude < bounds.latitude.min || latitude > bounds.latitude.max) {
    return {
      valid: false,
      error: `Latitude ${latitude.toFixed(5)} is outside India (${bounds.latitude.min} to ${bounds.latitude.max})`
    };
  }

  if (longitude < bounds.longitude.min || longitude > bounds.longitude.max) {
    return {
      valid: false,
      error: `Longitude ${longitude.toFixed(5)} is outside India (${bounds.longitude.min} to ${bounds.longitude.max})`
    };
  }

  return { valid: true };
}

/**
 * Detects which state/UT the coordinates belong to
 * @param {number} latitude - Latitude coordinate
 * @param {number} longitude - Longitude coordinate
 * @returns {Object} { found: boolean, state?: string, message?: string }
 */
function detectState(latitude, longitude) {
  // First validate it's in India
  const validation = isValidIndiaCoordinate(latitude, longitude);
  if (!validation.valid) {
    return {
      found: false,
      message: validation.error
    };
  }

  // Check each state boundary
  for (const state of STATE_BOUNDARIES) {
    if (
      latitude >= state.latMin &&
      latitude <= state.latMax &&
      longitude >= state.lngMin &&
      longitude <= state.lngMax
    ) {
      return {
        found: true,
        state: state.name
      };
    }
  }

  // Coordinates are in India but not matching any state (possible offshore/border area)
  return {
    found: false,
    message: 'Coordinates are within India but no state detected (possible offshore or border area)'
  };
}

/**
 * Validates a batch of coordinates
 * @param {Array} coordinates - Array of {latitude, longitude, id?, name?}
 * @returns {Object} { valid: [], invalid: [], summary: {} }
 */
function validateCoordinateBatch(coordinates) {
  const valid = [];
  const invalid = [];

  coordinates.forEach((coord) => {
    const validation = isValidIndiaCoordinate(coord.latitude, coord.longitude);
    const stateDetection = detectState(coord.latitude, coord.longitude);

    const result = {
      ...coord,
      validation,
      state: stateDetection.state || null,
      stateDetectionMessage: stateDetection.message || null
    };

    if (validation.valid) {
      valid.push(result);
    } else {
      invalid.push(result);
    }
  });

  return {
    valid,
    invalid,
    summary: {
      total: coordinates.length,
      validCount: valid.length,
      invalidCount: invalid.length,
      validPercentage: ((valid.length / coordinates.length) * 100).toFixed(2)
    }
  };
}

/**
 * Get nearest state for invalid coordinates (for debugging/correction)
 * @param {number} latitude - Latitude coordinate
 * @param {number} longitude - Longitude coordinate
 * @returns {Object} { state: string, distance: number, suggestion: string }
 */
function getNearestState(latitude, longitude) {
  let nearestState = null;
  let minDistance = Infinity;

  STATE_BOUNDARIES.forEach((state) => {
    // Calculate distance to center of state
    const stateCenterLat = (state.latMin + state.latMax) / 2;
    const stateCenterLng = (state.lngMin + state.lngMax) / 2;

    // Simple Euclidean distance (good enough for proximity check)
    const distance = Math.sqrt(
      Math.pow(latitude - stateCenterLat, 2) +
      Math.pow(longitude - stateCenterLng, 2)
    );

    if (distance < minDistance) {
      minDistance = distance;
      nearestState = state;
    }
  });

  // Approximate conversion to km (very rough, 1 degree ≈ 111km)
  const distanceKm = Math.round(minDistance * 111);

  return {
    state: nearestState.name,
    distance: distanceKm,
    suggestion: `Coordinates might be ${distanceKm}km from ${nearestState.name}. Check if coordinates are in correct format.`
  };
}

module.exports = {
  isValidIndiaCoordinate,
  detectState,
  validateCoordinateBatch,
  getNearestState,
  INDIA_BOUNDS,
  INDIA_MAINLAND_BOUNDS,
  STATE_BOUNDARIES
};
