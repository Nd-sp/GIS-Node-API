/**
 * Coordinate Fix Utility
 *
 * Provides functions to identify, report, and suggest fixes for invalid coordinates
 * in the infrastructure database
 */

const { pool } = require("../config/database");
const {
  isValidIndiaCoordinate,
  detectState,
  getNearestState,
  INDIA_BOUNDS
} = require("./coordinateValidator");

/**
 * Scan database for items with invalid coordinates
 * @returns {Promise<Object>} Report of invalid items
 */
async function scanInvalidCoordinates() {
  try {
    console.log("🔍 Scanning database for invalid coordinates...");

    // Get all infrastructure items with coordinates
    const [items] = await pool.query(`
      SELECT
        id,
        item_name,
        item_type,
        latitude,
        longitude,
        region_id,
        address_state,
        source,
        created_at,
        user_id
      FROM infrastructure_items
      WHERE latitude IS NOT NULL AND longitude IS NOT NULL
      ORDER BY created_at DESC
    `);

    const invalid = [];
    const missingRegion = [];
    const validWithRegion = [];
    const validWithoutRegion = [];

    for (const item of items) {
      const lat = parseFloat(item.latitude);
      const lng = parseFloat(item.longitude);

      // Check if coordinates are valid
      const validation = isValidIndiaCoordinate(lat, lng);

      if (!validation.valid) {
        // Invalid coordinates
        const nearest = getNearestState(lat, lng);
        invalid.push({
          id: item.id,
          name: item.item_name,
          type: item.item_type,
          latitude: lat,
          longitude: lng,
          regionId: item.region_id,
          addressState: item.address_state,
          source: item.source,
          createdAt: item.created_at,
          userId: item.user_id,
          validationError: validation.error,
          nearestState: nearest.state,
          distanceKm: nearest.distance,
          suggestion: nearest.suggestion
        });
      } else {
        // Valid coordinates
        const stateDetection = detectState(lat, lng);

        if (!item.region_id) {
          // Valid but missing region_id
          missingRegion.push({
            id: item.id,
            name: item.item_name,
            type: item.item_type,
            latitude: lat,
            longitude: lng,
            detectedState: stateDetection.state,
            addressState: item.address_state,
            source: item.source,
            createdAt: item.created_at,
            userId: item.user_id
          });
        } else {
          validWithRegion.push(item);
        }
      }
    }

    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        total: items.length,
        invalid: invalid.length,
        missingRegion: missingRegion.length,
        validWithRegion: validWithRegion.length,
        invalidPercentage: ((invalid.length / items.length) * 100).toFixed(2),
        missingRegionPercentage: ((missingRegion.length / items.length) * 100).toFixed(2)
      },
      details: {
        invalidCoordinates: invalid,
        missingRegionId: missingRegion
      }
    };

    console.log("📊 Scan Complete:");
    console.log(`   Total items: ${report.summary.total}`);
    console.log(`   Invalid coordinates: ${report.summary.invalid} (${report.summary.invalidPercentage}%)`);
    console.log(`   Missing region_id: ${report.summary.missingRegion} (${report.summary.missingRegionPercentage}%)`);
    console.log(`   Valid with region: ${report.summary.validWithRegion}`);

    return report;
  } catch (error) {
    console.error("Error scanning coordinates:", error);
    throw error;
  }
}

/**
 * Generate SQL script to delete items with invalid coordinates
 * @param {Array} invalidItems - Array of invalid items from scan
 * @returns {string} SQL DELETE script
 */
function generateDeleteScript(invalidItems) {
  if (!invalidItems || invalidItems.length === 0) {
    return "-- No invalid items to delete\n";
  }

  const ids = invalidItems.map(item => item.id);

  return `-- Delete infrastructure items with invalid coordinates
-- Generated: ${new Date().toISOString()}
-- Total items to delete: ${ids.length}

-- BACKUP FIRST (optional but recommended)
CREATE TABLE IF NOT EXISTS infrastructure_items_backup_invalid AS
SELECT * FROM infrastructure_items
WHERE id IN (${ids.join(', ')});

-- DELETE invalid items
DELETE FROM infrastructure_items
WHERE id IN (${ids.join(', ')});

-- Verify deletion
SELECT COUNT(*) as deleted_count FROM infrastructure_items_backup_invalid;
`;
}

/**
 * Generate CSV report of invalid coordinates
 * @param {Array} invalidItems - Array of invalid items from scan
 * @returns {string} CSV content
 */
function generateCSVReport(invalidItems) {
  const headers = [
    'ID',
    'Name',
    'Type',
    'Latitude',
    'Longitude',
    'Address State',
    'Source',
    'Created At',
    'User ID',
    'Validation Error',
    'Nearest State',
    'Distance (km)',
    'Suggestion'
  ].join(',');

  const rows = invalidItems.map(item => [
    item.id,
    `"${item.name}"`,
    item.type,
    item.latitude,
    item.longitude,
    `"${item.addressState || ''}"`,
    item.source,
    item.createdAt,
    item.userId,
    `"${item.validationError}"`,
    item.nearestState,
    item.distanceKm,
    `"${item.suggestion}"`
  ].join(','));

  return [headers, ...rows].join('\n');
}

/**
 * Analyze coordinate issues by source
 * @param {Array} invalidItems - Array of invalid items
 * @returns {Object} Analysis by source
 */
function analyzeBySource(invalidItems) {
  const bySource = {};

  invalidItems.forEach(item => {
    const source = item.source || 'Unknown';
    if (!bySource[source]) {
      bySource[source] = {
        count: 0,
        items: []
      };
    }
    bySource[source].count++;
    bySource[source].items.push(item);
  });

  return bySource;
}

/**
 * Suggest coordinate corrections based on address
 * @param {Object} item - Infrastructure item
 * @returns {Object} Suggestion
 */
async function suggestCorrection(item) {
  // If address_state is present, try to find typical coordinates for that state
  if (item.addressState) {
    const [stateRegion] = await pool.query(
      "SELECT id, name FROM regions WHERE name = ? AND is_active = TRUE LIMIT 1",
      [item.addressState]
    );

    if (stateRegion.length > 0) {
      return {
        suggestion: `Item has address_state "${item.addressState}". Consider geocoding the full address or using the state center.`,
        suggestedRegionId: stateRegion[0].id
      };
    }
  }

  return {
    suggestion: "No address information available. Manual correction required.",
    suggestedRegionId: null
  };
}

/**
 * Generate comprehensive fix report
 * @returns {Promise<Object>} Complete report with fix suggestions
 */
async function generateFixReport() {
  console.log("📋 Generating comprehensive coordinate fix report...");

  const scanResult = await scanInvalidCoordinates();
  const bySource = analyzeBySource(scanResult.details.invalidCoordinates);

  // Generate correction suggestions
  const suggestions = [];
  for (const item of scanResult.details.invalidCoordinates.slice(0, 20)) {
    const correction = await suggestCorrection(item);
    suggestions.push({
      ...item,
      correction
    });
  }

  const report = {
    ...scanResult,
    analysis: {
      bySource,
      topIssues: suggestions
    },
    recommendations: {
      immediate: [
        "1. Run the SQL script to update region_id for valid coordinates",
        "2. Review and delete items with coordinates outside India bounds",
        "3. Contact data source providers about coordinate accuracy"
      ],
      preventive: [
        "1. Enable coordinate validation on import",
        "2. Add geocoding for address-based entries",
        "3. Implement coordinate verification in UI"
      ]
    }
  };

  return report;
}

module.exports = {
  scanInvalidCoordinates,
  generateDeleteScript,
  generateCSVReport,
  analyzeBySource,
  suggestCorrection,
  generateFixReport
};
