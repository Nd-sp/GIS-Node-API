/**
 * Fiber Ring Sites Controller
 * Handles site management operations for fiber rings
 */

const pool = require('../config/database');

/**
 * @route GET /api/fiber-rings/:ringId/sites
 * @desc Get all sites for a specific fiber ring
 * @access Private (requires fiber.view permission)
 */
const getRingSites = async (req, res) => {
  try {
    const { ringId } = req.params;

    const [sites] = await pool.query(`
      SELECT
        frs.*,
        ii.item_name as linked_infrastructure_name
      FROM fiber_ring_sites frs
      LEFT JOIN infrastructure_items ii ON frs.infrastructure_item_id = ii.id
      WHERE frs.ring_id = ?
      ORDER BY frs.sequence_order ASC
    `, [ringId]);

    res.json({
      success: true,
      sites
    });
  } catch (error) {
    console.error('Error fetching ring sites:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch ring sites',
      error: error.message
    });
  }
};

/**
 * @route POST /api/fiber-rings/:ringId/sites
 * @desc Add new site to a fiber ring
 * @access Private (requires fiber.edit permission)
 */
const addRingSite = async (req, res) => {
  try {
    const { ringId } = req.params;
    const {
      site_name,
      site_type = 'Customer',
      latitude,
      longitude,
      address,
      icon_type = 'pushpin',
      icon_color = '#FFFF00',
      icon_size = 32,
      infrastructure_item_id,
      equipment_details,
      power_requirement_kw,
      access_notes,
      sequence_order
    } = req.body;

    // Validate required fields
    if (!site_name || latitude === undefined || longitude === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Site name, latitude, and longitude are required'
      });
    }

    // Verify ring exists
    const [ring] = await pool.query('SELECT id FROM fiber_rings WHERE id = ?', [ringId]);
    if (ring.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Fiber ring not found'
      });
    }

    // Insert site
    const [result] = await pool.query(`
      INSERT INTO fiber_ring_sites (
        ring_id, site_name, site_type, latitude, longitude, address,
        icon_type, icon_color, icon_size,
        infrastructure_item_id, equipment_details,
        power_requirement_kw, access_notes, sequence_order
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      ringId, site_name, site_type, latitude, longitude, address,
      icon_type, icon_color, icon_size,
      infrastructure_item_id, JSON.stringify(equipment_details),
      power_requirement_kw, access_notes, sequence_order
    ]);

    res.status(201).json({
      success: true,
      message: 'Site added successfully',
      site: {
        id: result.insertId,
        site_name,
        latitude,
        longitude
      }
    });
  } catch (error) {
    console.error('Error adding ring site:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add site',
      error: error.message
    });
  }
};

/**
 * @route PUT /api/fiber-rings/sites/:siteId
 * @desc Update site details
 * @access Private (requires fiber.edit permission)
 */
const updateRingSite = async (req, res) => {
  try {
    const { siteId } = req.params;
    const updates = req.body;

    // Get current site
    const [currentSite] = await pool.query('SELECT * FROM fiber_ring_sites WHERE id = ?', [siteId]);

    if (currentSite.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Site not found'
      });
    }

    // Build update query
    const updateFields = [];
    const updateValues = [];

    const allowedFields = [
      'site_name', 'site_type', 'latitude', 'longitude', 'address',
      'icon_type', 'icon_color', 'icon_size',
      'infrastructure_item_id', 'power_requirement_kw', 'access_notes',
      'sequence_order', 'distance_from_start_km'
    ];

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        updateFields.push(`${field} = ?`);
        updateValues.push(updates[field]);
      }
    }

    // Handle equipment_details JSON
    if (updates.equipment_details) {
      updateFields.push('equipment_details = ?');
      updateValues.push(JSON.stringify(updates.equipment_details));
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update'
      });
    }

    updateValues.push(siteId);

    await pool.query(`
      UPDATE fiber_ring_sites
      SET ${updateFields.join(', ')}
      WHERE id = ?
    `, updateValues);

    res.json({
      success: true,
      message: 'Site updated successfully'
    });
  } catch (error) {
    console.error('Error updating ring site:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update site',
      error: error.message
    });
  }
};

/**
 * @route DELETE /api/fiber-rings/sites/:siteId
 * @desc Delete site from fiber ring
 * @access Private (requires fiber.edit permission)
 */
const deleteRingSite = async (req, res) => {
  try {
    const { siteId } = req.params;

    // Check if site exists
    const [site] = await pool.query('SELECT * FROM fiber_ring_sites WHERE id = ?', [siteId]);

    if (site.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Site not found'
      });
    }

    // Delete site
    await pool.query('DELETE FROM fiber_ring_sites WHERE id = ?', [siteId]);

    res.json({
      success: true,
      message: 'Site deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting ring site:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete site',
      error: error.message
    });
  }
};

module.exports = {
  getRingSites,
  addRingSite,
  updateRingSite,
  deleteRingSite
};
