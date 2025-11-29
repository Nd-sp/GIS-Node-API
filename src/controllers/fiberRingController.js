/**
 * Fiber Ring Controller
 * Handles all fiber ring operations (CRUD, import, export, analysis)
 */

const { pool } = require('../config/database');

/**
 * @route GET /api/fiber-rings
 * @desc Get all fiber rings with optional filters
 * @access Private (requires fiber.view permission)
 */
const getAllFiberRings = async (req, res) => {
  try {
    const {
      region_id,
      status,
      owner,
      temporary,
      limit = 50,
      offset = 0
    } = req.query;

    // Build query with filters
    let query = `
      SELECT
        fr.id,
        fr.name,
        fr.description,
        fr.coordinates,
        fr.fiber_type,
        fr.fiber_count,
        fr.capacity_gbps,
        fr.total_length_km,
        fr.line_color,
        fr.line_width,
        fr.line_opacity,
        fr.status,
        fr.owner,
        fr.operator,
        fr.is_temporary,
        fr.region_id,
        fr.created_by,
        fr.created_at,
        fr.updated_at,
        (SELECT COUNT(*) FROM fiber_ring_sites WHERE ring_id = fr.id) as site_count,
        u.username as created_by_username
      FROM fiber_rings fr
      LEFT JOIN users u ON fr.created_by = u.id
      WHERE 1=1
    `;

    const params = [];

    if (region_id) {
      query += ' AND fr.region_id = ?';
      params.push(region_id);
    }

    if (status) {
      query += ' AND fr.status = ?';
      params.push(status);
    }

    if (owner) {
      query += ' AND fr.owner LIKE ?';
      params.push(`%${owner}%`);
    }

    if (temporary !== undefined) {
      query += ' AND fr.is_temporary = ?';
      params.push(temporary === 'true' ? 1 : 0);
    }

    // Get total count
    const countQuery = query.replace(/SELECT.*FROM/s, 'SELECT COUNT(*) as total FROM');
    const [countResult] = await pool.query(countQuery, params);
    const total = countResult[0].total;

    // Add ordering and pagination
    query += ' ORDER BY fr.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const [rings] = await pool.query(query, params);

    res.json({
      success: true,
      rings,
      total,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Error fetching fiber rings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch fiber rings',
      error: error.message
    });
  }
};

/**
 * @route GET /api/fiber-rings/:id
 * @desc Get single fiber ring with full details (including sites)
 * @access Private (requires fiber.view permission)
 */
const getFiberRingById = async (req, res) => {
  try {
    const { id } = req.params;

    // Get ring details
    const [rings] = await pool.query(`
      SELECT
        fr.*,
        u.username as created_by_username,
        u2.username as updated_by_username
      FROM fiber_rings fr
      LEFT JOIN users u ON fr.created_by = u.id
      LEFT JOIN users u2 ON fr.updated_by = u.id
      WHERE fr.id = ?
    `, [id]);

    if (rings.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Fiber ring not found'
      });
    }

    const ring = rings[0];

    // Get sites for this ring
    const [sites] = await pool.query(`
      SELECT *
      FROM fiber_ring_sites
      WHERE ring_id = ?
      ORDER BY sequence_order ASC
    `, [id]);

    ring.sites = sites;

    res.json({
      success: true,
      ring
    });
  } catch (error) {
    console.error('Error fetching fiber ring:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch fiber ring',
      error: error.message
    });
  }
};

/**
 * @route POST /api/fiber-rings
 * @desc Create new fiber ring
 * @access Private (requires fiber.create permission)
 */
const createFiberRing = async (req, res) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const {
      name,
      description,
      coordinates,
      fiber_type = 'Single-mode',
      fiber_count,
      capacity_gbps,
      line_color = '#FF0000',
      line_width = 2,
      line_opacity = 1.00,
      line_dash_pattern = 'solid',
      owner,
      operator,
      vendor,
      status = 'Planned',
      installation_date,
      cost_inr,
      is_temporary = false,
      region_id,
      sites = []
    } = req.body;

    // Validate required fields
    if (!name || !coordinates || coordinates.length < 2) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'Name and at least 2 coordinates are required'
      });
    }

    // Calculate total length
    const total_length_km = calculateTotalLength(coordinates);

    // Insert fiber ring
    const [result] = await connection.query(`
      INSERT INTO fiber_rings (
        name, description, coordinates, total_length_km,
        fiber_type, fiber_count, capacity_gbps,
        line_color, line_width, line_opacity, line_dash_pattern,
        owner, operator, vendor, status, installation_date, cost_inr,
        is_temporary, region_id, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      name, description, JSON.stringify(coordinates), total_length_km,
      fiber_type, fiber_count, capacity_gbps,
      line_color, line_width, line_opacity, line_dash_pattern,
      owner, operator, vendor, status, installation_date, cost_inr,
      is_temporary, region_id, req.user.id
    ]);

    const ringId = result.insertId;

    // Insert sites if provided
    if (sites && sites.length > 0) {
      for (const site of sites) {
        await connection.query(`
          INSERT INTO fiber_ring_sites (
            ring_id, site_name, site_type, latitude, longitude,
            icon_type, icon_color, icon_size, address,
            infrastructure_item_id, equipment_details,
            power_requirement_kw, access_notes, sequence_order
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          ringId, site.site_name, site.site_type || 'Customer',
          site.latitude, site.longitude,
          site.icon_type || 'pushpin', site.icon_color || '#FFFF00',
          site.icon_size || 32, site.address,
          site.infrastructure_item_id, JSON.stringify(site.equipment_details),
          site.power_requirement_kw, site.access_notes, site.sequence_order
        ]);
      }
    }

    // Create history entry
    await connection.query(`
      INSERT INTO fiber_ring_history (ring_id, action, changed_by, change_description, new_values)
      VALUES (?, 'created', ?, ?, ?)
    `, [ringId, req.user.id, `Fiber ring "${name}" created`, JSON.stringify({name, fiber_type, status})]);

    await connection.commit();

    res.status(201).json({
      success: true,
      message: 'Fiber ring created successfully',
      ring: {
        id: ringId,
        name,
        total_length_km
      }
    });
  } catch (error) {
    await connection.rollback();
    console.error('Error creating fiber ring:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create fiber ring',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

/**
 * @route PUT /api/fiber-rings/:id
 * @desc Update existing fiber ring
 * @access Private (requires fiber.edit.own or fiber.edit.any permission)
 */
const updateFiberRing = async (req, res) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const { id } = req.params;
    const updates = req.body;
    const { sites } = req.body; // Extract sites separately

    // Get current ring data
    const [currentRing] = await connection.query('SELECT * FROM fiber_rings WHERE id = ?', [id]);

    if (currentRing.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: 'Fiber ring not found'
      });
    }

    // Recalculate length if coordinates changed
    if (updates.coordinates) {
      updates.total_length_km = calculateTotalLength(updates.coordinates);
      updates.coordinates = JSON.stringify(updates.coordinates);
    }

    // Build update query dynamically
    const updateFields = [];
    const updateValues = [];

    const allowedFields = [
      'name', 'description', 'coordinates', 'total_length_km',
      'fiber_type', 'fiber_count', 'capacity_gbps',
      'line_color', 'line_width', 'line_opacity', 'line_dash_pattern',
      'owner', 'operator', 'vendor', 'status', 'installation_date', 'cost_inr',
      'region_id'
    ];

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        updateFields.push(`${field} = ?`);
        updateValues.push(updates[field]);
      }
    }

    if (updateFields.length === 0 && !sites) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update'
      });
    }

    // Update fiber ring if there are field changes
    if (updateFields.length > 0) {
      // Add updated_by
      updateFields.push('updated_by = ?');
      updateValues.push(req.user.id);
      updateValues.push(id);

      await connection.query(`
        UPDATE fiber_rings
        SET ${updateFields.join(', ')}
        WHERE id = ?
      `, updateValues);
    }

    // ✅ Handle sites update if provided
    if (sites && Array.isArray(sites)) {
      console.log(`🔄 Updating ${sites.length} sites for fiber ring ${id}`);

      // Delete all existing sites for this ring
      await connection.query('DELETE FROM fiber_ring_sites WHERE ring_id = ?', [id]);

      // Insert updated sites
      if (sites.length > 0) {
        for (const site of sites) {
          await connection.query(`
            INSERT INTO fiber_ring_sites (
              ring_id, site_name, site_type, latitude, longitude,
              icon_type, icon_color, icon_size, address,
              infrastructure_item_id, equipment_details,
              power_requirement_kw, access_notes, sequence_order
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            id,
            site.site_name,
            site.site_type || 'Customer',
            site.latitude,
            site.longitude,
            site.icon_type || 'pushpin',
            site.icon_color || '#FFFF00',
            site.icon_size || 32,
            site.address || null,
            site.infrastructure_item_id || null,
            site.equipment_details ? JSON.stringify(site.equipment_details) : null,
            site.power_requirement_kw || null,
            site.access_notes || null,
            site.sequence_order !== undefined ? site.sequence_order : null
          ]);
        }
        console.log(`✅ Successfully updated ${sites.length} sites`);
      }
    }

    // Create history entry
    await connection.query(`
      INSERT INTO fiber_ring_history (ring_id, action, changed_by, change_description, old_values, new_values)
      VALUES (?, 'updated', ?, ?, ?, ?)
    `, [
      id, req.user.id,
      `Fiber ring "${currentRing[0].name}" updated`,
      JSON.stringify(currentRing[0]),
      JSON.stringify(updates)
    ]);

    await connection.commit();

    res.json({
      success: true,
      message: 'Fiber ring updated successfully'
    });
  } catch (error) {
    await connection.rollback();
    console.error('Error updating fiber ring:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update fiber ring',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

/**
 * @route DELETE /api/fiber-rings/:id
 * @desc Delete fiber ring
 * @access Private (requires fiber.delete.own or fiber.delete.any permission)
 */
const deleteFiberRing = async (req, res) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const { id } = req.params;

    // Get ring details for history
    const [ring] = await connection.query('SELECT * FROM fiber_rings WHERE id = ?', [id]);

    if (ring.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: 'Fiber ring not found'
      });
    }

    // Create history entry before deletion
    await connection.query(`
      INSERT INTO fiber_ring_history (ring_id, action, changed_by, change_description, old_values)
      VALUES (?, 'deleted', ?, ?, ?)
    `, [id, req.user.id, `Fiber ring "${ring[0].name}" deleted`, JSON.stringify(ring[0])]);

    // Delete ring (cascade will delete sites, segments, and remaining history)
    await connection.query('DELETE FROM fiber_rings WHERE id = ?', [id]);

    await connection.commit();

    res.json({
      success: true,
      message: 'Fiber ring deleted successfully'
    });
  } catch (error) {
    await connection.rollback();
    console.error('Error deleting fiber ring:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete fiber ring',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

/**
 * Helper function to calculate total length of ring in kilometers
 */
function calculateTotalLength(coordinates) {
  if (!coordinates || coordinates.length < 2) return 0;

  let totalDistance = 0;
  for (let i = 0; i < coordinates.length - 1; i++) {
    const dist = haversineDistance(
      coordinates[i].lat, coordinates[i].lng,
      coordinates[i + 1].lat, coordinates[i + 1].lng
    );
    totalDistance += dist;
  }

  return parseFloat(totalDistance.toFixed(2));
}

/**
 * Haversine formula to calculate distance between two coordinates
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in kilometers
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(degrees) {
  return degrees * (Math.PI / 180);
}

module.exports = {
  getAllFiberRings,
  getFiberRingById,
  createFiberRing,
  updateFiberRing,
  deleteFiberRing
};
