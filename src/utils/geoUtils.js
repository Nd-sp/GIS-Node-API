/**
 * Geospatial Utility Functions
 * Helper functions for coordinate calculations, distance, and bounding boxes
 */

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param {number} lat1 - Latitude of first point
 * @param {number} lon1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lon2 - Longitude of second point
 * @returns {number} Distance in kilometers
 */
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * Convert degrees to radians
 * @param {number} degrees
 * @returns {number} Radians
 */
const toRadians = (degrees) => {
  return degrees * (Math.PI / 180);
};

/**
 * Convert radians to degrees
 * @param {number} radians
 * @returns {number} Degrees
 */
const toDegrees = (radians) => {
  return radians * (180 / Math.PI);
};

/**
 * Check if a point is within a bounding box
 * @param {number} lat - Point latitude
 * @param {number} lng - Point longitude
 * @param {object} bounds - { north, south, east, west }
 * @returns {boolean}
 */
const isPointInBounds = (lat, lng, bounds) => {
  return (
    lat >= bounds.south &&
    lat <= bounds.north &&
    lng >= bounds.west &&
    lng <= bounds.east
  );
};

/**
 * Calculate bounding box for a center point and radius
 * @param {number} lat - Center latitude
 * @param {number} lng - Center longitude
 * @param {number} radiusKm - Radius in kilometers
 * @returns {object} { north, south, east, west }
 */
const getBoundingBox = (lat, lng, radiusKm) => {
  const latDelta = radiusKm / 111; // 1 degree latitude ≈ 111 km
  const lngDelta = radiusKm / (111 * Math.cos(toRadians(lat)));

  return {
    north: lat + latDelta,
    south: lat - latDelta,
    east: lng + lngDelta,
    west: lng - lngDelta
  };
};

/**
 * Calculate the center point of a bounding box
 * @param {object} bounds - { north, south, east, west }
 * @returns {object} { lat, lng }
 */
const getBoundsCenter = (bounds) => {
  return {
    lat: (bounds.north + bounds.south) / 2,
    lng: (bounds.east + bounds.west) / 2
  };
};

/**
 * Calculate the approximate area of a bounding box in square kilometers
 * @param {object} bounds - { north, south, east, west }
 * @returns {number} Area in square kilometers
 */
const getBoundsArea = (bounds) => {
  const latDistance = calculateDistance(
    bounds.south,
    bounds.west,
    bounds.north,
    bounds.west
  );
  const lngDistance = calculateDistance(
    bounds.south,
    bounds.west,
    bounds.south,
    bounds.east
  );
  return latDistance * lngDistance;
};

/**
 * Expand a bounding box by a percentage
 * @param {object} bounds - { north, south, east, west }
 * @param {number} percentage - Percentage to expand (e.g., 10 for 10%)
 * @returns {object} Expanded bounds
 */
const expandBounds = (bounds, percentage) => {
  const latDelta = (bounds.north - bounds.south) * (percentage / 100) / 2;
  const lngDelta = (bounds.east - bounds.west) * (percentage / 100) / 2;

  return {
    north: bounds.north + latDelta,
    south: bounds.south - latDelta,
    east: bounds.east + lngDelta,
    west: bounds.west - lngDelta
  };
};

/**
 * Validate coordinate values
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {boolean}
 */
const isValidCoordinate = (lat, lng) => {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    !isNaN(lat) &&
    !isNaN(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
};

/**
 * Find the closest point from a list to a target coordinate
 * @param {number} targetLat
 * @param {number} targetLng
 * @param {Array} points - Array of {lat, lng} objects
 * @returns {object} Closest point with distance
 */
const findClosestPoint = (targetLat, targetLng, points) => {
  if (!points || points.length === 0) return null;

  let closest = null;
  let minDistance = Infinity;

  points.forEach((point) => {
    const distance = calculateDistance(
      targetLat,
      targetLng,
      point.lat || point.latitude,
      point.lng || point.longitude
    );

    if (distance < minDistance) {
      minDistance = distance;
      closest = { ...point, distance };
    }
  });

  return closest;
};

/**
 * Filter points within a radius from a center point
 * @param {number} centerLat
 * @param {number} centerLng
 * @param {number} radiusKm
 * @param {Array} points - Array of {lat, lng} objects
 * @returns {Array} Filtered points with distance
 */
const filterPointsWithinRadius = (centerLat, centerLng, radiusKm, points) => {
  return points
    .map((point) => {
      const distance = calculateDistance(
        centerLat,
        centerLng,
        point.lat || point.latitude,
        point.lng || point.longitude
      );
      return { ...point, distance };
    })
    .filter((point) => point.distance <= radiusKm)
    .sort((a, b) => a.distance - b.distance);
};

/**
 * Grid-based clustering helper
 * @param {number} coordinate - Latitude or longitude
 * @param {number} gridSize - Grid cell size in degrees
 * @returns {number} Grid cell identifier
 */
const getGridCell = (coordinate, gridSize) => {
  return Math.round(coordinate / gridSize) * gridSize;
};

/**
 * Format distance for display
 * @param {number} distanceKm - Distance in kilometers
 * @returns {string} Formatted distance
 */
const formatDistance = (distanceKm) => {
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m`;
  } else if (distanceKm < 10) {
    return `${distanceKm.toFixed(2)} km`;
  } else {
    return `${Math.round(distanceKm)} km`;
  }
};

module.exports = {
  calculateDistance,
  toRadians,
  toDegrees,
  isPointInBounds,
  getBoundingBox,
  getBoundsCenter,
  getBoundsArea,
  expandBounds,
  isValidCoordinate,
  findClosestPoint,
  filterPointsWithinRadius,
  getGridCell,
  formatDistance
};
